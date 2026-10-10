/*
 * 中国电信小组件
 * 同一个文件，三种用法：
 *   1. generic 类型 → iOS 小组件
 *   2. http_request 类型 → 登录捕获（cookie 模式用）
 *   3. schedule 类型 → 定时保活
 *
 * 登录方式（两种，密码登录优先）：
 *   A. 密码登录（推荐）：在小组件环境变量里填
 *        CT_PHONE=手机号
 *        CT_PASSWORD=服务密码
 *        CT_DEVICE_ID=设备ID（可选，不填自动生成）
 *      脚本用电信 App 官方接口（RSA 加密）登录拿 token，
 *      token 失效时自动重新登录，全程不用手动干预。
 *   B. Cookie 模式（兼容旧版）：不填上面三个变量时，
 *      走原来的 e.dlife.cn 抓包逻辑（https://e.dlife.cn 登录一次）。
 *
 * 环境变量：
 *   CT_PHONE / CT_PASSWORD / CT_DEVICE_ID
 *   CT_LOGIN_URL
 *   CT_COOKIE
 *   CT_SHOW_USED_FLOW
 *   CT_FILTER_ORIENTATE_FLOW
 *   CT_TITLE
 *
 * 数据来源：
 *   密码登录：https://appgologin.189.cn:9031（登录）
 *             https://appfuwu.189.cn:9021/query/qryImportantData（查数据）
 *   Cookie 模式：https://e.dlife.cn/user/package_detail.do
 *                https://e.dlife.cn/user/balance.do
 *
 * 登录过期处理：
 *   密码登录：token 失效自动重登；只有"密码错误/账号异常"导致登录失败
 *   时才通知一次并显示错误页。断网时用缓存顶，标题栏显示"缓存 HH:mm"。
 *   Cookie 模式：服务器拒绝 cookie（非 200 / 非 JSON / 异常载荷）时视为
 *   登录过期，小组件显示"登录已过期"错误页（点小组件可直接跳登录页）
 *   并通知一次，不再静默展示旧数据；仅当"连不上服务器"（断网/超时）
 *   时才用缓存顶一下，此时标题栏会显示"缓存 HH:mm"以示区别。
 *
 * 保活模式（schedule 定时任务）：
 *   cron 每 20 分钟执行一次。密码登录模式下查一次数据接口
 *   （token 失效会自动重登）；cookie 模式下 ping 一次 package_detail.do。
 *   成功/失败都不通知不写缓存，下次小组件刷新会正常处理显示和过期提醒。
 */

const URLS = {
  login: 'https://e.dlife.cn/index.do',
  detail: 'https://e.dlife.cn/user/package_detail.do',
  balance: 'https://e.dlife.cn/user/balance.do',
};


const FLOW_COLOR = '#FF6620';
const VOICE_COLOR = '#78C100';


const COLORS = {
  bg: {
    light: '#FFFFFF',
    dark: '#2C2C2E',
  },

  border: {
    light: '#E5E5EA',
    dark: '#3A3A3C',
  },

  title: {
    light: '#666666',
    dark: '#8E8E93',
  },

  value: {
    light: '#1C1C1E',
    dark: '#FFFFFF',
  },

  time: {
    light: '#999999',
    dark: '#666666',
  },

  error: {
    light: '#FF3B30',
    dark: '#FF453A',
  },

  capsuleBg: {
    light: '#F5F5F7',
    dark: '#3A3A3C',
  },

  accent: {
    light: '#FF6620',
    dark: '#FF854D',
  },
};


function formatFlow(flow) {
  const remain = flow / 1024;

  if (remain < 1024) {
    return {
      amount: remain.toFixed(2),
      unit: 'MB',
    };
  }

  return {
    amount: (remain / 1024).toFixed(2),
    unit: 'GB',
  };
}


function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}


function fmtTime(ts) {
  const d = new Date(ts);

  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}


async function refreshCookie(ctx) {
  const loginUrl =
    (ctx.env.CT_LOGIN_URL || '').trim() ||
    ctx.storage.get('ct_login_url') ||
    '';

  if (!loginUrl) {
    return ctx.storage.get('ct_cookie') || '';
  }

  const url =
    (loginUrl.match(/(http.+)&sign/) || [])[1] ||
    loginUrl;

  const resp = await ctx.http.get(url, {
    redirect: 'manual',
    timeout: 15000,
    credentials: 'omit',
  });

  const setCookies =
    (resp.headers &&
      resp.headers.getAll &&
      resp.headers.getAll('set-cookie')) ||
    [];

  const pairs = setCookies
    .map((c) => String(c).split(';')[0].trim())
    .filter(Boolean);

  if (pairs.length > 0) {
    ctx.storage.set(
      'ct_cookie',
      pairs.join('; ')
    );
  }

  return ctx.storage.get('ct_cookie') || '';
}


async function fetchJson(ctx, url, cookie) {
  let resp;
  try {
    resp = await ctx.http.get(url, {
      headers: {
        Cookie: cookie,
      },

      timeout: 15000,

      credentials: 'omit',
    });
  } catch (e) {
    // 连服务器都没连上（断网/DNS/超时）：瞬时故障，可以用缓存顶
    const err = new Error(`network: ${url}`);
    err.transient = true;
    throw err;
  }

  if (!resp || resp.status !== 200) {
    // 服务器有响应但拒绝了（302 跳登录/401/403 等）：cookie 已失效
    throw new Error(
      `HTTP ${resp ? resp.status : 'no-response'}: ${url}`
    );
  }

  try {
    return await resp.json();
  } catch (e) {
    // 200 但不是 JSON（通常是被踢到登录页，拿回 HTML）：cookie 已失效
    throw new Error(`not-json: ${url}`);
  }
}


