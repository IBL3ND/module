/**
 * @name 山丘阅读 (Hill Read) v735 广告拦截脚本
 * @description 精准拦截 /api/v2/config2025/ 接口，清空开屏广告、激励视频及插屏广告配置
 * @version 2.0.0
 */

let body = $response.body;

try {
    let obj = JSON.parse(body);

    // 【严格特征校验】确保只修改山丘阅读的配置接口，防止误杀
    if (obj && obj.status === "1" && Array.isArray(obj.data) && obj.data.length > 0 && obj.data[0].hasOwnProperty("cokey")) {
        
        let isModified = false;

        obj.data = obj.data.map(item => {
            if (!item || !item.cokey) return item;

            switch (item.cokey) {
                case "adconfig":
                    // 清空自营开屏提示图/内购引导
                    item.covalue = "[]";
                    isModified = true;
                    break;
                case "PARAV2_SPLASHADS_CONFIG":
                    // 清空第三方开屏广告配置 (穿山甲/优量汇等)
                    item.covalue = "";
                    isModified = true;
                    break;
                case "ONLINE_ENABLE_REWARDAD_V735":
                    // 禁用激励视频广告开关
                    item.covalue = "disable";
                    isModified = true;
                    break;
                case "ONLINE_REWARDAD_CONFIG_V735":
                case "ONLINE_INTERAD_DOWNLOAD_CONFIG_V735":
                    // 清空激励视频和插屏广告的具体配置参数
                    item.covalue = "";
                    isModified = true;
                    break;
                default:
                    // 保留所有其他正常功能配置（如书源、去广告规则等）
                    break;
            }
            return item;
        });

        if (isModified) {
            console.log("[HillRead Adblock] 成功拦截并清理 v2025 广告配置。");
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } else {
        // 数据结构不匹配，原样放行
        $done({});
    }
} catch (error) {
    // JSON 解析失败，原样放行，防止 App 崩溃
    $done({});
}
