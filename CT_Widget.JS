/*
 * 中国电信小组件（Egern 版，单文件双模式）
 * 移植自 Scriptable 版 ChinaTelecom_2024（作者 2Ya&脑瓜）
 *
 * 同一个文件，两种用法（在 Egern 里建两个脚本条目，脚本 URL 填同一个）：
 *   1. generic 类型 → iOS 小组件：显示剩余话费 / 剩余（或已用）流量 / 剩余语音
 *   2. request 类型 → 登录捕获：Safari 里登录 e.dlife.cn 成功时自动捕获登录地址，
 *      存入存储，小组件下次运行自动读取登录，全程无需手动复制粘贴。
 *
 * 环境变量（在模块/小组件的 Env 中配置）：
 *   CT_LOGIN_URL            电信登录地址（抓包得到的登录 URL，用于自动更新 cookie）
 *   CT_COOKIE               直接填写 cookie（与 CT_LOGIN_URL 二选一，URL 优先）
 *   CT_SHOW_USED_FLOW       'true' 显示已用流量，否则显示剩余流量
 *   CT_SHOW_USED_VOICE      'true' 显示已用语音，否则显示剩余语音（默认剩余，不受 CT_SHOW_USED_FLOW 影响）
 *   CT_SHOW_DIRECT          'false' 隐藏定向卡（3卡模式）；'true' 强制4卡；不填则自动判断
 *   CT_TITLE                小组件标题，默认 "中国电信"
 *
 * 数据来源：https://e.dlife.cn/user/package_detail.do
 *           https://e.dlife.cn/user/balance.do
 */

const URLS = {
  login: 'https://e.dlife.cn/index.do',
  detail: 'https://e.dlife.cn/user/package_detail.do',
  balance: 'https://e.dlife.cn/user/balance.do',
};


/* ---------- 工具函数 ---------- */

function formatFlow(flow) {
  const remain = flow / 1024; // 接口单位换算：与原版保持一致
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

/* ---------- 数据层 ---------- */

async function refreshCookie(ctx) {
  // 登录地址来源：Env 的 CT_LOGIN_URL 优先，其次用捕获脚本存下的地址
  const loginUrl =
    (ctx.env.CT_LOGIN_URL || '').trim() || ctx.storage.get('ct_login_url') || '';
  if (!loginUrl) return ctx.storage.get('ct_cookie') || '';
  const url = (loginUrl.match(/(http.+)&sign/) || [])[1] || loginUrl;
  const resp = await ctx.http.get(url, {
    redirect: 'manual',
    timeout: 15000,
    credentials: 'omit',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    },
  });
  const setCookies = (resp.headers && resp.headers.getAll('set-cookie')) || [];
  const pairs = setCookies
    .map((c) => String(c).split(';')[0].trim())
    .filter(Boolean);
  if (pairs.length > 0) {
    // 合并而非覆盖：回放可能只返回部分 cookie，丢掉原有的反而坏事
    const merged = mergeCookies(ctx.storage.get('ct_cookie'), pairs.join('; '));
    if (merged) ctx.storage.set('ct_cookie', merged);
  }
  return ctx.storage.get('ct_cookie') || '';
}

function mergeCookies(oldCookie, newPairs) {
  const map = new Map();
  for (const p of String(oldCookie || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) map.set(p.slice(0, i).trim(), p.slice(i + 1).trim());
  }
  for (const p of String(newPairs || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) map.set(p.slice(0, i).trim(), p.slice(i + 1).trim());
  }
  return [...map].map(([k, v]) => `${k}=${v}`).join('; ');
}

function harvestSetCookie(ctx, resp, cookie) {
  // 滑动续期：API 成功返回时若带了 Set-Cookie，合并进存储（同名覆盖）
  try {
    const setCookies = (resp.headers && resp.headers.getAll('set-cookie')) || [];
    const pairs = setCookies
      .map((c) => String(c).split(';')[0].trim())
      .filter(Boolean);
    if (pairs.length > 0) {
      const merged = mergeCookies(cookie, pairs.join('; '));
      if (merged && merged !== cookie) ctx.storage.set('ct_cookie', merged);
      return merged || cookie;
    }
  } catch (e) {}
  return cookie;
}

