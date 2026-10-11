/*
 * 中国电信小组件（微信小程序网关版）
 *
 * 原理：拦截微信小程序 wcmp.189.cn 网关请求，自动抓取 openid + appMethod + 加密 data，
 * 小组件直接重放这些请求获取数据。用户只需打开一次电信微信小程序，之后全自动。
 *
 * 数据接口：
 *   POST https://wcmp.189.cn/xcxApiService/api/gateway
 *   Headers: openid, appMethod, apptype: WEIXIN, methodType: GET, transUrl: 1
 *   Body: {"data": "<加密>"}（原样重放，不构造）
 *
 * 已验证的 appMethod：
 *   /api/bill/flowAndVoiceUsageAmount.do → 流量+语音（commType 1=流量KB, 2=语音分钟）
 *   余额接口 appMethod 待抓取后自动识别（响应含 billBalance.realBalance）
 */

const GATEWAY_URL = 'https://wcmp.189.cn/xcxApiService/api/gateway';

const FLOW_COLOR = '#FF6620';
const VOICE_COLOR = '#78C100';

const FEE_ICON = 'yensign.circle.fill';
const FEE_ICON_COLOR = '#FF9500';
const FLOW_ICON = 'antenna.radiowaves.left.and.right';
const VOICE_ICON = 'phone.circle.fill';

/* ---------- 工具函数 ---------- */