// ==================== 密码登录（电信 App 官方接口） ====================
// 手机号 + 服务密码 → RSA 加密登录拿 token，token 失效自动重登。
// 纯 JS 实现 RSA（PKCS#1 v1.5），不依赖 WebView。

const TOKEN_URLS = {
  login: 'https://appgologin.189.cn:9031/login/client/userLoginNormal',
  data: 'https://appfuwu.189.cn:9021/query/qryImportantData',
};

const TELECOM_RSA_PUBLIC_KEY = [
  '-----BEGIN PUBLIC KEY-----',
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDBkLT15ThVgz6/NOl6s8GNPofd',
  'WzWbCkWnkaAm7O2LjkM1H7dMvzkiqdxU02jamGRHLX/ZNMCXHnPcW/sDhiFCBN18',
  'qFvy8g6VYb9QtroI09e176s+ZCtiv7hbin2cCTj99iUpnEloZm19lwHyo69u5UMi',
  'PMpq0/XKBO8lYhN/gwIDAQAB',
  '-----END PUBLIC KEY-----',
].join('\n');

const RSA_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function rsaB64Decode(b64) {
  const clean = String(b64).replace(/[^A-Za-z0-9+/=]/g, '');
  const out = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = RSA_B64.indexOf(clean[i]);
    const c2 = RSA_B64.indexOf(clean[i + 1]);
    const c3 = clean[i + 2] === '=' ? 0 : RSA_B64.indexOf(clean[i + 2]);
    const c4 = clean[i + 3] === '=' ? 0 : RSA_B64.indexOf(clean[i + 3]);
    const n = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
    out.push((n >> 16) & 0xff);
    if (clean[i + 2] !== '=') out.push((n >> 8) & 0xff);
    if (clean[i + 3] !== '=') out.push(n & 0xff);
  }
  return out;
}

function rsaB64Encode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (b1 << 16) | (b2 << 8) | b3;
    out += RSA_B64[(n >> 18) & 0x3f];
    out += RSA_B64[(n >> 12) & 0x3f];
    out += i + 1 < bytes.length ? RSA_B64[(n >> 6) & 0x3f] : '=';
    out += i + 2 < bytes.length ? RSA_B64[n & 0x3f] : '=';
  }
  return out;
}

// 最小 DER 解析器：只够读 X.509 RSA 公钥
function rsaDerRead(bytes, pos) {
  const tag = bytes[pos];
  let len = bytes[pos + 1];
  let off = pos + 2;
  if (len & 0x80) {
    const nBytes = len & 0x7f;
    len = 0;
    for (let i = 0; i < nBytes; i++) {
      len = len * 256 + bytes[off++];
    }
  }
  return { tag, start: off, end: off + len, next: off + len };
}

function rsaParsePublicKey(pem) {
  const b64 = String(pem)
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '');
  const bytes = rsaB64Decode(b64);
  const outer = rsaDerRead(bytes, 0);
  let pos = outer.start;
  const alg = rsaDerRead(bytes, pos);
  pos = alg.next;
  const bitStr = rsaDerRead(bytes, pos);
  pos = bitStr.start + 1; // 跳过 BIT STRING 的未使用 bit 数
  const inner = rsaDerRead(bytes, pos);
  pos = inner.start;
  const modTlv = rsaDerRead(bytes, pos);
  pos = modTlv.next;
  const expTlv = rsaDerRead(bytes, pos);
  const toBigInt = (arr) => {
    let hex = '';
    for (const b of arr) hex += b.toString(16).padStart(2, '0');
    return BigInt('0x' + hex);
  };
  const n = toBigInt(bytes.slice(modTlv.start, modTlv.end));
  const e = toBigInt(bytes.slice(expTlv.start, expTlv.end));
  // k 按模数实际位长算（DER INTEGER 可能有前导 0x00）
  const k = Math.ceil(n.toString(2).length / 8);
  return { n, e, k };
}

function rsaModPow(base, exp, mod) {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

// PKCS#1 v1.5 type-2 填充后加密，返回 base64（与 JSEncrypt 输出一致）
function rsaEncrypt(publicKeyPem, text) {
  const { n, e, k } = rsaParsePublicKey(publicKeyPem);
  const src = String(text);
  const msgBytes = [];
  for (let i = 0; i < src.length; i++) {
    const code = src.charCodeAt(i);
    if (code < 0x80) {
      msgBytes.push(code);
    } else if (code < 0x800) {
      msgBytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      msgBytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  if (msgBytes.length > k - 11) throw new Error('RSA: 明文过长');
  // EM = 0x00 || 0x02 || PS(随机非零) || 0x00 || M
  const em = new Array(k).fill(0);
  em[1] = 0x02;
  const psLen = k - msgBytes.length - 3;
  for (let i = 0; i < psLen; i++) {
    let r = 0;
    while (r === 0) r = Math.floor(Math.random() * 256);
    em[2 + i] = r;
  }
  em[2 + psLen] = 0x00;
  for (let i = 0; i < msgBytes.length; i++) em[3 + psLen + i] = msgBytes[i];
  let hex = '';
  for (const b of em) hex += b.toString(16).padStart(2, '0');
  const c = rsaModPow(BigInt('0x' + hex), e, n);
  let cHex = c.toString(16).padStart(k * 2, '0');
  const cBytes = [];
  for (let i = 0; i < cHex.length; i += 2) cBytes.push(parseInt(cHex.substr(i, 2), 16));
  return rsaB64Encode(cBytes);
}

// 手机号/密码的简单混淆（charCode+2），与官方 App 一致
function transNumber(str, encode = true) {
  return [...String(str)]
    .map((c) => String.fromCharCode((c.charCodeAt(0) + (encode ? 2 : -2)) & 0xffff))
    .join('');
}

// 北京时间戳 yyyyMMddHHmmss（与设备时区无关）
function beijingTimestamp() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds())
  );
}

