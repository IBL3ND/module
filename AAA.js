/*
 * 中国电信小组件
 * 用这个链接去登录 https://e.dlife.cn
 * 同一个文件，两种用法：
 *   1. generic 类型 → iOS 小组件
 *   2. request 类型 → 登录捕获
 *
 * 环境变量：
 *   【App 自动登录（推荐）】
 *   CT_APP_ACCOUNT   手机号#服务密码#AndroidID（单个变量，三合一）
 *     或分别配置：
 *   CT_PHONE         手机号
 *   CT_PASSWORD      服务密码
 *   CT_ANDROID_ID    AndroidID（16 位十六进制）
 *   有 App 账号时走电信营业厅 App 网关直连，无需 cookie，token 失效自动重登
 *
 *   【网页 Cookie（备用）】
 *   CT_LOGIN_URL     无 App 账号时使用，Safari 登录后捕获
 *   CT_COOKIE        无 App 账号时使用
 *
 *   【显示开关】
 *   CT_SHOW_USED_FLOW
 *   CT_FILTER_ORIENTATE_FLOW
 *   CT_SHOW_GENERAL_FLOW / CT_SHOW_DIRECTIONAL_FLOW
 *   CT_TITLE
 *
 * 数据来源：
 *   App 通道：https://appfuwu.189.cn:9021/query/qryImportantData
 *   Cookie 通道：https://e.dlife.cn/user/package_detail.do
 *              https://e.dlife.cn/user/balance.do
 *
 * 登录过期处理：
 *   App 通道：token 失效时自动跑登录链重登；登录链失败（如密码错误）通知一次
 *   Cookie 通道：服务器拒绝 cookie（非 200 / 返回登录页 HTML / 异常载荷）时视为登录过期，
 *   小组件显示"登录已过期"错误页（点小组件可直接跳登录页）并通知一次，
 *   不再静默展示旧数据；仅当"连不上服务器"（断网/超时）时才用缓存顶一下，
 *   此时标题栏会显示"缓存 HH:mm"以示区别。
 *
 * 保活模式（三种用法，同一个文件）：
 *   1. generic 类型 → iOS 小组件
 *   2. http_request 类型 → 登录捕获
 *   3. schedule 类型 → 定时保活：在 Egern 里建 schedule 脚本条目指向本文件，
 *      cron 设为每 20 分钟执行一次，
 *      App 通道：验证 token 有效性，失效则静默重登；
 *      Cookie 通道：查一次接口，利用服务端 session 滑动过期机制续命；
 *      注意：若 e.dlife.cn 是固定时长过期，保活无效，只能手动重登（过期会有通知提示）。
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
    light: '#FFFFFF15',
    dark: '#FFFFFF10',
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
    // 合并而非覆盖：回放可能只返回部分 cookie，直接覆盖会丢掉原有的
    const merged = mergeCookies(ctx.storage.get('ct_cookie'), pairs.join('; '));
    if (merged) ctx.storage.set('ct_cookie', merged);
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

  // 滑动续期：成功响应带的 Set-Cookie 合并进存储
  cookie = harvestSetCookie(ctx, resp, cookie);

  try {
    return await resp.json();
  } catch (e) {
    // 200 但不是 JSON（通常是被踢到登录页，拿回 HTML）：cookie 已失效
    throw new Error(`not-json: ${url}`);
  }
}



/* ============================================================
 * App 登录链（电信营业厅 App 网关直连）
 * 移植自 Scripting 版，纯 JS 实现无依赖
 * 配置：CT_APP_ACCOUNT=手机号#服务密码#AndroidID
 *       或分别配置 CT_PHONE / CT_PASSWORD / CT_ANDROID_ID
 * 有 App 账号时优先走 App 接口，无需 cookie；token 失效自动重登
 * ============================================================ */

// 纯 TS 实现的 AES-128-ECB（Pkcs7），用于 189.cn 积分接口的请求体加密。
// 无外部依赖，可在 Scripting（JavaScriptCore）中运行。

const AES_SBOX = [
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
]

const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]

function xtime(a) {
  return ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff
}

function expandKey(key) {
  const ek = new Uint8Array(176)
  ek.set(key)
  for (let i = 16; i < 176; i += 4) {
    let t0 = ek[i - 4], t1 = ek[i - 3], t2 = ek[i - 2], t3 = ek[i - 1]
    if (i % 16 === 0) {
      const u = AES_SBOX[t1]
      t1 = AES_SBOX[t2]
      t2 = AES_SBOX[t3]
      t3 = AES_SBOX[t0]
      t0 = u ^ RCON[i / 16 - 1]
    }
    ek[i] = ek[i - 16] ^ t0
    ek[i + 1] = ek[i - 15] ^ t1
    ek[i + 2] = ek[i - 14] ^ t2
    ek[i + 3] = ek[i - 13] ^ t3
  }
  return ek
}

