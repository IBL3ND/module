/**
 * 🚀 TestFlight 极限监控
 * ✅ 使用 ctx.env 读取变量
 * ✅ 有名额就通知
 */

export default async function(ctx) {

  // ========= 读取环境变量（官方方式） =========
  const raw = ctx.env?.TF_APP_ID;
  const TF_APP_ID = raw ? raw.trim() : "";

  console.log("原始变量:", raw);
  console.log("处理后:", TF_APP_ID);

  // ========= 校验 =========
  if (!TF_APP_ID) {
    $notification.post("❌ TF监控", "", "未设置 TF_APP_ID");
    return;
  }

  // ========= UA =========
  const UA_LIST = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/140 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 Chrome/140 Safari/537.36"
  ];

  function getUA() {
    return UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
  }

  // ========= 请求函数 =========
  function httpGet(options) {
    return new Promise(resolve => {
      $httpClient.get(options, (err, resp, body) => {
        resolve({ err, resp, body });
      });
    });
  }

  // ========= 支持多个 =========
  const list = TF_APP_ID
    .split(/[\n,]/)
    .map(i => i.trim())
    .filter(Boolean);

  for (let item of list) {

    let appId = item;
    let name = item;

    // 支持备注
    if (item.includes("#")) {
      appId = item.split("#")[0].trim();
      name = item.split("#")[1].trim();
    }

    const url = `https://testflight.apple.com/join/${appId}`;

    const { resp, body } = await httpGet({
      url,
      headers: { "User-Agent": getUA() }
    });

    if (!resp) {
      console.log(`[${name}] ❌ 请求失败`);
      continue;
    }

    if (resp.status === 404) {
      console.log(`[${name}] ❌ 不存在`);
      continue;
    }

    if (resp.status !== 200) {
      console.log(`[${name}] ⚠️ 状态异常: ${resp.status}`);
      continue;
    }

    // ========= 状态判断 =========
    if (/已满|This beta is full/.test(body)) {
      console.log(`[${name}] 🚫 已满`);
    }
    else if (/不接受|isn't accepting/.test(body)) {
      console.log(`[${name}] 🚫 未开放`);
    }
    else {
      console.log(`[${name}] 🚀 有名额！！！`);

      // 🔥 通知
      $notification.post(
        "🚀 TestFlight 有位置！！！",
        name,
        "点击进入抢名额",
        { url }
      );
    }
  }

}