/**
 * 中国联通 余量组件
 * =======================================================
 * # ── 环境变量配置说明 ──
 * 1. 手机号 : "填写你的 11 位联通手机号 (例: 18612345678)"
 * 2. Cookie : "填入抓包获取的完整 Cookie 文本"
 * * # ── Cookie 获取指引 ──
 * 抓包工具 → 登录联通 App → 点击首页 → 点击“剩余流量”进入查询页 
 * → 寻找 m.client.10010.com 的请求 → 复制 Header 中的 Cookie。
 * * # ── 核心参数校验 ──
 * 确保你的 Cookie 中包含以 SHAREJSESSIONID= 开头的 Key
 * (例如: SHAREJSESSIONID=E4E9248A0B811035B15C294DA528D...)
 * =======================================================
 */

export default async function(ctx) {
  const phone = ctx.env.手机号 || "";
  const cookie = ctx.env.Cookie || "";

  const colors = {
    bg: { light: "#FFFFFF", dark: "#1C1C1E" },
    border: { light: "#E5E5EA", dark: "#3A3A3C" },
    title: { light: "#666666", dark: "#8E8E93" },
    value: { light: "#1C1C1E", dark: "#FFFFFF" },
    capsuleBg: { light: "#F5F5F7", dark: "#3A3A3C" },
    accent: { light: "#E60012", dark: "#FF453A" }, 
  };

  let data = {
    packageName: "等待配置环境变量...",
    mlUsed: "--",       
    freeUsed: "--",     
    totalRemain: "--",  
    mlRemain: "--",     
    updateTime: "--:--"
  };

  if (phone && cookie) {
    try {
      const url = "https://m.client.10010.com/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune";
      const resp = await ctx.http.post(url, {
        headers: {
          "User-Agent": "ChinaUnicom.x CFNetwork iOS/16.3",
          "cookie": cookie,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ desmobile: phone })
      });
      const res = await resp.json();

      if (res?.code === "0000") {
        const fmt = (val) => {
          if (val === undefined || val === null) return "0M";
          const n = parseFloat(val);
          return n >= 1024 ? (n / 1024).toFixed(2) + "G" : n.toFixed(0) + "M";
        };

        data.packageName = res.packageName || "查询成功";
        
        const freeFlowVal = res.summary?.freeFlow || 0;
        data.mlUsed = fmt(freeFlowVal); 
        data.freeUsed = fmt(freeFlowVal);
        
        data.totalRemain = `${res.canUseFlowAll || "0"}${res.canuseFlowAllUnit || "GB"}`;
        
        const gjRemain = res.GJResources?.[0]?.remainResource;
        data.mlRemain = fmt(gjRemain || 0);

        data.updateTime = res.time?.split(" ")[1]?.substring(0, 5) || "--:--";
      } else {
        data.packageName = "Cookie验证失败";
      }
    } catch (e) {
      data.packageName = "网络请求异常";
    }
  }

  function makeStackCapsule(title, value, forceAccent = false) {
    return {
      type: "stack",
      direction: "column",
      alignItems: "center",
      flex: 1,
      padding: [8, 10, 8, 10],
      backgroundColor: colors.capsuleBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      children: [
        { type: "text", text: title, font: { size: 12 }, textColor: colors.title },
        { 
          type: "text", 
          text: value, 
          font: { size: 18, weight: "semibold" }, 
          textColor: forceAccent ? colors.accent : colors.value,
          maxLines: 1,
          minScale: 0.5
        },
      ],
    };
  }

  const isJumpRed = (parseFloat(data.mlUsed) || 0) > 0;

  return {
    type: "widget",
    backgroundColor: colors.bg,
    padding: 16,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          { type: "text", text: data.packageName, font: { size: 16, weight: "bold" }, textColor: colors.value, maxLines: 1 },
          { type: "spacer" },
          {
            type: "stack", direction: "row", gap: 3, alignItems: "center",
            children: [
              { type: "image", src: "sf-symbol:arrow.clockwise", width: 11, height: 11, color: colors.title },
              { type: "text", text: data.updateTime, font: { size: 11 }, textColor: colors.title }
            ]
          }
        ]
      },
      { type: "spacer", length: 12 },
      {
        type: "stack", direction: "row", gap: 10,
        children: [
          makeStackCapsule("跳", data.mlUsed, isJumpRed), 
          makeStackCapsule("免", data.freeUsed)
        ]
      },
      { type: "spacer", length: 10 },
      {
        type: "stack", direction: "row", gap: 10,
        children: [
          makeStackCapsule("通用剩", data.totalRemain), 
          makeStackCapsule("免流剩", data.mlRemain)
        ]
      }
    ]
  };
}
