// IP信息 ➕ 流媒体解锁查询

export default async function(ctx) {
  const isSmall = ctx.widgetFamily === 'systemSmall';

  const C = {
    bg: { light: '#FFFFFF', dark: '#2C2C2E' },
    main: { light: '#000000', dark: '#FFFFFF' },
    sub: { light: '#1C1C1E', dark: '#F2F2F7' },
    muted: { light: '#8E8E93', dark: '#8E8E93' },
    gold: { light: '#FF9500', dark: '#FFD700' },
    orange: { light: '#FF6B00', dark: '#FF8800' },
    red: { light: '#FF3B30', dark: '#FF453A' },
    teal: { light: '#34C759', dark: '#30D158' },
    blue: { light: '#007AFF', dark: '#0A84FF' },
    purple: { light: '#AF52DE', dark: '#BF5AF2' },
    cyan: { light: '#5AC8FA', dark: '#64D2FF' }
  };

  // 🔑 新增：标签区域固定宽度（图标+2汉字），确保文字对齐
  const LABEL_WIDTH = 48;

  const httpGet = async (url) => {
    try {
      const start = Date.now();
      const resp = await ctx.http.get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 6000 });
      const text = await resp.text();
      const json = JSON.parse(text);
      return { data: json.data || json, ping: Date.now() - start };
    } catch (e) { return { data: {}, ping: 0 }; }
  };

  const getFlagEmoji = (cc) => {
    if (!cc) return "";
    const str = String(cc).toUpperCase();
    if (!/^[A-Z]{2}$/.test(str)) return "";
    return String.fromCodePoint(...[...str].map(c => 127397 + c.charCodeAt(0)));
  };

  const fmtISP = (isp) => {
    if (!isp) return "未知";
    const s = String(isp).toLowerCase();
    const raw = String(isp).replace(/\s*\(中国\)\s*/, "").replace(/\s+/g, " ").trim();
    if (/(^|[\s-])(cmcc|cmnet|cmi|mobile)\b|移动/.test(s)) return "中国移动";
    if (/(^|[\s-])(chinanet|telecom|ctcc|ct)\b|电信/.test(s)) return "中国电信";
    if (/(^|[\s-])(unicom|cncgroup|netcom|link)\b|联通/.test(s)) return "中国联通";
    if (/(^|[\s-])(cbn|broadcast)\b|广电/.test(s)) return "中国广电";
    return raw || "未知";
  };

  try {
    const d = ctx.device || {};
    const internalIP = d.ipv4?.address || "未连接";
    const gatewayIP = d.ipv4?.gateway;
    const wifiSsid = d.wifi?.ssid || "";
    const cellularRadio = d.cellular?.radio || "";

    const [localResp, nodeResp, pureResp] = await Promise.all([
      httpGet('https://myip.ipip.net/json'),
      httpGet('http://ip-api.com/json/?lang=zh-CN'),
      httpGet('https://my.ippure.com/v1/info')
    ]);

    const { data: local = {}, ping: localPing } = localResp;
    const { data: node = {}, ping: nodePing } = nodeResp;
    const pure = pureResp.data || {};

    const pingMs = nodePing || localPing || 0;

    const rawISP = (Array.isArray(local.location) ? local.location[local.location.length-1] : "") || node?.isp || node?.org || "";
    let currentISP = wifiSsid || fmtISP(rawISP);

    if (!wifiSsid && currentISP.includes("电信") && cellularRadio) {
      const map = { GPRS:"2G", EDGE:"2G", LTE:"4G", "LTE-CA":"4G+", NR:"5G" };
      currentISP = `${currentISP} ${map[cellularRadio] || cellularRadio}`;
    }

    const ispColor = currentISP.includes("电信") ? C.blue : C.main;

    const r1Content = [internalIP, gatewayIP !== internalIP ? gatewayIP : null].filter(Boolean).join("  -  ");

    let province = '';
    let city = '';
    if (Array.isArray(local.location)) {
      province = local.location[0] || '';
      city = local.location[1] || '';
    }
    const locStr = city ? `${province}.${city}` : province;
    const r2Content = [local.ip || "获取中...", locStr].filter(Boolean).join("  -  ");

    const nodeLoc = [getFlagEmoji(node.countryCode), node.country, node.city].filter(Boolean).join(" ");
    const asnStr = node.as ? String(node.as).split(' ')[0] : "";
    const r3Content = [node.query || node.ip || "获取中...", nodeLoc, asnStr].filter(Boolean).join("  -  ");

    const nativeText = pure.isResidential === true ? "家宽" : (pure.isResidential === false ? "机房" : "未知属性");
    const risk = pure.fraudScore || 0;
    let riskLevel = "低危";
    let riskColor = C.teal;
    if (risk >= 80) { riskLevel = "极高危"; riskColor = C.red; }
    else if (risk >= 70) { riskLevel = "高危"; riskColor = C.orange; }
    else if (risk >= 40) { riskLevel = "中危"; riskColor = C.gold; }

    const mediaServices = {
      GPT: true,
      Netflix: false,
      Disney: true,
      YouTube: true
    };

    return {
      type: 'widget',
      padding: isSmall ? [12, 14, 10, 14] : [16, 18, 12, 16],
      backgroundColor: C.bg,
      gap: isSmall ? 8 : 10,
      children: [
        // 标题行 - 左对齐，ping 推右
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 6,
          children: [
            {
              type: 'image',
              src: wifiSsid ? 'sf-symbol:wifi' : (cellularRadio ? 'sf-symbol:antenna.radiowaves.left.and.right' : 'sf-symbol:wifi.slash'),
              color: ispColor,
              width: 18,
              height: 18
            },
            {
              type: 'text',
              text: currentISP,
              font: { size: 18, weight: 'heavy' },
              textColor: ispColor,
              maxLines: 1,
              minScale: 0.75
            },
            { type: 'spacer' },
            {
              type: 'stack',
              direction: 'row',
              alignItems: 'center',
              gap: 4,
              children: [
                { type: 'image', src: 'sf-symbol:timer', color: C.sub, width: 14, height: 14 },
                { type: 'text', text: pingMs > 0 ? `${pingMs}ms` : '--ms', font: { size: 14 }, textColor: C.sub }
              ]
            }
          ]
        },

        { type: 'spacer' },

        // 🏠 内网行 - ✅ 标签固定宽度对齐
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 10,
          children: [
            {
              type: 'stack',
              direction: 'row',
              alignItems: 'center',
              gap: 4,
              width: LABEL_WIDTH,
              children: [
                { type: 'image', src: 'sf-symbol:house', color: C.teal, width: 16, height: 16 },
                { type: 'text', text: '内网', font: { size: 13 }, textColor: C.sub }
              ]
            },
            { type: 'spacer' },
            { type: 'text', text: r1Content || '—', font: { size: 13 }, textColor: C.main, maxLines: 1, minScale: 0.8 }
          ]
        },

        // 🌐 本地行 - ✅ 标签固定宽度对齐
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 10,
          children: [
            {
              type: 'stack',
              direction: 'row',
              alignItems: 'center',
              gap: 4,
              width: LABEL_WIDTH,
              children: [
                { type: 'image', src: 'sf-symbol:network', color: C.teal, width: 16, height: 16 },
                { type: 'text', text: '本地', font: { size: 13 }, textColor: C.sub }
              ]
            },
            { type: 'spacer' },
            { type: 'text', text: r2Content || '—', font: { size: 13 }, textColor: C.main, maxLines: 1, minScale: 0.8 }
          ]
        },

        // 🌍 落地行 - ✅ 标签固定宽度对齐
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 10,
          children: [
            {
              type: 'stack',
              direction: 'row',
              alignItems: 'center',
              gap: 4,
              width: LABEL_WIDTH,
              children: [
                { type: 'image', src: 'sf-symbol:globe', color: C.blue, width: 16, height: 16 },
                { type: 'text', text: '落地', font: { size: 13 }, textColor: C.sub }
              ]
            },
            { type: 'spacer' },
            { type: 'text', text: r3Content || '—', font: { size: 13 }, textColor: C.main, maxLines: 1, minScale: 0.8 }
          ]
        },

        // 🛡️ 风险 + 住宅行 - ✅ 双标签分别固定宽度
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 12,
          children: [
            // 风险标签
            {
              type: 'stack',
              direction: 'row',
              alignItems: 'center',
              gap: 4,
              width: LABEL_WIDTH,
              children: [
                { type: 'image', src: 'sf-symbol:shield', color: riskColor, width: 16, height: 16 },
                { type: 'text', text: '风险', font: { size: 13 }, textColor: C.sub }
              ]
            },
            { type: 'spacer' },
            { type: 'text', text: `${riskLevel} (${risk})`, font: { size: 13 }, textColor: C.main, maxLines: 1, minScale: 0.8 },

            { type: 'spacer', length: 16 },

            // 住宅标签
            {
              type: 'stack',
              direction: 'row',
              alignItems: 'center',
              gap: 4,
              width: LABEL_WIDTH,
              children: [
                { type: 'image', src: 'sf-symbol:house.fill', color: C.teal, width: 16, height: 16 },
                { type: 'text', text: '住宅', font: { size: 13 }, textColor: C.sub }
              ]
            },
            { type: 'spacer' },
            { type: 'text', text: nativeText, font: { size: 13 }, textColor: C.main, maxLines: 1, minScale: 0.8 }
          ]
        },

        // ▶️ 解锁行 - ✅ 标签固定宽度对齐
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          children: [
            {
              type: 'stack',
              direction: 'row',
              alignItems: 'center',
              gap: 4,
              width: LABEL_WIDTH,
              children: [
                { type: 'image', src: 'sf-symbol:play.rectangle.fill', color: C.teal, width: 16, height: 16 },
                { type: 'text', text: '解锁', font: { size: 13, weight: 'medium' }, textColor: C.main }
              ]
            },
            { type: 'spacer' },
            ...Object.entries(mediaServices).map(([name, ok]) => ({
              type: 'text',
              text: `${name} ${ok ? '✅' : '🚫'}`,
              font: { size: 13 },
              textColor: ok ? C.teal : C.red,
              maxLines: 1,
              minScale: 0.75
            }))
          ]
        },

        { type: 'spacer' }
      ]
    };

  } catch (e) {
    console.log(e);
    return {
      type: 'widget',
      padding: [14, 16, 14, 16],
      backgroundColor: C.bg,
      children: [
        { type: 'text', text: '加载失败', textColor: C.red, font: { size: 15, weight: 'bold' } }
      ]
    };
  }
}

