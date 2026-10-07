/**
 * @name 山丘阅读 极简修改版
 * @description 直接修改 myinfo 的 type, vipto, nickname；简单清空 config2025 的广告配置
 */

let body = $response.body;
let url = $request.url;

try {
    let obj = JSON.parse(body);

    // ==========================================
    // 1. 针对 myinfo 接口：直接填入修改后的数据
    // ==========================================
    if (url.includes("myinfo") && obj.status === "1" && obj.data && obj.data.length > 0) {
        let user = obj.data[0];
        
        // 【直接填写您要改动的数据】
        user.type = "9";                       // 改为 9 (终身会员)
        user.vipto = "2099-12-31 23:59:59";    // 改为永久有效时间
        user.nickname = "尊贵VIP";               // 填入您想要的昵称
        
        // 注意：uuid, token, cid 等字段不写死，保留服务器返回的原值，防止账号掉线
    }

    // ==========================================
    // 2. 针对 config2025 接口：极简去广告
    // ==========================================
    if (url.includes("config2025") && obj.status === "1" && Array.isArray(obj.data)) {
        obj.data = obj.data.map(item => {
            if (!item || !item.cokey) return item;
            
            // 简单粗暴：匹配到广告相关的 cokey，直接清空或禁用
            if (item.cokey === "adconfig") {
                item.covalue = "[]";
            } else if (item.cokey === "PARAV2_SPLASHADS_CONFIG") {
                item.covalue = "";
            } else if (item.cokey.includes("REWARDAD") || item.cokey.includes("INTERAD")) {
                item.covalue = item.cokey.includes("ENABLE") ? "disable" : "";
            }
            return item;
        });
    }

    // 返回修改后的数据
    $done({ body: JSON.stringify(obj) });

} catch (e) {
    // 如果解析失败，原样放行，保证 App 不崩溃
    $done({});
}
