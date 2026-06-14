/**
 * Egern小组件: 流媒体与 Ai 解锁检测
 */
export default async function(ctx) {
  const C = {
    bg:    { light: '#FFFFFF', dark: '#2C2C2E' },
    text:  { light: '#1C1C1E', dark: '#FFFFFF' },
    dim:   { light: '#8E8E93', dark: '#8E8E93' },
    green: { light: '#34C759', dark: '#30D158' },
    red:   { light: '#FF3B30', dark: '#FF453A' },
    blue:  { light: '#007AFF', dark: '#0A84FF' }
  };

  const getFlag = (code) => {
    if (!code || code === 'XX') return '';
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
  };

  const BASE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
  const commonHeaders = { "User-Agent": BASE_UA };

  const fetchProxy = async () => {
    try {
      const res = await ctx.http.get('http://ip-api.com/json/?lang=zh-CN', { timeout: 4000 });
      const data = JSON.parse(await res.text());
      return { cc: data.countryCode || "XX", flag: getFlag(data.countryCode) };
    } catch { return { cc: "XX", flag: "" }; }
  };

  async function checkNetflix() {
    try {
      const r = await ctx.http.get(`https://www.netflix.com/title/70143836`, { timeout: 4000, headers: commonHeaders, followRedirect: false }).catch(() => null);
      if (r?.status === 200) return { status: "已解锁", code: "OK" };
      return { status: "未解锁", code: "❌" };
    } catch { return { status: "未解锁", code: "❌" }; }
  }

  async function checkDisney() {
    try {
      const res = await ctx.http.get("https://www.disneyplus.com", { timeout: 4000, headers: commonHeaders, followRedirect: false }).catch(() => null);
      if (!res || res.status === 403) return { status: "未解锁", code: "❌" };
      return { status: "已解锁", code: "OK" };
    } catch { return { status: "未解锁", code: "❌" }; }
  }

  async function checkChatGPT() {
    try {
      const res = await ctx.http.get("https://chatgpt.com/cdn-cgi/trace", { timeout: 3000 }).catch(() => null);
      const tb = await res?.text();
      const m = tb?.match(/loc=([A-Z]{2})/);
      return { status: "已解锁", code: m?.[1] || "OK" };
    } catch { return { status: "未解锁", code: "❌" }; }
  }

  async function checkClaude() {
    try {
      const res = await ctx.http.get("https://claude.ai/login", { timeout: 5000, headers: commonHeaders }).catch(() => null);
      if (!res) return { status: "未解锁", code: "❌" };
      return { status: "已解锁", code: "OK" };
    } catch { return { status: "未解锁", code: "❌" }; }
  }

  async function checkGemini() {
    try {
      const res = await ctx.http.get("https://gemini.google.com/app", { timeout: 4000, headers: commonHeaders, followRedirect: false }).catch(() => null);
      if (!res) return { status: "未解锁", code: "❌" };
      return { status: "已解锁", code: "OK" };
    } catch { return { status: "未解锁", code: "❌" }; }
  }

  const [proxyData, rNF, rDP, rGPT, rCL, rGM] = await Promise.all([
    fetchProxy(),
    checkNetflix(), checkDisney(),
    checkChatGPT(), checkClaude(), checkGemini()
  ]);

  const fmtResult = (res, cc) => {
    if (res.code === "❌") return "未解锁";
    const flag = res.code === "OK" ? getFlag(cc) : getFlag(res.code);
    const code = res.code === "OK" ? cc : res.code;
    return `已解锁 › ${flag}${code}`;
  };

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const Row = (label, val, valCol) => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    children: [
      { type: 'text', text: label, font: { size: 13, weight: 'medium' }, textColor: C.text, flex: 1, maxLines: 1 },
      { type: 'text', text: val, font: { size: 13, weight: 'medium' }, textColor: valCol, textAlign: 'right', maxLines: 1, minScale: 0.85 }
    ]
  });

  const Divider = () => ({
    type: 'stack',
    height: 1,
    backgroundColor: { light: '#E5E5EA', dark: '#3A3A3C' }
  });

  const nfCol  = rNF.code  === "❌" ? C.red : C.green;
  const dpCol  = rDP.code  === "❌" ? C.red : C.green;
  const gptCol = rGPT.code === "❌" ? C.red : C.green;
  const clCol  = rCL.code  === "❌" ? C.red : C.green;
  const gmCol  = rGM.code  === "❌" ? C.red : C.green;

  return {
    type: 'widget',
    backgroundColor: C.bg,
    padding: [12, 14, 12, 14],
    gap: 8,
    children: [

      {
        type: 'stack', direction: 'row', alignItems: 'center', gap: 5,
        children: [
          { type: 'image', src: 'sf-symbol:lock.open.fill', color: C.blue, width: 15, height: 15 },
          { type: 'text', text: '解锁检测', font: { size: 15, weight: 'bold' }, textColor: C.text },
          { type: 'spacer' },
          { type: 'image', src: 'sf-symbol:arrow.clockwise', color: C.dim, width: 11, height: 11 },
          { type: 'text', text: timeStr, font: { size: 11 }, textColor: C.dim }
        ]
      },

      { type: 'stack', direction: 'row', children: [
        { type: 'spacer' },
        { type: 'text', text: '流媒体解锁', font: { size: 11, weight: 'bold' }, textColor: C.blue },
        { type: 'spacer' }
      ] },

      Row("YouTube",  `已解锁 › ${proxyData.flag}${proxyData.cc}`, C.green),
      Divider(),
      Row("Netflix",  fmtResult(rNF, proxyData.cc), nfCol),
      Divider(),
      Row("Disney+",  fmtResult(rDP, proxyData.cc), dpCol),

      { type: 'stack', direction: 'row', children: [
        { type: 'spacer' },
        { type: 'text', text: 'Ai 服务检测', font: { size: 11, weight: 'bold' }, textColor: C.blue },
        { type: 'spacer' }
      ] },

      Row("ChatGPT", fmtResult(rGPT, proxyData.cc), gptCol),
      Divider(),
      Row("Claude",  fmtResult(rCL,  proxyData.cc), clCol),
      Divider(),
      Row("Gemini",  fmtResult(rGM,  proxyData.cc), gmCol),
    ]
  };
}
