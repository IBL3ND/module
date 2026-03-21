/**
 * 📱 TestFlight 监控（Egern 参数版）
 */

const args = getArgs($argument);

const TF_APP_ID = args.TF_APP_ID || "";
const NOTIFY = args.Notify || "开启通知";

const CACHE_KEY = "TF_CACHE";

const UA_LIST = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 Chrome/140 Safari/537.36"
];

function getUA() {
  return UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
}

function getArgs(str) {
  let obj = {};
  if (!str) return obj;
  str.split("&").forEach(i => {
    let [k, v] = i.split("=");
    obj[k] = decodeURIComponent(v);
  });
  return obj;
}

function httpGet(options) {
  return new Promise(resolve => {
    $httpClient.get(options, (err, resp, body) => {
      resolve({ err, resp, body });
    });
  });
}

function getCache() {
  try {
    return JSON.parse($persistentStore.read(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setCache(data) {
  $persistentStore.write(JSON.stringify(data), CACHE_KEY);
}

(async () => {

  if (!TF_APP_ID) {
    console.log("❌ 未填写 TF_APP_ID");
    $done();
    return;
  }

  const list = TF_APP_ID.split(/[\n,]/).map(i => i.trim()).filter(Boolean);
  const cache = getCache();

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

    if (!resp) continue;

    if (resp.status !== 200) continue;

    let status = "open";

    if (/已满|This beta is full/.test(body)) {
      status = "full";
    } else if (/不接受|isn't accepting/.test(body)) {
      status = "closed";
    }

    console.log(`[${name}] 状态: ${status}`);

    if (status === "open") {

      if (cache[appId] === "open") continue;

      cache[appId] = "open";
      setCache(cache);

      if (NOTIFY !== "关闭通知") {
        $notification.post(
          "🎉 TestFlight 有名额！",
          name,
          "点击加入",
          { url }
        );
      }

    } else {
      cache[appId] = status;
      setCache(cache);
    }
  }

  $done();

})();