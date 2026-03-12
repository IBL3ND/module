/**
 * 机场订阅流量监控小组件 - Egern原生深浅色适配版
 * 
 * 📝 使用说明：
 * 
 * 1️⃣ 添加环境变量（在 Egern 中进入"编辑环境变量"）：
 * 
 *    格式：名称（大写）= 值
 * 
 *    NAME1 = 翻墙                    # 机场名称（自定义）
 *    URL1 = https://xxx.com/sub...   # 订阅地址（必填）
 *    RESET1 = 1                      # 重置日（可选，每月1日重置）
 * 
 *    NAME2 = 机场B
 *    URL2 = https://yyy.com/sub...
 *    RESET2 = 15                     # 每月15日重置
 * 
 *    ... 最多支持 5 个机场（NAME1-5, URL1-5, RESET1-5）
 * 
 * 2️⃣ 参数说明：
 *    - NAME1-5：机场名称，显示在卡片上（必填，否则显示"机场订阅"）
 *    - URL1-5：订阅地址，从机场后台复制（必填）
 *    - RESET1-5：流量重置日，1-28 的数字（可选）
 * 
 * 3️⃣ 示例：
 *    NAME1 = 翻墙
 *    URL1 = https://example.com/sub?token=abc123
 *    RESET1 = 1
 * 
 *    NAME2 = 备用机场
 *    URL2 = https://example2.com/sub?token=def456
 * 
 * 4️⃣ 注意事项：
 *    - 环境变量名称必须大写（NAME1、URL1 等）
 *    - 至少需要配置 URL1 才能显示
 *    - 订阅地址需要包含完整的 token
 *    - 小组件每小时自动刷新
 *    - 自动适配系统深色/浅色模式（无需配置）
 * 
 * @author 机场订阅监控
 * @version 3.0
 */

export default async function (ctx) {
  const MAX = 5;
  const slots = [];

  for (let i = 1; i <= MAX; i++) {
    const url = (ctx.env[`URL${i}`] || "").trim();
    if (!url) continue;
    slots.push({
      name: (ctx.env[`NAME${i}`] || "").trim() || inferName(url),
      url,
      resetDay: parseInt(ctx.env[`RESET${i}`] || "", 10) || null,
    });
  }

  const refreshTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // ✅ Egern 原生深浅色配置（自动切换）
  const colors = {
    bgCard: { light: "#FFFFFF", dark: "#2C2C2E" },
    bgCardBorder: { light: "#E5E5E7", dark: "#3A3A3C" },
    textPrimary: { light: "#1D1D1F", dark: "#FFFFFF" },
    textSecondary: { light: "#666666", dark: "#EBEBF5" },
    textTertiary: { light: "#999999", dark: "#AEAEB2" },
    textMuted: { light: "#CCCCCC", dark: "#636366" },
    iconPrimary: { light: "#5856D6", dark: "#5856D6" },
    iconSecondary: { light: "#8E8E93", dark: "#8E8E93" },
    iconMuted: { light: "#D1D1D6", dark: "#48484A" },
    error: { light: "#FF3B30", dark: "#FF453A" },
    warning: { light: "#FF9500", dark: "#FF9F0A" },
    success: { light: "#34C759", dark: "#30D158" },
    progressBg: { light: "#E5E5EA", dark: "#3A3A3C" },
  };

  const bgGradient = {
    type: "linear",
    colors: [
      { light: "#F5F5F7", dark: "#1C1C1E" },
      { light: "#FFFFFF", dark: "#2C2C2E" },
      { light: "#F8F8FA", dark: "#1C1C1E" },
      { light: "#FFFFFF", dark: "#2C2C2E" },
    ],
    stops: [0, 0.35, 0.7, 1],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 0.8, y: 1 },
  };

  if (!slots.length) {
    return {
      type: "widget",
      padding: 16,
      gap: 10,
      backgroundGradient: bgGradient,
      refreshAfter: refreshTime,
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          children: [
            {
              type: "image",
              src: "sf-symbol:chart.bar.fill",
              width: 13,
              height: 13,
              color: colors.iconPrimary,
            },
            {
              type: "text",
              text: "订阅流量",
              font: { size: "caption1", weight: "semibold" },
              textColor: colors.textSecondary,
            },
          ],
        },
        { type: "spacer" },
        {
          type: "text",
          text: "请配置 URL1 环境变量",
          font: { size: "caption1" },
          textColor: colors.error,
          textAlign: "center",
        },
      ],
    };
  }

  const results = await Promise.all(slots.map((s) => fetchInfo(ctx, s)));
  const cards = results.map((r) => buildCard(r, slots.length, colors));

  return {
    type: "widget",
    padding: [14, 14, 12, 14],
    gap: 10,
    backgroundGradient: bgGradient,
    refreshAfter: refreshTime,
    children: [
      // 顶部标题栏
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 5,
        children: [
          {
            type: "image",
            src: "sf-symbol:chart.bar.fill",
            width: 13,
            height: 13,
            color: colors.iconPrimary,
          },
          {
            type: "text",
            text: "订阅流量",
            font: { size: "caption1", weight: "semibold" },
            textColor: colors.textSecondary,
          },
          { type: "spacer" },
          {
            type: "image",
            src: "sf-symbol:clock",
            width: 11,
            height: 11,
            color: colors.iconMuted,
          },
          {
            type: "text",
            text: timeStr,
            font: { size: "caption2" },
            textColor: colors.textTertiary,
          },
        ],
      },

      // 卡片列表
      {
        type: "stack",
        direction: "column",
        gap: slots.length === 1 ? 0 : 7,
        children: cards,
      },

      { type: "spacer" },
    ],
  };
}

