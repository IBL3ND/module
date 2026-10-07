/**
 * @name 山丘阅读 (Hill Read) 广告拦截脚本
 * @description 拦截并清空开屏广告、激励视频及插屏广告的配置数据
 * @author Customized for Surge
 */

// 匹配配置接口的正则表达式 (请根据实际抓包结果调整，此处以常见路径为例)
// 建议修改为您实际抓到的包含 "status":"1" 和 "cokey" 的那个完整 URL 路径特征
const URL_REGEX = /\/config\/get|\/api\/v\d+\/config|settings/; 

let body = $response.body;

try {
    // 尝试解析 JSON
    let obj = JSON.parse(body);

    // 验证数据结构是否符合山丘阅读的特征
    if (obj && obj.status === "1" && Array.isArray(obj.data)) {
        let isModified = false;

        obj.data = obj.data.map(item => {
            if (!item || !item.cokey) return item;

            switch (item.cokey) {
                case "adconfig":
                    // 清空自营开屏提示图/内购引导 (原值为 JSON 字符串数组)
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
                    break;
            }
            return item;
        });

        // 如果进行了修改，则返回新的 JSON；否则原样返回
        if (isModified) {
            console.log("[HillRead Adblock] 成功拦截并清理广告配置。");
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
    console.log("[HillRead Adblock] JSON 解析失败: ", error);
    $done({});
}