async function fetchJson(ctx, url, cookie) {
  const resp = await ctx.http.get(url, {
    headers: {
      Cookie: cookie,
      // 伪装成 iOS Safari，避免服务端因 UA 不一致踢掉 session
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    },
    timeout: 15000,
    credentials: 'omit',
  });
  if (!resp || resp.status !== 200) {
    const err = new Error(`HTTP ${resp ? resp.status : 'no-response'}: ${url}`);
    // 401/403 基本可以确定是登录态没了
    if (resp && (resp.status === 401 || resp.status === 403)) err.authDead = true;
    throw err;
  }
  let data;
  try {
    data = await resp.json();
  } catch (_) {
    // 正常应返回 JSON，拿到 HTML（多半是被踢回登录页）→ 登录失效
    const err = new Error(`登录失效（接口未返回 JSON）：${url}`);
    err.authDead = true;
    throw err;
  }
  harvestSetCookie(ctx, resp, cookie);
  return data;
}

// 解析套餐详情 + 余额，逻辑与原 Scriptable 版保持一致
function parseTelecom(detail, balance, opts) {
  const { showUsedFlow, showUsedVoice } = opts || {};
  let genTotal = 0, genBalance = 0, genUsed = 0;
  let dirTotal = 0, dirBalance = 0, dirUsed = 0;
  let totalVoiceAmount = 0;
  let totalBalanceVoiceAmount = 0;
  let isUnlimitedFlow = false;

  for (const data of detail?.items || []) {
    if (data.offerType === 19) continue;
    for (const item of data.items || []) {
      if (item.unitTypeId == 3) {
        const isDirectional = /定向/.test(item.ratableResourcename || '');
        const isInvalid = item.balanceAmount == '999999999999';
        if (!(item.usageAmount == 0 && item.balanceAmount == 0) && !isInvalid) {
          const t = parseFloat(item.ratableAmount) || 0;
          const b = parseFloat(item.balanceAmount) || 0;
          if (isDirectional) { dirTotal += t; dirBalance += b; }
          else { genTotal += t; genBalance += b; }
        }
        const u = parseFloat(item.usageAmount) || 0;
        if (isDirectional) dirUsed += u; else genUsed += u;
        if (data.offerType == 21 && item.ratableAmount == '0') {
          isUnlimitedFlow = true;
        }
      } else if (!detail.voiceBalance && item.unitTypeId == 1) {
        totalVoiceAmount += parseInt(item.ratableAmount, 10) || 0;
        totalBalanceVoiceAmount += parseInt(item.balanceAmount, 10) || 0;
      }
    }
  }
  if (detail.voiceAmount && detail.voiceBalance) {
    totalVoiceAmount = detail.voiceAmount;
    totalBalanceVoiceAmount = detail.voiceBalance;
  }

  const mkFlow = (remainTitle, total, balanceAmt, usedAmt) => {
    const bal = formatFlow(balanceAmt);
    const used = formatFlow(usedAmt);
    const f = {
      title: remainTitle,
      number: bal.amount,
      unit: bal.unit,
      percent: +(((balanceAmt / (total || 1)) * 100).toFixed(2)),
    };
    if (showUsedFlow) {
      f.title = remainTitle.replace('剩余', '已用');
      f.number = used.amount;
      f.unit = used.unit;
    }
    return f;
  };

  const generalFlow = mkFlow('通用剩余', genTotal, genBalance, genUsed);
  generalFlow.color = GENERAL_ICON_COLOR;
  if (isUnlimitedFlow) {
    const used = formatFlow(genUsed);
    generalFlow.title = '通用已用';
    generalFlow.number = used.amount;
    generalFlow.unit = used.unit;
  }
  const directFlow = mkFlow('定向剩余', dirTotal, dirBalance, dirUsed);
  directFlow.color = DIRECT_ICON_COLOR;

  const voiceUsed = Math.max(0, totalVoiceAmount - totalBalanceVoiceAmount);
  const voice = {
    title: showUsedVoice ? '语音已用' : '语音剩余',
    number: `${showUsedVoice ? voiceUsed : totalBalanceVoiceAmount}`,
    unit: '分钟',
    percent: +(((totalBalanceVoiceAmount / (totalVoiceAmount || 1)) * 100).toFixed(2)),
    color: VOICE_ICON_COLOR,
  };

  const feeNum = Number(balance?.totalBalanceAvailable);
  const fee = {
    title: '话费余额',
    number: Number.isFinite(feeNum) ? (feeNum / 100).toFixed(2) : '0.00',
    unit: '元',
  };

  return { fee, generalFlow, directFlow, voice, updatedAt: Date.now(), hasDirectFlow: (dirTotal + dirBalance + dirUsed) > 0 };
}

