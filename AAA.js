// Egern TestFlight 实测可用性检测（独立脚本版）
// 依赖：$notification, $httpClient 或 $task 或 fetch
// 配合模块使用，环境变量通过 ctx.env 传递

const CONFIG = {
  enableNotification: true,
  notifyWhenUnavailable: false,
  perRequestTimeout: 8000,
  apps: [],
  ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
};

// ============ 环境变量解析 ============
function parseEnvConfig() {
  const env = typeof ctx !== "undefined" && ctx.env ? ctx.env : {};
  
  // 1. 解析通知开关
  if (env.TF_NOTIFY !== undefined) {
    CONFIG.enableNotification = String(env.TF_NOTIFY).toLowerCase() === "true";
  }
  if (env.TF_NOTIFY_UNAVAILABLE !== undefined) {
    CONFIG.notifyWhenUnavailable = String(env.TF_NOTIFY_UNAVAILABLE).toLowerCase() === "true";
  }
  // 2. 解析超时时间
  if (env.TF_TIMEOUT && !isNaN(parseInt(env.TF_TIMEOUT))) {
    CONFIG.perRequestTimeout = parseInt(env.TF_TIMEOUT);
  }
  // 3. 解析 User-Agent
  if (env.TF_USER_AGENT) {
    CONFIG.ua = String(env.TF_USER_AGENT);
  }
  
  // 4. 解析 App 列表（核心）
  if (env.TF_APP_IDS) {
    const val = String(env.TF_APP_IDS).trim();
    try {
      // 尝试按 JSON 数组解析（支持自定义 name）
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        CONFIG.apps = parsed.filter(app => app && app.id).map(app => ({
          name: app.name || `App-${app.id.slice(0,6)}`,
          id: String(app.id).trim()
        }));
      }
    } catch (e) {
      // 降级：按逗号分隔的纯 ID 列表解析
      const ids = val.split(",").map(s => s.trim()).filter(s => s.length > 0);
      CONFIG.apps = ids.map(id => ({
        name: `App-${id.slice(0,6)}`,
        id: id
      }));
    }
  }
  
  console.log(`[TF Monitor] 配置加载：${CONFIG.apps.length} 个应用，通知=${CONFIG.enableNotification}, 超时=${CONFIG.perRequestTimeout}ms`);
}

// ============ 通知函数 ============
function sendNotification(title, subtitle, message, url) {
  if (!CONFIG.enableNotification || typeof $notification === "undefined") return;
  try {
    $notification.post(title, subtitle, message, { url });
  } catch (e) {
    console.log("通知发送失败：" + e);
  }
}

// ============ 通用 GET 请求（带超时保护） ============
function httpGet(url, cb) {
  let finished = false;
  const timer = setTimeout(() => {
    if (finished) return;
    finished = true;
    cb(new Error("request timeout"));
  }, CONFIG.perRequestTimeout);

  const opts = { url: url, headers: { "User-Agent": CONFIG.ua, Accept: "text/html" } };

  if (typeof $httpClient !== "undefined") {
    try {
      $httpClient.get(opts, function (err, resp, body) {
        if (finished) return;
        clearTimeout(timer);
        finished = true;
        cb(err, resp || {}, typeof body === "string" ? body : (body && body.toString ? body.toString() : ""));
      });
      return;
    } catch (e) { /* fallthrough */ }
  }

  if (typeof $task !== "undefined") {
    $task.fetch(opts).then(function (resp) {
      if (finished) return;
      clearTimeout(timer);
      finished = true;
      cb(null, { statusCode: resp.statusCode, headers: resp.headers }, resp.body || "");
    }).catch(function (err) {
      if (finished) return;
      clearTimeout(timer);
      finished = true;
      cb(err);
    });
    return;
  }

  if (typeof fetch !== "undefined") {
    fetch(url, { headers: { "User-Agent": CONFIG.ua } }).then(function (res) {
      res.text().then(function (txt) {
        if (finished) return;
        clearTimeout(timer);
        finished = true;
        cb(null, { statusCode: res.status }, txt);
      }).catch(function (err) {
        if (finished) return;
        clearTimeout(timer);
        finished = true;
        cb(err);
      });
    }).catch(function (err) {
      if (finished) return;
      clearTimeout(timer);
      finished = true;
      cb(err);
    });
    return;
  }

  clearTimeout(timer);
  cb(new Error("no http client available"));
}

// ============ 检查单个 App ============
function checkApp(app, done) {
  const url = `https://testflight.apple.com/join/${app.id}`;
  console.log(`[TF Monitor] 检查 ${app.name} -> ${url}`);

  httpGet(url, function (err, resp, body) {
    if (err) {
      console.log(`[TF Monitor] 请求失败：${err}`);
      if (CONFIG.notifyWhenUnavailable) sendNotification("TestFlight 监控", app.name, `请求失败：${err}`, url);
      return done();
    }

    const text = (body || "").toLowerCase();

    // 可加入 & 已满 的关键字
    const availableKeywords = ["itms-beta://", "open in testflight", "join the beta", "start testing", "accept invite", "加入测试", "开始测试", "在 testflight 中打开", "open the testflight"];
    const fullKeywords = ["this beta is full", "beta is full", "测试人员已满", "测试已满", "本次测试已满", "名额已满", "无可用名额", "full"];

    let isAvailable = false;
    let isFull = false;

    for (const k of availableKeywords) if (text.indexOf(k) !== -1) { isAvailable = true; break; }
    for (const k of fullKeywords) if (text.indexOf(k) !== -1) { isFull = true; break; }

    // 双重保底：itms-beta 协议基本可判为可加入
    if (text.indexOf("itms-beta://") !== -1) isAvailable = true;

    if (isAvailable && !isFull) {
      console.log(`[TF Monitor] ✅ ${app.name} 似乎有名额，发送通知`);
      sendNotification("🎉 TestFlight 可加入", app.name, "点击打开 TestFlight 加入测试", url);
    } else {
      console.log(`[TF Monitor] ⏳ ${app.name} 暂无名额 (available=${isAvailable}, full=${isFull})`);
      if (CONFIG.notifyWhenUnavailable) {
        sendNotification("TestFlight 监控", app.name, "当前无名额或无法确认", url);
      }
    }

    // 调试：无法判断时输出页面片段
    if (!isAvailable && !isFull) {
      console.log("[TF Monitor] ⚠️ 无法明确判断，页面片段：\n" + (text.substr(0, 600)));
    }

    done();
  });
}

// ============ 主入口 ============
(function main() {
  // 1. 解析环境变量配置
  parseEnvConfig();
  
  // 2. 校验配置
  if (CONFIG.apps.length === 0) {
    console.log("[TF Monitor] ❌ 未配置任何 App ID，请在模块设置中填写 TF_APP_IDS");
    if (CONFIG.enableNotification && typeof $notification !== "undefined") {
      $notification.post("TestFlight 监控", "配置错误", "请在模块设置中填写 TF_APP_IDS 环境变量", "");
    }
    return;
  }
  
  console.log(`[TF Monitor] 🚀 启动，共检查 ${CONFIG.apps.length} 个应用`);
  
  // 3. 顺序执行检查（避免并发超时）
  let idx = 0;
  function next() {
    if (idx >= CONFIG.apps.length) {
      console.log("[TF Monitor] ✨ 全部检查完成");
      return;
    }
    const app = CONFIG.apps[idx++];
    checkApp(app, next);
  }
  next();
})();

