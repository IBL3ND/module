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
    light: '#FFFFFF15',
    dark: '#FFFFFF10',
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
  ).catch(e => { e.transient = true; throw e; });


  if (!resp) {
    const e = new Error('no-response');
    e.transient = true;
    throw e;
  }

  // cookie 被服务器拒绝视为登录过期
  if (resp.status === 401 || resp.status === 403) {
    const e = new Error(`HTTP ${resp.status}`);
    e.authFailed = true;
    throw e;
  }

  if (resp.status !== 200) {
    throw new Error(
      `HTTP ${resp.status}`
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
    const _apiErr = new Error(`API 返回异常：${res?.code || 'unknown'}`);
    _apiErr.authFailed = true;
    throw _apiErr;
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

// 登录过期通知：同一个失效 cookie 只通知一次，成功获取数据后清除标记
function notifyExpiredOnce(ctx, cookie) {
  const key = 'unicom_expired_notified';
  const marker = cookie || 'none';
  if (ctx.storage.get(key) === marker) return;
  ctx.storage.set(key, marker);
  try {
    ctx.notify({
      title: '中国联通',
      body: '登录已过期，请重新打开联通 App 获取登录信息',
    });
  } catch (e) {}
}

function clearExpiredFlag(ctx) {
  try { ctx.storage.remove('unicom_expired_notified'); } catch (e) {}
}

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

    clearExpiredFlag(ctx);


    return {
      data,
      configured: true,
      error: null,
    };

  } catch (e) {

    /*
     * 如果接口失败，尝试使用缓存
     * authFailed（cookie 被拒）时通知一次
     */
    if (e && e.authFailed) {
      notifyExpiredOnce(ctx, cookie);
    }

    const cached =
      ctx.storage.getJSON(
        'unicom_datasource'
      );


    return {
      data: cached || null,
      configured: true,
      error: e,
      authFailed: !!(e && e.authFailed),
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

        justifyContent: 'center',

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
  data,
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
        data.fee.value,
        data.fee.unit,
        data.fee.title
      )),

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
  if (result.authFailed) {
    return buildError(
      title,
      '登录已过期，请重新打开联通 App 获取登录信息'
    );
  }
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
