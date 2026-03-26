/**
 * 中国移动话费流量小组件（Egern可用版）
 */

export default async function(ctx) {

 const colors = {
  bg: { light: "#FFFFFF", dark: "#2C2C2E" },
  border: { light: "#E5E5EA", dark: "#3A3A3C" },
  title: { light: "#666666", dark: "#8E8E93" },
  value: { light: "#1C1C1E", dark: "#FFFFFF" },
  time: { light: "#999999", dark: "#666666" },
  error: { light: "#FF3B30", dark: "#FF453A" },
  capsuleBg: { light: "#F5F5F7", dark: "#3A3A3C" },
  accent: { light: "#007AFF", dark: "#0A84FF" },
 };

 const url = "https://api.example.com/10086/query"

 let data = {
  fee: { title: "剩余话费", value: "--", unit: "元" },
  voice: { title: "剩余语音", value: "--", unit: "分钟" },
  flow: { title: "剩余流量", value: "--", unit: "MB" },
  updateTime: "--:--",
  error: null,
 }

 function now() {
  return new Date().toLocaleTimeString("zh-CN", {
   hour: "2-digit",
   minute: "2-digit",
   timeZone: "Asia/Shanghai"
  })
 }

 // =========================
 // 📡 请求
 // =========================
 try {
  const resp = await ctx.http.post(url, {
   timeout: 8000,
   headers: { "Content-Type": "application/json" },
   body: "{}"
  })

  const res = await resp.json()

  if (res?.fee) {

   data.fee.value = res.fee.curFee ?? "0"

   let total = 0
   let used = 0

   const list = res?.plan?.planRemianFlowListRes?.planRemianFlowRes || []

   for (const item of list) {
    total += Number(item.flowSumNum || 0)
    used += Number(item.flowUsdNum || 0)
   }

   const remain = total - used

   data.flow.value = (remain / 1024).toFixed(2)
   data.flow.unit = "GB"

   const voice = res?.plan?.planRemianVoiceListRes?.planRemianVoiceInfoRes?.[0]

   if (voice) {
    data.voice.value = Math.floor(voice.voiceRemainNum || 0)
   }

   data.updateTime = now()

  } else {
   data.error = "返回异常"
  }

 } catch (e) {
  data.error = "请求失败"
 }

 // =========================
 // UI 构建（完全按你模板）
 // =========================
 const isSmall = ctx.widgetFamily === "systemSmall"

 const feeTitle = isSmall ? "话费" : data.fee.title
 const voiceTitle = isSmall ? "语音" : data.voice.title
 const flowTitle = isSmall ? "流量" : data.flow.title

 function capsule(title, value, unit) {
  return isSmall
   ? {
    type: "stack",
    direction: "row",
    alignItems: "center",
    padding: [6, 14],
    backgroundColor: colors.capsuleBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    children: [
     {
      type: "text",
      text: `${title} ${value} ${unit}`,
      font: { size: "body", weight: "medium" },
      textColor: colors.title,
      textAlign: "center",
     }
    ]
   }
   : {
    type: "stack",
    direction: "column",
    alignItems: "center",
    flex: 1,
    padding: [8, 10],
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
     },
     {
      type: "stack",
      direction: "row",
      alignItems: "center",
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
        font: { size: "caption2" },
        textColor: colors.title,
       }
      ]
     }
    ]
   }
 }

 const capsules = isSmall
  ? [
    capsule(feeTitle, data.fee.value, data.fee.unit),
    capsule(voiceTitle, data.voice.value, data.voice.unit),
    capsule(flowTitle, data.flow.value, data.flow.unit),
   ]
  : [
    capsule(data.fee.title, data.fee.value, data.fee.unit),
    capsule(data.voice.title, data.voice.value, data.voice.unit),
    capsule(data.flow.title, data.flow.value, data.flow.unit),
   ]

 return {
  type: "widget",
  backgroundColor: colors.bg,
  padding: isSmall ? [10, 12] : [10, 14],
  gap: isSmall ? 6 : 12,
  refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  children: [

   // 标题栏
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
       { type: "image", src: "sf-symbol:antenna.radiowaves.left.and.right", color: colors.accent, width: 16, height: 16 },
       { type: "text", text: "中国移动", font: { size: "headline", weight: "semibold" }, textColor: colors.value },
      ],
     },
     { type: "spacer" },
     {
      type: "text",
      text: data.updateTime,
      font: { size: "caption2" },
      textColor: colors.time,
     },
    ],
   },

   // 数据区
   {
    type: "stack",
    direction: isSmall ? "column" : "row",
    gap: isSmall ? 6 : 10,
    children: capsules,
   },

   // 错误提示
   data.error
    ? {
      type: "text",
      text: data.error,
      textColor: colors.error,
      font: { size: "caption2" },
     }
    : null,

  ].filter(Boolean),
 }
}