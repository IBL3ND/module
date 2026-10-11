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
 * （汇总：话费/语音/流量总数）
 *
 * 流量明细接口（通用/定向分项）：
 * POST https://m.client.10010.com/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune
 * （只需 Cookie，无 body；code === '0000' 为成功）
 * 定向判定规则（来自 ChinaTelecomOperators/ChinaUnicom 联通余量 v4）：
 * addupItemCode === '40008' / addUpItemName === '套餐内专享免费流量' /
 * 资源类型为「免流流量」/ feePolicyName 匹配 /（免流）|畅视/
 *
 * 三种用法（同一个 JS）：
 * http_request → 自动抓 Cookie / 手机号
 * generic      → 显示 Widget
 * schedule     → 保活：定时查一次接口续 session（ctx.cron 或 Env CU_KEEPALIVE=true）
 */


/* =========================================================
 * 基础配置
 * ========================================================= */

const API_HOST = 'm.client.10010.com';

const API_URL =
  'https://m.client.10010.com/mobileserviceimportant/home/queryUserInfoSeven';

/*
 * 流量明细接口（返回通用/定向分项数据）
 *
 * 分析来源：ChinaTelecomOperators/ChinaUnicom 的联通余量 v4 脚本
 * POST，无 body，Header 带 Cookie 即可
 * 成功标志：code === '0000'
 */
const FLOW_DETAIL_URL =
  'https://m.client.10010.com/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune';


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
  if (!url) return '';

  try {
    const match = url.match(
      /[?&]desmobiel=([^&]+)/i
    );

    if (match && match[1]) {
      return decodeURIComponent(match[1]).trim();
    }
  } catch (e) {}

  return '';
}


async function handleCapture(ctx) {
  const req = ctx.request || {};
  const url = String(req.url || '');

  if (!url) return;

  /*
   * 只捕获中国联通 App 的接口请求
   */
  if (!url.includes(API_HOST)) {
    return;
  }


  /*
   * 获取 Cookie
   */
  const cookie = String(
    getRequestHeader(req.headers, 'cookie') || ''
  ).trim();


  /*
   * 获取手机号
   *
   * 联通这个接口使用：
   * desmobiel=手机号
   */
  const phone = extractPhone(url);


  let changed = false;


  /*
   * 保存 Cookie
   */
  if (cookie) {
    const oldCookie =
      ctx.storage.get('unicom_cookie') || '';

    if (cookie !== oldCookie) {
      ctx.storage.set(
        'unicom_cookie',
        cookie
      );

      changed = true;
    }
  }


  /*
   * 保存手机号
   */
  if (phone) {
    const oldPhone =
      ctx.storage.get('unicom_phone') || '';

    if (phone !== oldPhone) {
      ctx.storage.set(
        'unicom_phone',
        phone
      );

      changed = true;
    }
  }


  /*
   * 第一次成功捕获时通知
   */
  if (
    changed &&
    cookie &&
    phone
  ) {
    ctx.notify({
      title: '中国联通',
      body: '已自动获取登录信息，小组件将自动更新',
    });
  }
}


/* =========================================================
 * 数据请求
 * ========================================================= */

async function fetchUnicomData(
  ctx,
  cookie,
  phone
) {

  const url =
    `${API_URL}?version=iphone_c@10.0100` +
    `&desmobiel=${encodeURIComponent(phone)}` +
    `&showType=0`;

  const resp = await ctx.http.get(
    url,
    {
      timeout: 10000,

      headers: {
        Host: API_HOST,

        'User-Agent':
          'ChinaUnicom.x CFNetwork iOS/16.3',

        Cookie: cookie,
      },

      credentials: 'omit',
    }
  );


  if (!resp || resp.status !== 200) {
    throw new Error(
      `HTTP ${resp ? resp.status : 'no-response'}`
    );
  }


  return await resp.json();
}


/*
 * 拉取流量明细（通用/定向分项）
 *
 * 只需要 Cookie，不需要 body
 */
