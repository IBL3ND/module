/*
 * 中国电信小组件
 * 数据接口（用户 2026-10-11 抓包提供）：
 *   POST https://appfuwusz.189.cn:443/query/queryMainDataArea
 * 模块里填写抓包得到的 token / userId / 手机号 / 省市代码即可，
 * 不用密码，不经过第三方。
 */

const FLOW_COLOR = '#FF6620';
const VOICE_COLOR = '#78C100';

const FEE_ICON = 'yensign.circle.fill';
const FEE_ICON_COLOR = '#FF9500';
const FLOW_ICON = 'antenna.radiowaves.left.and.right';
const VOICE_ICON = 'phone.circle.fill';

/* ---------- 工具函数 ---------- */

function formatFlow(flow) {
  const remain = flow / 1024;
  if (remain < 1024) return { amount: remain.toFixed(2), unit: 'MB' };
  return { amount: (remain / 1024).toFixed(2), unit: 'GB' };
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/* ---------- 渲染层（Widget DSL） ---------- */

function statCard(icon, color, size, data) {
  return {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    gap: 2,
    flex: 1,
    children: [
      {
        type: 'image',
        src: `sf-symbol:${icon}`,
        width: size,
        height: size,
        color,
      },
      {
        type: 'text',
        text: `${data.number} ${data.unit}`,
        font: { size: 'subheadline', weight: 'semibold' },
        textAlign: 'center',
        maxLines: 1,
        minScale: 0.6,
      },
      {
        type: 'text',
        text: data.title,
        font: { size: 'caption2' },
        textAlign: 'center',
        opacity: 0.6,
      },
    ],
  };
}

function headerRow(title, ds, fromCache) {
  const t = ds && ds.updatedAt ? fmtTime(ds.updatedAt) : '--:--';
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    children: [
      { type: 'text', text: title, font: { size: 'footnote', weight: 'semibold' } },
      { type: 'spacer' },
      {
        type: 'text',
        text: fromCache ? `缓存 ${t}` : `更新 ${t}`,
        font: { size: 'caption2' },
        opacity: 0.55,
      },
    ],
  };
}

function buildSmall(title, ds, fromCache) {
  return {
    type: 'widget',
    padding: 14,
    gap: 8,
    refreshAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    children: [
      headerRow(title, ds, fromCache),
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          { type: 'text', text: ds.fee.title, font: { size: 'footnote' }, opacity: 0.65 },
          { type: 'spacer' },
          {
            type: 'text',
            text: ds.fee.number,
            font: { size: 'title2', weight: 'bold' },
            maxLines: 1,
            minScale: 0.7,
          },
          {
            type: 'text',
            text: ` ${ds.fee.unit}`,
            font: { size: 'footnote' },
            opacity: 0.65,
          },
        ],
      },
      {
        type: 'stack',
        direction: 'row',
        gap: 10,
        children: [statCard(FLOW_ICON, ds.flow.color, 58, ds.flow), statCard(VOICE_ICON, ds.voice.color, 58, ds.voice)],
      },
    ],
  };
}

function buildMedium(title, ds, fromCache, ctx) {
  const style = String((ctx && ctx.env && ctx.env.CT_WIDGET_STYLE) || 'glass').toLowerCase();
  const cardBg =
    style === 'classic'
      ? { light: '#F2F2F7', dark: '#1C1C1E' }
      : { light: 'rgba(255,255,255,0.18)', dark: 'rgba(255,255,255,0.08)' };
  const card = (children) => ({
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: cardBg,
    children,
  });
  return {
    type: 'widget',
    padding: 12,
    gap: 8,
    refreshAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    children: [
      headerRow(title, ds, fromCache),
      {
        type: 'stack',
        direction: 'row',
        gap: 8,
        children: [
          card(statCard(FEE_ICON, FEE_ICON_COLOR, 62, ds.fee).children),
          card(statCard(FLOW_ICON, ds.flow.color, 62, ds.flow).children),
          card(statCard(VOICE_ICON, ds.voice.color, 62, ds.voice).children),
        ],
      },
    ],
  };
}

