/**
 * 中国联通话费流量小组件
 *
 * 自动获取方式：
 * 1. 打开中国联通 App
 * 2. 进入首页
 * 3. 点击当前余额 / 话费位置，让 App 查询一次
 * 4. Egern 会自动捕获联通 App 请求中的 Cookie 和手机号
 * 5. 小组件自动使用捕获的数据，无需手动填写环境变量
 *
 * 自动捕获域名：
 * m.client.10010.com
 *
 * 数据接口：
 * https://m.client.10010.com/mobileserviceimportant/home/queryUserInfoSeven
 */


/* =========================================================
 * Token / Cookie 捕获
 * ========================================================= */

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

  if (!url.includes("m.client.10010.com")) return;

  const cookie = String(getRequestHeader(req.headers, "Cookie") || "").trim();
  if (!cookie) return;

  const oldCookie = ctx.storage.get("unicom_cookie") || "";
  if (cookie === oldCookie) return;

  ctx.storage.set("unicom_cookie", cookie);

  // 尝试从 Cookie 里提取手机号
  const phoneMatch = cookie.match(/u_account=(\d{11})/);
  if (phoneMatch) {
    ctx.storage.set("unicom_phone", phoneMatch[1]);
  }

  ctx.notify({
    title: "中国联通",
    body: "已自动获取登录信息，小组件将自动更新",
  });
}


/* =========================================================
 * 颜色配置
 * ========================================================= */

const COLORS = {
  bg:        { light: "#FFFFFF", dark: "#2C2C2E" },
  border:    { light: "#E5E5EA", dark: "#3A3A3C" },
  title:     { light: "#666666", dark: "#8E8E93" },
  value:     { light: "#1C1C1E", dark: "#FFFFFF" },
  time:      { light: "#999999", dark: "#666666" },
  error:     { light: "#FF3B30", dark: "#FF453A" },
  capsuleBg: { light: "#F5F5F7", dark: "#3A3A3C" },
  accent:    { light: "#E60012", dark: "#FF3B30" },
};


/* =========================================================
 * 数据获取
 * ========================================================= */

async function fetchData(ctx) {
  const cookie =
    (ctx.env.Cookie || "").trim() ||
    (ctx.storage.get("unicom_cookie") || "").trim();

  const phone =
    (ctx.env.Phone || "").trim() ||
    (ctx.storage.get("unicom_phone") || "").trim();

  let data = {
    fee:   { title: "剩余话费", value: "--", unit: "元" },
    voice: { title: "剩余语音", value: "--", unit: "分" },
    flow:  { title: "剩余流量", value: "--", unit: "GB" },
    updateTime: "--:--",
    error: null,
  };

  if (!cookie) {
    data.error = "配置缺失";
    return data;
  }

  try {
    const resp = await ctx.http.get(
      "https://m.client.10010.com/mobileserviceimportant/home/queryUserInfoSeven?version=iphone&desmobile=" +
        (phone || "") +
        "&showType=3",
      {
        headers: {
          Cookie: cookie,
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 unicom{version:iphone_c@11.0500}",
        },
      }
    );

    const json = typeof resp.body === "string" ? JSON.parse(resp.body) : resp.body;

    if (json && json.code === "0000" && json.data) {
      const d = json.data;

      // 话费
      if (d.feeResource && d.feeResource.remain) {
        data.fee.value = parseFloat(d.feeResource.remain).toFixed(2);
      }

      // 语音
      if (d.voiceResource && d.voiceResource.remain) {
        data.voice.value = Math.floor(parseFloat(d.voiceResource.remain));
      }

      // 流量
      if (d.flowResource && d.flowResource.remain) {
        const remainMB = parseFloat(d.flowResource.remain);
        data.flow.value = (remainMB / 1024).toFixed(2);
      }

      data.updateTime = new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } else {
      data.error = json?.msg || "数据异常";
    }
  } catch (e) {
    data.error = e.message || "请求失败";
  }

  return data;
}


/* =========================================================
 * 顶部标题行
 * ========================================================= */

function headerRow(title, data, fromCache) {
  const updateTime = data?.updateTime || "--:--";

  return {
    type: "stack",
    direction: "row",
    alignItems: "center",
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          {
            type: "image",
            src: "sf-symbol:simcard.fill",
            color: COLORS.accent,
            width: 17,
            height: 17,
          },
          {
            type: "text",
            text: title,
            font: {
              size: "headline",
              weight: "semibold",
            },
            textColor: COLORS.value,
            maxLines: 1,
            minScale: 0.8,
          },
        ],
      },
      { type: "spacer" },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 5,
        children: [
          {
            type: "image",
            src: "sf-symbol:arrow.clockwise",
            color: COLORS.time,
            width: 12,
            height: 12,
          },
          {
            type: "text",
            text: updateTime,
            font: {
              size: "caption2",
            },
            textColor: COLORS.time,
            maxLines: 1,
          },
        ],
      },
    ],
  };
}


/* =========================================================
 * 通用数据胶囊（中号/大号用）
 * ========================================================= */

function makeCapsule(title, value, unit) {
  return {
    type: "stack",
    direction: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    padding: [7, 8, 7, 8],
    backgroundColor: COLORS.capsuleBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    children: [
      {
        type: "text",
        text: title,
        font: {
          size: "caption2",
          weight: "medium",
        },
        textColor: COLORS.title,
        textAlign: "center",
        maxLines: 1,
        minScale: 0.7,
      },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        children: [
          {
            type: "text",
            text: String(value),
            font: {
              size: "title2",
              weight: "semibold",
            },
            textColor: COLORS.value,
            textAlign: "center",
            maxLines: 1,
            minScale: 0.55,
          },
          {
            type: "text",
            text: unit,
            font: {
              size: "caption2",
            },
            textColor: COLORS.title,
            maxLines: 1,
            minScale: 0.7,
          },
        ],
      },
    ],
  };
}


