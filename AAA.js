/**
 * 🚀 TF监控（Egern兼容版）
 * ✅ 支持 $argument 传参（推荐）
 * ✅ 兼容 $persistentStore 读取
 * ✅ 添加调试日志，方便排查
 * ✅ cron 100%执行
 */

// 🔍 调试：打印所有可用变量
console.log("🔍 [DEBUG] $argument:", typeof $argument !== 'undefined' ? JSON.stringify($argument) : '未定义');
console.log("🔍 [DEBUG] persistentStore.TF_APP_ID:", $persistentStore.read("TF_APP_ID"));

// 📥 读取配置：优先 argument，其次 persistentStore
let TF_APP_ID = "";

if (typeof $argument !== 'undefined' && $argument?.TF_APP_ID) {
  TF_APP_ID = $argument.TF_APP_ID;
  console.log("📥 读取来源: $argument");
} else {
  TF_APP_ID = $persistentStore.read("TF_APP_ID") || "";
  console.log("📥 读取来源: persistentStore");
}

console.log("✅ 最终 TF_APP_ID:", TF_APP_ID);

if (!TF_APP_ID) {
  $notification.post("❌ TF监控配置错误", "", "请在模块参数或持久化存储中设置 TF_APP_ID");
  $done();
  return;
}

// 🔀 支持多应用：换行/逗号分隔
const list = TF_APP_ID.split(/[\n,]/).map(i => i.trim()).filter(Boolean);

console.log(`📋 监控列表: ${JSON.stringify(list)}`);

// 🌐 封装 HTTP GET
function httpGet(options) {
  return new Promise(resolve => {
    $httpClient.get(options, (err, resp, body) => {
      if (err) {
        console.log("❌ 请求错误:", err);
        resolve({ resp: null, body: "" });
      } else {
        resolve({ resp, body });
      }
    });
  });
}

// 🔄 主逻辑
(async () => {

  for (let item of list) {
    let appId = item;
    let name = item;

    // 🔖 支持 名称自定义：appId#名称
    if (item.includes("#")) {
      const parts = item.split("#");
      appId = parts[0].trim();
      name = parts.slice(1).join("#").trim() || appId; // 支持名称中含#
    }

    const url = `https://testflight.apple.com/join/${appId}`;
    console.log(`🔗 请求: [${name}] ${url}`);

    const { resp, body } = await httpGet({ 
      url,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      }
    });

    // 🚫 请求失败跳过
    if (!resp || resp.status !== 200) {
      console.log(`⚠️ [${name}] 请求异常: status=${resp?.status}`);
      continue;
    }

    // 📊 状态判断
    if (/已满|full|Full|FULL/.test(body)) {
      console.log(`🔴 [${name}] 已满员`);
    }
    else if (/not accepting|Not Accepting|测试已结束/.test(body)) {
      console.log(`🟡 [${name}] 未开放/已结束`);
    }
    else if (/加入测试|Join Test|您已加入/.test(body)) {
      console.log(`🟢 [${name}] 🚀 有位置！！！`);
      
      $notification.post(
        "🚀 TestFlight 有名额！！！",
        `${name}`,
        `点击立即加入测试 ➜`,
        { url, "open-url": url }
      );
      
      // 💡 可选：检测到有位置后停止后续请求（避免刷屏）
      // break;
    }
    else {
      // 未知页面结构，保守认为可能有位置
      console.log(`❓ [${name}] 页面状态未知，建议手动检查`);
    }
    
    // ⏱️ 避免请求过快被限流（可选）
    // await new Promise(r => setTimeout(r, 500));
  }

  console.log("✅ 监控任务完成");
  $done();

})();

