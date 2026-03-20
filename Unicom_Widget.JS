/**
 * 中国联通话费流量小组件
 *
 * Cookie 获取：抓包工具 → 登录联通 App → 点首页 → 点你当前余额位置查询 → 然后回到你的抓包工具 → 复制 m.client.10010.com 请求中的 Cookie
 *
 *# ── 环境变量配置 ──
 *Cookie: "抓包获取的Cookie
 *手机号： "186xxxxxxxx（联通手机号）"
 *
 */
export default async function(ctx) {
 const cookie = ctx.env.Cookie || "";
 const phone = ctx.env.手机号 || "";

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

 let data = {
 fee: { title: "剩余话费", value: "--", unit: "元" },
 voice: { title: "剩余语音", value: "--", unit: "分钟" },
 flow: { title: "剩余流量", value: "--", unit: "MB" },
 updateTime: "--:--",
 error: null,
 debugInfo: [],
 };

 if (!phone || !cookie) {
 data.error = "配置缺失";
 if (!phone) data.debugInfo.push("❌ 未填写「手机号」");
 if (!cookie) data.debugInfo.push("❌ 未填写「Cookie」");
 data.debugInfo.push("💡 请在小组件配置页 → 环境变量中添加");
 } else {
 try {
 const url = `https://m.client.10010.com/mobileserviceimportant/home/queryUserInfoSeven?version=iphone_c@10.0100&desmobiel=${encodeURIComponent(phone)}&showType=0`;

 const resp = await ctx.http.get(url, {
 timeout: 8000,
 headers: {
 "Host": "m.client.10010.com",
 "User-Agent": "ChinaUnicom.x CFNetwork iOS/16.3",
 "cookie": cookie,
 },
 });

 const res = await resp.json();

 if (res?.code === "Y" && res.feeResource && res.voiceResource && res.flowResource) {
 data.fee = {
 title: res.feeResource.dynamicFeeTitle || "剩余话费",
 value: res.feeResource.feePersent ?? 0,
 unit: res.feeResource.newUnit || "元",
 };
 data.voice = {
 title: res.voiceResource.dynamicVoiceTitle || "剩余语音",
 value: res.voiceResource.voicePersent ?? 0,
 unit: res.voiceResource.newUnit || "分钟",
 };
 data.flow = {
 title: res.flowResource.dynamicFlowTitle || "剩余流量",
 value: res.flowResource.flowPersent ?? 0,
 unit: res.flowResource.newUnit || "MB",
 };
 data.updateTime = new Date().toLocaleTimeString("zh-CN", {
 hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai"
 });
 } else {
 data.error = "API 返回异常";
 data.debugInfo.push(`响应 code: ${res?.code}`, "可能 Cookie 已过期");
 }
 } catch (e) {
 data.error = "请求失败";
 data.debugInfo.push(`错误: ${e.message}`);
 }
 }

 const widgetFamily = ctx.widgetFamily;
 const isSmall = widgetFamily === "systemSmall";

 const feeTitle = isSmall ? "话费" : data.fee.title;
 const voiceTitle = isSmall ? "语音" : data.voice.title;
 const flowTitle = isSmall ? "流量" : data.flow.title;

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
 text: `${title} ${value} ${unit}`,
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

 const capsules = isSmall ? [
 wrapCenter(makeSmallCapsule(feeTitle, data.fee.value, data.fee.unit)),
 wrapCenter(makeSmallCapsule(voiceTitle, data.voice.value, data.voice.unit)),
 wrapCenter(makeSmallCapsule(flowTitle, data.flow.value, data.flow.unit)),
 ] : [
 makeMediumCapsule(data.fee.title, data.fee.value, data.fee.unit),
 makeMediumCapsule(data.voice.title, data.voice.value, data.voice.unit),
 makeMediumCapsule(data.flow.title, data.flow.value, data.flow.unit),
 ];

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
 { type: "image", src: "sf-symbol:simcard.fill", color: colors.accent, width: isSmall ? 14 : 18, height: isSmall ? 14 : 18 },
 { type: "text", text: "中国联通", font: { size: isSmall ? "subheadline" : "headline", weight: "semibold" }, textColor: colors.value },
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
 children: capsules,
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