/**
 * 南方电网用电小组件
 *
 * 自动获取方式：
 * 1. 打开南方电网 App 或小程序
 * 2. 登录账号，进入「我的用电」或「电费查询」页面，等待数据加载
 * 3. Egern 会自动捕获请求头里的 x-auth-token
 * 4. 小组件自动使用捕获的 Token，无需手动填写环境变量
 *
 * 自动捕获域名：
 * 95598.csg.cn
 *
 * 也可以手动填写（可选，填写后优先使用）：
 * 环境变量 Token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxx"
 *
 * 同一个 JS：
 * http_request → 自动抓 Token
 * schedule     → 保活：定时查一次接口续 session（ctx.cron 或 Env CSG_KEEPALIVE=true）
 * generic      → 显示 Widget
 */

/* ---------- Token 捕获 ---------- */

function getRequestHeader(headers, name) {
  if (!headers) return "";

  try {
    if (typeof headers.get === "function") {
      return headers.get(name) || "";
    }
  } catch (e) {}

  try {
    for (const key of Object.keys(headers)) {
      if (String(key).toLowerCase() === name.toLowerCase()) {
        return headers[key] || "";
      }
    }
  } catch (e) {}

  return "";
}

async function handleCapture(ctx) {
  const req = ctx.request || {};
  const url = String(req.url || "");

  // 只处理南方电网的请求，其余透传
  if (!url.includes("95598.csg.cn")) return;

  const token = String(getRequestHeader(req.headers, "x-auth-token") || "").trim();
  if (!token) return;

  // Token 没变化就不重复保存和通知
  const oldToken = ctx.storage.get("csg_token") || "";
  if (token === oldToken) return;

  ctx.storage.set("csg_token", token);

  ctx.notify({
    title: "南方电网",
    body: "已自动获取登录信息，小组件将自动更新",
  });
}

/* ---------- 数据请求（小组件与保活用） ---------- */

async function fetchCsgData(ctx, token) {
  const resp = await ctx.http.post(
    "https://95598.csg.cn/ucs/ma/zt/eleCustNumber/queryBindEleUsers",
    {
      headers: { "x-auth-token": token, "Content-Type": "application/json" },
      body: "{}"
    }
  );
  const res = await resp.json();

  // 原逻辑：未绑定用电户时静默跳过（保持 "--" 显示，不报错）
  if (!res?.data?.[0]) {
    return null;
  }
  const u = res.data[0];

  const bResp = await ctx.http.post(
    "https://95598.csg.cn/ucs/ma/zt/charge/queryUserAccountNumberSurplus",
    {
      headers: { "x-auth-token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ areaCode: u.areaCode, eleCustId: u.bindingId })
    }
  );
  const bRes = await bResp.json();

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

  const out = {
    bal: String(bRes.data?.[0]?.balance ?? "0.00"),
    total: "--",
    yst: "--",
    updateTime: new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai"
    }),
  };

  if (pRes?.data) {
    out.total = String(pRes.data.totalPower ?? "0.00");
    const list = pRes.data.result || [];
    if (list.length > 0) {
      out.yst = String(list[list.length - 1].power ?? "0.00");
    }
  }

  return out;
}

/* ---------- 保活模式（schedule 定时任务调用） ----------
 *
 * 定时查一次接口，利用服务端 session 滑动过期机制续命；
 * 局限：只对"因不活跃过期"有效，若服务端是固定时长过期则无效；
 * iOS 后台定时触发频率不保证。
 * 失败时静默（小组件下次刷新时会显示请求失败状态）。
 */
async function handleKeepAlive(ctx) {
  const token =
    (ctx.env.Token || "").trim() ||
    (ctx.storage.get("csg_token") || "").trim();

  if (!token) return;

  try {
    await fetchCsgData(ctx, token);
  } catch (e) {}
}

/* ---------- 小组件 ---------- */

