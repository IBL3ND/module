const args = (() => {
  try { return JSON.parse($argument || "{}"); } catch (e) {
    // 兼容老版本 argument 为 query-string 的情况
    const q = ($argument || "").split("&").reduce((o, kv) => {
      const [k, v] = kv.split("=");
      if (k) o[k] = decodeURIComponent(v || "");
      return o;
    }, {});
    return q;
  }
})();

const CONFIG = {
  enableNotification: true,
  notifyWhenUnavailable: (args.notifyWhenUnavailable === "true"),
  perRequestTimeout: 8000,
  apps: [],
  ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  intervalSeconds: Number(args.intervalSeconds) || 60,
  maxRuntimeHours: Number(args.maxRuntimeHours) || 0 // 0 = unlimited
};

if (args.ids) {
  CONFIG.apps = args.ids
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(id => ({ id }));
} else {
  CONFIG.apps = [];
}

function sendNotification(title, subtitle, message, url) {
  if (!CONFIG.enableNotification || typeof $notification === "undefined") return;
  try {
    $notification.post(title, subtitle, message, { url });
  } catch (e) {
    console.log("通知发送失败: " + e);
  }
}

function httpGetPromise(url) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      reject(new Error("request timeout"));
    }, CONFIG.perRequestTimeout);

    const opts = { url, headers: { "User-Agent": CONFIG.ua, Accept: "text/html" } };

    if (typeof $httpClient !== "undefined") {
      try {
        $httpClient.get(opts, function (err, resp, body) {
          if (finished) return;
          clearTimeout(timer);
          finished = true;
          if (err) return reject(err);
          resolve({ statusCode: resp && resp.status || resp && resp.statusCode || 0, headers: resp && resp.headers, body: typeof body === "string" ? body : (body && body.toString ? body.toString() : "") });
        });
        return;
      } catch (e) {
        // fallthrough
      }
    }

    if (typeof $task !== "undefined") {
      $task.fetch(opts).then(function (res) {
        if (finished) return;
        clearTimeout(timer);
        finished = true;
        resolve({ statusCode: res.statusCode || res.status, headers: res.headers, body: res.body || "" });
      }).catch(function (err) {
        if (finished) return;
        clearTimeout(timer);
        finished = true;
        reject(err);
      });
      return;
    }

    if (typeof fetch !== "undefined") {
      fetch(url, { headers: { "User-Agent": CONFIG.ua } }).then(function (res) {
        res.text().then(function (txt) {
          if (finished) return;
          clearTimeout(timer);
          finished = true;
          resolve({ statusCode: res.status, headers: res.headers, body: txt });
        }).catch(function (err) {
          if (finished) return;
          clearTimeout(timer);
          finished = true;
          reject(err);
        });
      }).catch(function (err) {
        if (finished) return;
        clearTimeout(timer);
        finished = true;
        reject(err);
      });
      return;
    }

    clearTimeout(timer);
    finished = true;
    reject(new Error("no http client available"));
  });
}

function analyzeBodyForAvailability(body) {
  const text = (body || "").toLowerCase();
  const availableKeywords = [
    "itms-beta://", "open in testflight", "join the beta",
    "start testing", "accept invite", "加入测试",
    "开始测试", "在 testflight 中打开"
  ];
  const fullKeywords = [
    "this beta is full", "beta is full", "测试人员已满",
    "测试已满", "本次测试已满", "名额已满", "无可用名额", "full"
  ];

  let isAvailable = availableKeywords.some(k => text.includes(k));
  let isFull = fullKeywords.some(k => text.includes(k));
  if (text.includes("itms-beta://")) isAvailable = true;
  return { isAvailable, isFull };
}

async function checkAppOnce(app) {
  const url = `https://testflight.apple.com/join/${app.id}`;
  console.log(`[TF Monitor] 检查 ${app.id} -> ${url} (${new Date().toLocaleString()})`);
  try {
    const res = await httpGetPromise(url);
    const { body } = res;
    const { isAvailable, isFull } = analyzeBodyForAvailability(body);
    if (isAvailable && !isFull) {
      console.log(`[TF Monitor] ${app.id} 有名额 ✅`);
      sendNotification("TestFlight 名额可用", `App ID: ${app.id}`, "点击加入测试", url);
      return { id: app.id, status: "available" };
    } else {
      console.log(`[TF Monitor] ${app.id} 暂无名额`);
      if (CONFIG.notifyWhenUnavailable) sendNotification("TestFlight 监控", `App ID: ${app.id}`, "当前无名额", url);
      return { id: app.id, status: "full" };
    }
  } catch (err) {
    console.log(`[TF Monitor] ${app.id} 请求失败: ${err}`);
    if (CONFIG.notifyWhenUnavailable) sendNotification("TestFlight 监控", `App ID: ${app.id}`, `请求失败: ${err}`, url);
    return { id: app.id, status: "error", error: String(err) };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLoop() {
  if (!CONFIG.apps || CONFIG.apps.length === 0) {
    console.log("[TF Monitor] 未添加任何 TestFlight ID，退出");
    return;
  }

  console.log(`[TF Monitor] 实时监控启动（间隔 ${CONFIG.intervalSeconds}s）`);
  const startTs = Date.now();
  const maxMs = CONFIG.maxRuntimeHours > 0 ? CONFIG.maxRuntimeHours * 3600 * 1000 : 0;

  while (true) {
    for (const app of CONFIG.apps) {
      await checkAppOnce(app);
    }

    // 检查是否达到最大运行时间
    if (maxMs > 0 && (Date.now() - startTs) >= maxMs) {
      console.log("[TF Monitor] 达到最大运行时间，停止监控");
      return;
    }

    // 等待下次轮询
    await sleep(CONFIG.intervalSeconds * 1000);
    // 循环继续 -> 实时监控效果
  }
}

// 启动主循环（异步）
runLoop().catch(err => {
  console.log("[TF Monitor] 未捕获异常，停止: " + err);
});