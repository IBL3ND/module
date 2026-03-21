/**
 * 📱 TestFlight 监控（Egern 稳定完整版）
 * ✅ 支持多ID
 * ✅ 支持备注
 * ✅ 修复异步问题（不会漏通知）
 * ✅ 防止重复通知（可选）
 */

const TF_APP_ID = $persistentStore.read("TF_APP_ID");
const CACHE_KEY = "TF_CACHE"; // 防重复通知缓存

const UA_LIST = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_6) AppleWebKit/537.36 Chrome/140 Safari/537.36"
];

function getUA() {
  return UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
}

// 读取缓存（防重复推送）
function getCache() {
  try {
    return JSON.parse($persistentStore.read(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

// 写入缓存
function setCache(data) {
  $persistentStore.write(JSON.stringify(data), CACHE_KEY);
}

// HTTP Promise封装（关键）
function httpGet(options) {
  return new Promise((resolve) => {
    $httpClient.get(options, (err, resp, body) => {
      resolve({ err, resp, body });
    });
  });
}

// 主函数
(async () => {

  if (!TF_APP_ID) {
    $notification.post("❌ TF监控", "", "未设置 TF_APP_ID");
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

    const { err, resp, body } = await httpGet({
      url,
      headers: { "User-Agent": getUA() }
    });

    if (!resp) continue;

    // 状态判断
    if (resp.status === 404) {
      console.log(`[${name}] 不存在`);
      continue;
    }

    if (resp.status !== 200) {
      console.log(`[${name}] 状态异常: ${resp.status}`);
      continue;
    }

    let status = "unknown";

    if (/已满|This beta is full/.test(body)) {
      status = "full";
    } else if (/不接受|isn't accepting/.test(body)) {
      status = "closed";
    } else {
      status = "open";
    }

    console.log(`[${name}] 状态: ${status}`);

    // ✅ 可加入才通知
    if (status === "open") {

      // 防重复通知（同一个ID不重复推）
      if (cache[appId] === "open") {
        console.log(`[${name}] 已通知过，跳过`);
        continue;
      }

      cache[appId] = "open";
      setCache(cache);

      $notification.post(
        "🎉 TestFlight 有名额！",
        name,
        "点击立即加入",
        {
          url: url
        }
      );
    } else {
      // 状态变回关闭 → 清缓存（下次还能通知）
      cache[appId] = status;
      setCache(cache);
    }

  }

  $done();

})();