// Egern TestFlight 实时监控模块
// 支持参数配置和持续监控

const DEFAULT_CONFIG = {
enableNotification: true,
notifyWhenUnavailable: false,
perRequestTimeout: 8000,
checkInterval: 10, // 检查间隔（秒）
maxRunTime: 3600, // 最大运行时间（秒）
ua: “Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1”
};

let startTime = Date.now();
let totalChecks = 0;
let config = Object.assign({}, DEFAULT_CONFIG);

// 解析参数
function parseArguments() {
if (typeof $argument === “undefined” || !$argument) {
console.log(“⚠️ 未提供参数，使用默认配置”);
return;
}

console.log(“📝 原始参数: “ + $argument);

// 解析参数
const params = {};
$argument.split(”&”).forEach(pair => {
const [key, value] = pair.split(”=”);
if (key && value) {
params[key.trim()] = decodeURIComponent(value.trim());
}
});

console.log(“✅ 解析后参数:”, JSON.stringify(params));

// 读取配置
if (params.notifyWhenUnavailable === “true”) {
config.notifyWhenUnavailable = true;
}

if (params.interval && !isNaN(params.interval)) {
config.checkInterval = Math.max(5, parseInt(params.interval));
}

if (params.maxRunTime && !isNaN(params.maxRunTime)) {
const maxRunTimeValue = parseInt(params.maxRunTime);
// 如果设置为 0 则表示无限运行
config.maxRunTime = maxRunTimeValue === 0 ? Infinity : maxRunTimeValue * 60;
}

if (params.timeout && !isNaN(params.timeout)) {
config.perRequestTimeout = parseInt(params.timeout) * 1000;
}
}

// 获取 TestFlight ID 列表
function getAppIds() {
let ids = [];

if (typeof $argument !== “undefined” && $argument) {
const params = {};
$argument.split(”&”).forEach(pair => {
const [key, value] = pair.split(”=”);
if (key && value) {
params[key.trim()] = decodeURIComponent(value.trim());
}
});

```
if (params.ids) {
  ids = params.ids.split(",").map(id => id.trim()).filter(id => id);
}
```

}

if (ids.length === 0) {
console.log(“⚠️ 未提供 TestFlight ID，使用示例 ID”);
ids = [“wUz8czx3”];
}

console.log(“📱 TestFlight IDs:”, ids);
return ids.map(id => ({ id }));
}

// 发送通知
function sendNotification(title, subtitle, message, url) {
if (!config.enableNotification) return;

try {
if (typeof $notification !== “undefined”) {
$notification.post(title, subtitle, message, { url });
console.log(`✅ 通知已发送: ${title}`);
} else if (typeof $notify !== “undefined”) {
$notify(title, subtitle, message, { url });
console.log(`✅ 通知已发送: ${title}`);
} else {
console.log(“⚠️ 通知功能不可用”);
}
} catch (e) {
console.log(`❌ 通知发送失败: ${e}`);
}
}

// HTTP GET 请求
function httpGet(url, cb) {
let finished = false;
const timer = setTimeout(() => {
if (finished) return;
finished = true;
cb(new Error(“请求超时”));
}, config.perRequestTimeout);

const opts = {
url: url,
headers: {
“User-Agent”: config.ua,
“Accept”: “text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8”,
“Accept-Language”: “zh-CN,zh;q=0.9,en;q=0.8”
}
};

// 优先使用 $httpClient
if (typeof $httpClient !== “undefined”) {
$httpClient.get(opts, (err, resp, body) => {
if (finished) return;
clearTimeout(timer);
finished = true;
cb(err, resp || {}, body || “”);
});
return;
}

// Quantumult X
if (typeof $task !== “undefined”) {
$task.fetch(opts).then(resp => {
if (finished) return;
clearTimeout(timer);
finished = true;
cb(null, { statusCode: resp.statusCode }, resp.body || “”);
}).catch(err => {
if (finished) return;
clearTimeout(timer);
finished = true;
cb(err);
});
return;
}

// Fetch API
if (typeof fetch !== “undefined”) {
fetch(url, { headers: opts.headers })
.then(res => res.text().then(txt => ({ status: res.status, body: txt })))
.then(result => {
if (finished) return;
clearTimeout(timer);
finished = true;
cb(null, { statusCode: result.status }, result.body);
})
.catch(err => {
if (finished) return;
clearTimeout(timer);
finished = true;
cb(err);
});
return;
}

clearTimeout(timer);
cb(new Error(“无可用的 HTTP 客户端”));
}