function buildLockScreen(title, ds, family) {
  if (family === 'accessoryCircular' || family === 'accessoryInline') {
    return {
      type: 'widget',
      children: [
        {
          type: 'text',
          text: `¥${ds.fee.number}`,
          font: { size: 'body', weight: 'semibold' },
          textAlign: 'center',
        },
      ],
    };
  }
  return {
    type: 'widget',
    padding: 8,
    gap: 4,
    children: [
      { type: 'text', text: title, font: { size: 'caption2', weight: 'semibold' } },
      {
        type: 'text',
        text: `¥${ds.fee.number} · ${ds.flow.number}${ds.flow.unit} · ${ds.voice.number}分`,
        font: { size: 'footnote' },
        maxLines: 1,
        minScale: 0.6,
      },
    ],
  };
}

function buildError(title, message, url) {
  const w = {
    type: 'widget',
    padding: 14,
    gap: 6,
    children: [
      { type: 'text', text: title, font: { size: 'footnote', weight: 'semibold' } },
      {
        type: 'image',
        src: 'sf-symbol:exclamationmark.triangle',
        width: 22,
        height: 22,
        color: '#FF9500',
      },
      { type: 'text', text: message, font: { size: 'caption1' }, opacity: 0.7 },
    ],
  };
  if (url) w.url = url;
  return w;
}

/* ---------- 数据层（待用户提供抓包接口后填入） ---------- */

// 数据接口（用户 2026-10-11 自行抓包提供）：
//   POST https://appfuwusz.189.cn:443/query/queryMainDataArea
// 认证靠 headerInfos.token（App 登录后颁发）；timestamp 每次现算。
// 返回的 customerInsightData 为 base64(JSON)，含全部汇总（流量单位 KB）。

const TELECOM_API = 'https://appfuwusz.189.cn:443/query/queryMainDataArea';

/* ---------- App 自动抓取（request 脚本模式） ---------- */

// 打开电信 App 时，Egern 拦截 189.cn 请求，从请求体里提取认证信息存下来，
// 小组件直接用，无需手动填写。对标联通的 cookie 自动捕获。
function extractAuthFromRequest(ctx) {
  const req = ctx.request || {};
  const url = req.url || '';

  // 诊断：记录拦截到的 URL（只通知一次）
  try {
    if (!ctx.storage.get('ct_diag_notified')) {
      ctx.storage.set('ct_diag_notified', '1');
      ctx.notify({ title: '中国电信诊断', body: `拦截到: ${url.slice(0, 80)} | body类型: ${typeof req.body}` });
    }
  } catch (e) {}

  if (!url.includes('189.cn')) return false;

  let body = null;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) { return false; }
  if (!body) return false;

  const hi = body.headerInfos || {};
  const fd = (body.content && body.content.fieldData) || {};
  const token = hi.token || '';
  if (!token || token.length < 10) return false;

  let updated = false;
  const save = (k, v) => {
    if (v && ctx.storage.get(k) !== v) { ctx.storage.set(k, v); updated = true; }
  };
  save('ct_token', token);
  save('ct_broad_token', hi.broadToken || '');
  save('ct_user_id', fd.userId || '');
  save('ct_province_code', hi.provinceCode || fd.provinceCode || '');
  save('ct_city_code', fd.cityCode || '');
  save('ct_enc_phone', hi.userLoginName || '');
  // account 可能是 base64(transNumber(phone))，也可能是明文转码，直接存
  save('ct_account', fd.account || '');

  if (updated) {
    try {
      ctx.notify({ title: '中国电信', body: '已自动抓取登录凭证，小组件将自动更新' });
    } catch (e) {}
  }
  return true;
}

function transNumber(str, encode = true) {
  return [...String(str)]
    .map((c) => String.fromCharCode((c.charCodeAt(0) + (encode ? 2 : -2)) & 0xffff))
    .join('');
}

function beijingTimestamp() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
    p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds())
  );
}

function b64DecodeToString(b64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = String(b64).replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = chars.indexOf(clean[i]);
    const c2 = chars.indexOf(clean[i + 1]);
    const c3 = clean[i + 2] === '=' ? 0 : chars.indexOf(clean[i + 2]);
    const c4 = clean[i + 3] === '=' ? 0 : chars.indexOf(clean[i + 3]);
    const n = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
    bytes.push((n >> 16) & 0xff);
    if (clean[i + 2] !== '=') bytes.push((n >> 8) & 0xff);
    if (clean[i + 3] !== '=') bytes.push(n & 0xff);
  }
  // UTF-8 解码
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    if (b < 0x80) { out += String.fromCharCode(b); i++; }
    else if ((b & 0xe0) === 0xc0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2;
    } else {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
      ); i += 3;
    }
  }
  return out;
}