/* 小尺寸专用：圆形图标 + 数值 + 说明 的横条 */
function smallRow(color, symbol, glyph, value, unit, label) {
  const iconChild = symbol
    ? {
        type: "image",
        src: symbol,
        color: "#FFFFFF",
        width: 16,
        height: 16,
      }
    : {
        type: "text",
        text: glyph,
        font: { size: "headline", weight: "bold" },
        textColor: "#FFFFFF",
      };

  return {
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    padding: [4, 8, 4, 8],
    backgroundColor: { light: color + "1F", dark: color + "33" },
    borderRadius: 14,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: color,
        children: [iconChild],
      },
      {
        type: "stack",
        direction: "column",
        flex: 1,
        children: [
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            gap: 3,
            children: [
              { type: "text", text: String(value), font: { size: "title3", weight: "bold" }, textColor: color, maxLines: 1, minScale: 0.5 },
              { type: "text", text: String(unit), font: { size: "caption1", weight: "semibold" }, textColor: color, maxLines: 1 },
              { type: "spacer" },
            ],
          },
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            children: [
              { type: "text", text: String(label), font: { size: "caption2", weight: "medium" }, textColor: color + "B3", maxLines: 1, minScale: 0.7 },
              { type: "spacer" },
            ],
          },
        ],
      },
    ],
  };
}

/* 锁屏专用：透明背景，文字颜色交给系统处理 */
function buildLockScreen(data, family) {
  const SUB = { light: "#FFFFFFB3", dark: "#FFFFFFB3" };

  // 单行：昨日用电 · 余额
  if (family === "accessoryInline") {
    return {
      type: "widget",
      children: [
        {
          type: "text",
          text: `南方电网 昨日${data.yst.value}${data.yst.unit} · 余额${data.bal.value}${data.bal.unit}`,
          font: { size: "caption1", weight: "medium" },
          maxLines: 1,
          minScale: 0.5,
        },
      ],
    };
  }

  // 圆形：只显示昨日用电
  if (family === "accessoryCircular") {
    return {
      type: "widget",
      padding: 2,
      children: [
        { type: "spacer" },
        {
          type: "text",
          text: `${data.yst.value}`,
          font: { size: "headline", weight: "bold" },
          textAlign: "center",
          maxLines: 1,
          minScale: 0.5,
        },
        {
          type: "text",
          text: data.yst.unit,
          font: { size: "caption2" },
          textColor: SUB,
          textAlign: "center",
          maxLines: 1,
        },
        { type: "spacer" },
      ],
    };
  }

  // 矩形：三行，左边说明，右边数值
  const line = (label, value, unit) => ({
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 4,
    children: [
      { type: "text", text: label, font: { size: "caption2", weight: "medium" }, textColor: SUB, maxLines: 1 },
      { type: "spacer" },
      { type: "text", text: String(value), font: { size: "caption1", weight: "bold" }, maxLines: 1, minScale: 0.6 },
      { type: "text", text: String(unit), font: { size: "caption2" }, textColor: SUB, maxLines: 1 },
    ],
  });

  return {
    type: "widget",
    padding: 2,
    gap: 2,
    children: [
      line("昨日", data.yst.value, data.yst.unit),
      line("本月", data.total.value, data.total.unit),
      line("余额", data.bal.value, data.bal.unit),
    ],
  };
}

