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
  let flowScope = '流量';
  if (!hasCommon) {
    used = tUsed; balanceFlow = tBalance; totalFlow = tTotal;
  } else if (showGeneralFlow && showDirectionalFlow) {
    used = tUsed; balanceFlow = tBalance; totalFlow = tTotal;
  } else if (showGeneralFlow && !showDirectionalFlow) {
    used = gUsed; balanceFlow = gBalance; totalFlow = gTotal;
    flowScope = '通用流量';
  } else if (!showGeneralFlow && showDirectionalFlow) {
    used = Math.max(0, tUsed - gUsed); balanceFlow = Math.max(0, tBalance - gBalance); totalFlow = Math.max(0, tTotal - gTotal);
    flowScope = '定向流量';
  } else {
    used = tUsed; balanceFlow = tBalance; totalFlow = tTotal;
  }
  const balanceFmt = formatFlow(balanceFlow);
  const usedFmt = formatFlow(used);
  const flow = {
    title: '剩余' + flowScope,
    number: balanceFmt.amount,
    unit: balanceFmt.unit,
    percent: +(totalFlow > 0 ? ((balanceFlow / totalFlow) * 100).toFixed(2) : '0'),
    color: FLOW_COLOR,
  };
  if (showUsedFlow) {
    flow.title = '已用' + flowScope;
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
