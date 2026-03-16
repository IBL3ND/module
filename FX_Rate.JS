/** 汇率看板
*/

export default async function (ctx) {
  const family = ctx.widgetFamily;

  const allCurrencies = [
    { code: "USD", label: "USD",        unit: 1,    flag: "🇺🇸" },
    { code: "EUR", label: "EUR",        unit: 1,    flag: "🇪🇺" },
    { code: "GBP", label: "GBP",        unit: 1,    flag: "🇬🇧" },
    { code: "HKD", label: "HKD",        unit: 1,    flag: "🇭🇰" },
    { code: "JPY", label: "JPY(100)",   unit: 100,  flag: "🇯🇵" },
    { code: "KRW", label: "KRW(1000)",  unit: 1000, flag: "🇰🇷" },
    { code: "THB", label: "THB",        unit: 1,    flag: "🇹🇭" },
  ];

  // ✅ 背景颜色：浅色 #FFFFFF / 深色 #2C2C2E
  const bgColor = { light: "#FFFFFF", dark: "#2C2C2E" };

  // 📱 弹性适配参数（仅内部计算，不影响视觉布局）
  const adapt = {
    // 根据机型宽度动态计算比例（单位：pt）
    getFlexRatio: (baseFlex, minWidth = 320, maxWidth = 430) => {
      const screen = ctx.widgetFamily === "systemSmall" ? 320 : (ctx.widgetFamily === "systemMedium" ? 375 : 430);
      const ratio = (screen - minWidth) / (maxWidth - minWidth);
      return baseFlex * (0.9 + ratio * 0.2); // 浮动范围 0.9~1.1 倍
    },
    // 动态字体缩放系数
    getMinScale: () => ctx.widgetFamily === "systemSmall" ? 0.75 : 0.8,
  };

  function errorWidget(msg) {
    return {
      type: "widget",
      backgroundColor: bgColor,
      padding: 14,
      gap: 6,
      children: [
        { type: "text", text: "加载失败", font: { size: "headline", weight: "bold" }, textColor: { light: "#FF3B30", dark: "#FF453A" } },
        { type: "text", text: msg, font: { size: "caption1" }, textColor: { light: "#86868B", dark: "#636366" }, maxLines: 2 },
      ],
    };
  }

  // ① 先读上次快照和时间戳
  let prevSnapshot = {};
  let prevTimestamp = "";
  try {
    prevSnapshot  = ctx.storage.getJSON("rate_snapshot") || {};
    prevTimestamp = ctx.storage.get("rate_timestamp")   || "";
  } catch {}

  // ② 请求今日数据
  let rates, updateTime, updateTimestamp;
  try {
    const resp = await ctx.http.get("https://open.er-api.com/v6/latest/CNY", { timeout: 8000 });
    const data = await resp.json();
    if (data.result !== "success") throw new Error("API 异常");
    rates = data.rates;
    updateTimestamp = String(data.time_last_update_unix || Date.now());
    if (data.time_last_update_utc) {
      const d = new Date(data.time_last_update_utc);
      updateTime = d.toLocaleTimeString("zh-CN", {
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai",
      });
    }
  } catch (e) {
    return errorWidget(e.message || "网络请求失败");
  }

  function getRate(code, unit) {
    const r = rates[code];
    if (!r) return null;
    const val = unit / r;
    return val >= 1 ? val.toFixed(2) : val.toFixed(4);
  }

  // ③ 计算当前快照
  const currentSnapshot = {};
  allCurrencies.forEach((c) => {
    const r = getRate(c.code, c.unit);
    if (r) currentSnapshot[c.code] = r;
  });

  // ④ 时间戳变化时才更新快照
  try {
    if (updateTimestamp && updateTimestamp !== prevTimestamp) {
      ctx.storage.setJSON("rate_snapshot", currentSnapshot);
      ctx.storage.set("rate_timestamp", updateTimestamp);
    }
  } catch {}

  // ⑤ 趋势计算
  function getTrend(code) {
    const cur  = parseFloat(currentSnapshot[code]);
    const prev = parseFloat(prevSnapshot[code]);
    if (isNaN(cur) || isNaN(prev)) return "flat";
    if (cur > prev + 0.00001) return "up";
    if (cur < prev - 0.00001) return "down";
    return "flat";
  }

  function trendIcon(trend) {
    if (trend === "up")   return "▲";
    if (trend === "down") return "▼";
    return "";
  }
  
  function trendColor(trend) {
    if (trend === "up")   return { light: "#34C759", dark: "#30D158" };
    if (trend === "down") return { light: "#FF3B30", dark: "#FF6B35" };
    return { light: "#86868B", dark: "#636366" };
  }

  // ✅ 分隔线颜色适配
  const hDivider = { type: "stack", height: 1, backgroundColor: { light: "#00000010", dark: "#FFFFFF18" } };
  const vDivider = { type: "stack", width: 1, backgroundColor: { light: "#00000010", dark: "#FFFFFF18" } };

  // ── Small ────────────────────────────────────────────────
  if (family === "systemSmall") {
    const rows = allCurrencies.map((c) => {
      const rate  = getRate(c.code, c.unit);
      const trend = getTrend(c.code);
      const flexBase = adapt.getFlexRatio(1); // 动态 flex 系数
      
      return {
        type: "stack",
        direction: "row",
        alignItems: "center",
        flex: 1,  // ✅ 弹性占宽
        gap: 2,   // ✅ 小间距适配小屏
        children: [
          // 🚩 国旗：固定最小宽度 + 弹性
          { 
            type: "text", 
            text: c.flag, 
            font: { size: "caption1" }, 
            width: 22,
            minScale: adapt.getMinScale(),
          },
          // 🏷️ 标签：弹性拉伸 + 自动省略
          {
            type: "text",
            text: c.label,
            font: { size: "caption1", weight: "medium" },
            textColor: { light: "#1C1C1E", dark: "#EBEBF5CC" },
            flex: flexBase * 1.2,  // ✅ 动态 flex 比例
            maxLines: 1,
            minScale: adapt.getMinScale(),
            truncationMode: "tail",  // ✅ 超长自动省略
          },
          // 💰 数值：右对齐 + 弹性 + 自动缩放
          {
            type: "text",
            text: rate ? `¥${rate}` : "--",
            font: { size: "caption1", weight: "semibold" },
            textColor: { light: "#BF5900", dark: "#FFD60A" },
            flex: flexBase,
            textAlign: "right",
            maxLines: 1,
            minScale: adapt.getMinScale() * 0.95,
            truncationMode: "tail",
          },
          // 📈 趋势：条件渲染 + 固定宽度
          ...(trend !== "flat" ? [
            { type: "spacer", length: 2 },
            {
              type: "text",
              text: trendIcon(trend),
              font: { size: 8 },
              textColor: trendColor(trend),
              width: 10,
              minScale: adapt.getMinScale(),
            },
          ] : []),
        ],
      };
    });

    return {
      type: "widget",
      backgroundColor: bgColor,
      padding: [12, 14, 10, 14],
      gap: 0,
      refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 5,
          children: [
            { type: "image", src: "sf-symbol:banknote.fill", color: { light: "#BF5900", dark: "#FF9F0A" }, width: 14, height: 14 },
            { 
              type: "text", 
              text: "汇率 (CNY)", 
              font: { size: "subheadline", weight: "bold" }, 
              textColor: { light: "#000000", dark: "#FFFFFF" },
              flex: 1,  // ✅ 标题弹性占宽
              maxLines: 1,
              minScale: 0.85,
            },
          ],
        },
        { type: "spacer", length: 4 },
        { 
          type: "stack", 
          direction: "column", 
          flex: 1,  // ✅ 列表区域弹性填充
          gap: 0, 
          children: rows,
          justifyContent: "spaceBetween",  // ✅ 均匀分布行高
        },
        {
          type: "text",
          text: updateTime ? `更新于 ${updateTime}` : "获取中...",
          font: { size: "caption2" },
          textColor: { light: "#86868B", dark: "#636366" },
          maxLines: 1,
          minScale: 0.9,
          textAlign: "right",  // ✅ 时间右对齐
        },
      ],
    };
  }

  // ── Medium / Large ───────────────────────────────────────
  const mainCurrency = { code: "USD", label: "美元", unit: 1, flag: "🇺🇸" };
  const gridCurrencies = [
    { code: "HKD", label: "HKD", unit: 1,   flag: "🇭🇰" },
    { code: "EUR", label: "EUR", unit: 1,   flag: "🇪🇺" },
    { code: "JPY", label: "JPY", unit: 1,   flag: "🇯🇵" },
    { code: "GBP", label: "GBP", unit: 1,   flag: "🇬🇧" },
    { code: "KRW", label: "KRW", unit: 100, flag: "🇰🇷" },
    { code: "THB", label: "THB", unit: 1,   flag: "🇹🇭" },
  ];

  const mainRate  = getRate(mainCurrency.code, mainCurrency.unit);
  const mainTrend = getTrend(mainCurrency.code);

  function makeCell(c) {
    const rate  = getRate(c.code, c.unit);
    const trend = getTrend(c.code);
    const unitLabel = c.unit > 1 ? `${c.flag} ${c.unit} ${c.label}` : `${c.flag} 1 ${c.label}`;
    const flexBase = adapt.getFlexRatio(1);
    
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      flex: 1,  // ✅ 单元格弹性占宽
      gap: 0,
      children: [
        {
          type: "text",
          text: unitLabel,
          font: { size: "footnote", weight: "regular" },
          textColor: { light: "#1C1C1E", dark: "#EBEBF5CC" },
          flex: flexBase * 5,  // ✅ 动态 flex 比例（保持原 5:1:4）
          maxLines: 1,
          minScale: adapt.getMinScale(),
          truncationMode: "tail",
        },
        {
          type: "text",
          text: "=",
          font: { size: "footnote" },
          textColor: { light: "#86868B", dark: "#636366" },
          flex: flexBase,
          textAlign: "center",
          maxLines: 1,
          minScale: adapt.getMinScale(),
        },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          flex: flexBase * 4,
          gap: 2,
          justifyContent: "flexEnd",  // ✅ 数值区域右对齐
          children: [
            { type: "spacer" },
            {
              type: "text",
              text: rate ? `¥${rate}` : "--",
              font: { size: "footnote", weight: "semibold" },
              textColor: { light: "#BF5900", dark: "#FFD60A" },
              maxLines: 1,
              minScale: adapt.getMinScale() * 0.9,
              textAlign: "right",
              truncationMode: "tail",
            },
            ...(trend !== "flat" ? [{
              type: "text",
              text: trendIcon(trend),
              font: { size: "caption2" },
              textColor: trendColor(trend),
              minScale: adapt.getMinScale(),
            }] : []),
          ],
        },
      ],
    };
  }

  const gridRows = [];
  for (let i = 0; i < gridCurrencies.length; i += 2) {
    if (i > 0) gridRows.push(hDivider);
    gridRows.push({
      type: "stack",
      direction: "row",
      alignItems: "center",
      flex: 1,  // ✅ 整行弹性
      gap: 0,
      children: [
        { type: "stack", flex: 1, children: [makeCell(gridCurrencies[i])] },
        { type: "spacer", length: 6 },
        vDivider,
        { type: "spacer", length: 6 },
        { type: "stack", flex: 1, children: [makeCell(gridCurrencies[i + 1])] },
      ],
    });
  }

  return {
    type: "widget",
    backgroundColor: bgColor,
    padding: [10, 14, 10, 14],
    gap: 6,
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children: [
      {
        type: "text",
        text: "汇率看板（人民币 / 单位）",
        font: { size: "caption2" },
        textColor: { light: "#86868B", dark: "#636366" },
        maxLines: 1,
        minScale: 0.9,
      },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          { type: "text", text: mainCurrency.flag, font: { size: "title3" }, minScale: 0.85 },
          {
            type: "text",
            text: `国际${mainCurrency.label} ¥${mainRate || "--"}`,
            font: { size: "title3", weight: "bold" },
            textColor: { light: "#000000", dark: "#FFFFFF" },
            flex: 1,  // ✅ 主汇率文字弹性占宽
            maxLines: 1,
            minScale: 0.7,
            truncationMode: "tail",
          },
          ...(mainTrend !== "flat" ? [{
            type: "text",
            text: trendIcon(mainTrend),
            font: { size: "caption2" },
            textColor: trendColor(mainTrend),
            minScale: 0.9,
          }] : []),
          {
            type: "date",
            date: new Date().toISOString(),
            format: "time",
            font: { size: "caption1" },
            textColor: { light: "#86868B", dark: "#636366" },
            minScale: 0.9,
          },
        ],
      },
      hDivider,
      {
        type: "stack",
        direction: "column",
        flex: 1,  // ✅ 网格区域弹性填充剩余高度
        gap: 0,
        justifyContent: "spaceBetween",  // ✅ 均匀分布行高
        children: gridRows,
      },
    ],
  };
}