async function telecomLogin(ctx, phone, password) {
  const deviceId = (ctx.env.CT_DEVICE_ID || '').trim();
  const uuid = String(Math.floor(Math.random() * 9e15 + 1e15));
  const ts = beijingTimestamp();
  const encryptText = `iPhone 14 15.4.0${deviceId || uuid.slice(0, 12)}${phone}${ts}${password}0$$$0.`;
  const encrypted = rsaEncrypt(TELECOM_RSA_PUBLIC_KEY, encryptText);

  const body = {
    content: {
      fieldData: {
        loginType: '4',
        accountType: '',
        isChinatelecom: '',
        systemVersion: '15.4.0',
        deviceUid: uuid.slice(0, 16),
        phoneNum: transNumber(phone),
        authentication: transNumber(password),
        androidId: deviceId ? transNumber(deviceId) : '',
        loginAuthCipherAsymmertric: encrypted,
      },
      attach: 'iPhone',
    },
    headerInfos: {
      code: 'userLoginNormal',
      clientType: '#12.2.0#channel50#iPhone 14 Pro#',
      timestamp: ts,
      shopId: '20002',
      source: '110003',
      sourcePassword: 'Sid98s',
      userLoginName: transNumber(phone),
    },
  };

  let resp;
  try {
    resp = await ctx.http.post(TOKEN_URLS.login, {
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(body),
      timeout: 15000,
    });
  } catch (e) {
    // 连不上服务器：瞬时故障
    const err = new Error(`network: ${TOKEN_URLS.login}`);
    err.transient = true;
    throw err;
  }

  if (!resp || resp.status !== 200) {
    throw new Error(`HTTP ${resp ? resp.status : 'no-response'}: login`);
  }

  let data;
  try {
    data = await resp.json();
  } catch (e) {
    throw new Error('not-json: login');
  }

  if (data?.responseData?.resultCode !== '0000') {
    // 密码错误 / 账号异常：登录失败（非瞬时故障）
    const err = new Error(data?.responseData?.resultDesc || '登录失败');
    err.loginFailed = true;
    throw err;
  }

  const r = data.responseData.data.loginSuccessResult || {};
  ctx.storage.set('ct_token', r.token || '');
  ctx.storage.set('ct_city_code', r.cityCode || '');
  ctx.storage.set('ct_province_code', r.provinceCode || '');
  return r;
}

async function fetchImportantData(ctx, phone) {
  const token = ctx.storage.get('ct_token') || '';
  const cityCode = ctx.storage.get('ct_city_code') || '';
  const provinceCode = ctx.storage.get('ct_province_code') || '';
  const ts = beijingTimestamp();

  const body = {
    content: {
      fieldData: {
        provinceCode,
        cityCode,
        shopId: '20002',
        isChinatelecom: '0',
        account: transNumber(phone),
      },
      attach: 'test',
    },
    headerInfos: {
      code: 'qryImportantData',
      clientType: '#12.2.0#channel50#iPhone 14 Pro#',
      timestamp: ts,
      shopId: '20002',
      source: '110003',
      sourcePassword: 'Sid98s',
      userLoginName: transNumber(phone),
      token,
    },
  };

  let resp;
  try {
    resp = await ctx.http.post(TOKEN_URLS.data, {
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(body),
      timeout: 15000,
    });
  } catch (e) {
    const err = new Error(`network: ${TOKEN_URLS.data}`);
    err.transient = true;
    throw err;
  }

  if (!resp || resp.status !== 200) {
    throw new Error(`HTTP ${resp ? resp.status : 'no-response'}: data`);
  }

  let data;
  try {
    data = await resp.json();
  } catch (e) {
    throw new Error('not-json: data');
  }

  if (!data?.responseData) {
    // token 失效：需要重新登录
    const err = new Error('token-expired');
    err.tokenExpired = true;
    throw err;
  }

  return data.responseData.data;
}

