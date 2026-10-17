/*
 * 中国电信小组件（Egern 版，App RSA 登录）
 * 移植自 Scriptable「中国电信」3.0.0-rsa（2Ya&脑瓜，RSA 登录 + 电信官方 API）
 * 登录方式：App 官方接口 userLoginNormal（RSA 加密）+ qryImportantData 查数
 * 账号存在模块设置里，token 失效时自动重登。
 * 30 分钟缓存：30 分钟内直接用缓存，不调接口，减少登录次数。
 *
 * 环境变量（在模块 compat_arguments / generic env 里填）：
 *   CT_PHONE              手机号（必填）
 *   CT_PASSWORD           服务密码 6 位数字（必填，与 CT_SERVICE_PASSWORD 二选一）
 *   CT_SERVICE_PASSWORD   服务密码（CT_PASSWORD 的别名，填一个即可）
 *   CT_DEVICE_ID          设备 ID（可选）：在作者网页短信登录授权后复制
 *                         不填则用随机设备 ID，可能需要多试几次才登上
 *   CT_SHOW_USED_FLOW     'true' 显示已用流量，否则显示剩余流量
 *   CT_SHOW_USED_VOICE    'true' 显示已用语音，否则显示剩余语音
 *   CT_SHOW_GENERAL_FLOW  'false' 不统计通用流量，默认显示
 *   CT_SHOW_DIRECTIONAL_FLOW 'false' 不统计定向流量，默认显示
 *   CT_TITLE              小组件标题，默认 "中国电信"
 *
 * 数据来源：https://appgologin.189.cn:9031/login/client/userLoginNormal
 *           https://appfuwu.189.cn:9021/query/qryImportantData
 * 注意：密码只存在你自己的 Egern 模块设置里，不发给任何第三方。
 */