async function tryCookie(ctx, cookie, settings) {
  const detail = await fetchJson(ctx, URLS.detail, cookie);
  const balance = await fetchJson(ctx, URLS.balance, cookie);
  const ds = parseTelecom(detail, balance, settings);
  // balance.do 偶发返回空/异常时，用上次缓存的话费顶住，避免误显示 0.00
  const feeRaw = balance?.totalBalanceAvailable;
  if (feeRaw === undefined || feeRaw === null || feeRaw === '') {
    const cached = ctx.storage.getJSON('ct_datasource');
    if (cached?.fee?.number) ds.fee = cached.fee;
  }
  ctx.storage.setJSON('ct_datasource', ds);
  // 多存一份原始接口数据：缓存兜底时按当前 Env 设置重新解析，避免旧缓存里的标题/数值跟新设置对不上
  try {
    ctx.storage.setJSON('ct_raw', { detail, balance, at: ds.updatedAt || Date.now() });
  } catch (_) {}
  return ds;
}

async function loadData(ctx) {
  const envCookie = (ctx.env.CT_COOKIE || '').trim();
  const loginUrl =
    (ctx.env.CT_LOGIN_URL || '').trim() || ctx.storage.get('ct_login_url') || '';
  const settings = {
    showUsedFlow: String(ctx.env.CT_SHOW_USED_FLOW || '').toLowerCase() === 'true',
    showUsedVoice: String(ctx.env.CT_SHOW_USED_VOICE || '').toLowerCase() === 'true',
  };
  const storedCookie = ctx.storage.get('ct_cookie') || '';
  // 只要配了登录地址/cookie，或之前抓到过 cookie，就视为"已配置"
  const configured = !!(envCookie || loginUrl || storedCookie);

  // 1) 优先用已捕获的 cookie（从登录后的真实请求里抓的，最可靠）
  const firstCookie = envCookie || storedCookie;
  let cookieDead = false;
  if (firstCookie) {
    try {
      const ds = await tryCookie(ctx, firstCookie, settings);
      return { configured, ds, fromCache: false };
    } catch (e) {
      if (e && e.authDead) cookieDead = true; // 登录失效，继续往下走
    }
  }

  // 2) 回放登录地址刷新 cookie（备用方式）
  if (!envCookie && loginUrl) {
    try {
      const fresh = await refreshCookie(ctx);
      if (fresh && fresh !== firstCookie) {
        const ds = await tryCookie(ctx, fresh, settings);
        return { configured, ds, fromCache: false };
      }
    } catch (e) {
      if (e && e.authDead) cookieDead = true;
    }
  }

  // 3) 断网/过期时用缓存顶一下：有原始数据就按当前设置重新解析一次
  const raw = ctx.storage.getJSON('ct_raw');
  if (raw && raw.detail) {
    try {
      const ds = parseTelecom(raw.detail, raw.balance, settings);
      ds.updatedAt = raw.at || ds.updatedAt;
      return { configured, ds, fromCache: true, cookieDead };
    } catch (_) {
      /* 解析失败就掉到旧缓存 */
    }
  }
  const cached = ctx.storage.getJSON('ct_datasource');
  return { configured, ds: cached || null, fromCache: !!cached, cookieDead };
}

/* ---------- 渲染层（Widget DSL） ---------- */

// 四卡图标：话费¥ / 通用蜂窝 / 定向闪电 / 语音电话
const FEE_ICON = 'yensign.circle.fill';
const FEE_ICON_COLOR = '#FF9500';
const GENERAL_ICON = 'antenna.radiowaves.left.and.right';
const GENERAL_ICON_COLOR = '#0A84FF';
const DIRECT_ICON = 'bolt.fill';
const DIRECT_ICON_COLOR = '#AF52DE';
const VOICE_ICON = 'phone.circle.fill';
const VOICE_ICON_COLOR = '#34C759';