function b64Encode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = [];
  for (const ch of String(str)) {
    const code = ch.charCodeAt(0);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i], b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (b1 << 16) | (b2 << 8) | b3;
    out += chars[(n >> 18) & 0x3f] + chars[(n >> 12) & 0x3f];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 0x3f] : '=';
    out += i + 2 < bytes.length ? chars[n & 0x3f] : '=';
  }
  return out;
}

async function fetchTelecomData(ctx, settings) {
  // 优先用自动抓取存下的，env 手动填写做兜底
  const token = (ctx.env.CT_TOKEN || '').trim() || ctx.storage.get('ct_token') || '';
  const userId = (ctx.env.CT_USER_ID || '').trim() || ctx.storage.get('ct_user_id') || '';
  const phone = (ctx.env.CT_PHONE || '').trim();
  const provinceCode = (ctx.env.CT_PROVINCE_CODE || '').trim() || ctx.storage.get('ct_province_code') || '';
  const cityCode = (ctx.env.CT_CITY_CODE || '').trim() || ctx.storage.get('ct_city_code') || '';
  // encPhone：优先用抓到的 userLoginName，否则用手机号现算
  const encPhone = ctx.storage.get('ct_enc_phone') || (phone ? transNumber(phone) : '');
  if (!token || !userId) {
    const err = new Error('打开电信 App 自动抓取登录凭证');
    err.needCapture = true;
    throw err;
  }

  const ts = beijingTimestamp();
  // encPhone 已在上面确定（抓取优先，手机号兜底）
  const body = {
    content: {
      fieldData: {
        isNewUser: '0',
        netType: '0',
        isPremiumEdition: '0',
        scene: '',
        provinceCode,
        searchType: '1',
        cityCode,
        userId,
        shopId: '20004',
        isChinatelecom: '0',
        isShowFlowInformationWidget: '0',
        account: ctx.storage.get('ct_account') || b64Encode(encPhone),
        phoneType: '69',
        accessAuth: '1',
      },
      attach: 'iPhone',
    },
    headerInfos: {
      broadAccount: '',
      clientType: '#13.4.0#channel50#iPhone 15 Pro Max#',
      fixedLineToken: '',
      userLoginName: encPhone,
      timestamp: ts,
      broadToken: '',
      fixedLineAccount: '',
      provinceCode,
      source: '120002',
      code: 'queryMainDataArea',
      sourcePassword: 'TiqmIZ',
      token,
      shopId: '20004',
    },
  };

  let resp;
  try {
    resp = await ctx.http.post(TELECOM_API, {
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(body),
      timeout: 15000,
    });
  } catch (e) {
    const err = new Error('网络请求失败');
    err.transient = true;
    throw err;
  }
  if (!resp || resp.status !== 200) {
    throw new Error(`HTTP ${resp ? resp.status : '无响应'}`);
  }
  let data;
  try { data = await resp.json(); } catch (e) { throw new Error('返回非 JSON'); }
  const rd = data && data.responseData;
  if (!rd || rd.resultCode !== '0000') {
    const err = new Error(`[${(rd && rd.resultCode) || 'unknown'}] ${(rd && rd.resultDesc) || '接口返回异常'}`);
    // token 失效时 resultCode 非 0000，提示重新抓取
    err.authFailed = true;
    throw err;
  }

  // customerInsightData: base64(JSON)，流量单位 KB
  let insight = {};
  try {
    insight = JSON.parse(b64DecodeToString(rd.data.customerInsightData || ''));
  } catch (e) {}
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  // 话费：优先 otherData.balance
  const balanceStr = (rd.data.otherData && rd.data.otherData.balance) || insight.balance || '0';
  const fee = {
    title: '剩余话费',
    number: num(balanceStr).toFixed(2),
    unit: '元',
  };

  // 流量：KB → MB
  const flowTotalKB = num(insight.flowTotal);
  const flowUsedKB = num(insight.flowUsed);
  const flowBalanceKB = Math.max(0, flowTotalKB - flowUsedKB);
  const flowBalanceMB = flowBalanceKB / 1024;
  const flowUsedMB = flowUsedKB / 1024;
  const flowTotalMB = flowTotalKB / 1024;
  const balanceFlow = formatFlow(flowBalanceMB);
  const usedFlow = formatFlow(flowUsedMB);
  const flow = {
    title: settings.showUsedFlow ? '已用流量' : '剩余流量',
    number: settings.showUsedFlow ? usedFlow.amount : balanceFlow.amount,
    unit: settings.showUsedFlow ? usedFlow.unit : balanceFlow.unit,
    percent: +((flowBalanceKB / (flowTotalKB || 1)) * 100).toFixed(2),
    color: FLOW_COLOR,
  };

  // 语音
  const voiceTotal = num(insight.voiceTotal);
  const voiceBalance = num(insight.voiceBalance);
  const voice = {
    title: '剩余语音',
    number: `${Math.round(voiceBalance)}`,
    unit: '分钟',
    percent: +((voiceBalance / (voiceTotal || 1)) * 100).toFixed(2),
    color: VOICE_COLOR,
  };

  return { fee, flow, voice, updatedAt: Date.now() };
}