// ─── 卡片构建 ─────────────────────────────────────────────────

function buildCard(result, total, colors) {
  const { name, error, used, totalBytes, percent, expire, remainDays } = result;

  const usageColor =
    error
      ? colors.error
      : percent >= 90
      ? colors.error
      : percent >= 70
      ? colors.warning
      : colors.success;

  // 错误卡片
  if (error) {
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 6,
      padding: [9, 11, 9, 11],
      backgroundColor: colors.bgCard,
      borderRadius: 11,
      borderWidth: 0.5,
      borderColor: { light: colors.error.light + "40", dark: colors.error.dark + "40" },
      children: [
        {
          type: "image",
          src: "sf-symbol:exclamationmark.circle.fill",
          width: 12,
          height: 12,
          color: colors.error,
        },
        {
          type: "text",
          text: name,
          font: { size: "caption1", weight: "semibold" },
          textColor: colors.textPrimary,
          maxLines: 1,
          minScale: 0.8,
          flex: 1,
        },
        {
          type: "text",
          text: "获取失败",
          font: { size: "caption2" },
          textColor: colors.error,
        },
      ],
    };
  }

  // 到期文字
  let expireText = "";
  let expireColor = colors.textMuted;
  if (expire) {
    const daysLeft = Math.ceil((expire * 1000 - Date.now()) / 86400000);
    if (daysLeft < 0) {
      expireText = "已到期";
      expireColor = colors.error;
    } else if (daysLeft <= 7) {
      expireText = `${daysLeft}天后到期`;
      expireColor = colors.warning;
    } else {
      expireText = formatDate(expire);
    }
  } else if (remainDays !== null) {
    expireText = `${remainDays}天重置`;
    expireColor = remainDays <= 3 ? colors.warning : colors.textMuted;
  }

  const barFilled = Math.round(Math.min(Math.max(percent, 0), 100) / 10);
  const barEmpty = 10 - barFilled;
  const isSingle = total === 1;

  return {
    type: "stack",
    direction: "column",
    gap: 0,
    padding: isSingle ? [11, 13, 11, 13] : [9, 11, 9, 11],
    backgroundColor: colors.bgCard,
    borderRadius: 11,
    borderWidth: 0.5,
    borderColor: colors.bgCardBorder,
    children: [
      // ── 第一行：名称 + 到期 ──
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 5,
        children: [
          {
            type: "image",
            src: "sf-symbol:dot.radiowaves.left.and.right",
            width: 12,
            height: 12,
            color: usageColor,
          },
          {
            type: "text",
            text: name,
            font: { size: "caption1", weight: "semibold" },
            textColor: colors.textPrimary,
            maxLines: 1,
            minScale: 0.75,
            flex: 1,
          },
          ...(expireText
            ? [
                {
                  type: "text",
                  text: expireText,
                  font: { size: "caption2" },
                  textColor: expireColor,
                },
              ]
            : []),
        ],
      },

      // ── 名称与进度条之间固定间距 ──
      {
        type: "stack",
        direction: "row",
        height: 10,
        children: [],
      },

      // ── 第二行：进度条 ──
      {
        type: "stack",
        direction: "row",
        gap: 3,
        alignItems: "center",
        children: [
          ...(barFilled > 0
            ? [
                {
                  type: "stack",
                  flex: barFilled,
                  height: isSingle ? 5 : 4,
                  backgroundColor: usageColor,
                  borderRadius: 99,
                  children: [],
                },
              ]
            : []),
          ...(barEmpty > 0
            ? [
                {
                  type: "stack",
                  flex: barEmpty,
                  height: isSingle ? 5 : 4,
                  backgroundColor: colors.progressBg,
                  borderRadius: 99,
                  children: [],
                },
              ]
            : []),
        ],
      },

      // ── 进度条与用量行之间固定间距 ──
      {
        type: "stack",
        direction: "row",
        height: 5,
        children: [],
      },

      // ── 第三行：用量 + 百分比 ──
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          {
            type: "text",
            text: `${bytesToSize(used)} / ${bytesToSize(totalBytes)}`,
            font: { size: "caption2", weight: "medium" },
            textColor: colors.textSecondary,
          },
          { type: "spacer" },
          {
            type: "text",
            text: `${percent.toFixed(1)}%`,
            font: { size: "caption2", weight: "semibold" },
            textColor: usageColor,
          },
        ],
      },
    ],
  };
}