// 检查单个应用
function checkApp(app, done) {
const url = `https://testflight.apple.com/join/${app.id}`;
const checkNum = totalChecks + 1;
const currentTime = new Date().toLocaleTimeString(“zh-CN”);

console.log(`\n🔍 [检查 #${checkNum}] ${app.id} [${currentTime}]`);

httpGet(url, (err, resp, body) => {
if (err) {
console.log(`❌ 请求失败: ${err.message}`);
if (config.notifyWhenUnavailable) {
sendNotification(
“TestFlight 检查失败”,
`App ID: ${app.id}`,
`错误: ${err.message}`,
url
);
}
return done();
}

```
const statusCode = resp.statusCode || 200;

if (statusCode !== 200) {
  console.log(`⚠️ 异常状态码: ${statusCode}`);
  if (config.notifyWhenUnavailable) {
    sendNotification(
      "TestFlight 访问异常",
      `App ID: ${app.id}`,
      `HTTP ${statusCode}`,
      url
    );
  }
  return done();
}

const text = (body || "").toLowerCase();

// 可用关键词
const availableKeywords = [
  "itms-beta://",
  "open in testflight",
  "join the beta",
  "start testing",
  "accept invite",
  "加入测试",
  "开始测试",
  "在 testflight 中打开"
];

// 已满关键词
const fullKeywords = [
  "this beta is full",
  "beta is full",
  "测试人员已满",
  "测试已满",
  "本次测试已满",
  "名额已满",
  "无可用名额",
  "no longer accepting"
];

let isAvailable = false;
let isFull = false;

for (const keyword of availableKeywords) {
  if (text.includes(keyword)) {
    isAvailable = true;
    break;
  }
}

for (const keyword of fullKeywords) {
  if (text.includes(keyword)) {
    isFull = true;
    break;
  }
}

if (isAvailable && !isFull) {
  console.log(`🎉🎉🎉 ${app.id} 有名额可用！`);
  sendNotification(
    "🎉 TestFlight 名额来了！",
    `App ID: ${app.id}`,
    `发现时间: ${currentTime}\n点击立即加入测试 →`,
    url
  );
} else if (isFull) {
  console.log(`😔 ${app.id} 暂无名额`);
  if (config.notifyWhenUnavailable) {
    sendNotification(
      "TestFlight 暂无名额",
      `App ID: ${app.id}`,
      "继续监控中...",
      url
    );
  }
} else {
  console.log(`❓ ${app.id} 状态未知`);
}

done();
```

});
}

// 检查所有应用
function checkAllApps(apps, callback) {
let idx = 0;

function next() {
if (idx >= apps.length) {
totalChecks++;
return callback();
}

```
const app = apps[idx++];
checkApp(app, next);
```

}

next();
}

// 主函数
function main() {
parseArguments();

console.log(”=”.repeat(60));
console.log(“🚀 Egern TestFlight 实时监控启动”);
console.log(”=”.repeat(60));

const apps = getAppIds();
console.log(`📋 监控应用数量: ${apps.length}`);
console.log(`⏱️  检查间隔: ${config.checkInterval} 秒`);
console.log(`⏰ 最大运行: ${config.maxRunTime === Infinity ? "无限运行 ♾️" : config.maxRunTime / 60 + " 分钟"}`);
console.log(`🔔 通知设置: ${config.enableNotification ? "已启用" : "已禁用"}`);
console.log(`📢 无名额通知: ${config.notifyWhenUnavailable ? "已启用" : "已禁用"}`);
console.log(”=”.repeat(60));

// 检查是否超时
function shouldContinue() {
// 如果 maxRunTime 是 Infinity（无限），直接返回 true
if (config.maxRunTime === Infinity) {
return true;
}

```
const runTime = (Date.now() - startTime) / 1000;
if (runTime >= config.maxRunTime) {
  console.log("\n" + "=".repeat(60));
  console.log(`⏰ 已达到最大运行时间 (${config.maxRunTime / 60} 分钟)`);
  console.log(`📊 总共检查: ${totalChecks} 轮`);
  console.log("=".repeat(60));
  
  if (typeof $done !== "undefined") {
    $done();
  }
  return false;
}
return true;
```

}

// 循环检查
function loop() {
if (!shouldContinue()) return;

```
const runTime = Math.floor((Date.now() - startTime) / 1000);
console.log(`\n⏰ 已运行: ${runTime}秒 | 已检查: ${totalChecks} 轮`);

checkAllApps(apps, () => {
  if (!shouldContinue()) return;
  
  console.log(`💤 等待 ${config.checkInterval} 秒...`);
  setTimeout(loop, config.checkInterval * 1000);
});
```

}

// 开始循环
loop();
}

// 启动
main();