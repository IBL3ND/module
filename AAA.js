/**
 * 中国广电流量话费小组件
 * * -----------------------------------------------------------
 * 📌 [配置指引 - 必看]
 * -----------------------------------------------------------
 * 1. 抓包目标：打开“中国广电”App 或 微信小程序，刷新首页。
 * 2. 查找接口：在抓包记录中搜索关键词 `qryUserInfo`
 * 3. 获取变量：
 * - [broadnet_access]: 在该请求的 [Headers] (请求头) 中找到 `access` 的值。
 * - [broadnet_body]: 在该请求的 [Body] (请求体) 中找到 `data` 对应的一长串加密字符串。
 * * 4. 填写位置：
 * - 进入 Egern -> 工具 -> 脚本 -> 编辑此脚本。
 * - 在下方的 [Env (环境变量)] 区域，点击添加：
 * Key: broadnet_access  |  Value: (粘贴刚才找的值)
 * Key: broadnet_body    |  Value: (粘贴刚才找的值)
 *
 */

export default async function(ctx) {
  // 从环境变量读取配置，若未配置则默认为空
  const access = ctx.env.broadnet_access || "";
  const bodyData = ctx.env.broadnet_body || "";

  // UI 配色方案 (适配深浅色)
  const colors = {
    bg: { light: "#FFFFFF", dark: "#2C2C2E" },
    border: { light: "#E5E5EA", dark: "#3A3A3C" },
    title: { light: "#666666", dark: "#8E8E93" },
    value: { light: "#1C1C1E", dark: "#FFFFFF" },
    time: { light: "#999999", dark: "#666666" },
    capsuleBg: { light: "#F5F5F7", dark: "#3A3A3C" },
    accent: { light: "#1E81B0", dark: "#409EFF" }, 
  };

  let data = {
    fee: { title: "剩余话费", value: "0.00", unit: "元" },
    voice: { title: "剩余语音", value: "0", unit: "分钟" },
    flow: { title: "剩余流量", value: "0.00", unit: "GB" },
    updateTime: "--:--",
    status: "正常",
  };

  // --- 数据请求部分 ---
  if (!access || !bodyData) {
    data.status = "未配置环境变量";
  } else {
    try {
      const url = 'https://wx.10099.com.cn/contact-web/api/busi/qryUserInfo';
      const resp = await ctx.http.post(url, {
        timeout: 8000,
        headers: {
          'access': access,
          'content-type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
        },
        body: JSON.stringify({ "data": bodyData }),
      });

      const res = await resp.json();

      if (res?.status === '000000' && res.data?.userData) {
        const info = res.data.userData;
        data.fee.value = (info.fee / 100).toFixed(2);
        data.flow.value = (info.flow / 1048576).toFixed(2); // KB转GB
        data.voice.value = info.voice;
        
        const now = new Date();
        data.updateTime = (now.getHours() < 10 ? '0' : '') + now.getHours() + ":" + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
      } else {
        data.status = "认证过期，请重新抓包";
      }
    } catch (e) {
      data.status = "网络连接异常";
    }
  }

  // --- UI 组件定义 ---
  const isSmall = ctx.widgetFamily === "systemSmall";

  // 小尺寸下的单行胶囊
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
      children: [{
        type: "text",
        text: `${title} ${value} ${unit}`,
        font: { size: 13, weight: "medium" },
        textColor: colors.title,
        maxLines: 1,
      }],
    };
  }

  // 中尺寸下的块状胶囊
  function makeMediumCapsule(title, value, unit) {
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
        { type: "text", text: title, font: { size: 10, weight: "medium" }, textColor: colors.title },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 3,
          children: [
            { type: "text", text: String(value), font: { size: 18, weight: "semibold" }, textColor: colors.value },
            { type: "text", text: unit, font: { size: 10 }, textColor: colors.title },
          ],
        },
      ],
    };
  }

  // 根据尺寸选择显示的胶囊内容
  const capsules = isSmall ? [
    { type: "stack", direction: "row", children: [{ type: "spacer" }, makeSmallCapsule("话费", data.fee.value, "元"), { type: "spacer" }] },
    { type: "stack", direction: "row", children: [{ type: "spacer" }, makeSmallCapsule("流量", data.flow.value, "GB"), { type: "spacer" }] },
    { type: "stack", direction: "row", children: [{ type: "spacer" }, makeSmallCapsule("语音", data.voice.value, "分"), { type: "spacer" }] },
  ] : [
    makeMediumCapsule(data.fee.title, data.fee.value, data.fee.unit),
    makeMediumCapsule(data.flow.title, data.flow.value, data.flow.unit),
    makeMediumCapsule(data.voice.title, data.voice.value, data.voice.unit),
  ];

  // --- 最终 Widget 渲染 ---
  return {
    type: "widget",
    backgroundColor: colors.bg,
    padding: isSmall ? [10, 12, 10, 12] : [12, 14, 12, 14],
    gap: isSmall ? 6 : 12,
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children: [
      // 1. 顶部栏 (图标 + 标题 + 时间)
      {
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
              { type: "image", src: "sf-symbol:antenna.radiowaves.left.and.right", color: colors.accent, width: isSmall ? 14 : 18, height: isSmall ? 14 : 18 },
              { type: "text", text: "中国广电", font: { size: isSmall ? 14 : 16, weight: "semibold" }, textColor: colors.value },
            ],
          },
          { type: "spacer" },
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            gap: 4,
            children: [
              { type: "image", src: "sf-symbol:arrow.clockwise", color: colors.time, width: 10, height: 10 },
              { type: "text", text: data.updateTime, font: { size: 10 }, textColor: colors.time },
            ],
          },
        ],
      },

      // 2. 状态异常显示 (如果有错就显示提示词)
      ...(data.status !== "正常" ? [{
        type: "text",
        text: data.status,
        font: { size: 11 },
        textColor: "#FF3B30",
        textAlign: "center"
      }] : []),

      // 3. 核心胶囊区域
      {
        type: "stack",
        direction: isSmall ? "column" : "row",
        alignItems: "center",
        gap: isSmall ? 6 : 9,
        children: capsules,
      },

      // 4. 底部装饰装饰条
      {
        type: "stack",
        direction: "row",
        children: [
          { type: "spacer" },
          { type: "stack", width: 40, height: 3, borderRadius: 2, backgroundColor: colors.border },
          { type: "spacer" },
        ],
      },
    ],
  };
}