function encryptBlock(block, ek) {
  // state 为 4x4 列优先
  const s = new Uint8Array(16)
  for (let i = 0; i < 16; i++) s[i] = block[i] ^ ek[i]
  for (let round = 1; round <= 10; round++) {
    // SubBytes
    for (let i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]]
    // ShiftRows
    let t
    t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t
    t = s[2]; s[2] = s[10]; s[10] = t
    t = s[6]; s[6] = s[14]; s[14] = t
    t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t
    // MixColumns（最后一轮跳过）
    if (round < 10) {
      for (let c = 0; c < 4; c++) {
        const i = c * 4
        const a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3]
        const b0 = xtime(a0), b1 = xtime(a1), b2 = xtime(a2), b3 = xtime(a3)
        s[i] = b0 ^ a1 ^ b1 ^ a2 ^ a3
        s[i + 1] = a0 ^ b1 ^ a2 ^ b2 ^ a3
        s[i + 2] = a0 ^ a1 ^ b2 ^ a3 ^ b3
        s[i + 3] = a0 ^ b0 ^ a1 ^ a2 ^ b3
      }
    }
    // AddRoundKey
    const off = round * 16
    for (let i = 0; i < 16; i++) s[i] ^= ek[off + i]
  }
  return s
}

function utf8Bytes(str) {
  const out = []
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1)
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00)
        i++
      }
    }
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
  }
  return Uint8Array.from(out)
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

function base64Encode(bytes) {
  let out = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)]
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "="
    out += i + 2 < bytes.length ? B64[b2 & 63] : "="
  }
  return out
}

/** AES-128-ECB + Pkcs7，返回 base64（对标 CryptoJS.AES.encrypt(...).toString()） */
function aes128EcbPkcs7Base64(plaintext, keyStr) {
  const key = utf8Bytes(keyStr)
  if (key.length !== 16) throw new Error("AES-128 需要 16 字节 key")
  const ek = expandKey(key)
  const pt = utf8Bytes(plaintext)
  const padLen = 16 - (pt.length % 16)
  const data = new Uint8Array(pt.length + padLen)
  data.set(pt)
  data.fill(padLen, pt.length)
  const out = new Uint8Array(data.length)
  for (let off = 0; off < data.length; off += 16) {
    out.set(encryptBlock(data.subarray(off, off + 16), ek), off)
  }
  return base64Encode(out)
}


// 纯 TS 实现 DES / TripleDES-CBC，无依赖，Scripting 可用

const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7,
]
const FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25,
]
const E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9,
  8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
  16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1,
]
const P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
  2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25,
]
const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4,
]
const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
]
const ROT = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1]
const DES_SBOX = [
  [
    14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7,
    0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
    4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0,
    15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13,
  ],
  [
    15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10,
    3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5,
    0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15,
    13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9,
  ],
  [
    10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8,
    13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
    13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7,
    1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12,
  ],
  [
    7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15,
    13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
    10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4,
    3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14,
  ],
  [
    2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9,
    14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
    4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14,
    11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3,
  ],
  [
    12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11,
    10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
    9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6,
    4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13,
  ],
  [
    4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1,
    13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
    1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2,
    6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12,
  ],
  [
    13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7,
    1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
    7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8,
    2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11,
  ],
]



function bytesToBits(b) {
  const out = []
  for (const byte of b) for (let i = 7; i >= 0; i--) out.push((byte >> i) & 1)
  return out
}
function bitsToBytes(bits) {
  const out = new Uint8Array(bits.length / 8)
  for (let i = 0; i < out.length; i++) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i * 8 + j]
    out[i] = v
  }
  return out
}
function perm(bits, table) {
  return table.map((p) => bits[p - 1])
}
function xor(a, b) {
  return a.map((v, i) => v ^ b[i])
}
function rotL(bits, n) {
  return bits.slice(n).concat(bits.slice(0, n))
}

function keySchedule(key8) {
  const k56 = perm(bytesToBits(key8), PC1)
  let c = k56.slice(0, 28)
  let d = k56.slice(28)
  const subs = []
  for (let i = 0; i < 16; i++) {
    c = rotL(c, ROT[i])
    d = rotL(d, ROT[i])
    subs.push(perm(c.concat(d), PC2))
  }
  return subs
}

