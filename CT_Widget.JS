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


const CARRIER_LOGO = 'data:image/png;base64,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';

function withCarrierLogo(row) {
  row.children[0].backgroundColor = '#FFFFFF';
  row.children[0].children = [
    { type: 'image', src: CARRIER_LOGO, width: 21, height: 21 },
  ];
  return row;
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

      withCarrierLogo(smallRow(
        '#E8651F',
        null,
        '¥',
        ds.fee.number,
        ds.fee.unit,
        ds.fee.title
      )),

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