async function fetchFlowDetail(
  ctx,
  cookie
) {

  const resp = await ctx.http.post(
    FLOW_DETAIL_URL,
    {
      timeout: 10000,

      headers: {
        Host: API_HOST,

        'User-Agent':
          'ChinaUnicom.x CFNetwork iOS/16.3',

        Cookie: cookie,
      },

      credentials: 'omit',
    }
  );


  if (!resp || resp.status !== 200) {
    throw new Error(
      `HTTP ${resp ? resp.status : 'no-response'}`
    );
  }


  const data = await resp.json();

  if (
    !data ||
    String(data.code) !== '0000'
  ) {
    throw new Error(
      `API 返回异常：${data?.code || 'unknown'}`
    );
  }


  return data;
}


/*
 * 流量明细里的资源类型（中文名）
 */
const FLOW_RESOURCE_NAMES = {
  resources: '套餐内流量&流量包',
  unshared: '套餐内流量&流量包(非共享)',
  rzbresources: '日租宝',
  mlresources: '免流流量',
  twresources: '套外流量',
};


/*
 * 判断明细项是否为定向（免流）流量
 *
 * 规则来自联通余量 v4 脚本，满足任一即为定向：
 * 1. addupItemCode === '40008'
 * 2. addUpItemName === '套餐内专享免费流量'
 * 3. 资源类型名为「免流流量」
 * 4. feePolicyName 匹配 /（免流）|畅视/
 */
function isDirectionalFlowItem(
  item,
  resourceName
) {

  const addupItemCode =
    String(item.addupItemCode || '');

  const addUpItemName =
    String(item.addUpItemName || '');

  const feePolicyName =
    String(item.feePolicyName || '');

  return (
    addupItemCode === '40008' ||
    addUpItemName === '套餐内专享免费流量' ||
    resourceName === '免流流量' ||
    /（免流）|畅视/.test(feePolicyName)
  );
}


/*
 * 流量数值自动换算单位：>= 1024 MB 时显示为 GB
 */
function formatFlowValue(value, unit) {

  const v = parseFloat(value) || 0;

  const u =
    String(unit || '').toUpperCase();

  if (
    (u === 'MB' || u === 'M') &&
    v >= 1024
  ) {
    return {
      value:
        Math.round(v / 1024 * 100) / 100,
      unit: 'GB',
    };
  }

  return {
    value:
      Math.round(v * 100) / 100,
    unit: String(unit || 'MB'),
  };
}


/*
 * 解析流量明细，按通用/定向汇总（单位：MB）
 */
function parseFlowDetail(data) {

  let generalRemain = 0;
  let directionalRemain = 0;

  let generalTotal = 0;
  let directionalTotal = 0;

  let generalUsed = 0;
  let directionalUsed = 0;


  for (
    const key of Object.keys(
      FLOW_RESOURCE_NAMES
    )
  ) {

    const resourceName =
      FLOW_RESOURCE_NAMES[key];

    const list = data[key];

    if (!Array.isArray(list)) {
      continue;
    }


    for (const res of list) {

      const details = res.details;

      if (!Array.isArray(details)) {
        continue;
      }


      for (const item of details) {

        const directional =
          isDirectionalFlowItem(
            item,
            resourceName
          );

        const remain =
          Math.max(
            0,
            parseFloat(item.remain) || 0
          );

        const total =
          Math.max(
            0,
            parseFloat(item.total) || 0
          );

        const used =
          Math.max(
            0,
            parseFloat(item.use) || 0
          );


        if (directional) {
          directionalRemain += remain;
          directionalTotal += total;
          directionalUsed += used;
        } else {
          generalRemain += remain;
          generalTotal += total;
          generalUsed += used;
        }
      }
    }
  }


  return {
    generalRemain,
    directionalRemain,
    generalTotal,
    directionalTotal,
    generalUsed,
    directionalUsed,
  };
}


/* =========================================================
 * 数据解析
 * ========================================================= */