function feistel(r32, sub) {
  const e48 = perm(r32, E)
  const x = xor(e48, sub)
  const s32 = []
  for (let s = 0; s < 8; s++) {
    const chunk = x.slice(s * 6, s * 6 + 6)
    const row = (chunk[0] << 1) | chunk[5]
    const col = (chunk[1] << 3) | (chunk[2] << 2) | (chunk[3] << 1) | chunk[4]
    const v = DES_SBOX[s][row * 16 + col]
    for (let i = 3; i >= 0; i--) s32.push((v >> i) & 1)
  }
  return perm(s32, P)
}

function desBlock(block8, subs, decrypt) {
  const ip = perm(bytesToBits(block8), IP)
  let l = ip.slice(0, 32)
  let r = ip.slice(32)
  for (let i = 0; i < 16; i++) {
    const sub = decrypt ? subs[15 - i] : subs[i]
    const nl = r
    const nr = xor(l, feistel(r, sub))
    l = nl
    r = nr
  }
  return bitsToBytes(perm(r.concat(l), FP))
}

/** TripleDES-CBC。key24: 24 字节；iv8: 8 字节；encrypt: true=加密/false=解密。PKCS7 填充。 */
function tripleDesCbc(data, key24, iv8, encrypt) {
  const k1 = keySchedule(key24.slice(0, 8))
  const k2 = keySchedule(key24.slice(8, 16))
  const k3 = keySchedule(key24.slice(16, 24))
  const single = (blk, ks, dec) => desBlock(blk, ks, dec)
  const ede = (blk, dec) =>
    dec
      ? single(single(single(blk, k3, true), k2, false), k1, true)
      : single(single(single(blk, k1, false), k2, true), k3, false)

  let input
  if (encrypt) {
    const pad = 8 - (data.length % 8)
    input = new Uint8Array(data.length + pad)
    input.set(data)
    input.fill(pad, data.length)
  } else {
    input = data
  }
  const out = new Uint8Array(input.length)
  let prev = iv8
  for (let off = 0; off < input.length; off += 8) {
    const blk = input.slice(off, off + 8)
    if (encrypt) {
      const x = new Uint8Array(8)
      for (let i = 0; i < 8; i++) x[i] = blk[i] ^ prev[i]
      const c = ede(x, false)
      out.set(c, off)
      prev = c
    } else {
      const p = ede(blk, true)
      for (let i = 0; i < 8; i++) out[off + i] = p[i] ^ prev[i]
      prev = blk
    }
  }
  if (!encrypt) {
    const pad = out[out.length - 1]
    if (pad < 1 || pad > 8) throw new Error("3DES 解密填充错误")
    return out.slice(0, out.length - pad)
  }
  return out
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}
function bytesToHex(b) {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")
}


// 纯 TS RSA 公钥加密（PKCS#1 v1.5），无依赖，Scripting 可用
// 用 BigInt 做模幂运算

const RSA_N_HEX =
  "c190b4f5e53855833ebf34e97ab3c18d3e87dd5b359b0a45a791a026eced8b8e43351fb74cbf3922a9dc54d368da9864472d7fd934c0971e73dc5bfb0386214204dd7ca85bf2f20e9561bf50b6ba08d3d7b5efab3e642b62bfb85b8a7d9c0938fdf625299c4968666d7d9701f2a3af6ee543223cca6ad3f5ca04ef2562137f83"
const RSA_E = 65537n
const RSA_N = BigInt("0x" + RSA_N_HEX)
const KEY_BYTES = 128

function modPow(base, exp, mod) {
  let result = 1n
  let b = base % mod
  let e = exp
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod
    b = (b * b) % mod
    e >>= 1n
  }
  return result
}

function bigintToBytes(v, len) {
  const out = new Uint8Array(len)
  let x = v
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(x & 0xffn)
    x >>= 8n
  }
  return out
}

/** PKCS#1 v1.5 加密，返回 base64。msg 为 UTF-8 字符串。 */
function rsaEncryptPkcs1(msg) {
  const enc = new TextEncoder()
  const m = enc.encode(msg)
  if (m.length > KEY_BYTES - 11) throw new Error("RSA 明文过长")
  // 0x00 || 0x02 || PS(非零随机) || 0x00 || M
  const psLen = KEY_BYTES - 3 - m.length
  const block = new Uint8Array(KEY_BYTES)
  block[0] = 0x00
  block[1] = 0x02
  const rnd = new Uint8Array(psLen)
  // 简单 PRNG（Math.random），加密用途可接受
  for (let i = 0; i < psLen; i++) {
    let b = 0
    while (b === 0) b = Math.floor(Math.random() * 256)
    rnd[i] = b
  }
  block.set(rnd, 2)
  block[2 + psLen] = 0x00
  block.set(m, 3 + psLen)
  let v = 0n
  for (const b of block) v = (v << 8n) | BigInt(b)
  const c = modPow(v, RSA_E, RSA_N)
  const cBytes = bigintToBytes(c, KEY_BYTES)
  return base64Encode(cBytes)
}


