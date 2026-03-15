/**
 * 机场订阅流量监控小组件
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
 * @version 3.1
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

  // 高级配色系统
  const colors = {
    textPrimary: { light: "#000000", dark: "#FFFFFF" },
    textSecondary: { light: "#555555", dark: "#EBEBF5" },
    textTertiary: { light: "#888888", dark: "#8E8E93" },
    accentBlue: { light: "#007AFF", dark: "#0A84FF" },
    accentGreen: { light: "#34C759", dark: "#30D158" },
    accentOrange: { light: "#FF9500", dark: "#FF9F0A" },
    accentRed: { light: "#FF3B30", dark: "#FF453A" },
    accentPurple: { light: "#5856D6", dark: "#5856D6" },
    divider: { light: "#E5E5EA", dark: "#48484A" },
  };

  // 🔧 修改：背景渐变 - 浅色纯白 #FFFFFF / 深色 #2C2C2E
  const bgGradient = {
    type: "linear",
    colors: [
      { light: "#FFFFFF", dark: "#2C2C2E" },
      { light: "#FFFFFF", dark: "#2C2C2E" },
    ],
    stops: [0, 1],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 0, y: 1 },
  };

  if (!slots.length) {
    return {
      type: "widget",
      backgroundGradient: bgGradient,
      padding: 16,
      gap: 12,
      refreshAfter: refreshTime,
      children: [
        {
          type: "stack",
          direction: "column",
          gap: 10,
          alignItems: "center",
          children: [
            {
              type: "image",
              src: "sf-symbol:wifi.slash",
              width: 32,
              height: 32,
              color: colors.accentRed,
            },
            {
              type: "text",
              text: "未配置订阅",
              font: { size: "headline", weight: "semibold" },
              textColor: colors.textPrimary,
            },
            {
              type: "text",
              text: "请添加 URL1 环境变量",
              font: { size: "caption1" },
              textColor: colors.textTertiary,
            },
          ],
        },
      ],
    };
  }

  const results = await Promise.all(slots.map((s) => fetchInfo(ctx, s)));

  // 根据小组件尺寸调整显示
  const isMedium = ctx.widgetFamily === "systemMedium";
  const isLarge = ctx.widgetFamily === "systemLarge";

  return {
    type: "widget",
    backgroundGradient: bgGradient,
    padding: 14,
    gap: 10,
    refreshAfter: refreshTime,
    children: [
      // 顶部标题 - 紧凑设计
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 8,
        children: [
          {
            type: "image",
            src: "sf-symbol:network",
            width: 14,
            height: 14,
            color: colors.accentBlue,
          },
          {
            type: "text",
            text: "机场订阅流量监控",
            font: { size: "subheadline", weight: "bold" },
            textColor: colors.textPrimary,
          },
          { type: "spacer" },
          {
            type: "text",
            text: timeStr,
            font: { size: "caption2", weight: "medium" },
            textColor: colors.textTertiary,
          },
        ],
      },

      // 卡片容器
      {
        type: "stack",
        direction: "column",
        gap: 7,
        children: results.map((r, idx) => buildCompactCard(r, colors, idx)),
      },

      { type: "spacer" },
    ],
  };
}

// ─── 紧凑卡片设计 ─────────────────────────────────────────────

function buildCompactCard(result, colors, index) {
  const { name, error, used, totalBytes, percent, expire, remainDays } = result;

  // 状态颜色判断
  let statusColor = colors.accentGreen;
  if (error) {
    statusColor = colors.accentRed;
  } else if (percent >= 95) {
    statusColor = colors.accentRed;
  } else if (percent >= 80) {
    statusColor = colors.accentOrange;
  } else if (percent >= 50) {
    statusColor = colors.accentPurple;
  }

  // 错误状态
  if (error) {
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 8,
      padding: [10, 12],
      backgroundColor: { light: "#FFF5F5", dark: "#3B1F1F" },
      borderRadius: 10,
      borderWidth: 1,
      borderColor: { light: colors.accentRed.light + "20", dark: colors.accentRed.dark + "20" },
      children: [
        {
          type: "image",
          src: "sf-symbol:exclamationmark.circle.fill",
          width: 14,
          height: 14,
          color: colors.accentRed,
        },
        {
          type: "text",
          text: name,
          font: { size: "footnote", weight: "semibold" },
          textColor: colors.textPrimary,
          maxLines: 1,
          flex: 1,
        },
        {
          type: "text",
          text: "失败",
          font: { size: "caption2", weight: "semibold" },
          textColor: colors.accentRed,
        },
      ],
    };
  }

  // 获取到期信息
  let expireLabel = "";
  let expireColor = colors.textTertiary;

  if (expire) {
    const daysLeft = Math.ceil((expire * 1000 - Date.now()) / 86400000);
    if (daysLeft < 0) {
      expireLabel = "已到期";
      expireColor = colors.accentRed;
    } else if (daysLeft <= 7) {
      expireLabel = `${daysLeft}d`;
      expireColor = colors.accentOrange;
    } else if (daysLeft <= 30) {
      expireLabel = `${daysLeft}d`;
      expireColor = colors.textSecondary;
    }
  } else if (remainDays !== null && remainDays <= 3) {
    expireLabel = `${remainDays}d重置`;
    expireColor = colors.accentOrange;
  }

  const progressPercent = Math.min(Math.max(percent, 0), 100);

  return {
    type: "stack",
    direction: "column",
    gap: 6,
    padding: [10, 11],
    backgroundColor: { light: "#FFFFFF", dark: "#2B2B2D" },
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    children: [
      // 第一行：名称 + 百分比 + 到期
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          {
            type: "image",
            src: "sf-symbol:circle.fill",
            width: 8,
            height: 8,
            color: statusColor,
          },
          {
            type: "text",
            text: name,
            font: { size: "footnote", weight: "semibold" },
            textColor: colors.textPrimary,
            maxLines: 1,
            flex: 1,
            minScale: 0.85,
          },
          {
            type: "text",
            text: `${progressPercent.toFixed(0)}%`,
            font: { size: "caption1", weight: "bold" },
            textColor: statusColor,
          },
          ...(expireLabel
            ? [
                {
                  type: "text",
                  text: expireLabel,
                  font: { size: "caption2", weight: "medium" },
                  textColor: expireColor,
                },
              ]
            : []),
        ],
      },

      // 第二行：进度条
      {
        type: "stack",
        direction: "row",
        height: 4,
        gap: 1,
        children: Array.from({ length: 10 }, (_, i) => {
          const filled = i < Math.ceil((progressPercent / 100) * 10);
          return {
            type: "stack",
            flex: 1,
            height: 4,
            backgroundColor: filled ? statusColor : { light: "#E8E8EA", dark: "#2C2C2E" },
            borderRadius: 2,
            children: [],
          };
        }),
      },

      // 第三行：用量信息
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 8,
        children: [
          {
            type: "text",
            text: bytesToSize(used),
            font: { size: "caption2", weight: "semibold" },
            textColor: colors.textSecondary,
          },
          {
            type: "text",
            text: "/",
            font: { size: "caption2" },
            textColor: colors.textTertiary,
          },
          {
            type: "text",
            text: bytesToSize(totalBytes),
            font: { size: "caption2", weight: "semibold" },
            textColor: colors.textTertiary,
          },
          { type: "spacer" },
          {
            type: "text",
            text: `剩 ${bytesToSize(totalBytes - used)}`,
            font: { size: "caption2", weight: "medium" },
            textColor: colors.accentGreen,
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
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
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
  return "机场订阅";
}