async function handleWidget(ctx) {
  // 手动填写的 Token 优先，其次用自动捕获的
  const token =
    (ctx.env.Token || "").trim() ||
    (ctx.storage.get("csg_token") || "").trim();

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

  let data = {
    yst:   { title: "昨日用电", value: "--", unit: "度" },
    total: { title: "本月累计", value: "--", unit: "度" },
    bal:   { title: "账户余额", value: "--", unit: "元" },
    fee:   "0.00",
    updateTime: "--:--",
    error: null,
    debugInfo: [],
  };

  if (!token) {
    data.error = "配置缺失";
    data.debugInfo.push("❌ 尚未获取到 Token");
    data.debugInfo.push("💡 请打开南方电网 App 或小程序，进入「我的用电」页面");
  } else {
    try {
      const f = await fetchCsgData(ctx, token);

      if (f) {
        data.bal.value = f.bal;
        data.total.value = f.total;
        data.yst.value = f.yst;
        data.updateTime = f.updateTime;
      }
    } catch (e) {
      data.error = "请求失败";
      data.debugInfo.push(`错误: ${e.message}`);
    }
  }

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

  const isSmall = ctx.widgetFamily === "systemSmall";

  function makeSmallCapsule(title, value, unit) {
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      padding: [6, 14, 6, 14],
      backgroundColor: colors.capsuleBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      children: [
        {
          type: "text",
          text: `${title} ${value}${unit ? " " + unit : ""}`,
          font: { size: "body", weight: "medium" },
          textColor: colors.title,
          textAlign: "center",
          numberOfLines: 1,
        },
      ],
    };
  }

  function wrapCenter(child) {
    return {
      type: "stack",
      direction: "row",
      children: [
        { type: "spacer" },
        child,
        { type: "spacer" },
      ],
    };
  }

  // ═══════════ 锁屏专用布局（仅 accessory 系列生效）═══════════
  if (ctx.widgetFamily && ctx.widgetFamily.startsWith("accessory")) {
    return buildLockScreen(data, ctx.widgetFamily);
  }
  // ═══════════ 锁屏专用布局结束 ═══════════

  // ═══════════ 小尺寸专用布局（仅 systemSmall 生效，其他尺寸不受影响）═══════════
  if (isSmall) {
    return {
      type: "widget",
      backgroundColor: colors.bg,
      padding: [10, 10, 10, 10],
      gap: 6,
      refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      children: [
        smallRow("#E8651F", "sf-symbol:bolt.fill", "", data.yst.value, data.yst.unit, data.yst.title),
        smallRow("#4DA6F0", "sf-symbol:calendar", "", data.total.value, data.total.unit, data.total.title),
        smallRow("#55C759", null, "¥", data.bal.value, data.bal.unit, data.bal.title),
      ],
    };
  }
  // ═══════════ 小尺寸专用布局结束 ═══════════

  return {
    type: "widget",
    backgroundColor: colors.bg,
    padding: isSmall ? [10, 12, 10, 12] : [10, 14, 10, 14],
    gap: isSmall ? 6 : 12,
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            gap: isSmall ? 5 : 7,
            children: [
              { type: "image", src: "sf-symbol:bolt.square.fill", color: colors.accent, width: isSmall ? 14 : 18, height: isSmall ? 14 : 18 },
              { type: "text", text: "南方电网", font: { size: isSmall ? "subheadline" : "headline", weight: "semibold" }, textColor: colors.value },
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

      {
        type: "stack",
        direction: isSmall ? "column" : "row",
        alignItems: "center",
        gap: isSmall ? 6 : 9,
        children: isSmall ? [
          wrapCenter(makeSmallCapsule("昨日", data.yst.value, "度")),
          wrapCenter(makeSmallCapsule("本月", data.total.value, "度")),
          wrapCenter(makeSmallCapsule("余额", data.bal.value, "元")),
        ] : [
          makeCapsule(data.yst.title, data.yst.value, data.yst.unit),
          makeCapsule(data.total.title, data.total.value, data.total.unit),
          makeCapsule(data.bal.title, data.bal.value, data.bal.unit, true),
        ],
      },

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

/* ---------- Egern 入口：单文件三模式 ----------
 *
 * http_request → 自动抓 Token
 * schedule     → 保活：定时查一次接口续 session（ctx.cron 或 Env CSG_KEEPALIVE=true）
 * generic      → 显示小组件
 */

export default async function(ctx) {
  // http_request 模式 → 自动抓 Token
  if (ctx.request && ctx.request.url) {
    return handleCapture(ctx);
  }

  // 保活模式：schedule 定时任务（ctx.cron 存在）或 Env CSG_KEEPALIVE=true
  if (ctx.cron || (ctx.env && ctx.env.CSG_KEEPALIVE === 'true')) {
    return handleKeepAlive(ctx);
  }

  // generic 模式 → 显示小组件
  return handleWidget(ctx);
}