/* 电信营业厅 App 登录链（Egern 版）
 * 移植自 Scripting 版 api/loginchain.ts
 * ① 服务密码登录 → ② 换 ticket → ③ wapact 统一登录拿 Bearer
 * 依赖：rsaEncryptPkcs1, tripleDesCbc, hexToBytes, bytesToHex, aes128EcbPkcs7Base64
 *（由 rsa.js / des3.js / aes.js 提供）
 */

const APP_UA =
  'Mozilla/5.0 (Linux; U; Android 12; zh-cn) AppleWebKit/533.1 (KHTML, like Gecko) Version/5.0 Mobile Safari/533.1';
const DES3_KEY_STR = '1234567`90koiuyhgtfrdews';
const AES_LOGIN_KEY = 'telecom_wap_2018';
const REQ_TIMEOUT = 15000;
const MAX_RETRY = 2;

function appCaesar2(s) {
  return Array.from(s).map((c) => String.fromCharCode(c.charCodeAt(0) + 2)).join('');
}

function appTs14(d) {
  d = d || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/* 把 Set-Cookie 收集进 jar（Egern 的 headers.getAll 风格） */
function appCollectCookies(resp, jar) {
  let rawCookies = [];
  try {
    if (resp.headers && resp.headers.getAll) {
      rawCookies = resp.headers.getAll('set-cookie') || [];
    }
  } catch (e) {}
  // 兼容单个 set-cookie 头
  if (rawCookies.length === 0) {
    try {
      const single = resp.headers && resp.headers.get && resp.headers.get('set-cookie');
      if (single) rawCookies = [single];
    } catch (e) {}
  }
  for (const c of rawCookies) {
    for (const part of String(c).split(/,(?=[^;,=\s]+=)/)) {
      const m = part.match(/^\s*([^=;]+)=([^;]*)/);
      if (m) jar[m[1].trim()] = m[2];
    }
  }
}

async function appReqOnce(ctx, url, opts, jar) {
  opts = opts || {};
  jar = jar || {};
  const headers = Object.assign({ 'User-Agent': APP_UA }, opts.headers || {});
  const ck = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  if (ck) headers['Cookie'] = ck;

  const method = (opts.method || 'GET').toUpperCase();
  const reqOpts = {
    headers: headers,
    timeout: REQ_TIMEOUT,
    credentials: 'omit',
  };
  if (opts.body !== undefined) reqOpts.body = opts.body;
  // Egern 支持 redirect 选项时透传
  if (opts.redirect) reqOpts.redirect = opts.redirect;

  let resp;
  if (method === 'POST') {
    resp = await ctx.http.post(url, reqOpts);
  } else {
    resp = await ctx.http.get(url, reqOpts);
  }

  appCollectCookies(resp, jar);

  let text = '';
  try { text = await resp.text(); } catch (e) {}
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: resp.status, text: text, json: json };
}