/* =========================================================
 * 小尺寸专用紧凑胶囊
 * ========================================================= */

function makeSmallCapsule(title, value, unit) {
  return {
    type: "stack",
    direction: "row",
    alignItems: "center",
    padding: [6, 14, 6, 14],
    backgroundColor: COLORS.capsuleBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    children: [
      {
        type: "text",
        text: `${title} ${value}${unit ? " " + unit : ""}`,
        font: { size: "body", weight: "medium" },
        textColor: COLORS.value,
        textAlign: "center",
        maxLines: 1,
        minScale: 0.7,
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


/* =========================================================
 * 中号 / 大号 / 超大号
 * ========================================================= */

function buildMainWidget(title, data, fromCache) {
  return {
    type: "widget",
    backgroundColor: COLORS.bg,
    padding: [10, 14, 10, 14],
    gap: 10,
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children: [
      headerRow(title, data, fromCache),

      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 9,
        children: [
          makeCapsule(data.fee.title, data.fee.value, data.fee.unit),
          makeCapsule(data.voice.title, data.voice.value, data.voice.unit),
          makeCapsule(data.flow.title, data.flow.value, data.flow.unit),
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
            backgroundColor: COLORS.border,
          },
          { type: "spacer" },
        ],
      },
    ],
  };
}


/* =========================================================
 * 小尺寸（已优化）
 * ========================================================= */

function buildSmall(title, data, fromCache) {
  return {
    type: "widget",
    backgroundColor: COLORS.bg,
    padding: [10, 12, 10, 12],
    gap: 6,
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children: [
      // 顶部标题
      headerRow(title, data, fromCache),

      // 三行紧凑胶囊垂直堆叠
      {
        type: "stack",
        direction: "column",
        alignItems: "center",
        gap: 6,
        children: [
          wrapCenter(
            makeSmallCapsule(data.fee.title, data.fee.value, data.fee.unit)
          ),
          wrapCenter(
            makeSmallCapsule(data.voice.title, data.voice.value, data.voice.unit)
          ),
          wrapCenter(
            makeSmallCapsule(data.flow.title, data.flow.value, data.flow.unit)
          ),
        ],
      },

      // 底部短横线
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          { type: "spacer" },
          {
            type: "stack",
            width: 42,
            height: 3,
            borderRadius: 2,
            backgroundColor: COLORS.border,
          },
          { type: "spacer" },
        ],
      },
    ],
  };
}


/* =========================================================
 * 锁屏小组件
 * ========================================================= */

function buildLockScreen(title, data, family) {
  if (family === "accessoryInline") {
    return {
      type: "widget",
      children: [
        {
          type: "text",
          text:
            `${title} ${data.fee.value}${data.fee.unit} · ` +
            `${data.flow.value}${data.flow.unit}`,
          font: {
            size: "caption1",
            weight: "medium",
          },
          textColor: COLORS.value,
          maxLines: 1,
          minScale: 0.5,
        },
      ],
    };
  }

  if (family === "accessoryCircular") {
    return {
      type: "widget",
      padding: 4,
      children: [
        {
          type: "text",
          text: `${data.flow.value}`,
          font: {
            size: "title2",
            weight: "bold",
          },
          textColor: COLORS.value,
          textAlign: "center",
          maxLines: 1,
          minScale: 0.5,
        },
        {
          type: "text",
          text: data.flow.unit,
          font: {
            size: "caption2",
          },
          textColor: COLORS.title,
          textAlign: "center",
          maxLines: 1,
        },
      ],
    };
  }

  return {
    type: "widget",
    padding: 4,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          {
            type: "image",
            src: "sf-symbol:simcard.fill",
            color: COLORS.accent,
            width: 15,
            height: 15,
          },
          {
            type: "text",
            text: `${data.fee.value}${data.fee.unit}`,
            font: {
              size: "headline",
              weight: "semibold",
            },
            textColor: COLORS.value,
            maxLines: 1,
            minScale: 0.5,
          },
        ],
      },
      {
        type: "text",
        text: `${data.flow.value}${data.flow.unit}`,
        font: {
          size: "caption1",
          weight: "medium",
        },
        textColor: COLORS.title,
        maxLines: 1,
        minScale: 0.7,
      },
    ],
  };
}


/* =========================================================
 * 错误小组件
 * ========================================================= */

function buildError(title, message) {
  return {
    type: "widget",
    backgroundColor: COLORS.bg,
    padding: [12, 14, 12, 14],
    children: [
      {
        type: "text",
        text: title,
        font: { size: "headline", weight: "semibold" },
        textColor: COLORS.value,
      },
      {
        type: "text",
        text: message || "数据获取失败",
        font: { size: "footnote" },
        textColor: COLORS.error,
        maxLines: 3,
      },
    ],
  };
}


/* =========================================================
 * 主入口
 * ========================================================= */

export default async function (ctx) {
  // 捕获模式
  if (ctx.request && ctx.request.url) {
    return handleCapture(ctx);
  }

  // 小组件模式
  const family =
    ctx.widgetFamily ||
    "systemSmall";

  const title = "中国联通";
  let data = await fetchData(ctx);
  const fromCache = false;

  if (data.error) {
    return buildError(title, data.error);
  }

  if (
    family === "accessoryCircular" ||
    family === "accessoryRectangular" ||
    family === "accessoryInline"
  ) {
    return buildLockScreen(title, data, family);
  }

  if (family === "systemSmall") {
    return buildSmall(title, data, fromCache);
  }

  return buildMainWidget(title, data, fromCache);
}