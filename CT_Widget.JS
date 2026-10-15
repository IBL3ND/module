/*
 * 中国电信小组件（Egern 版，单文件三模式）
 * 移植自 xccverse/egern-widgets 的 china-telecom.js（cookie 获取逻辑全量照搬）
 *
 * 同一个文件，三种用法：
 *   1. generic 类型 → iOS 小组件：显示剩余话费 / 剩余（或已用）流量 / 剩余语音
 *   2. request 类型 → 登录捕获：Safari 里登录 e.dlife.cn 成功时自动捕获 cookie，
 *      存入存储，小组件下次运行自动读取登录，全程无需手动复制粘贴。
 *   3. schedule 类型 → 定时保活：每 20 分钟拉一次接口续 session
 *
 * 环境变量：
 *   CT_LOGIN_URL          电信登录地址（抓包得到的登录 URL，用于自动更新 cookie）
 *   CT_COOKIE             直接填写 cookie（与 CT_LOGIN_URL 二选一，URL 优先）
 *   CT_SHOW_USED_FLOW     'true' 显示已用流量，否则显示剩余流量
 *   CT_SHOW_USED_VOICE    'true' 显示已用语音，否则显示剩余语音
 *   CT_SHOW_DIRECT        定向流量开关（本版已合并为通用/定向开关，见下）
 *   CT_SHOW_GENERAL_FLOW  'false' 不统计通用流量，默认显示
 *   CT_SHOW_DIRECTIONAL_FLOW 'false' 不统计定向流量，默认显示
 *   CT_TITLE              小组件标题，默认 "中国电信"
 *   CT_KEEPALIVE          定时保活开关：填 'false' 关闭，不填或填其他值均为开启
 *   CT_EXPIRE_WARN_DAYS   cookie 超过此天数未刷新时提前通知，默认 5 天；填 0 关闭
 *   CT_DEBUG              填 '1' 在小组件底部显示保活诊断信息
 *
 * 数据来源：https://e.dlife.cn/user/package_detail.do
 *           https://e.dlife.cn/user/balance.do
 * 登录方式：Safari 打开 e.dlife.cn 登录一次，脚本自动捕获 cookie（需在模块里配置 http_request + MITM）
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

  // 多存一份原始接口数据：缓存兜底时按当前 Env 设置重新解析，避免旧缓存里的标题/数值跟新设置对不上
  try {
    ctx.storage.setJSON('ct_raw', { detail, balance, at: ds.updatedAt || Date.now() });
  } catch (_) {}

  return ds;
}

async function loadData(ctx) {

  const settings = {

    showUsedFlow:
      ctx.env.CT_SHOW_USED_FLOW ===
      'true',

    showUsedVoice:
      ctx.env.CT_SHOW_USED_VOICE ===
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

  // 1) 优先用已捕获的 cookie（从登录后的真实请求里抓的，最可靠）
  const firstCookie =
    envCookie ||
    storedCookie;

  let cookieDead = false;

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

        cookieDead: false,
      };

    } catch (e) {

      if (!(e && e.transient)) {
        cookieDead = true;
      }
    }
  }

  // 2) 回放登录地址刷新 cookie（备用方式）
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

            cookieDead: false,
          };

        } catch (e2) {

          if (!(e2 && e2.transient)) {
            cookieDead = true;
          }
        }
      }

    } catch (e) {
    }
  }

  // 3) 断网/过期时用缓存顶一下：有原始数据就按当前设置重新解析一次
  const raw = ctx.storage.getJSON('ct_raw');
  if (raw && raw.detail) {
    try {
      const ds = parseTelecom(raw.detail, raw.balance, settings);
      ds.updatedAt = raw.at || ds.updatedAt;
      return { configured, ds, fromCache: true, authFailed: cookieDead, cookieDead };
    } catch (_) {
      /* 解析失败就掉到旧缓存 */
    }
  }

  const cached =
    ctx.storage.getJSON(
      'ct_datasource'
    );

  if (cookieDead) {
    // cookie 被服务器拒绝且刷新无果：登录已过期，通知一次（同个 cookie 只通知一次）
    notifyExpiredOnce(ctx, firstCookie);
  }

  return {

    configured,

    ds:
      cached || null,

    fromCache:
      !!cached,

    authFailed: cookieDead,

    cookieDead,
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
  // 记录 cookie 获取时间，用于过期预警
  ctx.storage.set('ct_cookie_ts', String(Date.now()));
  // 新 cookie 到手，清除之前的过期预警标记
  ctx.storage.delete('ct_expire_warned');

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
  const safeCtx = ctx || {};
  const env = safeCtx.env || {};
  const title = (env.CT_TITLE || '中国电信').trim() || '中国电信';

  let result;
  try {
    result = await loadData(safeCtx);
  } catch (e) {
    return buildError(title, '数据获取失败', 'https://e.dlife.cn');
  }

  const { configured, ds, fromCache, authFailed, cookieDead } = result;

  if (!configured) {
    return buildError(title, '未登录：在 Safari 打开 e.dlife.cn 登录一次', URLS.login);
  }

  if (authFailed || !ds) {
    return buildError(title, '登录已过期', 'https://e.dlife.cn');
  }

  const family = safeCtx.widgetFamily || '';
  let w;
  if (family.startsWith('accessory')) {
    w = buildLockScreen(title, ds, family);
  } else {
    w = buildMainWidget(title, ds, fromCache);
  }
  // cookie 失效时点小组件直接跳去登录页
  if (cookieDead) w.url = URLS.login;
  // CT_DEBUG=1：在底部显示保活诊断（上次保活时间/成败）
  try {
    if (String(safeCtx.env?.CT_DEBUG || '') === '1' && w && Array.isArray(w.children)) {
      const ka = safeCtx.storage.getJSON('ct_ka_last');
      let dbg = '保活: 无记录';
      if (ka && ka.ts) {
        const agoMin = Math.max(0, Math.round((Date.now() - ka.ts) / 60000));
        dbg = ka.ok ? `保活: ${agoMin}分钟前成功` : `保活: ${agoMin}分钟前失败(${(ka.err || '').slice(0, 30)})`;
      }
      w.children.push({ type: 'text', text: dbg, font: { size: 'caption2' }, opacity: 0.5, maxLines: 1 });
    }
  } catch (_) {}
  return w;
}