async function appReq(ctx, url, opts, jar) {
  let lastErr = null;
  for (let i = 0; i <= MAX_RETRY; i++) {
    try {
      return await appReqOnce(ctx, url, opts, jar);
    } catch (e) {
      lastErr = e;
      if (i < MAX_RETRY) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

function explainCode(rc) {
  if (rc === '3001') return '（手机号或密码有误；若确认无误，可能是账号被临时锁定，请等 1-2 小时再试）';
  if (rc === '3006') return '（服务端风控拒绝；可能是设备指纹异常或账号被锁定，请等 1-2 小时再试）';
  return '';
}

/* 跑完整登录链（AndroidID 版）。返回每步结果与会话。 */
async function runLoginChain(ctx, phoneInput, passwdInput, androidIdInput) {
  const steps = [];
  const jar = {};
  const fail = (msg) => {
    steps.push({ ok: false, msg: msg });
    return { steps: steps };
  };

  const phone = String(phoneInput || '').trim();
  const passwd = String(passwdInput || '').trim();
  const androidId = String(androidIdInput || '').trim().toLowerCase();
  if (!/^1\d{10}$/.test(phone)) return fail('① 手机号格式不对，应为 11 位数字');
  if (!passwd) return fail('① 服务密码不能为空');
  if (!/^[0-9a-f]{16}$/.test(androidId))
    return fail('① AndroidID 格式不对，应为 16 位十六进制字符');

  // ---------- ① 服务密码登录 ----------
  const t = appTs14();
  const plain = `Xiaomi 20 8.0.0.${androidId.slice(0, 12)}${phone}${t}${passwd}0$$$0.`;
  let cipherB64;
  try {
    cipherB64 = rsaEncryptPkcs1(plain);
  } catch (e) {
    return fail(`① RSA 加密失败: ${e && e.message}`);
  }
  const body1 = {
    headerInfos: {
      code: 'userLoginNormal',
      timestamp: t,
      broadAccount: '',
      broadToken: '',
      clientType: '#11.0.0#channel8#Xiaomi 20#',
      shopId: '20002',
      source: '110003',
      sourcePassword: 'Sid98s',
      token: '',
      userLoginName: appCaesar2(phone),
    },
    content: {
      attach: 'test',
      fieldData: {
        loginType: '4',
        accountType: '',
        loginAuthCipherAsymmertric: cipherB64,
        deviceUid: '',
        phoneNum: appCaesar2(phone),
        isChinatelecom: '',
        systemVersion: '8.0.0',
        androidId: appCaesar2(androidId),
        loginAuthCipher: '',
        authentication: appCaesar2(passwd),
      },
    },
  };
  let r1;
  try {
    r1 = await appReq(
      ctx,
      'https://appgologin.189.cn:9031/login/client/userLoginNormal',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body1) },
      jar
    );
  } catch (e) {
    return fail(`① 登录请求网络异常（已重试）: ${e && e.message}`);
  }
  const respData = (r1.json && r1.json.responseData) || {};
  const rc1 = String(respData.resultCode || '');
  if (rc1 !== '0000') {
    const failDetail = respData.data && respData.data.loginFailResult;
    const failJson = failDetail ? JSON.stringify(failDetail) : '';
    const msg = (r1.json && r1.json.msg) || respData.resultDetail || respData.resultDesc || '';
    return fail(`① 登录失败 resultCode=${rc1} ${msg}${explainCode(rc1)} | 详情: ${failJson.slice(0, 500)}`);
  }
  const loginData = respData.data.loginSuccessResult;
  const userId = loginData.userId;
  const token = loginData.token;
  steps.push({ ok: true, msg: `① 登录成功 userId=${userId}` });

  // ---------- ② 换 ticket ----------
  const enc = new TextEncoder();
  const des3key = enc.encode(DES3_KEY_STR);
  const iv8 = new Uint8Array(8);
  let targetIdHex;
  try {
    targetIdHex = bytesToHex(tripleDesCbc(enc.encode(String(userId)), des3key, iv8, true));
  } catch (e) {
    return fail(`② 3DES 加密失败: ${e && e.message}`);
  }
  const xml =
`<Request>
    <HeaderInfos>
        <Code>getSingle</Code>
        <Timestamp>${t}</Timestamp>
        <BroadAccount></BroadAccount>
        <BroadToken></BroadToken>
        <ClientType>#9.6.1#channel50#iPhone 14 Pro Max#</ClientType>
        <ShopId>20002</ShopId>
        <Source>110003</Source>
        <SourcePassword>Sid98s</SourcePassword>
        <Token>${token}</Token>
        <UserLoginName>${phone}</UserLoginName>
    </HeaderInfos>
    <Content>
        <Attach>test</Attach>
        <FieldData>
            <TargetId>${targetIdHex}</TargetId>
            <Url>4a6862274835b451</Url>
        </FieldData>
    </Content>
</Request>`;
  let r2;
  try {
    r2 = await appReq(
      ctx,
      'https://appgologin.189.cn:9031/map/clientXML',
      { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: xml },
      jar
    );
  } catch (e) {
    return fail(`② 换 ticket 请求网络异常（已重试）: ${e && e.message}`);
  }
  if (typeof r2.text !== 'string' || !r2.text.includes('<Ticket>')) {
    const hint = /过期|校验错误/.test(r2.text || '') ? '（票据校验异常，可能是 token 已失效）' : '';
    return fail(`② 未取到 Ticket${hint} | 原始前200字: ${(r2.text || '').slice(0, 200)}`);
  }
  let ticketHex;
  let uid;
  try {
    ticketHex = r2.text.split('<Ticket>')[1].split('</Ticket>')[0];
    const dec = tripleDesCbc(hexToBytes(ticketHex), des3key, iv8, false);
    uid = new TextDecoder().decode(dec);
  } catch (e) {
    return fail(`② Ticket 解密失败: ${e && e.message}`);
  }
  if (!uid) return fail('② Ticket 解密结果为空');
  steps.push({ ok: true, msg: '② 拿到 ticket' });

  // ---------- ③ wapact 统一登录拿 Bearer ----------
  const authPlain = JSON.stringify({
    ticket: uid,
    backUrl: 'https%3A%2F%2Fwapact.189.cn%3A9001',
    platformCode: 'P201010301',
    loginType: 2,
  });
  let authBody;
  try {
    authBody = aes128EcbPkcs7Base64(authPlain, AES_LOGIN_KEY);
  } catch (e) {
    return fail(`③ AES 加密失败: ${e && e.message}`);
  }
  let r3;
  try {
    r3 = await appReq(
      ctx,
      'https://wapact.189.cn:9001/unified/user/login',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: authBody },
      jar
    );
  } catch (e) {
    return fail(`③ 统一登录请求网络异常（已重试）: ${e && e.message}`);
  }
  const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  if (r3.json && r3.json.code === 0 && r3.json.biz && r3.json.biz.token) {
    const bearer = `Bearer ${r3.json.biz.token}`;
    steps.push({ ok: true, msg: '③ 统一登录成功，拿到 Bearer' });
    return { steps: steps, userId: String(userId), token: String(token), ticket: ticketHex, uid: uid, bearer: bearer, cookie: cookie };
  }
  steps.push({ ok: false, msg: `③ 统一登录未拿到 Bearer (code=${r3.json && r3.json.code})，但前两步已通` });
  return { steps: steps, userId: String(userId), token: String(token), ticket: ticketHex, uid: uid, cookie: cookie };
}