// 把 189.cn 接口数据映射成小组件统一的 ds 结构（与 parseTelecom 输出一致）
// 流量数值 /1024 = MB（与 formatFlow 的换算一致）；
// 通用/定向开关：接口原生区分 commonFlow（通用）和 totalAmount（全部），
// 定向 = 全部 - 通用。
function parseTokenData(apiData, opts) {
  const { showUsedFlow, showGeneralFlow, showDirectionalFlow } = opts;

  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  // 话费（元）
  const balanceRaw = apiData?.balanceInfo?.indexBalanceDataInfo?.balance ?? apiData?.balance;
  const balanceNum = Number(balanceRaw);
  const fee = {
    title: '剩余话费',
    number: Number.isFinite(balanceNum) ? balanceNum.toFixed(2) : '0.00',
    unit: '元',
  };

  // 流量
  const common = apiData?.flowInfo?.commonFlow || {};
  const total = apiData?.flowInfo?.totalAmount || {};
  let usedRaw = 0;
  let balanceRawFlow = 0;
  if (showGeneralFlow && showDirectionalFlow) {
    usedRaw = num(total.used);
    balanceRawFlow = num(total.balance);
  } else if (showGeneralFlow) {
    usedRaw = num(common.used);
    balanceRawFlow = num(common.balance);
  } else if (showDirectionalFlow) {
    usedRaw = Math.max(0, num(total.used) - num(common.used));
    balanceRawFlow = Math.max(0, num(total.balance) - num(common.balance));
  }
  // 两个开关都关：显示 0
  const totalRaw = usedRaw + balanceRawFlow;

  const balanceFlow = formatFlow(balanceRawFlow);
  const usedFlow = formatFlow(usedRaw);

  const flow = {
    title: '剩余流量',
    number: balanceFlow.amount,
    unit: balanceFlow.unit,
    percent: +((balanceRawFlow / (totalRaw || 1)) * 100).toFixed(2),
    color: FLOW_COLOR,
  };

  if (showUsedFlow) {
    flow.title = '已用流量';
    flow.number = usedFlow.amount;
    flow.unit = usedFlow.unit;
  }

  // 语音（分钟）
  const vInfo = apiData?.voiceInfo?.voiceDataInfo || {};
  const voiceTotal = num(vInfo.total ?? apiData?.totalVoice);
  const voiceUsed = num(vInfo.used ?? apiData?.usedVoice);
  const voiceBalance = num(vInfo.balance ?? voiceTotal - voiceUsed);

  const voice = {
    title: '剩余语音',
    number: `${Math.round(voiceBalance)}`,
    unit: '分钟',
    percent: +((voiceBalance / (voiceTotal || 1)) * 100).toFixed(2),
    color: VOICE_COLOR,
  };

  return { fee, flow, voice, updatedAt: Date.now() };
}

// 密码登录失败通知：同一个手机号只通知一次，登录成功后清除标记
function notifyTokenLoginFailedOnce(ctx, phone) {
  const key = 'ct_token_login_notified';
  const marker = phone || 'none';
  if (ctx.storage.get(key) === marker) return;
  ctx.storage.set(key, marker);
  try {
    ctx.notify({
      title: '中国电信',
      body: '密码登录失败，请检查手机号和服务密码是否正确',
    });
  } catch (e) {}
}

function clearTokenLoginFlag(ctx) {
  ctx.storage.delete('ct_token_login_notified');
}

// 密码登录模式的数据加载：token 失效自动重登；断网走缓存
async function loadDataByToken(ctx, phone, password, settings) {
  const configured = true;

  try {
    let apiData;
    try {
      apiData = await fetchImportantData(ctx, phone);
    } catch (e) {
      if (e && e.tokenExpired) {
        // token 失效：自动重新登录一次
        await telecomLogin(ctx, phone, password);
        apiData = await fetchImportantData(ctx, phone);
      } else {
        throw e;
      }
    }

    const ds = parseTokenData(apiData, settings);
    ctx.storage.setJSON('ct_datasource', ds);
    clearTokenLoginFlag(ctx);

    return { configured, ds, fromCache: false, authFailed: false };
  } catch (e) {
    if (e && e.transient) {
      // 断网：用缓存顶
      const cached = ctx.storage.getJSON('ct_datasource');
      return { configured, ds: cached || null, fromCache: !!cached, authFailed: false };
    }
    if (e && e.loginFailed) {
      // 密码错误 / 账号异常：通知一次
      notifyTokenLoginFailedOnce(ctx, phone);
      return { configured, ds: null, fromCache: false, authFailed: 'token' };
    }
    // 其他异常：有缓存用缓存顶一下并标过期，无缓存则报错
    const cached = ctx.storage.getJSON('ct_datasource');
    return {
      configured,
      ds: cached || null,
      fromCache: !!cached,
      authFailed: cached ? false : 'token',
    };
  }
}


function parseTelecom(detail, balance, opts) {
  const {
    showUsedFlow,
    showGeneralFlow,
    showDirectionalFlow,
  } = opts;

  let totalFlowAmount = 0;
  let totalBalanceFlowAmount = 0;
  let totalUsedFlowAmount = 0;

  let totalVoiceAmount = 0;
  let totalBalanceVoiceAmount = 0;

  let isUnlimitedFlow = false;

  for (const data of detail?.items || []) {

    if (data.offerType === 19) {
      continue;
    }

    for (const item of data.items || []) {


      if (item.unitTypeId == 3) {

        // 定向判断：资源名含"定向"即为定向流量，其余为通用流量
        const isDirectional =
          /定向/.test(
            item.ratableResourcename || ''
          );

        const directionAllowed =
          isDirectional ?
            showDirectionalFlow :
            showGeneralFlow;

        if (
          !(
            item.usageAmount == 0 &&
            item.balanceAmount == 0
          )
        ) {

          const skip =
            item.balanceAmount == '999999999999' ||
            !directionAllowed;

          if (!skip) {

            totalFlowAmount +=
              parseFloat(
                item.ratableAmount
              ) || 0;

            totalBalanceFlowAmount +=
              parseFloat(
                item.balanceAmount
              ) || 0;
          }
        }

        // 已用流量同样按开关过滤，保证"只显示通用"时已用也是通用的
        if (directionAllowed) {

          totalUsedFlowAmount +=
            parseFloat(
              item.usageAmount
            ) || 0;
        }

        if (
          data.offerType == 21 &&
          item.ratableAmount == '0'
        ) {
          isUnlimitedFlow = true;
        }

      }


      else if (
        !detail.voiceBalance &&
        item.unitTypeId == 1
      ) {

        totalVoiceAmount +=
          parseInt(
            item.ratableAmount,
            10
          ) || 0;

        totalBalanceVoiceAmount +=
          parseInt(
            item.balanceAmount,
            10
          ) || 0;
      }
    }
  }


  if (
    detail.voiceAmount &&
    detail.voiceBalance
  ) {

    totalVoiceAmount =
      detail.voiceAmount;

    totalBalanceVoiceAmount =
      detail.voiceBalance;
  }


  const balanceFlow =
    formatFlow(
      totalBalanceFlowAmount
    );

  const usedFlow =
    formatFlow(
      totalUsedFlowAmount
    );


  const flow = {

    title:
      '剩余流量',

    number:
      balanceFlow.amount,

    unit:
      balanceFlow.unit,

    percent:
      +(
        (
          totalBalanceFlowAmount /
          (totalFlowAmount || 1)
        ) *
        100
      ).toFixed(2),

    color:
      FLOW_COLOR,
  };


  if (showUsedFlow) {

    flow.title =
      '已用流量';

    flow.number =
      usedFlow.amount;

    flow.unit =
      usedFlow.unit;
  }


  if (isUnlimitedFlow) {

    flow.title =
      '已用流量';

    flow.number =
      usedFlow.amount;

    flow.unit =
      usedFlow.unit;
  }


  const voice = {

    title:
      '剩余语音',

    number:
      `${totalBalanceVoiceAmount}`,

    unit:
      '分钟',

    percent:
      +(
        (
          totalBalanceVoiceAmount /
          (totalVoiceAmount || 1)
        ) *
        100
      ).toFixed(2),

    color:
      VOICE_COLOR,
  };


  const feeNum =
    Number(
      balance?.totalBalanceAvailable
    );

  const fee = {

    title:
      '剩余话费',

    number:
      Number.isFinite(feeNum)
        ? (feeNum / 100).toFixed(2)
        : '0.00',

    unit:
      '元',
  };


  return {

    fee,

    flow,

    voice,

    updatedAt:
      Date.now(),
  };
}


