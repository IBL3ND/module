/**
 * 🚀 TestFlight 极限监控版
 * ⚠️ 有名额就一直弹通知（不会停止）
 */

// ========= 参数 =========
function getArgs(str) {
  let obj = {};
  if (!str) return obj;
  str.split("&").forEach(i => {
    let [k, v] = i.split("=");
    obj[k] = decodeURIComponent(v);
  });
  return obj;
}

const args = getArgs(typeof $argument !== "undefined" ? $argument : "");

const TF_APP_ID =
  args.TF_APP_ID ||
  $persistentStore.read("TF_APP_ID") ||
  "";

const NOTIFY =
  args.Notify ||
  $persistentStore.read("TF_NOTIFY") ||
  "开启通知";

// ========= UA =========
const UA_LIST = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/140",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) Chrome/140"
];

function getUA() {
  return UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
}

// ========= HTTP =========
function httpGet(options) {
  return new Promise(resolve => {
    $httpClient.get(options, (err, resp, body) => {
      resolve({ resp, body });
    });
  });
}

// ========= 主逻辑 =========
(async () => {

  if (!TF_APP_ID) {
    $notification.post("❌ TF监控", "", "未设置 TF_APP_ID");
    $done();
    return;
  }

  const list = TF_APP_ID.split(/[\n,]/).map(i => i.trim()).filter(Boolean);

  for (let item of list) {

    let appId = item;
    let name = item;

    if (item.includes("#")) {
      appId = item.split("#")[0];
      name = item.split("#")[1];
    }

    const url = `https://testflight.apple.com/join/${appId}`;

    const { resp, body } = await httpGet({
      url,
      headers: { "User-Agent": getUA() }
    });

    if (!resp || resp.status !== 200) continue;

    // ========= 状态判断 =========
    if (/已满|This beta is full/.test(body)) {
      console.log(`[${name}] 已满`);
    }
    else if (/不接受|isn't accepting/.test(body)) {
      console.log(`[${name}] 未开放`);
    }
    else {
      console.log(`[${name}] 🚀 有名额！！！`);

      if (NOTIFY !== "关闭通知") {
        $notification.post(
          "🚀 TF有位置！！！",
          name,
          "狂点进入抢名额！！！",
          { url }
        );
      }
    }
  }

  $done();

})();