/* App 接口查话费/流量/语音（Egern 版）
 * 移植自 Scripting 版 api/appdata.ts
 * POST https://appfuwu.189.cn:9021/query/qryImportantData
 * 用 App 登录拿到的 token 直接查，无需 e.dlife.cn cookie
 */

const APPFUWU_UA = 'P216010901';
const APP_CLIENT_TYPE = '#11.0.0#channel8#Xiaomi 20#';

function appDataCaesar2(s) {
  return Array.from(s).map((c) => String.fromCharCode(c.charCodeAt(0) + 2)).join('');
}

function appDataTsMin(d) {
  d = d || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}00`;
}

/* 用 App token 查主要数据。成功返回解析后的数据，失败抛错。 */
async function fetchImportantData(ctx, token, phone) {
  const t = appDataTsMin();
  const encPhone = appDataCaesar2(phone);
  const body = {
    content: {
      fieldData: {
        provinceCode: '600101',
        cityCode: '8441900',
        shopId: '20002',
        isChinatelecom: '0',
        account: encPhone,
      },
      attach: 'test',
    },
    headerInfos: {
      code: 'userFluxPackage',
      clientType: APP_CLIENT_TYPE,
      timestamp: t,
      shopId: '20002',
      source: '110003',
      sourcePassword: 'Sid98s',
      userLoginName: encPhone,
      token: token,
    },
  };

  let resp;
  try {
    resp = await ctx.http.post('https://appfuwu.189.cn:9021/query/qryImportantData', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=UTF-8',
        'user-agent': APPFUWU_UA,
      },
      body: JSON.stringify(body),
      timeout: 15000,
      credentials: 'omit',
    });
  } catch (e) {
    const err = new Error(`network: qryImportantData`);
    err.transient = true;
    throw err;
  }

  let text = '';
  try { text = await resp.text(); } catch (e) {}
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}

  const rd = json && json.responseData;
  if (!rd || rd.resultCode !== '0000') {
    const err = new Error(`resultCode=${rd && rd.resultCode} | 原始: ${text.slice(0, 300)}`);
    // token 失效类错误标记为 authFailed，便于上层触发重登
    err.authFailed = true;
    throw err;
  }

  const d = rd.data;
  const num = (v) => {
    const n = parseInt(String(v == null ? '0' : v), 10);
    return isNaN(n) ? 0 : n;
  };
  const total = (d && d.flowInfo && d.flowInfo.totalAmount) || {};
  const common = (d && d.flowInfo && d.flowInfo.commonFlow) || {};
  const special = (d && d.flowInfo && d.flowInfo.specialAmount) || {};
  const voice = (d && d.voiceInfo && d.voiceInfo.voiceDataInfo) || {};
  const balStr = (d && d.balanceInfo && d.balanceInfo.indexBalanceDataInfo && d.balanceInfo.indexBalanceDataInfo.balance) || '0';

  return {
    balanceFen: Math.round(parseFloat(String(balStr)) * 100) || 0,
    voiceUsed: num(voice.used),
    voiceBalance: num(voice.balance),
    voiceTotal: num(voice.total),
    flowUsedKB: num(total.used),
    flowBalanceKB: num(total.balance),
    flowOverKB: num(total.over),
    commonUsedKB: num(common.used),
    commonBalanceKB: num(common.balance),
    commonOverKB: num(common.over),
    specialUsedKB: num(special.used),
    specialBalanceKB: num(special.balance),
  };
}


/* ---------- App 账号配置解析 ---------- */

function getAppAccount(ctx) {
  // 优先单个变量 CT_APP_ACCOUNT=手机号#服务密码#AndroidID
  const combined = (ctx.env.CT_APP_ACCOUNT || '').trim();
  if (combined) {
    const parts = combined.split('#');
    if (parts.length >= 2) {
      return {
        phone: (parts[0] || '').trim(),
        passwd: parts[1] || '',
        androidId: (parts[2] || '').trim(),
      };
    }
  }
  // 备选：三个独立变量
  const phone = (ctx.env.CT_PHONE || '').trim();
  const passwd = (ctx.env.CT_PASSWORD || '').trim();
  const androidId = (ctx.env.CT_ANDROID_ID || '').trim();
  if (phone && passwd) {
    return { phone: phone, passwd: passwd, androidId: androidId };
  }
  // 兼容 Storage 里存的（之前配置过）
  const sPhone = ctx.storage.get('ct_app_phone') || '';
  const sPass = ctx.storage.get('ct_app_pass') || '';
  const sAndroid = ctx.storage.get('ct_app_android_id') || '';
  if (sPhone && sPass) {
    return { phone: sPhone, passwd: sPass, androidId: sAndroid };
  }
  return null;
}

function saveAppAccountStorage(ctx, phone, passwd, androidId) {
  ctx.storage.set('ct_app_phone', String(phone || '').trim());
  ctx.storage.set('ct_app_pass', String(passwd || ''));
  ctx.storage.set('ct_app_android_id', String(androidId || '').trim());
}

/* ---------- App Token 管理 ---------- */

function getAppToken(ctx) {
  return ctx.storage.get('ct_app_token') || '';
}

function saveAppToken(ctx, token) {
  ctx.storage.set('ct_app_token', token || '');
  ctx.storage.set('ct_app_token_at', Date.now());
}

function clearAppToken(ctx) {
  ctx.storage.delete('ct_app_token');
  ctx.storage.delete('ct_app_token_at');
}

/* ---------- App 数据格式转换 ---------- */
/* 把 qryImportantData 的返回转成现有 render 函数能用的 ds 格式 */

function parseAppData(imp, opts) {
  const showUsedFlow = opts.showUsedFlow;
  const showGeneralFlow = opts.showGeneralFlow;
  const showDirectionalFlow = opts.showDirectionalFlow;

  // 流量：按通用/定向开关累加（KB）
  let balanceKB = 0;
  let usedKB = 0;
  if (showGeneralFlow) {
    balanceKB += imp.commonBalanceKB || 0;
    usedKB += imp.commonUsedKB || 0;
  }
  if (showDirectionalFlow) {
    balanceKB += imp.specialBalanceKB || 0;
    usedKB += imp.specialUsedKB || 0;
  }
  // 两个开关都关时用总量，避免显示 0
  if (!showGeneralFlow && !showDirectionalFlow) {
    balanceKB = imp.flowBalanceKB || 0;
    usedKB = imp.flowUsedKB || 0;
  }
  const totalKB = balanceKB + usedKB;

  const balanceFlow = formatFlow(balanceKB / 1024);  // KB → MB
  const usedFlow = formatFlow(usedKB / 1024);

  const flow = {
    title: '剩余流量',
    number: balanceFlow.amount,
    unit: balanceFlow.unit,
    percent: +(((balanceKB / (totalKB || 1)) * 100).toFixed(2)),
    color: FLOW_COLOR,
  };
  if (showUsedFlow) {
    flow.title = '已用流量';
    flow.number = usedFlow.amount;
    flow.unit = usedFlow.unit;
  }

  const voiceBalance = imp.voiceBalance || 0;
  const voiceTotal = imp.voiceTotal || 1;
  const voice = {
    title: '剩余语音',
    number: `${voiceBalance}`,
    unit: '分钟',
    percent: +(((voiceBalance / voiceTotal) * 100).toFixed(2)),
    color: VOICE_COLOR,
  };

  const fee = {
    title: '剩余话费',
    number: ((imp.balanceFen || 0) / 100).toFixed(2),
    unit: '元',
  };

  return {
    fee: fee,
    flow: flow,
    voice: voice,
    updatedAt: Date.now(),
  };
}

/* ---------- App 数据获取（含自动重登） ---------- */

async function tryAppToken(ctx, token, phone, settings) {
  const imp = await fetchImportantData(ctx, token, phone);
  const ds = parseAppData(imp, settings);
  ctx.storage.setJSON('ct_datasource', ds);
  // 标记数据源为 App，供保活用
  ctx.storage.set('ct_datasource_type', 'app');
  return ds;
}

async function runAppLogin(ctx, account) {
  const r = await runLoginChain(ctx, account.phone, account.passwd, account.androidId);
  const allOk = r.steps.length === 3 && r.steps.every((s) => s.ok);
  if (!allOk || !r.token) {
    const detail = r.steps.map((s) => `${s.ok ? 'OK' : 'FAIL'} ${s.msg}`).join(' | ');
    const err = new Error(`app-login-failed: ${detail}`);
    err.appLoginFailed = true;
    throw err;
  }
  // 保存账号（供下次重登）和 token
  saveAppAccountStorage(ctx, account.phone, account.passwd, account.androidId);
  saveAppToken(ctx, r.token);
  return r.token;
}

/* App 登录失败通知：同一账号只通知一次，成功后清除 */
function notifyAppExpiredOnce(ctx, account, detail) {
  const key = 'ct_app_expired_notified_v2';
  const marker = account ? account.phone : 'none';
  if (ctx.storage.get(key) === marker) return;
  ctx.storage.set(key, marker);
  try {
    ctx.notify({
      title: '中国电信',
      body: 'App 登录失败: ' + (detail || '请检查 CT_APP_ACCOUNT 是否正确'),
    });
  } catch (e) {}
}

function clearAppExpiredFlag(ctx) {
  ctx.storage.delete('ct_app_expired_notified');
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

  /* ---------- App 通道（优先）：有 App 账号配置时走 App 网关 ---------- */
  const appAccount = getAppAccount(ctx);
  if (appAccount) {
    const cachedToken = getAppToken(ctx);

    // 1) 先试缓存的 token
    if (cachedToken) {
      try {
        const ds = await tryAppToken(ctx, cachedToken, appAccount.phone, settings);
        clearAppExpiredFlag(ctx);
        return {
          configured: true,
          ds: ds,
          fromCache: false,
          authFailed: false,
        };
      } catch (e) {
        if (e && e.transient) {
          // 断网：用缓存顶一下
          const cached = ctx.storage.getJSON('ct_datasource');
          return {
            configured: true,
            ds: cached || null,
            fromCache: !!cached,
            authFailed: false,
          };
        }
        // token 失效：继续走自动重登
      }
    }

    // 2) 跑登录链拿新 token
    try {
      const newToken = await runAppLogin(ctx, appAccount);
      const ds = await tryAppToken(ctx, newToken, appAccount.phone, settings);
      clearAppExpiredFlag(ctx);
      return {
        configured: true,
        ds: ds,
        fromCache: false,
        authFailed: false,
      };
    } catch (e) {
      if (e && e.transient) {
        const cached = ctx.storage.getJSON('ct_datasource');
        return {
          configured: true,
          ds: cached || null,
          fromCache: !!cached,
          authFailed: false,
        };
      }
      // 登录链失败（如密码错误）：通知一次，用缓存顶
      notifyAppExpiredOnce(ctx, appAccount, e && e.message);
      const cached = ctx.storage.getJSON('ct_datasource');
      return {
        configured: true,
        ds: cached || null,
        fromCache: !!cached,
        authFailed: !cached,  // 无缓存时视为登录过期，显示错误页
      };
    }
  }

  /* ---------- Cookie 通道（备用）：无 App 账号时走老路 ---------- */
  const envCookie =
    (ctx.env.CT_COOKIE || '').trim();

  const loginUrl =
    (ctx.env.CT_LOGIN_URL || '').trim() ||
    ctx.storage.get('ct_login_url') ||
    '';

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
      light: color + '40',
      dark: color + '33',
    },

    borderRadius: 14,

    children: [

      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        width: 30,

        height: 30,

        borderRadius: 15,

        backgroundColor: { light: color, dark: color + '60' },

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


async function handleWidget(ctx) {
  const safeCtx = ctx || {};
  const env = safeCtx.env || {};
  const title = (env.CT_TITLE || '中国电信').trim() || '中国电信';

  let result;
  try {
    result = await loadData(safeCtx);
  } catch (e) {
    return buildError(title, '数据获取失败', 'https://e.dlife.cn');
  }

  const { configured, ds, fromCache, authFailed } = result;

  if (!configured) {
    return buildError(title, '未配置登录', 'https://e.dlife.cn');
  }

  if (authFailed || !ds) {
    return buildError(title, '登录已过期', 'https://e.dlife.cn');
  }

  const family = safeCtx.widgetFamily || '';
  if (family.startsWith('accessory')) {
    return buildLockScreen(title, ds, family);
  }

  return buildMainWidget(title, ds, fromCache);
}


export default async function(ctx) {


  return handleWidget(ctx);
}
