// 机场订阅小组件
// 环境变量：NAME1/URL1/RESET1 ... NAME5/URL5/RESET5

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

  const bgGradient = {
    type: "linear",
    colors: ["#1B3A6B", "#1E3A8A", "#2D1B69", "#1A1040"],
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
              color: "#6E7FF3",
            },
            {
              type: "text",
              text: "订阅流量",
              font: { size: "caption1", weight: "semibold" },
              textColor: "#FFFFFF66",
            },
          ],
        },
        { type: "spacer" },
        {
          type: "text",
          text: "请配置 URL1 环境变量",
          font: { size: "caption1" },
          textColor: "#FF453A",
          textAlign: "center",
        },
      ],
    };
  }

  const results = await Promise.all(slots.map((s) => fetchInfo(ctx, s)));
  const cards = results.map((r) => buildCard(r, slots.length));

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
            color: "#6E7FF3",
          },
          {
            type: "text",
            text: "订阅流量",
            font: { size: "caption1", weight: "semibold" },
            textColor: "#FFFFFF55",
          },
          { type: "spacer" },
          {
            type: "image",
            src: "sf-symbol:clock",
            width: 11,
            height: 11,
            color: "#FFFFFF33",
          },
          {
            type: "text",
            text: timeStr,
            font: { size: "caption2" },
            textColor: "#FFFFFF44",
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

function buildCard(result, total) {
  const { name, error, used, totalBytes, percent, expire, remainDays } = result;

  const usageColor =
    error
      ? "#FF453A"
      : percent >= 90
      ? "#FF453A"
      : percent >= 70
      ? "#FF9F0A"
      : "#34D399";

  // 错误卡片
  if (error) {
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 6,
      padding: [9, 11, 9, 11],
      backgroundColor: "#FFFFFF07",
      borderRadius: 11,
      borderWidth: 0.5,
      borderColor: "#FF453A28",
      children: [
        {
          type: "image",
          src: "sf-symbol:exclamationmark.circle.fill",
          width: 12,
          height: 12,
          color: "#FF453A",
        },
        {
          type: "text",
          text: name,
          font: { size: "caption1", weight: "semibold" },
          textColor: "#FFFFFFCC",
          maxLines: 1,
          minScale: 0.8,
          flex: 1,
        },
        {
          type: "text",
          text: "获取失败",
          font: { size: "caption2" },
          textColor: "#FF453A",
        },
      ],
    };
  }

  // 到期文字
  let expireText = "";
  let expireColor = "#FFFFFF40";
  if (expire) {
    const daysLeft = Math.ceil((expire * 1000 - Date.now()) / 86400000);
    if (daysLeft < 0) {
      expireText = "已到期";
      expireColor = "#FF453A";
    } else if (daysLeft <= 7) {
      expireText = `${daysLeft}天后到期`;
      expireColor = "#FF9F0A";
    } else {
      expireText = formatDate(expire);
    }
  } else if (remainDays !== null) {
    expireText = `${remainDays}天重置`;
    expireColor = remainDays <= 3 ? "#FF9F0A" : "#FFFFFF40";
  }

  const barFilled = Math.round(Math.min(Math.max(percent, 0), 100) / 10);
  const barEmpty = 10 - barFilled;
  const isSingle = total === 1;

  return {
    type: "stack",
    direction: "column",
    gap: 0,
    padding: isSingle ? [11, 13, 11, 13] : [9, 11, 9, 11],
    backgroundColor: "#FFFFFF08",
    borderRadius: 11,
    borderWidth: 0.5,
    borderColor: "#FFFFFF10",
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
            textColor: "#FFFFFFDD",
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
                  backgroundColor: "#FFFFFF15",
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
            textColor: "#FFFFFFAA",
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
  const m = url.match(/^https?:\/\/([^\/?#]+)/i);
  return m ? m[1] : "未命名订阅";
}