// 四卡统一：小图标 / 标题(含单位) / 大数值
// 卡片统一：小图标 / 标题 / 大数值
// fourCard=true（4 卡挤）时：标题不带单位，单位跟在数字后面，数字字号自动缩小
function quadCard(icon, color, data, fourCard) {
  const titleText = fourCard ? data.title : `${data.title}(${data.unit})`;
  const numberText = fourCard ? `${data.number}${data.unit}` : String(data.number);
  return {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    flex: 1,
    gap: 2,
    children: [
      { type: 'image', src: `sf-symbol:${icon}`, width: 32, height: 32, color },
      { type: 'text', text: titleText, font: { size: 'caption2' }, opacity: 0.75, maxLines: 1, minScale: 0.8 },
      {
        type: 'text',
        text: numberText,
        font: { size: fourCard ? 'footnote' : 'title2', weight: 'bold' },
        maxLines: 1,
        minScale: fourCard ? 0.9 : 0.7,
      },
    ],
  };
}
// 小尺寸 2x2 紧凑卡
function miniCard(icon, color, data) {
  return {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    flex: 1,
    gap: 1,
    children: [
      { type: 'image', src: `sf-symbol:${icon}`, width: 18, height: 18, color },
      {
        type: 'text',
        text: String(data.number),
        font: { size: 'footnote', weight: 'semibold' },
        maxLines: 1,
        minScale: 0.7,
      },
      { type: 'text', text: data.title, font: { size: 'caption2' }, opacity: 0.6, maxLines: 1 },
    ],
  };
}

// 开关2：CT_SHOW_DIRECT=false → 3卡模式（隐藏定向）；=true → 强制4卡；不填 → 有定向数据才显示
function showDirectCard(ctx, ds) {
  const v = String(ctx?.env?.CT_SHOW_DIRECT || '').toLowerCase();
  if (v === 'false') return false;
  if (v === 'true') return true;
  return !!ds.hasDirectFlow;
}

function headerRow(title, ds, fromCache, cookieDead) {
  const t = ds && ds.updatedAt ? fmtTime(ds.updatedAt) : '--:--';
  // 状态灯：绿=登录有效，红=登录失效，灰=缓存（网络问题，登录态未知）
  const dotColor = cookieDead ? '#FF3B30' : fromCache ? '#8E8E93' : '#30D158';
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 5,
    children: [
      { type: 'image', src: 'sf-symbol:circle.fill', width: 8, height: 8, color: dotColor },
      { type: 'text', text: title, font: { size: 'footnote', weight: 'semibold' } },
      { type: 'spacer' },
      {
        type: 'text',
        text: cookieDead ? '⚠️ 登录失效，点我重登' : fromCache ? `缓存 ${t}` : `更新 ${t}`,
        font: { size: 'caption2' },
        opacity: cookieDead ? 1 : 0.55,
      },
    ],
  };
}

function buildSmall(title, ds, fromCache, ctx, cookieDead) {
  const cards3 = !showDirectCard(ctx, ds);
  const row4 = (a, b) => ({
    type: 'stack',
    direction: 'row',
    gap: 6,
    children: [miniCard(a[0], a[1], a[2]), miniCard(b[0], b[1], b[2])],
  });
  const body = cards3
    ? [
        {
          type: 'stack',
          direction: 'row',
          gap: 6,
          children: [miniCard(FEE_ICON, FEE_ICON_COLOR, ds.fee)],
        },
        row4([GENERAL_ICON, GENERAL_ICON_COLOR, ds.generalFlow], [VOICE_ICON, VOICE_ICON_COLOR, ds.voice]),
      ]
    : [
        row4([FEE_ICON, FEE_ICON_COLOR, ds.fee], [GENERAL_ICON, GENERAL_ICON_COLOR, ds.generalFlow]),
        row4([DIRECT_ICON, DIRECT_ICON_COLOR, ds.directFlow], [VOICE_ICON, VOICE_ICON_COLOR, ds.voice]),
      ];
  return {
    type: 'widget',
    padding: 12,
    gap: 6,
    refreshAfter: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    children: [headerRow(title, ds, fromCache, cookieDead), ...body],
  };
}

