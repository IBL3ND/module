/**
 * 中国联通话费流量小组件
 *
 * 自动获取方式：
 * 1. 打开中国联通 App
 * 2. 进入首页
 * 3. 点击当前余额 / 话费位置，让 App 查询一次
 * 4. Egern 会自动捕获联通 App 请求中的 Cookie 和手机号
 * 5. 小组件自动使用捕获的数据，无需手动填写环境变量
 *
 * 自动捕获域名：
 * m.client.10010.com
 *
 * 数据接口：
 * https://m.client.10010.com/mobileserviceimportant/home/queryUserInfoSeven
 */


/* =========================================================
 * 基础配置
 * ========================================================= */

const API_HOST = 'm.client.10010.com';

const API_URL =
  'https://m.client.10010.com/mobileserviceimportant/home/queryUserInfoSeven';


/* =========================================================
 * 颜色
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
    light: '#E60012',
    dark: '#FF375F',
  },
};


/* =========================================================
 * Cookie / 手机号捕获
 * ========================================================= */

function getRequestHeader(headers, name) {
  if (!headers) return '';

  try {
    if (typeof headers.get === 'function') {
      return headers.get(name) || '';
    }
  } catch (e) {}

  try {
    for (const key of Object.keys(headers)) {
      if (String(key).toLowerCase() === name.toLowerCase()) {
        return headers[key] || '';
      }
    }
  } catch (e) {}

  return '';
}


function extractPhone(url) {
  try {
    const m = String(url || '').match(/desmobile=(\d{11})/);
    return m ? m[1] : '';
  } catch (e) {
    return '';
  }
}


async function handleCapture(ctx) {
  const req = ctx.request || {};
  const url = String(req.url || '');

  if (!url.includes(API_HOST)) return;

  const cookie = String(getRequestHeader(req.headers, 'Cookie') || '').trim();
  if (!cookie) return;

  const oldCookie = ctx.storage.get('unicom_cookie') || '';
  if (cookie === oldCookie) return;

  ctx.storage.set('unicom_cookie', cookie);

  const phone = extractPhone(url);
  if (phone) {
    ctx.storage.set('unicom_phone', phone);
  }

  ctx.notify({
    title: '中国联通',
    body: '已自动获取登录信息，小组件将自动更新',
  });
}


/* =========================================================
 * 数据请求
 * ========================================================= */

async function fetchUnicomData(ctx, cookie, phone) {
  const headers = {
    Cookie: cookie,
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 unicom{version:iphone_c@11.0500}',
  };

  const url =
    API_URL +
    '?version=iphone&desmobile=' +
    (phone || '') +
    '&showType=3';

  const resp = await ctx.http.get(url, { headers });
  return resp;
}


function parseUnicomData(res) {
  let json = res.body;
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  if (!json || json.code !== '0000' || !json.data) {
    return null;
  }

  const d = json.data;

  const fee = {
    title: '剩余话费',
    value: '--',
    unit: '元',
  };

  const voice = {
    title: '剩余语音',
    value: '--',
    unit: '分',
  };

  const flow = {
    title: '剩余流量',
    value: '--',
    unit: 'GB',
  };

  if (d.feeResource && d.feeResource.remain != null) {
    fee.value = parseFloat(d.feeResource.remain).toFixed(2);
  }

  if (d.voiceResource && d.voiceResource.remain != null) {
    voice.value = Math.floor(parseFloat(d.voiceResource.remain));
  }

  if (d.flowResource && d.flowResource.remain != null) {
    const mb = parseFloat(d.flowResource.remain);
    flow.value = (mb / 1024).toFixed(2);
  }

  return {
    fee,
    voice,
    flow,
    updateTime: new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  };
}


async function loadData(ctx) {
  const cookie =
    (ctx.env.Cookie || '').trim() ||
    (ctx.storage.get('unicom_cookie') || '').trim();

  const phone =
    (ctx.env.Phone || '').trim() ||
    (ctx.storage.get('unicom_phone') || '').trim();

  if (!cookie) {
    return {
      configured: false,
      data: null,
    };
  }

  try {
    const res = await fetchUnicomData(ctx, cookie, phone);
    const data = parseUnicomData(res);

    if (data) {
      ctx.storage.set('unicom_cache', JSON.stringify(data));
      return {
        configured: true,
        data,
      };
    }
  } catch (e) {}

  // 尝试读缓存
  try {
    const cache = ctx.storage.get('unicom_cache');
    if (cache) {
      return {
        configured: true,
        data: JSON.parse(cache),
      };
    }
  } catch (e) {}

  return {
    configured: true,
    data: null,
  };
}


