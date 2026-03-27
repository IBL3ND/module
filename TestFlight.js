/**
 * TestFlight 监控 (全速高精度版)
 * 自动监控 TestFlight 名额
 * 只要检测到有名额就一直通知
 * 支持多 ID 监控与随机 UA 伪装
 * 环境变量里 名称填 TF  值填你想监控的ID
 * 配置说明
 * 1. 脚本类型: 计划 (Schedule)
 * 2. 环境变量:
 * - 名称: TF
 * - 值:  示例: hmC52rdF, b6X29Sva
 */

const userAgents = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_6_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_7_9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_0_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_5_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
];

export default async function(ctx) {
  const rawIds = ctx.env.TF || "";
  if (!rawIds.trim()) return;
  
  const appIds = rawIds.split(/\s*[\n,，;]\s*/).filter(Boolean);
  const getRandomUA = () => userAgents[Math.floor(Math.random() * userAgents.length)];

  console.log(`[TF Monitor] 开始检查：[${appIds}] `);

  for (const appIdInfo of appIds) {
    let appId = appIdInfo;
    let appName = "";
    
    if (appIdInfo.includes("#")) {
      appId = appIdInfo.split("#")[0].trim();
      appName = appIdInfo.split("#")[1].trim();
    }

    const url = `https://testflight.apple.com/join/${appId}`;
    
    try {
      const resp = await ctx.http.get(url, {
        headers: { "User-Agent": getRandomUA() },
        timeout: 10000
      });

      if (resp.status === 404) {
        console.log(`[D] ${appIdInfo} → 不存在 ⚠️`);
        continue;
      }
      if (resp.status !== 200) {
        console.log(`[?] ${appIdInfo} → 状态码: ${resp.status}`);
        continue;
      }

      const data = await resp.text();
      
      if (/版本的测试员已满|This beta is full|此 beta 版已额满/.test(data)) {
        console.log(`[F] ${appIdInfo} → 已满`);
      } 
      
      else if (/版本目前不接受任何新测试员|This beta isn't accepting any new testers/.test(data)) {
        console.log(`[N] ${appIdInfo} → 暂不接受新成员`);
      } 

      else if (/要加入 Beta 版|To join the|开始测试|itms-beta:\/\/|join the beta/.test(data)) {
        console.log(`[Y] ${appIdInfo} → 可加入 ✅`);
        
        ctx.notify({
          title: "TestFlight 有名额了！",
          subtitle: appName ? `${appName} (${appId})` : `ID: ${appId}`,
          body: "🚀 探测到新名额，请立即点击加入测试",
          action: { type: "openUrl", url: url }
        });
      } else {
        console.log(`[?] ${appIdInfo} → 状态未知`);
      }

    } catch (e) {
      console.log(`[!] ${appIdInfo} → 请求出错: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }
}
