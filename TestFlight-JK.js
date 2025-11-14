// ---------- 参数处理 ----------
const args = (() => {
  try { return JSON.parse($argument || "{}"); } catch (e) {
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
  intervalSeconds: Number(args.intervalSeconds) || 60
};

if (args.ids) {
  CONFIG.apps = args.ids
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(id => ({ id }));
}


// ---------- 通知 ----------
function sendNotification(title, subtitle, message, url) {
  if (!CONFIG.enableNotification || typeof $notification === "undefined") return;
  try {
    $notification.post(title, subtitle, message, { url });
  } catch (e) {
    console.log("通知发送失败: " + e);
  }
}


// ---------- HTTP ----------
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
          resolve({
            statusCode: resp?.status || resp?.statusCode || 0,
            headers: resp?.headers,
            body: typeof body === "string" ? body :
              body?.toString ? body.toString() : ""
          });
        });
        return;
      } catch (e) {}
    }

    if (typeof $task !== "undefined") {
      $task.fetch(opts).then(res => {
        if (finished) return;
        clearTimeout(timer);
        finished = true;
        resolve({
          statusCode: res.statusCode || res.status,
          headers: res.headers,
          body: res.body || ""
        });
      }).catch(err => {
        if (finished) return;
        clearTimeout(timer);
        finished = true;
        reject(err);
      });
      return;
    }

    if (typeof fetch !== "undefined") {
      fetch(url, { headers: { "User-Agent": CONFIG.ua } })
        .then(res => res.text().then(txt => {
          if (finished) return;
          clearTimeout(timer);
          finished = true;
          resolve({
            statusCode: res.status,
            headers: res.headers,
            body: txt
          });
        }))
        .catch(err => {
          if (finished) return;
          clearTimeout(timer);
          finished = true;
          reject(err);
        });
      return;
    }

    clearTimeout(timer);
    reject(new Error("no http client available"));
  });
}


// ---------- 判断可用 ----------
function analyzeBody(body) {
  const text = (body || "").toLowerCase();
  const available = [
    "itms-beta://", "open in testflight", "join the beta",
    "start testing", "accept invite", "加入测试",
    "开始测试", "在 testflight 中打开"
  ];
  const full = [
    "this beta is full", "beta is full", "测试人员已满",
    "测试已满", "本次测试已满", "名额已满", "无可用名额", "full"
  ];
  return {
    isAvailable: available.some(k => text.includes(k)),
    isFull: full.some(k => text.includes(k))
  };
}


// ---------- 单次检查 ----------
async function checkApp(app) {
  const url = `https://testflight.apple.com/join/${app.id}`;
  console.log(`[TF] 检查: ${app.id} (${new Date().toLocaleString()})`);

  try {
    const res = await httpGetPromise(url);
    const { isAvailable, isFull } = analyzeBody(res.body);

    if (isAvailable && !isFull) {
      console.log(`[TF] ${app.id} 有名额！`);
      sendNotification("TestFlight 名额可用", `App ID: ${app.id}`, "点击加入测试", url);
    } else {
      console.log(`[TF] ${app.id} 暂无名额`);
      if (CONFIG.notifyWhenUnavailable) {
        sendNotification("TestFlight 监控", `App ID: ${app.id}`, "当前无名额", url);
      }
    }
  } catch (err) {
    console.log(`[TF] ${app.id} 请求失败: ${err}`);
    if (CONFIG.notifyWhenUnavailable) {
      sendNotification("TestFlight 监控", `App ID: ${app.id}`, `请求失败: ${err}`, url);
    }
  }
}


// ---------- sleep ----------
function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}


// ---------- 主监控循环（永驻 + 不阻塞） ----------
async function monitorLoop() {
  console.log(`[TF] 实时监控启动（间隔 ${CONFIG.intervalSeconds}s）`);

  while (true) {
    for (const app of CONFIG.apps) {
      checkApp(app); // 不 await，保持事件循环活跃
    }
    await sleep(CONFIG.intervalSeconds * 1000);
  }
}


// ---------- 保持事件循环永活，防止 Egern 调度 ----------
function keepAliveLoop() {
  setInterval(() => {}, 1000);  // 永不退出
}


// ---------- 启动 ----------
keepAliveLoop();
monitorLoop();