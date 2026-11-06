/**
 * 蛋蛋不语 VIP 解锁 - Egern 原生适配版
 * 基于 Curtinp118 的 dandanvip_unlock.js (v1.1.0) 重写
 */

export default async function(ctx) {
  try {
    const raw = await ctx.response.text();
    if (!raw) return;

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return; // 不是 JSON 就原样返回
    }

    const VIP_PATCH = {
      vip_status: true,
      vip_level: 3,
      vip_expire_at: "2099-09-19T22:21:06.147807+00:00",
      username: "TG@Curtinp118",
      avatar_url: "https://i.ibb.co/NgghpGgn/11zon-A9-CBAC35-2-CA3-4-E7-F-923-D-7304-EEB40635.webp"
    };

    function patch(obj) {
      if (!obj || typeof obj !== "object") return obj;
      return Object.assign({}, obj, VIP_PATCH);
    }

    if (Array.isArray(data)) {
      data = data.map(patch);
    } else {
      data = patch(data);
    }

    return { body: data };
  } catch (e) {
    console.log("蛋蛋不语解锁失败:", e);
  }
}