// 过期预警：cookie 快到期时提前通知，避免突然变红点
function checkExpireWarn(ctx) {
  try {
    if (ctx.storage.get('ct_expire_warned')) return; // 每个 cookie 只预警一次
    const ts = Number(ctx.storage.get('ct_cookie_ts') || 0);
    if (!ts) return;
    const warnDays = parseFloat(ctx.env?.CT_EXPIRE_WARN_DAYS) || 5;
    if (warnDays <= 0) return;
    const ageDays = (Date.now() - ts) / 86400000;
    if (ageDays >= warnDays) {
      ctx.storage.set('ct_expire_warned', '1');
      ctx.notify({
        title: '中国电信',
        body: `登录已 ${Math.floor(ageDays)} 天未刷新，可能快过期了，点我去重新登录`,
        action: { type: 'url', url: URLS.login },
      });
    }
  } catch (_) {}
}

/* ---------- 入口：单文件三模式 ---------- */

export default async function (ctx) {
  const safeCtx = ctx || {};
  // request 脚本条目 → 捕获登录；generic 脚本条目 → 渲染小组件
  //（ctx.request 仅在 request/response 脚本中可用）
  if (safeCtx.request && safeCtx.request.url) {
    return handleCapture(safeCtx);
  }
  // schedule 定时保活 → 只拉接口续 session，不渲染小组件
  if (!safeCtx.widgetFamily) {
    const keep = String(safeCtx.env?.CT_KEEPALIVE || '').toLowerCase();
    if (keep === 'false' || keep === '0') return { type: 'text', text: 'keepalive disabled' };
    // 保活行车记录仪：记录每次运行的时间、成败、错误，下次掉线时有据可查
    const ka = { ts: Date.now() };
    const markKaFail = (err) => {
      ka.ok = false;
      ka.err = String(err || '').slice(0, 120);
      const fails = Number(safeCtx.storage.get('ct_ka_fail') || 0) + 1;
      safeCtx.storage.set('ct_ka_fail', String(fails));
      ka.fails = fails;
      // 连续失败 3 次就通知，别等半夜悄悄死
      if (fails === 3) {
        try {
          safeCtx.notify({ title: '中国电信', body: `保活连续失败 3 次（${ka.err}），登录可能已失效` });
        } catch (_) {}
      }
    };
    try {
      const r = await loadData(safeCtx);
      if (r && r.fromCache) {
        // 保活的目的是验证 session 还活着；只能读到缓存说明没打通真接口，
        // 必须记失败——否则 cookie 死了也显示"保活成功"，行车记录仪就撒谎了
        markKaFail(r.cookieDead ? '登录已失效，仅读到缓存' : '网络异常，仅读到缓存');
      } else {
        ka.ok = true;
        safeCtx.storage.set('ct_ka_fail', '0');
      }
    } catch (e) {
      markKaFail((e && e.message) || e);
    }
    try { safeCtx.storage.setJSON('ct_ka_last', ka); } catch (_) {}
    checkExpireWarn(safeCtx);
    return { type: 'text', text: 'keepalive done' };
  }
  checkExpireWarn(safeCtx);
  return handleWidget(safeCtx);
}
