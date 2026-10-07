/*
 * 中国电信小组件
 *
 * 同一个文件，两种用法：
 *   1. generic 类型 → iOS 小组件
 *   2. request 类型 → 登录捕获
 *
 * 环境变量：
 *   CT_LOGIN_URL
 *   CT_COOKIE
 *   CT_SHOW_USED_FLOW
 *   CT_FILTER_ORIENTATE_FLOW
 *   CT_TITLE
 *
 * 数据来源：
 *   https://e.dlife.cn/user/package_detail.do
 *   https://e.dlife.cn/user/balance.do
 */

const URLS = {
  login: 'https://e.dlife.cn/index.do',
  detail: 'https://e.dlife.cn/user/package_detail.do',
  balance: 'https://e.dlife.cn/user/balance.do',
};


/* =========================================================
 * 数据颜色
 * ========================================================= */

const FLOW_COLOR = '#FF6620';
const VOICE_COLOR = '#78C100';


/* =========================================================
 * Widget UI 颜色
 * ========================================================= */

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


/* =========================================================
 * 工具函数
 * ========================================================= */

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


/* =========================================================
 * 数据层
 * ========================================================= */

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
  const resp = await ctx.http.get(url, {
    headers: {
      Cookie: cookie,
    },

    timeout: 15000,

    credentials: 'omit',
  });

  if (!resp || resp.status !== 200) {
    throw new Error(
      `HTTP ${resp ? resp.status : 'no-response'}: ${url}`
    );
  }

  return await resp.json();
}


/* =========================================================
 * 电信数据解析
 * ========================================================= */

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

      /* -------------------------
       * 流量
       * ------------------------- */

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

      /* -------------------------
       * 语音
       * ------------------------- */

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


  /* -------------------------
   * 流量
   * ------------------------- */

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


  /* -------------------------
   * 语音
   * ------------------------- */

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


  /* -------------------------
   * 话费
   * ------------------------- */

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


/* =========================================================
 * Cookie 获取数据
 * ========================================================= */

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


/* =========================================================
 * 加载数据
 * ========================================================= */

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


  /* -------------------------
   * 1. 优先 Cookie
   * ------------------------- */

  const firstCookie =
    envCookie ||
    storedCookie;

  if (firstCookie) {

    try {

      const ds =
        await tryCookie(
          ctx,
          firstCookie,
          settings
        );

      return {

        configured,

        ds,

        fromCache: false,
      };

    } catch (e) {
      /* Cookie 失效，继续 */
    }
  }


  /* -------------------------
   * 2. 登录地址刷新 Cookie
   * ------------------------- */

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

        const ds =
          await tryCookie(
            ctx,
            fresh,
            settings
          );

        return {

          configured,

          ds,

          fromCache: false,
        };
      }

    } catch (e) {
      /* 继续使用缓存 */
    }
  }


  /* -------------------------
   * 3. 缓存
   * ------------------------- */

  const cached =
    ctx.storage.getJSON(
      'ct_datasource'
    );

  return {

    configured,

    ds:
      cached || null,

    fromCache:
      !!cached,
  };
}


/* =========================================================
 * Widget UI
 * ========================================================= */

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


/* =========================================================
 * 顶部标题
 * ========================================================= */

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
              time,

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


/* =========================================================
 * 中号 / 大号组件
 *
 * 注意：
 * 这部分保持原来的横向布局。
 * ========================================================= */

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


      /* 三个数据胶囊 */

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


      /* 底部短横线 */

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