const URLS = {
  login: 'https://appgologin.189.cn:9031/login/client/userLoginNormal',
  query: 'https://appfuwu.189.cn:9021/query/qryImportantData',
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
    return { amount: remain.toFixed(2), unit: 'MB' };
  }
  return { amount: (remain / 1024).toFixed(2), unit: 'GB' };
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function _safeN(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function transNumber(str, encode = true) {
  return [...String(str || '')].map((c) => String.fromCharCode((c.charCodeAt(0) + (encode ? 2 : -2)) & 0xffff)).join('');
}

function getBeijingTimestamp() {
  const bjDate = new Date(Date.now() + 8 * 3600 * 1000);
  const yyyy = String(bjDate.getFullYear());
  const MM = String(bjDate.getMonth() + 1).padStart(2, '0');
  const dd = String(bjDate.getDate()).padStart(2, '0');
  const HH = String(bjDate.getHours()).padStart(2, '0');
  const mm = String(bjDate.getMinutes()).padStart(2, '0');
  const ss = String(bjDate.getSeconds()).padStart(2, '0');
  return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
}

const RSA_MOD_HEX = 'c190b4f5e53855833ebf34e97ab3c18d3e87dd5b359b0a45a791a026eced8b8e43351fb74cbf3922a9dc54d368da9864472d7fd934c0971e73dc5bfb0386214204dd7ca85bf2f20e9561bf50b6ba08d3d7b5efab3e642b62bfb85b8a7d9c0938fdf625299c4968666d7d9701f2a3af6ee543223cca6ad3f5ca04ef2562137f83';

function _modPow(base, exp, mod) {
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

function _base64Encode(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return out;
}

function rsaEncrypt(text) {
  const data = [...String(text)].map((c) => c.charCodeAt(0) & 0xff);
  const k = 128;
  if (data.length > k - 11) throw new Error('RSA 明文过长');
  const psLen = k - data.length - 3;
  const ps = [];
  while (ps.length < psLen) {
    const r = Math.floor(Math.random() * 255) + 1;
    if (r !== 0) ps.push(r);
  }
  const em = [0x00, 0x02, ...ps, 0x00, ...data];
  let hex = '';
  for (const b of em) hex += b.toString(16).padStart(2, '0');
  const m = BigInt('0x' + RSA_MOD_HEX);
  const c = _modPow(BigInt('0x' + hex), 65537n, m);
  let cHex = c.toString(16).padStart(256, '0');
  const out = [];
  for (let i = 0; i < cHex.length; i += 2) out.push(parseInt(cHex.slice(i, i + 2), 16));
  return _base64Encode(out);
}

async function _postJson(ctx, url, bodyObj) {
  let resp;
  try {
    resp = await ctx.http.post(url, {
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(bodyObj),
      timeout: 15000,
    });
  } catch (e) {
    const err = new Error(`network: ${url}`);
    err.transient = true;
    throw err;
  }
  if (!resp || resp.status !== 200) {
    const err = new Error(`HTTP ${resp ? resp.status : 'no-response'}: ${url}`);
    err.transient = true;
    throw err;
  }
  try {
    return await resp.json();
  } catch (e) {
    const err = new Error(`not-json: ${url}`);
    err.transient = true;
    throw err;
  }
}

function _getAccount(ctx) {
  const env = ctx.env || {};
  const phone = String(env.CT_PHONE || '').trim();
  const password = String(env.CT_PASSWORD || env.CT_SERVICE_PASSWORD || '').trim();
  const deviceId = String(env.CT_DEVICE_ID || '').trim();
  return { phone, password, deviceId };
}

async function telecomLogin(ctx, account) {
  const { phone, password, deviceId } = account;
  const uuid = String(Math.floor(Math.random() * 9e15 + 1e15));
  const ts = getBeijingTimestamp();
  const encryptText = `iPhone 14 15.4.0${deviceId || uuid.slice(0, 12)}${phone}${ts}${password}0$$$0.`;
  const encrypted = rsaEncrypt(encryptText);
  const loginBody = {
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
  const loginData = await _postJson(ctx, URLS.login, loginBody);
  const rd = loginData && loginData.responseData;
  if (!rd || rd.resultCode !== '0000') {
    const err = new Error(`登录失败 ${rd ? rd.resultCode : 'no-response'}：${(rd && rd.resultDesc) || '未知错误'}`);
    err.resultCode = rd ? rd.resultCode : '';
    err.resultDesc = rd ? rd.resultDesc : '';
    throw err;
  }
  const { token, cityCode, provinceCode } = rd.data.loginSuccessResult || {};
  if (!token) throw new Error('登录成功但未返回 token');
  try {
    ctx.storage.set('ct_app_token', token);
    ctx.storage.set('ct_app_city', String(cityCode || ''));
    ctx.storage.set('ct_app_province', String(provinceCode || ''));
    ctx.storage.set('ct_app_token_ts', String(Date.now()));
  } catch (_) {}
  return { token, cityCode, provinceCode };
}

async function fetchImportantData(ctx, account, token, cityCode, provinceCode) {
  const ts = getBeijingTimestamp();
  const dataBody = {
    content: {
      fieldData: {
        provinceCode,
        cityCode,
        shopId: '20002',
        isChinatelecom: '0',
        account: transNumber(account.phone),
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
      userLoginName: transNumber(account.phone),
      token,
    },
  };
  const dataResp = await _postJson(ctx, URLS.query, dataBody);
  if (!dataResp || !dataResp.responseData) {
    const err = new Error(`查数失败：${(dataResp && dataResp.headerInfos && dataResp.headerInfos.reason) || 'Token 失效'}`);
    err.authFailed = true;
    throw err;
  }
  return dataResp.responseData.data;
}

function parseImportantData(apiData, opts) {
  const { showUsedFlow, showGeneralFlow, showDirectionalFlow } = opts;
  const balance = _safeN(apiData && apiData.balanceInfo && apiData.balanceInfo.indexBalanceDataInfo && apiData.balanceInfo.indexBalanceDataInfo.balance);
  const feeBalance = balance !== 0 ? balance : _safeN(apiData && apiData.balance);
  const fee = { title: '剩余话费', number: feeBalance.toFixed(2), unit: '元' };

  const common = (apiData && apiData.flowInfo && apiData.flowInfo.commonFlow) || {};
  const total = (apiData && apiData.flowInfo && apiData.flowInfo.totalAmount) || {};
  const gUsed = _safeN(common.used), gBalance = _safeN(common.balance), gTotal = _safeN(common.total);
  const tUsed = _safeN(total.used !== undefined ? total.used : apiData.usedFlux), tBalance = _safeN(total.balance), tTotal = _safeN(total.total !== undefined ? total.total : (tUsed + tBalance));
  const hasCommon = common.used !== undefined || common.balance !== undefined || common.total !== undefined;
  let used, balanceFlow, totalFlow;
  if (!hasCommon) {
    used = tUsed; balanceFlow = tBalance; totalFlow = tTotal;
  } else if (showGeneralFlow && showDirectionalFlow) {
    used = tUsed; balanceFlow = tBalance; totalFlow = tTotal;
  } else if (showGeneralFlow && !showDirectionalFlow) {
    used = gUsed; balanceFlow = gBalance; totalFlow = gTotal;
  } else if (!showGeneralFlow && showDirectionalFlow) {
    used = Math.max(0, tUsed - gUsed); balanceFlow = Math.max(0, tBalance - gBalance); totalFlow = Math.max(0, tTotal - gTotal);
  } else {
    used = tUsed; balanceFlow = tBalance; totalFlow = tTotal;
  }
  const balanceFmt = formatFlow(balanceFlow);
  const usedFmt = formatFlow(used);
  const flow = {
    title: '剩余流量',
    number: balanceFmt.amount,
    unit: balanceFmt.unit,
    percent: +(totalFlow > 0 ? ((balanceFlow / totalFlow) * 100).toFixed(2) : '0'),
    color: FLOW_COLOR,
  };
  if (showUsedFlow) {
    flow.title = '已用流量';
    flow.number = usedFmt.amount;
    flow.unit = usedFmt.unit;
  }

  const voiceInfo = (apiData && apiData.voiceInfo && apiData.voiceInfo.voiceDataInfo) || {};
  const vTotal = _safeN(voiceInfo.total !== undefined ? voiceInfo.total : apiData.totalVoice);
  const vUsed = _safeN(voiceInfo.used !== undefined ? voiceInfo.used : apiData.usedVoice);
  const vBalance = _safeN(voiceInfo.balance !== undefined ? voiceInfo.balance : (vTotal - vUsed));
  const showUsedVoice = opts.showUsedVoice;
  const voice = {
    title: showUsedVoice ? '已用语音' : '剩余语音',
    number: `${showUsedVoice ? vUsed : vBalance}`,
    unit: '分钟',
    percent: +(vTotal > 0 ? (((showUsedVoice ? vUsed : vBalance) / vTotal) * 100).toFixed(2) : '0'),
    color: VOICE_COLOR,
  };

  return { fee, flow, voice, updatedAt: Date.now() };
}

function _notifyAuthFailedOnce(ctx, account, err) {
  try {
    const marker = `${account.phone.slice(-4)}:${err && err.resultCode ? err.resultCode : (err && err.message) || ''}`;
    if (ctx.storage.get('ct_auth_notified') === marker) return;
    ctx.storage.set('ct_auth_notified', marker);
    ctx.notify({ title: '中国电信', body: `登录失败：${(err && err.message) || '请检查手机号/服务密码/设备ID'}` });
  } catch (_) {}
}

function _clearAuthFlag(ctx) {
  try { ctx.storage.delete('ct_auth_notified'); } catch (_) {}
}

async function loadData(ctx) {
  const settings = {
    showUsedFlow: ctx.env.CT_SHOW_USED_FLOW === 'true',
    showUsedVoice: ctx.env.CT_SHOW_USED_VOICE === 'true',
    showGeneralFlow: ctx.env.CT_SHOW_GENERAL_FLOW !== 'false',
    showDirectionalFlow: ctx.env.CT_SHOW_DIRECTIONAL_FLOW !== 'false',
  };
  const account = _getAccount(ctx);
  const configured = !!(account.phone && account.password);
  if (!configured) {
    return { configured: false, ds: null, fromCache: false, authFailed: false, authError: '' };
  }

  try {
    const rawCache = ctx.storage.getJSON('ct_raw');
    const dsCache = ctx.storage.getJSON('ct_datasource');
    const at = (rawCache && rawCache.at) || (dsCache && dsCache.updatedAt) || 0;
    if (at && Date.now() - at < 30 * 60 * 1000) {
      if (rawCache && rawCache.apiData) {
        const ds = parseImportantData(rawCache.apiData, settings);
        ds.updatedAt = at;
        return { configured, ds, fromCache: false, authFailed: false, authError: '' };
      }
      if (dsCache) {
        return { configured, ds: dsCache, fromCache: false, authFailed: false, authError: '' };
      }
    }
  } catch (_) {}

  let token = '';
  let cityCode = '';
  let provinceCode = '';
  try {
    token = ctx.storage.get('ct_app_token') || '';
    cityCode = ctx.storage.get('ct_app_city') || '';
    provinceCode = ctx.storage.get('ct_app_province') || '';
  } catch (_) {}

  const _tryFetch = async (tok, city, prov) => {
    const apiData = await fetchImportantData(ctx, account, tok, city, prov);
    const ds = parseImportantData(apiData, settings);
    try {
      ctx.storage.setJSON('ct_datasource', ds);
      ctx.storage.setJSON('ct_raw', { apiData, at: ds.updatedAt || Date.now() });
    } catch (_) {}
    _clearAuthFlag(ctx);
    return ds;
  };

  if (token) {
    try {
      const ds = await _tryFetch(token, cityCode, provinceCode);
      return { configured, ds, fromCache: false, authFailed: false, authError: '' };
    } catch (e) {
      if (e && e.transient) {
        return _fromCache(ctx, configured, settings, false, '');
      }
    }
  }

  try {
    const login = await telecomLogin(ctx, account);
    const ds = await _tryFetch(login.token, login.cityCode, login.provinceCode);
    return { configured, ds, fromCache: false, authFailed: false, authError: '' };
  } catch (e) {
    if (e && e.transient) {
      return _fromCache(ctx, configured, settings, false, '');
    }

    _notifyAuthFailedOnce(ctx, account, e);
    return { configured, ds: null, fromCache: false, authFailed: true, authError: (e && e.message) || '登录失败' };
  }
}

function _fromCache(ctx, configured, settings, authFailed, authError) {
  try {
    const raw = ctx.storage.getJSON('ct_raw');
    if (raw && raw.apiData) {
      const ds = parseImportantData(raw.apiData, settings);
      ds.updatedAt = raw.at || ds.updatedAt;
      return { configured, ds, fromCache: true, authFailed, authError };
    }
  } catch (_) {}
  try {
    const cached = ctx.storage.getJSON('ct_datasource');
    if (cached) return { configured, ds: cached, fromCache: true, authFailed, authError };
  } catch (_) {}
  return { configured, ds: null, fromCache: false, authFailed, authError };
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

  const SUB = {
    light: '#FFFFFFB3',
    dark: '#FFFFFFB3',
  };

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
              '请在模块设置里检查账号',

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
    return buildError(title, '数据获取失败', '');
  }

  const { configured, ds, fromCache, authFailed, authError } = result;

  if (!configured) {
    return buildError(title, '未配置：请在模块设置里填手机号和服务密码', '');
  }

  if (authFailed || !ds) {
    return buildError(title, authError || '登录失败，请检查手机号/服务密码/设备ID', '');
  }

  const family = safeCtx.widgetFamily || '';
  let w;
  if (family === 'systemSmall') {
    w = buildSmall(title, ds, fromCache);
  } else if (family.startsWith('accessory')) {
    w = buildLockScreen(title, ds, family);
  } else {
    w = buildMainWidget(title, ds, fromCache);
  }
  return w;
}

export default async function (ctx) {
  const safeCtx = ctx || {};
  if (safeCtx.request && safeCtx.request.url) {
    return { type: 'text', text: 'app login mode, no capture' };
  }
  return handleWidget(safeCtx);
}
