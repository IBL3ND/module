/*
 * 中国电信小组件
 * 用这个链接去登录 https://e.dlife.cn
 * 同一个文件，两种用法：
 *   1. generic 类型 → iOS 小组件
 *   2. request 类型 → 登录捕获
 *
 * 环境变量： 不需要手动填 添加模块后登录即可
 *   CT_LOGIN_URL
 *   CT_COOKIE
 *   CT_SHOW_USED_FLOW
 *   CT_FILTER_ORIENTATE_FLOW
 *   CT_TITLE
 *
 * 数据来源：
 *   https://e.dlife.cn/user/package_detail.do
 *   https://e.dlife.cn/user/balance.do
 *
 * 登录过期处理：
 *   服务器拒绝 cookie（非 200 / 返回登录页 HTML / 异常载荷）时视为登录过期，
 *   小组件显示"登录已过期"错误页（点小组件可直接跳登录页）并通知一次，
 *   不再静默展示旧数据；仅当"连不上服务器"（断网/超时）时才用缓存顶一下，
 *   此时标题栏会显示"缓存 HH:mm"以示区别。
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


function parseTelecom(detail, balance, opts) {
  const {
    showUsedFlow,
    filterOrientateFlow,
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

        if (
          !(
            item.usageAmount == 0 &&
            item.balanceAmount == 0
          )
        ) {

          const isDirectional =
            /定向/.test(
              item.ratableResourcename || ''
            );

          const skip =
            item.balanceAmount == '999999999999' ||
            (
              filterOrientateFlow &&
              isDirectional
            );

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

        totalUsedFlowAmount +=
          parseFloat(
            item.usageAmount
          ) || 0;

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

    filterOrientateFlow:
      ctx.env.CT_FILTER_ORIENTATE_FLOW ===
      'true',
  };

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


  // cookie 被服务器拒绝：不再展示旧数据，直接提示重新登录
  if (authFailed) {

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


  return handleWidget(ctx);
}
