/**
 * 📌 桌面小组件：✈️ 代理检测
 */
export default async function(ctx) {
  // 🎨 背景颜色（纯色，无渐变）- 使用 backgroundColor 属性
  const BG_COLOR = { light: '#FFFFFF', dark: '#2C2C2E' };
  
  // 🎨 文字颜色方案（自适应浅色/深色模式）
  const C_TITLE = { light: '#1A1A1A', dark: '#FFD700' };      // 标题
  const C_SUB   = { light: '#666666', dark: '#B0B0B0' };      // 副标题/标签
  const C_MAIN  = { light: '#1A1A1A', dark: '#FFFFFF' };      // 主内容文字
  const C_GREEN = { light: '#32D74B', dark: '#32D74B' };      // 状态/成功色（双色通用）
  const C_ICON_LOCAL = { light: '#007AFF', dark: '#0A84FF' }; // 本地 IP 图标色
  const C_ICON_REMOTE = { light: '#5856D6', dark: '#5E5CE6' }; // 落地 IP 图标色

  // 运营商格式化
  const fmtISP = (isp) => {
    if (!isp) return "未知";
    const s = String(isp).toLowerCase();
    if (/移动\|mobile\|cmcc/i.test(s)) return "中国移动";
    if (/电信\|telecom\|chinanet/i.test(s)) return "中国电信";
    if (/联通\|unicom/i.test(s)) return "中国联通";
    if (/广电\|broadcast\|cbn/i.test(s)) return "中国广电";
    return isp;
  };

  // 获取本地 IP 信息
  let lIp = "获取失败", lLoc = "未知位置", lIsp = "未知运营商";
  try {
    const lRes = await ctx.http.get('https://myip.ipip.net/json', { 
      headers: { 'User-Agent': 'Mozilla/5.0' }, 
      timeout: 4000 
    });
    const body = JSON.parse(await lRes.text());
    if (body?.data) {
      lIp = body.data.ip || "获取失败";
      const locArr = body.data.location || [];
      lLoc = `🇨🇳 ${locArr[1] || ""} ${locArr[2] || ""}`.trim() || "未知位置";
      lIsp = fmtISP(locArr[4] || locArr[3]);
    }
  } catch (e) {}

  // 备用接口
  if (lIp === "获取失败" || !lIp) {
    try {
      const res126 = await ctx.http.get('https://ipservice.ws.126.net/locate/api/getLocByIp', { 
        headers: { 'User-Agent': 'Mozilla/5.0' }, 
        timeout: 4000 
      });
      const body126 = JSON.parse(await res126.text());
      if (body126?.result) {
        lIp = body126.result.ip;
        lLoc = `🇨🇳 ${body126.result.province || ""} ${body126.result.city || ""}`.trim();
        lIsp = fmtISP(body126.result.operator || body126.result.company);
      }
    } catch (e) {}
  }

  // 获取落地 IP 信息
  let nIp = "获取失败", nLoc = "未知位置", nIsp = "未知运营商";
  try {
    const nRes = await ctx.http.get('http://ip-api.com/json/?lang=zh-CN', { timeout: 4000 });
    const nData = JSON.parse(await nRes.text());
    nIp = nData.query || "获取失败";
    nIsp = fmtISP(nData.isp || "未知运营商");
    let code = nData.countryCode || "";
    if (code.toUpperCase() === 'TW') code = 'CN';
    const flag = code ? String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt())) : "🌐";
    nLoc = `${flag} ${nData.country || ""} ${nData.city || ""}`.trim();
  } catch (e) {}

  // 当前时间
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  // 🔧 通用 Row 组件（符合文档规范）
  const Row = (iconName, iconColor, label, value, valueColor) => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
    children: [
      { type: 'image', src: `sf-symbol:${iconName}`, color: iconColor, width: 13, height: 13 },
      { type: 'text', text: label, font: { size: 11 }, textColor: C_SUB },
      { type: 'spacer' },
      { type: 'text', text: value, font: { size: 11, weight: 'bold', family: 'Menlo' }, textColor: valueColor, maxLines: 1, minScale: 0.6 }
    ]
  });

  // 🎯 返回 Widget DSL（严格按文档结构）
  return {
    type: 'widget',
    padding: 14,
    gap: 8,
    // ✅ 使用 backgroundColor 实现纯色背景（文档规范做法）
    backgroundColor: BG_COLOR,
    children: [
      // 标题栏
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          { type: 'image', src: 'sf-symbol:paperplane.fill', color: C_TITLE, width: 16, height: 16 },
          { type: 'text', text: '代理检测', font: { size: 14, weight: 'heavy' }, textColor: C_TITLE },
          { type: 'spacer' },
        ]
      },
      // 内容区域
      {
        type: 'stack',
        direction: 'column',
        gap: 4,
        children: [
          // 本地信息（蓝色系图标）
          Row("house.fill", C_ICON_LOCAL, "本地 IP", lIp, C_GREEN),
          Row("map.fill", C_ICON_LOCAL, "本地位置", lLoc, C_MAIN),
          Row("antenna.radiowaves.left.and.right", C_ICON_LOCAL, "运营商", lIsp, C_MAIN),
          { type: 'spacer', length: 4 },
          // 落地信息（紫色系图标）
          Row("network", C_ICON_REMOTE, "落地 IP", nIp, C_GREEN),
          Row("mappin.and.ellipse", C_ICON_REMOTE, "落地位置", nLoc, C_MAIN),
          Row("server.rack", C_ICON_REMOTE, "运营商", nIsp, C_MAIN),
          Row("clock.fill", C_GREEN, "执行时间", timeStr, C_GREEN)
        ]
      }
    ]
  };
}

