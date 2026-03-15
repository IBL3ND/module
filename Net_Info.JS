/**
 * 📌 桌面小组件: 📶 网络信息
 */
export default async function(ctx) {
  const BG_COLOR = { light: '#FFFFFF', dark: '#2C2C2E' };
  const C_TITLE = { light: '#1A1A1A', dark: '#FFD700' };
  const C_SUB   = { light: '#666666', dark: '#B0B0B0' };
  const C_MAIN  = { light: '#1A1A1A', dark: '#FFFFFF' };
  const C_GREEN = { light: '#32D74B', dark: '#32D74B' };
  const C_ICON_NET = { light: '#007AFF', dark: '#0A84FF' };
  const C_ICON_IP = { light: '#34C759', dark: '#30D158' };
  const C_ICON_GATEWAY = { light: '#FF9500', dark: '#FF9F0A' };
  const C_ICON_PUBLIC = { light: '#5856D6', dark: '#5E5CE6' };

  const fmtISP = (isp) => {
    if (!isp) return "未知";
    const s = String(isp).toLowerCase();
    if (/移动\|mobile\|cmcc/i.test(s)) return "中国移动";
    if (/电信\|telecom\|chinanet/i.test(s)) return "中国电信";
    if (/联通\|unicom/i.test(s)) return "中国联通";
    if (/广电\|broadcast\|cbn/i.test(s)) return "中国广电";
    return isp;
  };

  const d = ctx.device || {};
  const isWifi = !!d.wifi?.ssid;

  let netName = "未连接", netIcon = "antenna.radiowaves.left.and.right";
  if (isWifi) {
    netName = d.wifi.ssid;
    netIcon = "wifi";
  } else if (d.cellular?.radio) {
    const radioMap = { "GPRS": "2.5G", "EDGE": "2.75G", "WCDMA": "3G", "LTE": "4G", "NR": "5G (NR)", "NRNSA": "5G (NR)" };
    const rawRadio = d.cellular.radio.toUpperCase().replace(/\s+/g, "");
    netName = `蜂窝: ${radioMap[rawRadio] || rawRadio}`;
  }

  const localIp = d.ipv4?.address || "获取失败";
  const gateway = d.ipv4?.gateway || "获取失败";

  let pubIp = "获取失败", pubLoc = "未知位置", pubIsp = "未知运营商";
  try {
    const res = await ctx.http.get('https://myip.ipip.net/json', { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 });
    const body = JSON.parse(await res.text());
    if (body && body.data) {
      pubIp = body.data.ip || "获取失败";
      const locArr = body.data.location || [];
      pubLoc = `🇨🇳 ${locArr[0] || "中国"} ${locArr[1] || ""} ${locArr[2] || ""}`.trim() || "未知位置";
      pubIsp = fmtISP(locArr[4] || locArr[3]);
    }
  } catch (e) {}

  if (pubIp === "获取失败" || !pubIp) {
    try {
      const res126 = await ctx.http.get('https://ipservice.ws.126.net/locate/api/getLocByIp', { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 });
      const body126 = JSON.parse(await res126.text());
      if (body126 && body126.result) {
        pubIp = body126.result.ip;
        pubLoc = `🇨🇳 中国 ${body126.result.province || ""} ${body126.result.city || ""}`.trim();
        pubIsp = fmtISP(body126.result.operator || body126.result.company);
      }
    } catch (e) {}
  }

  // 🔧 通用 Row 组件（右侧数值更大）
  const Row = (iconName, iconColor, label, value, valueColor) => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
    children: [
      { type: 'image', src: `sf-symbol:${iconName}`, color: iconColor, width: 14, height: 14 },
      { type: 'text', text: label, font: { size: 11 }, textColor: C_SUB },  // ← 左侧保持 11
      { type: 'spacer' },
      { 
        type: 'text', 
        text: value, 
        font: { size: 17, weight: 'bold', family: 'Menlo' },  // ← 右侧加大到 17
        textColor: valueColor, 
        maxLines: 1, 
        minScale: 0.5,
        lineBreakMode: 'tail',
        textAlign: 'right'
      }
    ]
  });

  return {
    type: 'widget',
    padding: 14,
    gap: 10,
    backgroundColor: BG_COLOR,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          { type: 'image', src: `sf-symbol:${netIcon}`, color: C_TITLE, width: 16, height: 16 },
          { type: 'text', text: '网络信息', font: { size: 14, weight: 'heavy' }, textColor: C_TITLE }
        ]
      },
      {
        type: 'stack',
        direction: 'column',
        gap: 8,
        children: [
          Row("network", C_ICON_NET, "当前连接", netName, C_GREEN),
          Row("iphone", C_ICON_IP, "内网 IP", localIp, C_GREEN),
          Row("wifi.router.fill", C_ICON_GATEWAY, "路由网关", gateway, C_GREEN),
          { type: 'spacer', length: 4 },
          Row("globe", C_ICON_PUBLIC, "直连公网", pubIp, C_GREEN),
          Row("mappin.and.ellipse", C_ICON_PUBLIC, "所在位置", pubLoc, C_MAIN),
          Row("antenna.radiowaves.left.and.right", C_ICON_PUBLIC, "运营商", pubIsp, C_MAIN)
        ]
      }
    ]
  };
}

