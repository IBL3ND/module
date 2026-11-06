/**
 * 蛋蛋不语 VIP 解锁 - 原生 Egern 适配版
 * 基于 Curtinp118 的 dandanvip_unlock.js (v1.1.0) 重写
 */

const VIP_PATCH = {
    vip_status: true,
    vip_level: 3,
    vip_expire_at: "2099-09-19T22:21:06.147807+00:00",
    username: "TG@Curtinp118",
    avatar_url: "https://i.ibb.co/NgghpGgn/11zon-A9-CBAC35-2-CA3-4-E7-F-923-D-7304-EEB40635.webp"
};

function patchObject(obj) {
    if (!obj || typeof obj !== "object") return obj;
    return Object.assign(obj, VIP_PATCH);
}

export default async function(ctx) {
    // 1. 获取响应体文本（Egern 的 body 是流，只能消费一次）
    const rawBody = await ctx.response.text();

    if (!rawBody) {
        console.log("❌ 蛋蛋不语：响应体为空");
        return; // 不修改，让原始响应通过
    }

    let data;
    try {
        data = JSON.parse(rawBody);
    } catch (e) {
        console.log("❌ 蛋蛋不语：JSON 解析失败", e.message);
        return; // 解析失败时不修改响应
    }

    // 2. 应用 VIP 补丁（兼容数组和对象两种结构）
    if (Array.isArray(data)) {
        data = data.map(patchObject);
    } else {
        data = patchObject(data);
    }

    console.log("✅ 蛋蛋不语：VIP 已解锁");

    // 3. 返回修改后的响应体
    // Egern 支持通过返回 { body: ... } 来改写响应
    return {
        body: JSON.stringify(data)
    };
}