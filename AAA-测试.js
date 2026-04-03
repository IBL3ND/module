/**
 * Egern 响应体重写脚本 - 过滤广告位
 */

let body = $response.body;
if (!body) $done({});

try {
    let obj = JSON.parse(body);

    if (obj.widgetPositions && Array.isArray(obj.widgetPositions)) {
        // 关键过滤逻辑：移除包含特定广告关键词的组件
        const adKeywords = [
            "postitial",    // 插屏
            "native",       // 原生广告
            "preroll",      // 视频前贴片
            "underrelated", // 相关视频下方广告
            "undervideo",   // 视频下方广告
            "playerpause"   // 暂停时的广告
        ];

        obj.widgetPositions = obj.widgetPositions.filter(item => {
            if (!item.name) return true;
            const nameLower = item.name.toLowerCase();
            // 如果组件名包含上述任何一个关键词，则过滤掉
            return !adKeywords.some(keyword => nameLower.includes(keyword));
        });
        
        // 可选：清空模型列表以减少数据量（如果这些模型只是推荐广告）
        // obj.models = [];
    }

    $done({ body: JSON.stringify(obj) });
} catch (e) {
    console.log("解析 JSON 失败: " + e);
    $done({});
}
