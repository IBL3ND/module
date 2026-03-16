/**
 * 南方电网用电小组件
 *
 *# ── 环境变量配置 ──
 * Token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxx"
 *
 * 获取 x-auth-token 教程
 * 抓包工具 → 登录账号 → 进入「我的用电」或「电费查询」页面 → 等待几秒让数据加载完成 → 回到 抓包工具 → 点击「停止抓取」→ 搜索关键词：95598.csg.cn → 找到请求：/ucs/ma/zt/eleCustNumber/queryBindEleUsers → 点击该请求 → 查看「请求头」(Request Headers) → 找到 `x-auth-token` 字段 → 长按复制整个值（一串长字符）
 * 示例格式：
 *x-auth-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxx
 */
export default async function(ctx) {
  // ── 1. 读取环境变量 ─────────────────────────────────
  const token = (ctx.env.Token || "").trim();

  // ── 2. 颜色配置（深浅色模式）───────────────────────
  const colors = {
    bg:        { light: "#FFFFFF", dark: "#2C2C2E" },
    border:    { light: "#E5E5EA", dark: "#3A3A3C" },
    title:     { light: "#666666", dark: "#8E8E93" },
    value:     { light: "#1C1C1E", dark: "#FFFFFF" },
    time:      { light: "#999999", dark: "#666666" },
    error:     { light: "#FF3B30", dark: "#FF453A" },
    capsuleBg: { light: "#F5F5F7", dark: "#3A3A3C" },
    accent:    { light: "#FF9500", dark: "#FF9F0A" },
  };

  // ── 3. 默认数据 ───────────────────────────────────
  let data = {
    yst:   { title: "昨日用电", value: "--", unit: "千瓦时" },
    total: { title: "本月累计", value: "--", unit: "千瓦时" },
    bal:   { title: "账户余额", value: "--", unit: "元" },
    fee:   "0.00",
    updateTime: "--:--",
    error: null,
    debugInfo: [],
  };

  // ── 4. 配置验证 & 数据请求 ─────────────────────────
  if (!token) {
    data.error = "配置缺失";
    data.debugInfo.push("❌ 未填写「Token」");
    data.debugInfo.push("💡 请在小组件配置页 → 环境变量中添加");
  } else {
    try {
      // 用户信息查询
      const resp = await ctx.http.post(
        "https://95598.csg.cn/ucs/ma/zt/eleCustNumber/queryBindEleUsers",
        {
          headers: { "x-auth-token": token, "Content-Type": "application/json" },
          body: "{}"
        }
      );
      const res = await resp.json();
      
      if (res?.data?.[0]) {
        const u = res.data[0];

        // 余额请求
        const bResp = await ctx.http.post(
          "https://95598.csg.cn/ucs/ma/zt/charge/queryUserAccountNumberSurplus",
          {
            headers: { "x-auth-token": token, "Content-Type": "application/json" },
            body: JSON.stringify({ areaCode: u.areaCode, eleCustId: u.bindingId })
          }
        );
        const bRes = await bResp.json();
        const balance = bRes.data?.[0]?.balance ?? "0.00";
        data.bal.value = String(balance);

        // 电量请求
        const ym = new Date().toISOString().slice(0, 7).replace(/-/g, '');
        const pResp = await ctx.http.post(
          "https://95598.csg.cn/ucs/ma/zt/charge/queryDayElectricByMPoint",
          {
            headers: { "x-auth-token": token, "Content-Type": "application/json" },
            body: JSON.stringify({ 
              eleCustId: u.bindingId, 
              areaCode: u.areaCode, 
              yearMonth: ym, 
              meteringPointId: u.meteringPointId 
            })
          }
        );
        const pRes = await pResp.json();
        if (pRes?.data) {
          data.total.value = String(pRes.data.totalPower ?? "0.00");
          const list = pRes.data.result || [];
          if (list.length > 0) {
            data.yst.value = String(list[list.length - 1].power ?? "0.00");
          }
        }
        data.fee = String((parseFloat(data.total.value) * 0.61).toFixed(2));
        data.updateTime = new Date().toLocaleTimeString("zh-CN", { 
          hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" 
        });
      } else {
        data.error = "API 返回异常";
        data.debugInfo.push("未查询到用户信息", "可能 Token 已过期");
      }
    } catch (e) {
      data.error = "请求失败";
      data.debugInfo.push(`错误: ${e.message}`);
    }
  }

  // ── 5. 胶囊组件工厂（完全复制联通样式）──────────────
  function makeCapsule(title, value, unit, isNegative = false) {
    const valueColor = isNegative && parseFloat(value) < 0 ? colors.error : colors.value;
    
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
        {
          type: "text",
          text: title,
          font: { size: "caption2", weight: "medium" },
          textColor: colors.title,
          maxLines: 1,
        },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 3,
          children: [
            {
              type: "text",
              text: String(value),
              font: { size: "title2", weight: "semibold" },
              textColor: valueColor,
            },
            {
              type: "text",
              text: unit,
              font: { size: "caption2", weight: "regular" },
              textColor: colors.title,
            },
          ],
        },
      ],
    };
  }

  // ── 6. 错误/调试界面 ───────────────────────────────
  if (data.error || data.debugInfo.length > 0) {
    return {
      type: "widget",
      backgroundColor: colors.bg,
      padding: 14,
      gap: 9,
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          children: [
            { type: "image", src: "sf-symbol:exclamationmark.triangle.fill", color: colors.error, width: 14, height: 14 },
            { type: "text", text: data.error || "🔍 调试信息", font: { size: "headline", weight: "bold" }, textColor: colors.error },
          ],
        },
        ...data.debugInfo.map(msg => ({
          type: "text",
          text: `• ${msg}`,
          font: { size: "caption2" },
          textColor: colors.title,
          maxLines: 1,
        })),
      ],
    };
  }

  // ── 7. 正常界面：完全复制联通布局 ──────────────────
  return {
    type: "widget",
    backgroundColor: colors.bg,
    padding: [10, 14, 10, 14],
    gap: 12,
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children: [
      // ── 顶部标题栏（完全复制联通）──────────────
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            gap: 7,
            children: [
              { type: "image", src: "sf-symbol:bolt.square.fill", color: colors.accent, width: 18, height: 18 },
              { type: "text", text: "南方电网", font: { size: "headline", weight: "semibold" }, textColor: colors.value },
            ],
          },
          { type: "spacer" },
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            gap: 5,
            children: [
              { type: "image", src: "sf-symbol:arrow.clockwise", color: colors.time, width: 12, height: 12 },
              { type: "text", text: data.updateTime, font: { size: "caption2" }, textColor: colors.time },
            ],
          },
        ],
      },

      // ── 三个胶囊卡片（完全复制联通）────────────
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 9,
        children: [
          makeCapsule(data.yst.title, data.yst.value, data.yst.unit),
          makeCapsule(data.total.title, data.total.value, data.total.unit),
          makeCapsule(data.bal.title, data.bal.value, data.bal.unit, true),
        ],
      },

      // ── 底部装饰条（完全复制联通）────────────
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          { type: "spacer" },
          {
            type: "stack",
            width: 48,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
          },
          { type: "spacer" },
        ],
      },
    ],
  };
}