function formatFlow(kb) {
  const mb = kb / 1024;
  if (mb < 1024) return { amount: mb.toFixed(2), unit: 'MB' };
  return { amount: (mb / 1024).toFixed(2), unit: 'GB' };
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

/* ---------- 存储 ---------- */

const STORE_OPENID = 'wx_openid';
const STORE_OPENID2 = 'wx_openid_analytics'; // 埋点里的电信内部 openid（备用）
const STORE_REQS = 'wx_requests'; // {appMethod: {data, methodType, ts}}

function getStoredOpenid(ctx) {
  return ctx.storage.get(STORE_OPENID) || '';
}

function getStoredRequests(ctx) {
  try {
    return JSON.parse(ctx.storage.get(STORE_REQS) || '{}');
  } catch (e) {
    return {};
  }
}

function saveRequest(ctx, appMethod, data, methodType) {
  const reqs = getStoredRequests(ctx);
  reqs[appMethod] = { data, methodType: methodType || 'GET', ts: Date.now() };
  ctx.storage.set(STORE_REQS, JSON.stringify(reqs));
}

/* ---------- http_request 自动抓取 ---------- */

function extractAnalyticsOpenid(url) {
  // 从 bigdata-behaviordata 的 data= 参数里解 base64 取 openid
  // 注意：Egern 是 JavaScriptCore，没有 Node 的 Buffer，用 atob
  try {
    const m = url.match(/[?&]data=([^&]+)/);
    if (!m) return '';
    const b64 = decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    // openid 是 ASCII hex，直接正则提取，避免 UTF-8 解码问题
    const om = bin.match(/"openid":"([0-9a-fA-F]+)"/);
    return om ? om[1] : '';
  } catch (e) {
    return '';
  }
}

function handleCapture(ctx) {
  const req = ctx.request || {};
  const headers = req.headers || {};
  const url = req.url || '';

  // 埋点域名：提取电信内部 openid
  if (url.indexOf('bigdata-behaviordata.189.cn') >= 0) {
    const aOpenid = extractAnalyticsOpenid(url);
    if (aOpenid && ctx.storage.get(STORE_OPENID2) !== aOpenid) {
      ctx.storage.set(STORE_OPENID2, aOpenid);
      ctx.notify('电信小组件', '已抓取埋点 openid', aOpenid.slice(0, 20) + '…');
    }
    return;
  }

  // 只处理网关请求
  if (url.indexOf('/xcxApiService/api/gateway') < 0 && url.indexOf('wcmp.189.cn') < 0) return;

  // 取 openid（header 名大小写不敏感）
  let openid = '';
  let appMethod = '';
  let methodType = 'GET';
  for (const k of Object.keys(headers)) {
    const lk = k.toLowerCase();
    if (lk === 'openid') openid = headers[k];
    else if (lk === 'appmethod') appMethod = headers[k];
    else if (lk === 'methodtype') methodType = headers[k];
  }

  // 取 body 里的 data
  let data = '';
  let body = req.body;
  if (typeof body === 'string') body = safeJsonParse(body);
  if (body && typeof body === 'object' && body.data) data = body.data;

  if (!openid || !appMethod || !data) return;

  const isNewOpenid = getStoredOpenid(ctx) !== openid;
  const reqs = getStoredRequests(ctx);
  const isNewMethod = !reqs[appMethod];

  if (isNewOpenid) ctx.storage.set(STORE_OPENID, openid);
  saveRequest(ctx, appMethod, data, methodType);

  // 调试：每次抓到都通知（带时间，确认脚本在跑）
  const now = new Date();
  const tstr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
  ctx.notify(
    '电信抓取',
    `${tstr} ${isNewMethod ? '新接口' : '更新'}`,
    `${appMethod.slice(0, 50)}\ndata长度: ${data.length}`
  );

  if (isNewOpenid || isNewMethod) {
    const short = appMethod.length > 40 ? '…' + appMethod.slice(-37) : appMethod;
    ctx.notify(
      '电信小组件',
      '已抓取登录凭证',
      `接口：${short}\n打开小组件即可显示数据`
    );
  }
}

/* ---------- 数据获取（重放） ---------- */

function buildHeaders(openid, appMethod, methodType) {
  return {
    'Content-Type': 'application/json',
    'openid': openid,
    'appMethod': appMethod,
    'apptype': 'WEIXIN',
    'methodType': methodType || 'GET',
    'transUrl': '1',
    'v': '36',
    'v1': '60100',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.79 NetType/WIFI Language/zh_CN',
  };
}

async function replayRequest(ctx, openid, appMethod, reqInfo) {
  const resp = await ctx.http.post(GATEWAY_URL, {
    headers: buildHeaders(openid, appMethod, reqInfo.methodType),
    body: JSON.stringify({ data: reqInfo.data }),
    timeout: 15000,
  });
  const j = await resp.json();
  if (!j || j.success !== true) throw new Error('gateway error');
  return j.data;
}

/* ---------- 数据解析 ---------- */

function parseBalance(data) {
  // data.object.billBalance.realBalance
  try {
    const b = data.object.billBalance;
    if (b && typeof b.realBalance === 'number') return b.realBalance;
    if (b && typeof b.generalCallBalance === 'number') return b.generalCallBalance;
  } catch (e) {}
  return null;
}

function parseFlowVoice(data, showGeneral, showDirectional) {
  // data.object.data[]: commType 1=流量(KB), 2=语音(分钟)
  // 定向判定：accuQryList 中 accuTypeName 含"定向"或 offerType 特殊
  const result = { flowKB: 0, flowUsedKB: 0, flowTotalKB: 0, voice: 0, voiceUsed: 0, voiceTotal: 0 };
  try {
    const arr = data.object.data;
    if (!Array.isArray(arr)) return result;
    for (const item of arr) {
      if (item.commType === '1' || item.commType === 1) {
        // 流量：按通用/定向开关过滤
        let unused = 0, used = 0, total = 0;
        const plans = item.planList || [];
        for (const plan of plans) {
          for (const accu of (plan.accuQryList || [])) {
            const name = accu.accuTypeName || '';
            const isDirectional = name.indexOf('定向') >= 0;
            const uv = parseFloat(accu.unusedVal || 0);
            const sv = parseFloat(accu.usageVal || 0);
            const tv = parseFloat(accu.totalVal || 0);
            if (isDirectional && !showDirectional) continue;
            if (!isDirectional && !showGeneral) continue;
            unused += uv; used += sv; total += tv;
          }
        }
        // 如果没有明细，回落到汇总
        if (total === 0) {
          unused = parseFloat(item.planUnusedAmount || 0);
          used = parseFloat(item.planUsedAmount || 0);
          total = parseFloat(item.planTotalAmount || 0);
        }
        result.flowKB = unused; result.flowUsedKB = used; result.flowTotalKB = total;
      } else if (item.commType === '2' || item.commType === 2) {
        result.voice = parseFloat(item.planUnusedAmount || 0);
        result.voiceUsed = parseFloat(item.planUsedAmount || 0);
        result.voiceTotal = parseFloat(item.planTotalAmount || 0);
      }
    }
  } catch (e) {}
  return result;
}

async function tryReplayWithOpenid(ctx, openid, reqs) {
  const methods = Object.keys(reqs);
  const result = { balance: null, flowKB: 0, voice: 0, updatedAt: Date.now() };
  let okCount = 0;
  const showGeneral = ctx.env.CT_SHOW_GENERAL_FLOW !== 'false';
  const showDirectional = ctx.env.CT_SHOW_DIRECTIONAL_FLOW !== 'false';

  const tasks = methods.map(m => {
    return replayRequest(ctx, openid, m, reqs[m]).then(data => {
      okCount++;
      const b = parseBalance(data);
      if (b !== null) result.balance = b;
      const fv = parseFlowVoice(data, showGeneral, showDirectional);
      if (fv.flowTotalKB > 0) {
        result.flowKB = fv.flowKB;
        result.flowUsedKB = fv.flowUsedKB;
        result.flowTotalKB = fv.flowTotalKB;
      }
      if (fv.voiceTotal > 0) {
        result.voice = fv.voice;
        result.voiceUsed = fv.voiceUsed;
        result.voiceTotal = fv.voiceTotal;
      }
    }).catch(e => {});
  });

  await Promise.all(tasks);
  return { result, okCount };
}

function loadData(ctx) {
  const openid = getStoredOpenid(ctx);
  const openid2 = ctx.storage.get(STORE_OPENID2) || '';
  const reqs = getStoredRequests(ctx);
  const methods = Object.keys(reqs);

  if (methods.length === 0) {
    return Promise.resolve({
      error: 'no_auth',
      message: openid ? '已抓到 openid\n请在小程序里点一下\n话费和流量页面' : '请先打开电信微信小程序\n点一点话费/流量页面\n回来刷新小组件',
    });
  }

  // 先试网关 openid，不行再试埋点 openid
  const candidates = [];
  if (openid) candidates.push(openid);
  if (openid2 && openid2 !== openid) candidates.push(openid2);

  if (candidates.length === 0) {
    return Promise.resolve({
      error: 'no_auth',
      message: '请先打开电信微信小程序\n点一点话费/流量页面\n回来刷新小组件',
    });
  }

  let chain = Promise.resolve(null);
  for (const oid of candidates) {
    chain = chain.then(prev => {
      if (prev && prev.okCount > 0) return prev;
      return tryReplayWithOpenid(ctx, oid, reqs);
    });
  }

  return chain.then(({ result, okCount }) => {
    if (okCount === 0) {
      return {
        error: 'auth_expired',
        message: '凭证已失效\n请重新打开电信小程序\n点一点页面后刷新',
      };
    }
    try {
      ctx.storage.set('ct_cache', JSON.stringify(result));
      ctx.storage.set('ct_cache_time', String(Date.now()));
    } catch (e) {}
    return result;
  });
}

function loadCached(ctx) {
  try {
    const c = JSON.parse(ctx.storage.get('ct_cache') || 'null');
    const t = parseInt(ctx.storage.get('ct_cache_time') || '0', 10);
    if (c) return { data: c, time: t };
  } catch (e) {}
  return null;
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
        text: data.amount,
        fontSize: 22,
        fontWeight: 'bold',
      },
      {
        type: 'text',
        text: data.unit,
        fontSize: 11,
        color: '#8E8E93',
      },
    ],
  };
}