function parseUnicomData(res) {

  if (
    !res ||
    res.code !== 'Y' ||
    !res.feeResource ||
    !res.voiceResource ||
    !res.flowResource
  ) {
    throw new Error(
      `API 返回异常：${res?.code || 'unknown'}`
    );
  }


  const feeResource =
    res.feeResource;

  const voiceResource =
    res.voiceResource;

  const flowResource =
    res.flowResource;


  return {
    fee: {
      title:
        feeResource.dynamicFeeTitle ||
        '剩余话费',

      value:
        feeResource.feePersent ??
        0,

      unit:
        feeResource.newUnit ||
        '元',
    },

    voice: {
      title:
        voiceResource.dynamicVoiceTitle ||
        '剩余语音',

      value:
        voiceResource.voicePersent ??
        0,

      unit:
        voiceResource.newUnit ||
        '分钟',
    },

    flow: (() => {

      const formatted =
        formatFlowValue(
          flowResource.flowPersent ?? 0,
          flowResource.newUnit || 'MB'
        );

      return {
        title:
          flowResource.dynamicFlowTitle ||
          '剩余流量',

        value: formatted.value,

        unit: formatted.unit,
      };
    })(),

    updateTime:
      new Date().toLocaleTimeString(
        'zh-CN',
        {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Shanghai',
        }
      ),

    timestamp: Date.now(),
  };
}


/* =========================================================
 * 加载数据
 * ========================================================= */

async function loadData(ctx) {

  const cookie =
    ctx.storage.get('unicom_cookie') ||
    '';

  const phone =
    ctx.storage.get('unicom_phone') ||
    '';


  /*
   * 没有自动捕获到登录信息
   */
  if (!cookie || !phone) {

    return {
      data: null,
      configured: false,
      error: null,
    };
  }


  try {

    const res =
      await fetchUnicomData(
        ctx,
        cookie,
        phone
      );


    const data =
      parseUnicomData(res);


    /*
     * 通用 / 定向流量开关（模块里配置，默认都开）
     */
    const showGeneralFlow =
      ctx.env.CU_SHOW_GENERAL_FLOW !==
      'false';

    const showDirectionalFlow =
      ctx.env.CU_SHOW_DIRECTIONAL_FLOW !==
      'false';


    /*
     * 拉取流量明细，按开关过滤后覆盖流量数值
     *
     * 明细接口失败时降级为汇总接口的原值，
     * 不影响话费和语音的显示
     */
    try {

      const detail =
        await fetchFlowDetail(
          ctx,
          cookie
        );

      const {
        generalRemain,
        directionalRemain,
      } = parseFlowDetail(detail);

      let flowValue = 0;

      if (showGeneralFlow) {
        flowValue += generalRemain;
      }

      if (showDirectionalFlow) {
        flowValue += directionalRemain;
      }

      /*
       * 超过 1024MB 自动换算为 GB 显示
       */
      const formatted =
        formatFlowValue(flowValue, 'MB');

      data.flow.value = formatted.value;
      data.flow.unit = formatted.unit;

    } catch (e) {}


    /*
     * 保存最新数据
     */
    ctx.storage.setJSON(
      'unicom_datasource',
      data
    );


    return {
      data,
      configured: true,
      error: null,
    };

  } catch (e) {

    /*
     * 如果接口失败，尝试使用缓存
     */
    const cached =
      ctx.storage.getJSON(
        'unicom_datasource'
      );


    return {
      data: cached || null,
      configured: true,
      error: e,
    };
  }
}


