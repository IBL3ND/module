// IP信息 ➕ 流媒体解锁查询

export default async function(ctx) {
  const C = {
    bg: [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#2C2C2E' }],
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

  const httpGet = async (url, ua) => {
    try {
      const start = Date.now();
      const resp = await ctx.http.get(url, { headers: { "User-Agent": ua || "Mozilla/5.0" }, timeout: 6000 });
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

  const BASE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1";

  const readBody = async (r) => {
    if (!r) return "";
    if (typeof r.body === "string" && r.body.length) return r.body;
    if (typeof r.text === "function") {
      try { return String(await r.text()); } catch { return ""; }
    }
    return "";
  };

  async function checkNetflix(ctx) {
    try {
      const url = "https://www.netflix.com/title/81280792";
      const res = await ctx.http.get(url, { headers: { "User-Agent": BASE_UA }, followRedirect: true, timeout: 10000 }).catch(() => null);
      const body = await readBody(res);
      if (!body) return false;
      return !/oh no!/i.test(body);
    } catch { return false; }
  }

  async function checkGPT(ctx) {
    try {
      const res = await ctx.http.get("https://chatgpt.com", { headers: { "User-Agent": BASE_UA }, timeout: 8000, followRedirect: true });
      return !!res;
    } catch { return false; }
  }

  async function checkGemini(ctx) {
    try {
      const res = await ctx.http.get("https://gemini.google.com/", {
        headers: { "User-Agent": BASE_UA },
        timeout: 10000,
        followRedirect: true
      }).catch(() => null);

      const body = await readBody(res);
      if (!body) return false;

      if (/not available|unavailable|region/i.test(body)) return false;
      if (/Gemini|Google AI/i.test(body)) return true;

      return false;
    } catch {
      return false;
    }
  }

  async function checkTikTok(ctx) {
    try {
      const res = await ctx.http.get("https://www.tiktok.com/", { headers: { "User-Agent": BASE_UA }, timeout: 10000, followRedirect: true });
      const url = res?.url || "";
      return !url.includes("challenge") && !url.includes("blocked");
    } catch { return false; }
  }

  try {
    const d = ctx.device || {};
    const internalIP = d.ipv4?.address || "未连接";
    const gatewayIP = d.ipv4?.gateway;
    const wifiSsid = d.wifi?.ssid || "";
    const cellularRadio = d.cellular?.radio || "";

    const [localResp, nodeResp, pureResp, nf, gpt, gem, tiktok] = await Promise.all([
      httpGet('https://myip.ipip.net/json', BASE_UA), 
      httpGet('http://ip-api.com/json/?lang=zh-CN', BASE_UA),
      httpGet('https://my.ippure.com/v1/info', BASE_UA),
      checkNetflix(ctx),
      checkGPT(ctx),
      checkGemini(ctx),
      checkTikTok(ctx)
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

    const r1Content = [internalIP, gatewayIP !== internalIP ? gatewayIP : null].filter(Boolean).join(" / ");

    // ✅ 修改后的省市逻辑：过滤干扰项并去重提取
    let locStr = "";
    if (Array.isArray(local.location)) {
      const tags = local.location.filter(i => i && !/电信|移动|联通|广电|IP|China|中国|数据中心/i.test(i));
      const uniqueTags = [...new Set(tags)]; // 去重处理，防止“上海.上海”
      if (uniqueTags.length >= 2) {
        locStr = `${uniqueTags[uniqueTags.length - 2]}.${uniqueTags[uniqueTags.length - 1]}`;
      } else if (uniqueTags.length === 1) {
        locStr = uniqueTags[0];
      }
    }
    const r2Content = [local.ip || "获取中...", locStr].filter(Boolean).join(" / ");

    const nodeLoc = [getFlagEmoji(node.countryCode), node.country, node.city].filter(Boolean).join(" ");
    const asnStr = node.as ? String(node.as).split(' ')[0] : "";
    const r3Content = [node.query || node.ip || "获取中...", nodeLoc, asnStr].filter(Boolean).join(" / ");

    const nativeText = pure.isResidential === true ? "家宽" : (pure.isResidential === false ? "机房" : "未知属性");
    const risk = pure.fraudScore || 0;
    let riskColor = C.teal;
    let riskLevel = "低危";
    if (risk >= 80) { riskLevel = "极高危"; riskColor = C.red; }
    else if (risk >= 70) { riskLevel = "高危"; riskColor = C.orange; }
    else if (risk >= 40) { riskLevel = "中危"; riskColor = C.gold; }

    const mediaServices = {
      GPT: gpt,
      Netflix: nf,
      TikTok: tiktok,
      Gemini: gem
    };

    const buildRow = (icon, label, content, color) => ({
      type: 'stack', direction: 'row', alignItems: 'center', gap: 10, children: [
        { type: 'image', src: `sf-symbol:${icon}`, color: color || C.sub, width: 14, height: 14 },
        { type: 'text', text: label, font: { size: 12.5, weight: 'regular', lineHeight: 14 }, textColor: C.sub },
        { type: 'stack', direction: 'row', gap: 4, children: content }
      ]
    });

    const mediaContent = Object.entries(mediaServices).map(([name, ok]) => ({
      type: 'text',
      text: ok ? `${name} ✅` : `${name} 🚫`,
      font: { size: 12.5, weight: 'regular', lineHeight: 14 },
      textColor: ok ? C.teal : C.red
    }));

    const widgetConfig = {
      type: 'widget', padding: [14,16,12,16],
      backgroundGradient: { colors: C.bg, direction: 'topToBottom' },
      children: [
        { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [
            { type: 'image', src: wifiSsid ? 'sf-symbol:wifi' : (cellularRadio ? 'sf-symbol:antenna.radiowaves.left.and.right' : 'sf-symbol:wifi.slash'), color: C.main, width: 16, height: 16 },
            { type: 'text', text: currentISP, font: { size: 17, weight: 'heavy' }, textColor: ispColor, maxLines: 1, minScale: 0.7 },
            { type: 'spacer' },
            { type: 'stack', direction: 'row', alignItems: 'center', gap: 2, children: [
                { type: 'image', src: 'sf-symbol:timer', color: C.sub, width: 12, height: 12 },
                { type: 'text', text: pingMs > 0 ? `${pingMs}ms` : "--", font: { size: 12, weight: 'regular' }, textColor: C.sub }
            ]}
        ]},
        { type: 'spacer', length: 12 },
        { type: 'stack', direction: 'column', alignItems: 'start', gap: 6, children: [
            buildRow('house.fill','内网', [{type:'text', text:r1Content, font:{size:12.5,weight:'regular'}, textColor:C.teal}], C.teal),
            buildRow('location.circle.fill','本地', [{type:'text', text:r2Content, font:{size:12.5,weight:'regular'}, textColor:C.blue}], C.blue),
            buildRow('map.fill','落地', [{type:'text', text:r3Content, font:{size:12.5,weight:'regular'}, textColor:C.purple}], C.purple),
            buildRow('shield.lefthalf.filled','属性', [{type:'text', text:`${nativeText} / ${risk} (${riskLevel})`, font:{size:12.5,weight:'regular'}, textColor:riskColor}], riskColor),
            buildRow('play.tv','解锁', mediaContent, C.orange)
        ]},
        { type: 'spacer' }
      ]
    };

    return widgetConfig;

  } catch(err) {
    return {
      type: 'widget', padding: 12,
      backgroundGradient: { colors: C.bg, direction: 'topToBottom' },
      children: [
        { type: 'text', text: '小组件崩溃 ⚠️', font: { size: 14, weight: 'heavy' }, textColor: C.red.light },
        { type: 'spacer', length: 4 },
        { type: 'text', text: String(err.message || err), font: { size: 11 }, textColor: C.muted.light, maxLines: 5 }
      ]
    };
  }
}