async function tryCookie(
  ctx,
  cookie,
  settings
) {

  const detail =
    await fetchJson(
      ctx,
      URLS.detail,
      cookie
    );

  const balance =
    await fetchJson(
      ctx,
      URLS.balance,
      cookie
    );

  // 200 + JSON 但不是套餐数据（比如返回了错误码对象）：视为登录失效
  for (const [name, data] of [['detail', detail], ['balance', balance]]) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`bad-payload: ${name}`);
    }
  }

  const ds =
    parseTelecom(
      detail,
      balance,
      settings
    );

  ctx.storage.setJSON(
    'ct_datasource',
    ds
  );

  return ds;
}


async function loadData(ctx) {

  const envCookie =
    (ctx.env.CT_COOKIE || '').trim();

  const loginUrl =
    (ctx.env.CT_LOGIN_URL || '').trim() ||
    ctx.storage.get('ct_login_url') ||
    '';

  const settings = {

    showUsedFlow:
      ctx.env.CT_SHOW_USED_FLOW ===
      'true',

    // 模块开关：通用流量 / 定向流量显示控制（默认都显示，即原来的"全部流量"）
    showGeneralFlow:
      ctx.env.CT_SHOW_GENERAL_FLOW !==
      'false',

    // 兼容旧版 CT_FILTER_ORIENTATE_FLOW=true（等价于定向流量开关关闭）
    showDirectionalFlow:
      ctx.env.CT_SHOW_DIRECTIONAL_FLOW !==
      'false' &&
      ctx.env.CT_FILTER_ORIENTATE_FLOW !==
      'true',
  };

  // 密码登录优先：填了手机号 + 服务密码就走 App 官方接口（token 自动续期）；
  // 否则走原来的 cookie 模式（兼容旧版）。
  const phone = (ctx.env.CT_PHONE || '').trim();
  const password = (ctx.env.CT_PASSWORD || '').trim();

  if (phone && password) {
    return loadDataByToken(ctx, phone, password, settings);
  }


  const storedCookie =
    ctx.storage.get('ct_cookie') ||
    '';

  const configured =
    !!(
      envCookie ||
      loginUrl ||
      storedCookie
    );


  const firstCookie =
    envCookie ||
    storedCookie;

  // authFailed：服务器明确拒绝了 cookie（非 200 / 非 JSON / 异常载荷），
  // 与"连不上服务器"（transient，走缓存）区分开
  let authFailed = false;

  if (firstCookie) {

    try {

      const ds =
        await tryCookie(
          ctx,
          firstCookie,
          settings
        );

      clearExpiredFlag(ctx);

      return {

        configured,

        ds,

        fromCache: false,

        authFailed: false,
      };

    } catch (e) {

      if (!(e && e.transient)) {
        authFailed = true;
      }
    }
  }


  if (
    !envCookie &&
    loginUrl
  ) {

    try {

      const fresh =
        await refreshCookie(ctx);

      if (
        fresh &&
        fresh !== firstCookie
      ) {

        try {

          const ds =
            await tryCookie(
              ctx,
              fresh,
              settings
            );

          clearExpiredFlag(ctx);

          return {

            configured,

            ds,

            fromCache: false,

            authFailed: false,
          };

        } catch (e2) {

          if (!(e2 && e2.transient)) {
            authFailed = true;
          }
        }
      }

    } catch (e) {
    }
  }


  const cached =
    ctx.storage.getJSON(
      'ct_datasource'
    );

  if (authFailed) {
    // cookie 被服务器拒绝且刷新无果：登录已过期，通知一次（同个 cookie 只通知一次）
    notifyExpiredOnce(ctx, firstCookie);
  }

  return {

    configured,

    ds:
      cached || null,

    fromCache:
      !!cached,

    authFailed,
  };
}