function buildMedium(title, ds, fromCache, ctx, cookieDead) {


  return {
    type: 'widget',
    padding: 12,
    gap: 8,
    refreshAfter: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    children: [
      headerRow(title, ds, fromCache, cookieDead),
      {
        type: 'stack',
        direction: 'row',
        gap: 12,
        children: (() => {
          const four = showDirectCard(ctx, ds);
          return [
            quadCard(FEE_ICON, FEE_ICON_COLOR, ds.fee, four),
            quadCard(GENERAL_ICON, GENERAL_ICON_COLOR, ds.generalFlow, four),
            ...(four ? [quadCard(DIRECT_ICON, DIRECT_ICON_COLOR, ds.directFlow, four)] : []),
            quadCard(VOICE_ICON, VOICE_ICON_COLOR, ds.voice, four),
          ];
        })(),
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
  // accessoryRectangular
  return {
    type: 'widget',
    padding: 8,
    gap: 4,
    children: [
      { type: 'text', text: title, font: { size: 'caption2', weight: 'semibold' } },
      {
        type: 'text',
        text: `¥${ds.fee.number} · ${ds.generalFlow.number}${ds.generalFlow.unit} · ${ds.voice.number}分`,
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
  if (url) w.url = url; // 点小组件直接跳转（比如跳到登录页）
  return w;
}

/* ---------- 登录捕获（request 脚本模式） ---------- */

// 在 Safari/浏览器里登录 e.dlife.cn 成功时，Egern 会经过 loginMiddle 请求，
// 在此自动捕获登录地址存入存储，小组件下次运行自动读取，全程无需手动操作。
// 不返回值 = 透传，不影响登录请求本身。
/* 从请求头里取 Cookie，兼容 plain object / Headers 实例等形态，忽略大小写 */
function getReqCookie(headers) {
  if (!headers) return '';
  if (typeof headers.get === 'function') {
    return headers.get('cookie') || headers.get('Cookie') || '';
  }
  for (const k of Object.keys(headers)) {
    if (String(k).toLowerCase() === 'cookie') return headers[k] || '';
  }
  return '';
}

async function handleCapture(ctx) {
  const req = ctx.request || {};
  const url = req.url || '';
  if (!url.includes('e.dlife.cn')) return; // 非电信请求直接透传

  // 1) 登录握手地址：记下来，并标记"刚刚登录过"（10 分钟内有效）
  if (url.includes('/user/loginMiddle')) {
    const loginUrl = (url.match(/(http.+)&sign/) || [])[1] || url;
    if (loginUrl && ctx.storage.get('ct_login_url') !== loginUrl) {
      ctx.storage.set('ct_login_url', loginUrl);
    }
    ctx.storage.set('ct_login_ts', String(Date.now()));
    return;
  }

  // 2) 主要方式：直接从登录后的真实请求里抓 Cookie，比回放握手地址可靠
  const cookie = String(getReqCookie(req.headers) || '').trim();
  if (!cookie || ctx.storage.get('ct_cookie') === cookie) return;
  ctx.storage.set('ct_cookie', cookie);

  // 只有"刚登录过"才打扰用户（成功信号）；后台静默续期不通知
  const ts = Number(ctx.storage.get('ct_login_ts') || 0);
  if (Date.now() - ts < 10 * 60 * 1000) {
    ctx.storage.delete('ct_login_ts');
    ctx.notify({
      title: '中国电信',
      body: '登录成功，小组件将自动更新',
      // 兜底：如果小组件没自动读到，点通知手动复制 cookie
      action: { type: 'clipboard', text: cookie },
    });
  }
}

/* ---------- 小组件（generic 脚本模式） ---------- */

async function handleWidget(ctx) {
  const title = (ctx.env.CT_TITLE || '中国电信').trim() || '中国电信';
  const { configured, ds, fromCache, cookieDead } = await loadData(ctx);

  if (!configured) {
    return buildError(
      title,
      '未登录：在 Safari 打开 e.dlife.cn 登录一次',
      URLS.login
    );
  }
  if (!ds) {
    return buildError(title, cookieDead ? '登录已失效，请重新登录' : '数据获取失败，请检查网络或重新登录', URLS.login);
  }

  const family = ctx.widgetFamily || 'systemSmall';
  let w;
  if (family === 'systemMedium' || family === 'systemLarge' || family === 'systemExtraLarge') {
    w = buildMedium(title, ds, fromCache, ctx, cookieDead);
  } else if (family.startsWith('accessory')) {
    w = buildLockScreen(title, ds, family);
  } else {
    w = buildSmall(title, ds, fromCache, ctx, cookieDead);
  }
  // cookie 失效时点小组件直接跳去登录页
  if (cookieDead) w.url = URLS.login;
  return w;
}

/* ---------- 入口：单文件双模式 ---------- */

export default async function (ctx) {
  // request 脚本条目 → 捕获登录；generic 脚本条目 → 渲染小组件
  //（ctx.request 仅在 request/response 脚本中可用）
  if (ctx.request && ctx.request.url) {
    return handleCapture(ctx);
  }
  // schedule 定时保活 → 只拉接口续 session，不渲染小组件
  if (!ctx.widgetFamily) {
    const keep = String(ctx.env?.CT_KEEPALIVE || '').toLowerCase();
    if (keep === 'false' || keep === '0') return { type: 'text', text: 'keepalive disabled' };
    try {
      await loadData(ctx);
    } catch (_) {}
    return { type: 'text', text: 'keepalive done' };
  }
  return handleWidget(ctx);
}
