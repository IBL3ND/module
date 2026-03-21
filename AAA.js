/**
 * 🚀 TF监控（终极兼容版）
 */

export default async function(ctx) {

  // ========= 多方式读取 =========
  let TF_APP_ID =
    (ctx?.env?.TF_APP_ID) ||
    $persistentStore.read("TF_APP_ID") ||
    ($argument && $argument.match(/TF_APP_ID=([^&]+)/)?.[1]) ||
    "";

  TF_APP_ID = TF_APP_ID.trim();

  console.log("最终TF_APP_ID:", TF_APP_ID);

  if (!TF_APP_ID) {
    $notification.post("❌ TF监控", "", "未设置 TF_APP_ID");
    return;
  }

  const list = TF_APP_ID.split(/[\n,]/).map(i => i.trim()).filter(Boolean);

  function httpGet(options) {
    return new Promise(resolve => {
      $httpClient.get(options, (err, resp, body) => {
        resolve({ resp, body });
      });
    });
  }

  for (let item of list) {

    let appId = item;
    let name = item;

    if (item.includes("#")) {
      appId = item.split("#")[0].trim();
      name = item.split("#")[1].trim();
    }

    const url = `https://testflight.apple.com/join/${appId}`;

    const { resp, body } = await httpGet({ url });

    if (!resp || resp.status !== 200) continue;

    if (/已满|full/.test(body)) {
      console.log(`[${name}] 已满`);
    }
    else if (/not accepting/.test(body)) {
      console.log(`[${name}] 未开放`);
    }
    else {
      console.log(`[${name}] 🚀 有位置！！！`);

      $notification.post(
        "🚀 TF有名额！！！",
        name,
        "点我立刻加入",
        { url }
      );
    }
  }
}