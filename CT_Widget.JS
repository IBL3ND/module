/**
 * 中国电信话费流量小组件
 * 
 * # ── 环境变量配置 ──
 * Cookie: "抓包获取的Cookie"
 * 手机号： "133xxxxxxxx（电信手机号）"
 */
export default async function(ctx) {
  // ── 1. 读取环境变量 ─────────────────────────────────
  const cookie = ctx.env.Cookie || "";
  const phone = ctx.env.手机号 || "";

  // ── 2. 颜色配置（深浅色模式）───────────────────────
  const colors = {
    bg:        { light: "#FFFFFF", dark: "#2C2C2E" },
    border:    { light: "#E5E5EA", dark: "#3A3A3C" },
    title:     { light: "#666666", dark: "#8E8E93" },
    value:     { light: "#1C1C1E", dark: "#FFFFFF" },
    time:      { light: "#999999", dark: "#666666" },
    error:     { light: "#FF3B30", dark: "#FF453A" },
    capsuleBg: { light: "#F5F5F7", dark: "#3A3A3C" },
    accent:    { light: "#FF6620", dark: "#FF854D" },  // 电信橙色
  };

  // ── 3. 默认数据 ───────────────────────────────────
  let data = {
    fee:   { title: "剩余话费", value: "--", unit: "元" },
    voice: { title: "剩余语音", value: "--", unit: "分钟" },
    flow:  { title: "剩余流量", value: "--", unit: "MB" },
    updateTime: "--:--",
    error: null,
    debugInfo: [],
  };

  // ── 4. 配置验证 & 数据请求 ─────────────────────────
  if (!phone || !cookie) {
    data.error = "配置缺失";
    if (!phone) data.debugInfo.push("❌ 未填写「手机号」");
    if (!cookie) data.debugInfo.push("❌ 未填写「Cookie」");
    data.debugInfo.push("💡 请在小组件配置页 → 环境变量中添加");
  } else {
    try {
      // 电信接口
      const detailUrl = "https://e.dlife.cn/user/package_detail.do";
      const balanceUrl = "https://e.dlife.cn/user/balance.do";
      
      // 获取套餐详情（流量和语音）
      const detailResp = await ctx.http.get(detailUrl, {
        timeout: 8000,
        headers: {
          "Host": "e.dlife.cn",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X)",
          "Cookie": cookie,
        },
      });
      
      const detailRes = await detailResp.json();
      
      // 解析流量和语音
      let flowBalance = 0, voiceBalance = 0;
      if (detailRes?.items) {
        detailRes.items.forEach(group => {
          if (group?.items) {
            group.items.forEach(item => {
              if (item?.unitTypeId === "3" && item?.balanceAmount !== "999999999999") {
                flowBalance += Number(item.balanceAmount || 0);
              }
              if (item?.unitTypeId === "1") {
                voiceBalance += Number(item.balanceAmount || 0);
              }
            });
          }
        });
      }
      
      // 获取话费余额
      const balanceResp = await ctx.http.get(balanceUrl, {
        timeout: 8000,
        headers: {
          "Host": "e.dlife.cn",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X)",
          "Cookie": cookie,
        },
      });
      
      const balanceRes = await balanceResp.json();
      const feeBalance = (Number(balanceRes?.totalBalanceAvailable) / 100).toFixed(2);
      
      // 格式化流量单位
      const formatFlow = (mb) => {
        if (mb >= 1024) {
          return { value: (mb / 1024).toFixed(2), unit: "GB" };
        }
        return { value: Math.floor(mb).toString(), unit: "MB" };
      };
      
      const flowFormatted = formatFlow(flowBalance);
      
      // 更新时间
      const now = new Date();
      const timeStr = now.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai",
      });
      
      // 更新数据
      data = {
        fee: {
          title: "剩余话费",
          value: feeBalance,
          unit: "元",
        },
        voice: {
          title: "剩余语音",
          value: Math.floor(voiceBalance).toString(),
          unit: "分钟",
        },
        flow: {
          title: "剩余流量",
          value: flowFormatted.value,
          unit: flowFormatted.unit,
        },
        updateTime: timeStr,
      };
      
    } catch (e) {
      data.error = "请求失败";
      data.debugInfo.push(`错误: ${e.message}`);
    }
  }

  // ── 5. 胶囊组件工厂（核心样式复用）──────────────────
  function makeCapsule(title, value, unit) {
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
              textColor: colors.value,
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
        { type: "spacer", length: 2 },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 5,
          padding: [6, 10, 6, 10],
          backgroundColor: colors.capsuleBg,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          children: [
            { type: "image", src: "sf-symbol:phone.circle", color: colors.time, width: 12, height: 12 },
            { type: "text", text: phone || "未配置", font: { size: "caption2" }, textColor: colors.time, maxLines: 1 },
          ],
        },
      ],
    };
  }

  // ── 7. 正常界面：胶囊式三列弹性布局 ─────────────────
  return {
    type: "widget",
    backgroundColor: colors.bg,
    padding: [10, 14, 10, 14],
    gap: 12,
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children: [
      // ── 顶部标题栏（两端对齐）──────
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
              { type: "image", src: "sf-symbol:antenna.radiowaves.left.and.right", color: colors.accent, width: 18, height: 18 },
              { type: "text", text: "中国电信", font: { size: "headline", weight: "semibold" }, textColor: colors.value },
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

      // ── 核心数据区：三列胶囊 ────────────
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 9,
        children: [
          makeCapsule(data.fee.title,   data.fee.value,   data.fee.unit),
          makeCapsule(data.voice.title, data.voice.value, data.voice.unit),
          makeCapsule(data.flow.title,  data.flow.value,  data.flow.unit),
        ],
      },

      // ── 底部装饰条 ────────────────────
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