// 登录过期通知：同一个失效 cookie 只通知一次，成功刷新后清除标记
function notifyExpiredOnce(ctx, cookie) {
  const key = 'ct_expired_notified';
  const marker = cookie || 'none';

  if (ctx.storage.get(key) === marker) {
    return;
  }

  ctx.storage.set(key, marker);

  try {
    ctx.notify({
      title: '中国电信',
      body: '登录已过期，请在 Safari 重新登录 e.dlife.cn',
    });
  } catch (e) {
  }
}


function clearExpiredFlag(ctx) {
  ctx.storage.delete('ct_expired_notified');
}


function makeCapsule(
  title,
  value,
  unit
) {

  return {

    type: 'stack',

    direction: 'column',

    alignItems: 'center',

    justifyContent: 'center',

    flex: 1,

    padding: [
      8,
      8,
      8,
      8,
    ],

    backgroundColor:
      COLORS.capsuleBg,

    borderRadius: 14,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    children: [

      {
        type: 'text',

        text:
          title,

        font: {
          size: 'caption2',
          weight: 'medium',
        },

        textColor:
          COLORS.title,

        textAlign:
          'center',

        maxLines: 1,

        minScale:
          0.7,
      },

      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        justifyContent:
          'center',

        gap: 3,

        children: [

          {
            type: 'text',

            text:
              String(value),

            font: {
              size: 'title2',
              weight: 'semibold',
            },

            textColor:
              COLORS.value,

            textAlign:
              'center',

            maxLines: 1,

            minScale:
              0.65,
          },

          {
            type: 'text',

            text:
              unit,

            font: {
              size: 'caption2',
              weight: 'regular',
            },

            textColor:
              COLORS.title,

            maxLines: 1,
          },
        ],
      },
    ],
  };
}


function headerRow(
  title,
  ds,
  fromCache
) {

  const time =
    ds &&
    ds.updatedAt
      ? fmtTime(ds.updatedAt)
      : '--:--';

  return {

    type: 'stack',

    direction: 'row',

    alignItems: 'center',

    children: [

      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        gap: 7,

        children: [

          {
            type: 'image',

            src:
              'sf-symbol:antenna.radiowaves.left.and.right',

            color:
              COLORS.accent,

            width: 18,

            height: 18,
          },

          {
            type: 'text',

            text:
              title,

            font: {
              size: 'headline',
              weight: 'semibold',
            },

            textColor:
              COLORS.value,

            maxLines: 1,

            minScale:
              0.75,
          },
        ],
      },

      {
        type: 'spacer',
      },

      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        gap: 5,

        children: [

          {
            type: 'image',

            src:
              'sf-symbol:arrow.clockwise',

            color:
              COLORS.time,

            width: 12,

            height: 12,
          },

          {
            type: 'text',

            text:
              fromCache ? `缓存 ${time}` : time,

            font: {
              size: 'caption2',
            },

            textColor:
              COLORS.time,

            maxLines: 1,
          },
        ],
      },
    ],
  };
}


function buildMainWidget(
  title,
  ds,
  fromCache
) {

  return {

    type: 'widget',

    backgroundColor:
      COLORS.bg,

    padding: [
      10,
      14,
      10,
      14,
    ],

    gap: 12,

    refreshAfter:
      new Date(
        Date.now() +
        60 * 60 * 1000
      ).toISOString(),

    children: [

      /* 顶部 */

      headerRow(
        title,
        ds,
        fromCache
      ),


      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        gap: 9,

        children: [

          makeCapsule(
            ds.fee.title,
            ds.fee.number,
            ds.fee.unit
          ),

          makeCapsule(
            ds.voice.title,
            ds.voice.number,
            ds.voice.unit
          ),

          makeCapsule(
            ds.flow.title,
            ds.flow.number,
            ds.flow.unit
          ),
        ],
      },


      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        children: [

          {
            type: 'spacer',
          },

          {
            type: 'stack',

            width: 48,

            height: 4,

            borderRadius: 2,

            backgroundColor:
              COLORS.border,
          },

          {
            type: 'spacer',
          },
        ],
      },
    ],
  };
}

/* 小尺寸专用：圆形图标 + 数值 + 说明 的横条 */
function smallRow(
  color,
  symbol,
  glyph,
  value,
  unit,
  label
) {

  const iconChild =
    symbol
      ? {
          type: 'image',

          src: symbol,

          color: '#FFFFFF',

          width: 16,

          height: 16,
        }
      : {
          type: 'text',

          text: glyph,

          font: {
            size: 'headline',
            weight: 'bold',
          },

          textColor: '#FFFFFF',
        };

  return {

    type: 'stack',

    direction: 'row',

    alignItems: 'center',

    gap: 8,

    flex: 1,

    padding: [
      4,
      8,
      4,
      8,
    ],

    backgroundColor: {
      light: color + '1F',
      dark: color + '33',
    },

    borderRadius: 14,

    children: [

      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        justifyContent: 'center',

        width: 30,

        height: 30,

        borderRadius: 15,

        backgroundColor: color,

        children: [
          iconChild,
        ],
      },

      {
        type: 'stack',

        direction: 'column',

        flex: 1,

        children: [

          {
            type: 'stack',

            direction: 'row',

            alignItems: 'center',

            gap: 3,

            children: [

              {
                type: 'text',

                text: String(value),

                font: {
                  size: 'title3',
                  weight: 'bold',
                },

                textColor: color,

                maxLines: 1,

                minScale: 0.5,
              },

              {
                type: 'text',

                text: String(unit),

                font: {
                  size: 'caption1',
                  weight: 'semibold',
                },

                textColor: color,

                maxLines: 1,
              },

              {
                type: 'spacer',
              },
            ],
          },

          {
            type: 'stack',

            direction: 'row',

            alignItems: 'center',

            children: [

              {
                type: 'text',

                text: String(label),

                font: {
                  size: 'caption2',
                  weight: 'medium',
                },

                textColor: color + 'B3',

                maxLines: 1,

                minScale: 0.7,
              },

              {
                type: 'spacer',
              },
            ],
          },
        ],
      },
    ],
  };
}

