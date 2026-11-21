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
      if (showGeneralFlow && !showDirectionalFlow) {
        data.flow.title = '剩余通用流量';
      }
      if (!showGeneralFlow && showDirectionalFlow) {
        data.flow.title = '剩余定向流量';
      }

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
