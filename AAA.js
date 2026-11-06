/**
 * 蛋蛋不语 VIP 解锁 - Egern 原生适配版
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
    const rawBody = await ctx.response.text();

    if (!rawBody) {
        console.log("❌ 蛋蛋不语：响应体为空");
        return; 
    }

    let data;
    try {
        data = JSON.parse(rawBody);
    } catch (e) {
        console.log("❌ 蛋蛋不语：JSON 解析失败", e.message);
        return; 
    }

    if (Array.isArray(data)) {
        data = data.map(patchObject);
    } else {
        data = patchObject(data);
    }

    console.log("✅ 蛋蛋不语：VIP 已解锁");

    // ✅ 关键修正：直接返回字符串，不再包裹在 { body: ... } 中
    return JSON.stringify(data);
}