function buildSmall(
  title,
  ds,
  fromCache
) {

  return {

    type: 'widget',

    backgroundColor:
      COLORS.bg,

    padding: [
      10,
      10,
      10,
      10,
    ],

    gap: 6,

    refreshAfter:
      new Date(
        Date.now() +
        60 * 60 * 1000
      ).toISOString(),

    children: [

      smallRow(
        '#E8651F',
        null,
        '¥',
        ds.fee.number,
        ds.fee.unit,
        ds.fee.title
      ),

      smallRow(
        '#4DA6F0',
        'sf-symbol:antenna.radiowaves.left.and.right',
        '',
        ds.flow.number,
        ds.flow.unit,
        ds.flow.title
      ),

      smallRow(
        '#55C759',
        'sf-symbol:phone.and.waveform.fill',
        '',
        ds.voice.number,
        ds.voice.unit,
        ds.voice.title
      ),
    ],
  };
}

function buildLockScreen(
  title,
  ds,
  family
) {

  /*
   * 锁屏组件背景是透明的，文字颜色交给系统处理，
   * 只有次要文字用半透明白色
   */
  const SUB = {
    light: '#FFFFFFB3',
    dark: '#FFFFFFB3',
  };


  /*
   * 单行：话费 · 流量
   */
  if (
    family ===
      'accessoryInline'
  ) {

    return {

      type: 'widget',

      children: [

        {
          type: 'text',

          text:
            `${title} ${ds.fee.number}${ds.fee.unit} · ` +
            `${ds.flow.number}${ds.flow.unit}`,

          font: {
            size: 'caption1',
            weight: 'medium',
          },

          maxLines: 1,

          minScale:
            0.5,
        },
      ],
    };
  }


  /*
   * 圆形：只显示剩余流量
   */
  if (
    family ===
      'accessoryCircular'
  ) {

    return {

      type: 'widget',

      padding: 2,

      children: [

        {
          type: 'spacer',
        },

        {
          type: 'text',

          text:
            `${ds.flow.number}`,

          font: {
            size: 'headline',
            weight: 'bold',
          },

          textAlign:
            'center',

          maxLines: 1,

          minScale:
            0.5,
        },

        {
          type: 'text',

          text:
            ds.flow.unit,

          font: {
            size: 'caption2',
          },

          textColor: SUB,

          textAlign:
            'center',

          maxLines: 1,
        },

        {
          type: 'spacer',
        },
      ],
    };
  }


  /*
   * 矩形：三行，左边说明，右边数值
   */
  const line = (
    label,
    value,
    unit
  ) => ({

    type: 'stack',

    direction: 'row',

    alignItems: 'center',

    gap: 4,

    children: [

      {
        type: 'text',

        text: label,

        font: {
          size: 'caption2',
          weight: 'medium',
        },

        textColor: SUB,

        maxLines: 1,
      },

      {
        type: 'spacer',
      },

      {
        type: 'text',

        text: String(value),

        font: {
          size: 'caption1',
          weight: 'bold',
        },

        maxLines: 1,

        minScale: 0.6,
      },

      {
        type: 'text',

        text: String(unit),

        font: {
          size: 'caption2',
        },

        textColor: SUB,

        maxLines: 1,
      },
    ],
  });


  return {

    type: 'widget',

    padding: 2,

    gap: 2,

    children: [

      line(
        '话费',
        ds.fee.number,
        ds.fee.unit
      ),

      line(
        '流量',
        ds.flow.number,
        ds.flow.unit
      ),

      line(
        '语音',
        ds.voice.number,
        ds.voice.unit
      ),
    ],
  };
}


function buildError(
  title,
  message,
  url
) {

  const w = {

    type: 'widget',

    backgroundColor:
      COLORS.bg,

    padding: 14,

    gap: 9,

    children: [

      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        gap: 6,

        children: [

          {
            type: 'image',

            src:
              'sf-symbol:exclamationmark.triangle.fill',

            color:
              COLORS.error,

            width: 14,

            height: 14,
          },

          {
            type: 'text',

            text:
              title,

            font: {
              size: 'headline',
              weight: 'bold',
            },

            textColor:
              COLORS.error,

            maxLines: 1,
          },
        ],
      },

      {
        type: 'text',

        text:
          message,

        font: {
          size: 'caption1',
        },

        textColor:
          COLORS.title,

        maxLines: 3,
      },

      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        gap: 5,

        padding: [
          6,
          10,
          6,
          10,
        ],

        backgroundColor:
          COLORS.capsuleBg,

        borderRadius: 10,

        borderWidth: 1,

        borderColor:
          COLORS.border,

        children: [

          {
            type: 'image',

            src:
              'sf-symbol:phone.circle',

            color:
              COLORS.time,

            width: 12,

            height: 12,
          },

          {
            type: 'text',

            text:
              '请在 Safari 登录电信账号',

            font: {
              size: 'caption2',
            },

            textColor:
              COLORS.time,

            maxLines: 1,

            minScale:
              0.7,
          },
        ],
      },
    ],
  };


  if (url) {
    w.url = url;
  }

  return w;
}