// ─── 网络请求 ─────────────────────────────────────────────────

const UA_LIST = [
  { "User-Agent": "Quantumult%20X/1.5.2" },
  { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" },
  { "User-Agent": "mihomo/1.19.3", Accept: "application/x-yaml,text/plain,*/*" },
];

async function fetchInfo(ctx, slot) {
  const urls = buildVariants(slot.url);

  for (const method of ["head", "get"]) {
    for (const url of urls) {
      for (const headers of UA_LIST) {
        try {
          const resp = await ctx.http[method](url, { headers, timeout: 9000 });
          const raw = resp.headers.get("subscription-userinfo") || "";
          const info = parseUserInfo(raw);
          if (info) {
            const used = (info.upload || 0) + (info.download || 0);
            const totalBytes = info.total || 0;
            const percent = totalBytes > 0 ? (used / totalBytes) * 100 : 0;
            return {
              name: slot.name,
              error: null,
              used,
              totalBytes,
              percent,
              expire: info.expire || null,
              remainDays: slot.resetDay ? getRemainingDays(slot.resetDay) : null,
            };
          }
        } catch (_) {}
      }
    }
  }

  return { name: slot.name, error: true };
}

function buildVariants(url) {
  const seen = new Set();
  const out = [];
  const add = (u) => {
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  };
  add(url);
  add(withParam(url, "flag", "clash"));
  add(withParam(url, "flag", "meta"));
  add(withParam(url, "target", "clash"));
  return out;
}

function withParam(url, key, value) {
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

function parseUserInfo(header) {
  if (!header) return null;
  const pairs = header.match(/\w+=[\d.eE+-]+/g) || [];
  if (!pairs.length) return null;
  return Object.fromEntries(
    pairs.map((p) => {
      const [k, v] = p.split("=");
      return [k, Number(v)];
    })
  );
}

// ─── 工具函数 ─────────────────────────────────────────────────

function bytesToSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatDate(ts) {
  const d = new Date(ts > 1e12 ? ts : ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getRemainingDays(resetDay) {
  const now = new Date();
  const day = now.getDate();
  let next = new Date(now.getFullYear(), now.getMonth(), resetDay);
  if (day >= resetDay) next = new Date(now.getFullYear(), now.getMonth() + 1, resetDay);
  return Math.max(0, Math.ceil((next - now) / 86400000));
}

function inferName(url) {
  // 如果环境变量中没有设置名称，返回默认名称
  return "机场订阅";
}