/* =========================================================
 * 顶部标题行
 * ========================================================= */

function headerRow(
  title,
  data,
  fromCache
) {

  const updateTime =
    data?.updateTime ||
    '--:--';


  return {
    type: 'stack',

    direction: 'row',

    alignItems: 'center',

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
              'sf-symbol:simcard.fill',

            color:
              COLORS.accent,

            width: 17,

            height: 17,
          },

          {
            type: 'text',

            text: title,

            font: {
              size: 'headline',
              weight: 'semibold',
            },

            textColor:
              COLORS.value,

            maxLines: 1,

            minScale: 0.8,
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

            text: updateTime,

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
 * 通用数据胶囊
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

      {
        type: 'text',

        text: title,

        font: {
          size: 'caption2',
          weight: 'medium',
        },

        textColor:
          COLORS.title,

        textAlign: 'center',

        maxLines: 1,

        minScale: 0.7,
      },


      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        justifyContent: 'center',

        gap: 3,

        children: [

          {
            type: 'text',

            text: String(value),

            font: {
              size: 'title2',
              weight: 'semibold',
            },

            textColor:
              COLORS.value,

            textAlign: 'center',

            maxLines: 1,

            minScale: 0.55,
          },


          {
            type: 'text',

            text: unit,

            font: {
              size: 'caption2',
            },

            textColor:
              COLORS.title,

            maxLines: 1,

            minScale: 0.7,
          },

        ],
      },

    ],
  };
}


/* =========================================================
 * 中号 / 大号 / 超大号
 * ========================================================= */

function buildMainWidget(
  title,
  data,
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

    gap: 10,

    refreshAfter:
      new Date(
        Date.now() +
        60 * 60 * 1000
      ).toISOString(),

    children: [

      /*
       * 顶部
       */
      headerRow(
        title,
        data,
        fromCache
      ),


      /*
       * 三列胶囊
       */
      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        gap: 9,

        children: [

          makeCapsule(
            data.fee.title,
            data.fee.value,
            data.fee.unit
          ),

          makeCapsule(
            data.voice.title,
            data.voice.value,
            data.voice.unit
          ),

          makeCapsule(
            data.flow.title,
            data.flow.value,
            data.flow.unit
          ),

        ],
      },


      /*
       * 底部短横线
       */
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
 * 小尺寸（仅此处优化）
 * ========================================================= */

function buildSmall(
  title,
  data,
  fromCache
) {

  /* 小尺寸专用紧凑胶囊 */
  function makeSmallCapsule(title, value, unit) {
    return {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      padding: [5, 12, 5, 12],
      backgroundColor: COLORS.capsuleBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
      children: [
        {
          type: 'text',
          text: `${title} ${value}${unit ? ' ' + unit : ''}`,
          font: { size: 'subheadline', weight: 'medium' },
          textColor: COLORS.value,
          textAlign: 'center',
          maxLines: 1,
          minScale: 0.7,
        },
      ],
    };
  }

  function wrapCenter(child) {
    return {
      type: 'stack',
      direction: 'row',
      children: [
        { type: 'spacer' },
        child,
        { type: 'spacer' },
      ],
    };
  }

  return {

    type: 'widget',

    backgroundColor:
      COLORS.bg,

    padding: [
      8,
      10,
      8,
      10,
    ],

    gap: 5,

    refreshAfter:
      new Date(
        Date.now() +
        60 * 60 * 1000
      ).toISOString(),

    children: [

      /*
       * 顶部：标题 + 更新时间
       */
      headerRow(
        title,
        data,
        fromCache
      ),


      /*
       * 三行紧凑胶囊垂直堆叠（适配小尺寸高度）
       */
      {
        type: 'stack',
        direction: 'column',
        alignItems: 'center',
        gap: 5,
        children: [
          wrapCenter(
            makeSmallCapsule(
              data.fee.title,
              data.fee.value,
              data.fee.unit
            )
          ),
          wrapCenter(
            makeSmallCapsule(
              data.voice.title,
              data.voice.value,
              data.voice.unit
            )
          ),
          wrapCenter(
            makeSmallCapsule(
              data.flow.title,
              data.flow.value,
              data.flow.unit
            )
          ),
        ],
      },


      /*
       * 底部短横线
       */
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

            width: 36,

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
 * ========================================================= */

function buildLockScreen(
  title,
  data,
  family
) {

  if (
    family === 'accessoryInline'
  ) {

    return {
      type: 'widget',

      children: [

        {
          type: 'text',

          text:
            `${title} ${data.fee.value}${data.fee.unit} · ` +
            `${data.flow.value}${data.flow.unit}`,

          font: {
            size: 'caption1',
            weight: 'medium',
          },

          textColor:
            COLORS.value,

          maxLines: 1,

          minScale: 0.5,
        },

      ],
    };
  }


  if (
    family === 'accessoryCircular'
  ) {

    return {
      type: 'widget',

      padding: 4,

      children: [

        {
          type: 'text',

          text:
            `${data.flow.value}`,

          font: {
            size: 'title2',
            weight: 'bold',
          },

          textColor:
            COLORS.value,

          textAlign:
            'center',

          maxLines: 1,

          minScale: 0.5,
        },

        {
          type: 'text',

          text:
            data.flow.unit,

          font: {
            size: 'caption2',
          },

          textColor:
            COLORS.title,

          textAlign:
            'center',

          maxLines: 1,
        },

      ],
    };
  }


  return {
    type: 'widget',

    padding: 4,

    children: [

      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        children: [

          {
            type: 'image',

            src:
              'sf-symbol:simcard.fill',

            color:
              COLORS.accent,

            width: 15,

            height: 15,
          },

          {
            type: 'text',

            text:
              `${data.fee.value}${data.fee.unit}`,

            font: {
              size: 'headline',
              weight: 'semibold',
            },

            textColor:
              COLORS.value,

            maxLines: 1,

            minScale: 0.5,
          },

        ],
      },


      {
        type: 'text',

        text:
          `${data.flow.value}${data.flow.unit}`,

        font: {
          size: 'caption1',
          weight: 'medium',
        },

        textColor:
          COLORS.title,

        maxLines: 1,

        minScale: 0.7,
      },

    ],
  };
}


/* =========================================================
 * 错误小组件
 * ========================================================= */

function buildError(
  title,
  message
) {

  return {
    type: 'widget',

    backgroundColor:
      COLORS.bg,

    padding: [
      12,
      14,
      12,
      14,
    ],

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

            width: 16,

            height: 16,
          },

          {
            type: 'text',

            text: title,

            font: {
              size: 'headline',
              weight: 'semibold',
            },

            textColor:
              COLORS.value,
          },

        ],
      },


      {
        type: 'text',

        text:
          message ||
          '数据获取失败',

        font: {
          size: 'footnote',
        },

        textColor:
          COLORS.title,

        maxLines: 4,
      },

    ],
  };
}