function getReqCookie(headers) {

  if (!headers) {
    return '';
  }

  if (
    typeof headers.get ===
    'function'
  ) {

    return (
      headers.get('cookie') ||
      headers.get('Cookie') ||
      ''
    );
  }

  for (
    const k of Object.keys(headers)
  ) {

    if (
      String(k).toLowerCase() ===
      'cookie'
    ) {

      return headers[k] || '';
    }
  }

  return '';
}


async function handleCapture(ctx) {

  const req =
    ctx.request || {};

  const url =
    req.url || '';

  if (
    !url.includes(
      'e.dlife.cn'
    )
  ) {
    return;
  }


  if (
    url.includes(
      '/user/loginMiddle'
    )
  ) {

    const loginUrl =
      (
        url.match(
          /(http.+)&sign/
        ) || []
      )[1] ||
      url;


    if (
      loginUrl &&
      ctx.storage.get(
        'ct_login_url'
      ) !== loginUrl
    ) {

      ctx.storage.set(
        'ct_login_url',
        loginUrl
      );
    }


    ctx.storage.set(
      'ct_login_ts',
      String(Date.now())
    );

    return;
  }


  const cookie =
    String(
      getReqCookie(
        req.headers
      ) || ''
    ).trim();


  if (
    !cookie ||
    ctx.storage.get(
      'ct_cookie'
    ) === cookie
  ) {
    return;
  }


  ctx.storage.set(
    'ct_cookie',
    cookie
  );

  const ts =
    Number(
      ctx.storage.get(
        'ct_login_ts'
      ) || 0
    );


  if (
    Date.now() - ts <
    10 * 60 * 1000
  ) {

    ctx.storage.delete(
      'ct_login_ts'
    );


    ctx.notify({

      title:
        '中国电信',

      body:
        '登录成功，小组件将自动更新',

      action: {
        type: 'clipboard',

        text:
          cookie,
      },
    });
  }
}


async function handleWidget(ctx) {

  const title =
    (
      ctx.env.CT_TITLE ||
      '中国电信'
    ).trim() ||
    '中国电信';


  const {
    configured,
    ds,
    fromCache,
    authFailed,
  } =
    await loadData(ctx);

  if (!configured) {

    return buildError(
      title,
      '未登录：在 Safari 打开 e.dlife.cn 登录一次',
      URLS.login
    );
  }


  // 登录失效：不再展示旧数据，直接提示处理
  // authFailed === 'token'：密码登录模式（密码错误/账号异常）
  // authFailed === true：cookie 模式（cookie 被服务器拒绝）
  if (authFailed) {

    if (authFailed === 'token') {

      return buildError(
        title,
        '登录失败：请检查环境变量里的手机号和服务密码'
      );
    }

    return buildError(
      title,
      '登录已过期：在 Safari 打开 e.dlife.cn 重新登录',
      URLS.login
    );
  }


  if (!ds) {

    return buildError(
      title,
      '数据获取失败，请检查网络或重新登录'
    );
  }


  const family =
    ctx.widgetFamily ||
    'systemSmall';

  if (
    family ===
      'systemMedium' ||
    family ===
      'systemLarge' ||
    family ===
      'systemExtraLarge'
  ) {

    return buildMainWidget(
      title,
      ds,
      fromCache
    );
  }

  if (
    family.startsWith(
      'accessory'
    )
  ) {

    return buildLockScreen(
      title,
      ds,
      family
    );
  }

  return buildSmall(
    title,
    ds,
    fromCache
  );
}


export default async function(ctx) {


  if (
    ctx.request &&
    ctx.request.url
  ) {

    return handleCapture(ctx);
  }


  // 保活模式：schedule 定时任务（ctx.cron 存在）或 Env CT_KEEPALIVE=true。
  // 定时查一次接口，利用服务端 session 滑动过期机制续命；
  // 若已过期，loadData 内部会按"登录已过期"处理并通知一次。
  if (
    ctx.cron ||
    (ctx.env && ctx.env.CT_KEEPALIVE === 'true')
  ) {

    return handleKeepAlive(ctx);
  }


  return handleWidget(ctx);
}


// 定时保活：轻量 ping 一次。
//
// 注意：不要调完整 loadData——串行多个请求累积时长可能超过
// Egern 定时任务的脚本超时被直接终止。
// 保活只需要一次真实触达；成功/失败都不通知不写缓存，
// 下次小组件刷新会正常处理显示和过期提醒。
async function handleKeepAlive(ctx) {

  const phone =
    (ctx.env.CT_PHONE || '').trim();

  const password =
    (ctx.env.CT_PASSWORD || '').trim();

  if (phone && password) {

    // 密码登录模式：查一次数据接口；token 失效时自动重登一次
    try {

      try {

        await fetchImportantData(
          ctx,
          phone
        );

      } catch (e) {

        if (e && e.tokenExpired) {

          await telecomLogin(
            ctx,
            phone,
            password
          );

          await fetchImportantData(
            ctx,
            phone
          );
        }
      }

    } catch (e) {}

    return;
  }

  const cookie =
    (ctx.env.CT_COOKIE || '').trim() ||
    ctx.storage.get('ct_cookie') ||
    '';

  if (!cookie) return;

  try {

    await ctx.http.get(URLS.detail, {
      headers: {
        Cookie: cookie,
      },

      timeout: 10000,

      credentials: 'omit',
    });

  } catch (e) {}
}
