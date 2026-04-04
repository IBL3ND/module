/**
 * Egern 脚本
 */

let body = $response.body;

if (body) {
    try {
        let obj = JSON.parse(body);

        // 1. 彻底删除插屏弹窗对象 (解决倒计时弹窗的关键)
        if (obj.postitial) {
            delete obj.postitial;
        }

        // 2. 清空模型数组 (弹窗里的女主播/视频列表通常存在这里)
        if (obj.models) {
            obj.models = [];
        }

        // 3. 过滤组件位 (防止页面留下广告占位符)
        if (obj.widgetPositions && Array.isArray(obj.widgetPositions)) {
            const adKeywords = [
                "postitial", 
                "native", 
                "preroll", 
                "playerpause", 
                "underrelated", 
                "undervideo",
                "contentbottom"
            ];
            
            obj.widgetPositions = obj.widgetPositions.filter(item => {
                if (!item.name) return true;
                const nameLower = item.name.toLowerCase();
                // 剔除匹配关键词的组件
                return !adKeywords.some(keyword => nameLower.includes(keyword));
            });
        }

        // 4. 重建响应体并完成
        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        console.log("xHamster 脚本执行出错: " + e);
        $done({});
    }
} else {
    $done({});
}