function renderWidget(data, cacheTime) {
  const flow = formatFlow(data.flowKB || 0);
  const children = [];

  // 余额行
  children.push({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
    children: [
      {
        type: 'image',
        src: `sf-symbol:${FEE_ICON}`,
        width: 28,
        height: 28,
        color: FEE_ICON_COLOR,
      },
      {
        type: 'text',
        text: data.balance !== null && data.balance !== undefined ? `¥${data.balance}` : '--',
        fontSize: 28,
        fontWeight: 'bold',
      },
    ],
  });

  children.push({ type: 'spacer', height: 8 });

  // 流量 + 语音
  children.push({
    type: 'stack',
    direction: 'row',
    gap: 4,
    children: [
      statCard(FLOW_ICON, FLOW_COLOR, 22, flow),
      statCard(VOICE_ICON, VOICE_COLOR, 22, {
        amount: String(Math.round(data.voice || 0)),
        unit: '分钟',
      }),
    ],
  });

  if (cacheTime) {
    children.push({ type: 'spacer', height: 4 });
    children.push({
      type: 'text',
      text: `缓存 ${fmtTime(cacheTime)}`,
      fontSize: 10,
      color: '#8E8E93',
    });
  }

  return { type: 'stack', direction: 'column', padding: 12, children };
}

function renderError(message) {
  return {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
    children: [
      {
        type: 'image',
        src: 'sf-symbol:exclamationmark.triangle.fill',
        width: 28,
        height: 28,
        color: '#FF9500',
      },
      {
        type: 'text',
        text: message,
        fontSize: 13,
        color: '#8E8E93',
        multiline: true,
      },
    ],
  };
}

/* ---------- 保活 ---------- */

function handleKeepAlive(ctx) {
  const openid = getStoredOpenid(ctx);
  if (!openid) return;
  const reqs = getStoredRequests(ctx);
  const methods = Object.keys(reqs);
  if (methods.length === 0) return;
  // 只 ping 第一个接口，轻量保活
  replayRequest(ctx, openid, methods[0], reqs[methods[0]]).catch(() => {});
}

/* ---------- 入口 ---------- */

async function handleWidget(ctx) {
  try {
    const result = await loadData(ctx);
    if (result.error) {
      const cached = loadCached(ctx);
      if (cached && cached.data && cached.data.balance !== null) {
        return renderWidget(cached.data, cached.time);
      }
      return renderError(result.message);
    }
    return renderWidget(result, 0);
  } catch (e) {
    try {
      const cached = loadCached(ctx);
      if (cached && cached.data) return renderWidget(cached.data, cached.time);
    } catch (e2) {}
    return renderError('网络异常\n请检查连接后重试');
  }
}

export default async function(ctx) {
  // http_request 抓取模式
  if (ctx.request && ctx.request.url) {
    try { handleCapture(ctx); } catch (e) {}
    return {};
  }
  // schedule 保活模式
  if (ctx.cron || (ctx.env && ctx.env.CT_KEEPALIVE === 'true')) {
    try { handleKeepAlive(ctx); } catch (e) {}
    return {};
  }
  // 小组件模式
  return handleWidget(ctx);
}