/* =========================================================
 * 主逻辑
 * ========================================================= */

async function handleWidget(ctx) {

  const title =
    '中国联通';


  const result =
    await loadData(ctx);


  const data =
    result.data;


  /*
   * 尚未自动捕获
   */
  if (!result.configured) {

    return buildError(
      title,
      '请打开联通 App，进入首页并点击余额位置'
    );
  }


  /*
   * 有缓存就继续显示缓存
   * 没有缓存才显示错误
   */
  if (!data) {

    return buildError(
      title,
      '数据获取失败，请重新打开联通 App 查询一次'
    );
  }


  const family =
    ctx.widgetFamily ||
    'systemSmall';


  /*
   * 锁屏组件
   */
  if (
    family.startsWith('accessory')
  ) {

    return buildLockScreen(
      title,
      data,
      family
    );
  }


  /*
   * 小组件
   */
  if (
    family === 'systemSmall'
  ) {

    return buildSmall(
      title,
      data,
      false
    );
  }


  /*
   * 中号 / 大号 / 超大号
   */
  if (
    family === 'systemMedium' ||
    family === 'systemLarge' ||
    family === 'systemExtraLarge'
  ) {

    return buildMainWidget(
      title,
      data,
      false
    );
  }


  return buildSmall(
    title,
    data,
    false
  );
}


/* =========================================================
 * Egern 入口
 *
 * 同一个 JS：
 *
 * http_request → 自动抓 Cookie / 手机号
 * generic      → 显示 Widget
 * ========================================================= */

export default async function(ctx) {

  /*
   * HTTP Request 模式
   */
  if (
    ctx.request &&
    ctx.request.url
  ) {

    return handleCapture(ctx);
  }


  /*
   * Generic Widget 模式
   */
  return handleWidget(ctx);
}