/* ---------- 小组件（generic 脚本模式） ---------- */

async function handleWidget(ctx) {
  const title = (ctx.env.CT_TITLE || '中国电信').trim() || '中国电信';
  const settings = {
    showUsedFlow: ctx.env.CT_SHOW_USED_FLOW === 'true',
    showGeneralFlow: ctx.env.CT_SHOW_GENERAL_FLOW !== 'false',
    showDirectionalFlow:
      ctx.env.CT_SHOW_DIRECTIONAL_FLOW !== 'false' &&
      ctx.env.CT_FILTER_ORIENTATE_FLOW !== 'true',
  };

  let ds = null;
  let errMsg = '';
  let authFailed = false;
  try {
    ds = await fetchTelecomData(ctx, settings);
    if (ds) ds.updatedAt = Date.now();
    ctx.storage.setJSON('ct_datasource', ds);
  } catch (e) {
    errMsg = (e && e.message) || '数据获取失败';
    authFailed = !!(e && e.authFailed);
  }

  if (!ds) {
    if (authFailed) {
      // token 失效：不再显示旧数据，提示重新抓取
      return buildError(title, `登录已过期：${errMsg}，请重新抓包更新 token`);
    }
    const cached = ctx.storage.getJSON('ct_datasource');
    if (cached) {
      return buildWidget(title, cached, true, ctx);
    }
    if (errMsg === '打开电信 App 自动抓取登录凭证') {
      return buildError(title, '未抓取到凭证：打开电信 App 刷新一下');
    }
    return buildError(title, `数据获取失败：${errMsg}`);
  }
  return buildWidget(title, ds, false, ctx);
}

function buildWidget(title, ds, fromCache, ctx) {
  const family = ctx.widgetFamily || 'systemSmall';
  if (family === 'systemMedium' || family === 'systemLarge' || family === 'systemExtraLarge') {
    return buildMedium(title, ds, fromCache, ctx);
  }
  if (family.startsWith('accessory')) {
    return buildLockScreen(title, ds, family);
  }
  return buildSmall(title, ds, fromCache);
}

/* ---------- 保活（待接口确定后填入） ---------- */

async function handleKeepAlive(ctx) {
  // 轻量保活：只调一次 queryMainDataArea（10s 超时），不断网不通知。
  // 注意：保活用的是抓包的 token，若服务端是绝对过期则续不了命，
  // 只能延长"不活跃过期"类会话的寿命。
  const token = (ctx.env.CT_TOKEN || '').trim();
  if (!token) return;
  try {
    await fetchTelecomData(ctx, {
      showUsedFlow: false,
      showGeneralFlow: true,
      showDirectionalFlow: true,
    });
  } catch (e) {}
}

/* ---------- 入口 ---------- */

export default async function (ctx) {
  // request 脚本 → App 自动抓取；schedule → 保活；generic → 小组件
  if (ctx.request && ctx.request.url) {
    extractAuthFromRequest(ctx);
    return;
  }
  if (ctx.cron || (ctx.env && ctx.env.CT_KEEPALIVE === 'true')) {
    return handleKeepAlive(ctx);
  }
  return handleWidget(ctx);
}
