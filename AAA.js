/**
 * 🚀 TF监控（参数版）
 */

// 📥 从 $argument 接收模块参数
const TF_APP_ID = $argument || "";

console.log("🔍 读取到的参数:", TF_APP_ID);

if (!TF_APP_ID) {
  $notification.post("❌ TF监控", "", "请在模块参数中填写 App ID");
  $done();
  return;
}

// 🔀 支持多应用：换行/逗号分隔
const list = TF_APP_ID.split(/[\n,]/).map(i => i.trim()).filter(Boolean);
console.log(`📋 监控列表: ${JSON.stringify(list)}`);

// 🌐 HTTP GET 封装
function httpGet(options) {
  return new Promise(resolve => {
    $httpClient.get(options, (err, resp, body) => {
      resolve({ resp, body });
    });
  });
}

// 🔄 主逻辑
(async () => {
  for (let item of list) {
    let appId = item;
    let name = item;

    if (item.includes("#")) {
      appId = item.split("#")[0].trim();
      name = item.split("#").slice(1).join("#").trim() || appId;
    }

    const url = `https://testflight.apple.com/join/${appId}`;
    console.log(`🔗 检查: [${name}]`);

    const { resp, body } = await httpGet({ 
      url,
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }
    });

    if (!resp || resp.status !== 200) continue;

    if (/已满|full|Full|FULL/.test(body)) {
      console.log(`🔴 [${name}] 已满员`);
    }
    else if (/not accepting|Not Accepting|测试已结束/.test(body)) {
      console.log(`🟡 [${name}] 未开放`);
    }
    else if (/加入测试|Join Test|您已加入/.test(body)) {
      console.log(`🟢 [${name}] 🚀 有位置！`);
      $notification.post("🚀 TestFlight 有名额！！！", name, "点击立即加入", { url, "open-url": url });
    }
    else {
      console.log(`❓ [${name}] 状态未知`);
    }
  }
  $done();
})();