/* =========================================================
 * 顶部标题
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
       * 三项数据
       */
      {
        type: 'stack',

        direction: 'row',

        alignItems: 'center',

        gap: 8,

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
 * 小组件
 *
 * 三行横条：圆形图标 + 数值 + 说明
 * ========================================================= */

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
  data,
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
        data.fee.value,
        data.fee.unit,
        data.fee.title
      ),

      smallRow(
        '#4DA6F0',
        'sf-symbol:antenna.radiowaves.left.and.right',
        '',
        data.flow.value,
        data.flow.unit,
        data.flow.title
      ),

      smallRow(
        '#55C759',
        'sf-symbol:phone.and.waveform.fill',
        '',
        data.voice.value,
        data.voice.unit,
        data.voice.title
      ),

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

  /*
   * 锁屏组件背景是透明的，文字颜色交给系统处理，
   * 只有次要文字用半透明白色
   */
  const SUB = {
    light: '#FFFFFFB3',
    dark: '#FFFFFFB3',
  };


  /*
   * 单行：话费 / 流量 / 语音
   */
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

          maxLines: 1,

          minScale: 0.5,
        },

      ],
    };
  }


  /*
   * 圆形：只显示剩余流量
   */
  if (
    family === 'accessoryCircular'
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
            `${data.flow.value}`,

          font: {
            size: 'headline',
            weight: 'bold',
          },

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
        data.fee.value,
        data.fee.unit
      ),

      line(
        '流量',
        data.flow.value,
        data.flow.unit
      ),

      line(
        '语音',
        data.voice.value,
        data.voice.unit
      ),

    ],
  };
}


/* =========================================================
 * 错误界面
 * ========================================================= */

function buildError(
  title,
  message
) {

  return {

    type: 'widget',

    backgroundColor:
      COLORS.bg,

    padding: 12,

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

            width: 15,

            height: 15,
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
          },

        ],
      },


      {
        type: 'spacer',
      },


      {
        type: 'text',

        text: message,

        font: {
          size: 'caption1',
          weight: 'medium',
        },

        textColor:
          COLORS.title,

        textAlign:
          'center',

        maxLines: 3,

        minScale: 0.75,
      },


      {
        type: 'spacer',
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

            padding: [
              5,
              12,
              5,
              12,
            ],

            backgroundColor:
              COLORS.capsuleBg,

            borderRadius: 10,

            borderWidth: 1,

            borderColor:
              COLORS.border,

            children: [

              {
                type: 'text',

                text:
                  '打开联通 App 查询一次',

                font: {
                  size: 'caption2',
                  weight: 'medium',
                },

                textColor:
                  COLORS.accent,

                maxLines: 1,
              },

            ],
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
 * Widget 主逻辑
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
 * 保活模式（schedule 定时任务调用）
 *
 * 定时查一次接口，利用服务端 session 滑动过期机制续命；
 * 局限：只对"因不活跃过期"有效，若服务端是固定时长过期则无效；
 * iOS 后台定时触发频率不保证。
 * ========================================================= */

async function handleKeepAlive(ctx) {

  /*
   * 轻量保活：只发一次汇总查询触达服务端续 session，
   * 不跑完整 loadData（明细接口也是串行请求，累积超时会被 Egern 终止）。
   * 成功/失败都不通知不写缓存，下次小组件刷新会正常处理显示。
   */
  const cookie =
    ctx.storage.get('unicom_cookie') ||
    '';

  const phone =
    ctx.storage.get('unicom_phone') ||
    '';

  if (!cookie || !phone) return;

  try {

    await fetchUnicomData(
      ctx,
      cookie,
      phone
    );

  } catch (e) {}
}


/* =========================================================
 * Egern 入口
 *
 * 同一个 JS：
 *
 * http_request → 自动抓 Cookie / 手机号
 * schedule     → 保活（ctx.cron 存在，或 Env CU_KEEPALIVE=true）
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
   * 保活模式：schedule 定时任务（ctx.cron 存在）或 Env CU_KEEPALIVE=true。
   * 定时查一次接口，利用服务端 session 滑动过期机制续命。
   */
  if (
    ctx.cron ||
    (ctx.env && ctx.env.CU_KEEPALIVE === 'true')
  ) {

    return handleKeepAlive(ctx);
  }


  /*
   * Generic Widget 模式
   */
  return handleWidget(ctx);
}