/* =========================================================
 * 小尺寸专用 UI
 *
 * 只针对 systemSmall。
 *
 * 布局：
 *
 *   上：标题 + 时间
 *   中：话费
 *   下：语音 + 流量
 *   底：短横线
 * ========================================================= */

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
      12,
      10,
      12,
    ],

    gap: 8,

    refreshAfter:
      new Date(
        Date.now() +
        60 * 60 * 1000
      ).toISOString(),

    children: [

      /* =================================================
       * 上
       * 标题 + 更新时间
       * ================================================= */

      headerRow(
        title,
        ds,
        fromCache
      ),


      /* =================================================
       * 中
       * 剩余话费
       * ================================================= */

      {
        type: 'stack',

        direction: 'column',

        alignItems: 'center',

        justifyContent: 'center',

        padding: [
          7,
          8,
          7,
          8,
        ],

        backgroundColor:
          COLORS.capsuleBg,

        borderRadius: 14,

        borderWidth: 1,

        borderColor:
          COLORS.border,

        children: [

          /* 话费标题 */

          {
            type: 'text',

            text:
              ds.fee.title,

            font: {
              size: 'caption2',
              weight: 'medium',
            },

            textColor:
              COLORS.title,

            textAlign:
              'center',

            maxLines: 1,
          },

          /* 话费数值 */

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
                  String(
                    ds.fee.number
                  ),

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
                  0.7,
              },

              {
                type: 'text',

                text:
                  ds.fee.unit,

                font: {
                  size: 'caption2',
                },

                textColor:
                  COLORS.title,

                maxLines: 1,
              },
            ],
          },
        ],
      },


      /* =================================================
       * 下
       * 剩余语音 + 剩余流量
       * ================================================= */

      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        gap: 7,

        children: [

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


      /* =================================================
       * 底部短横线
       * ================================================= */

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

            width: 42,

            height: 3,

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


/* =========================================================
 * 锁屏小组件
 *
 * 保持不变
 * ========================================================= */

function buildLockScreen(
  title,
  ds,
  family
) {

  if (
    family ===
      'accessoryCircular' ||
    family ===
      'accessoryInline'
  ) {

    return {

      type: 'widget',

      children: [

        {
          type: 'text',

          text:
            `¥${ds.fee.number}`,

          font: {
            size: 'body',
            weight: 'semibold',
          },

          textAlign:
            'center',
        },
      ],
    };
  }


  /* accessoryRectangular */

  return {

    type: 'widget',

    padding: 8,

    gap: 4,

    children: [

      {
        type: 'text',

        text:
          title,

        font: {
          size: 'caption2',
          weight: 'semibold',
        },
      },

      {
        type: 'text',

        text:
          `¥${ds.fee.number} · ${ds.flow.number}${ds.flow.unit} · ${ds.voice.number}分`,

        font: {
          size: 'footnote',
        },

        maxLines: 1,

        minScale:
          0.6,
      },
    ],
  };
}


/* =========================================================
 * 错误界面
 * ========================================================= */

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


/* =========================================================
 * 登录捕获
 *
 * 完整保留原逻辑
 * ========================================================= */

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


  /* 非电信请求直接透传 */

  if (
    !url.includes(
      'e.dlife.cn'
    )
  ) {
    return;
  }


  /* -------------------------
   * 登录握手地址
   * ------------------------- */

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


  /* -------------------------
   * 抓取 Cookie
   * ------------------------- */

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


  /* -------------------------
   * 刚登录成功 → 通知
   * ------------------------- */

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


/* =========================================================
 * 小组件
 * ========================================================= */

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
  } =
    await loadData(ctx);


  /* -------------------------
   * 未配置
   * ------------------------- */

  if (!configured) {

    return buildError(
      title,
      '未登录：在 Safari 打开 e.dlife.cn 登录一次',
      URLS.login
    );
  }


  /* -------------------------
   * 数据失败
   * ------------------------- */

  if (!ds) {

    return buildError(
      title,
      '数据获取失败，请检查网络或重新登录'
    );
  }


  const family =
    ctx.widgetFamily ||
    'systemSmall';


  /* =====================================================
   * 中号 / 大号 / 超大号
   *
   * 保持原来的 buildMainWidget
   * ===================================================== */

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


  /* =====================================================
   * 锁屏
   *
   * 保持原来的 buildLockScreen
   * ===================================================== */

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


  /* =====================================================
   * Small
   *
   * ★ 这次唯一改变的尺寸
   * ===================================================== */

  return buildSmall(
    title,
    ds,
    fromCache
  );
}


/* =========================================================
 * 入口：单文件双模式
 * ========================================================= */

export default async function(ctx) {

  /*
   * request 脚本：
   * 自动捕获电信登录 Cookie
   */

  if (
    ctx.request &&
    ctx.request.url
  ) {

    return handleCapture(ctx);
  }


  /*
   * generic 脚本：
   * 渲染小组件
   */

  return handleWidget(ctx);
}