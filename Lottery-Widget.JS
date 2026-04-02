/**
 * 全国彩票开奖结果 - Egern 小组件
 * 环境变量：名称填 彩票类型 名称里填种类名称 双色球
 */
export default async function(ctx) {
  const LOTTERY_CONFIG = {
    '双色球': { index: 0, redCount: 6, blueCount: 1, redColor: '#FF3B30', blueColor: '#007AFF' },
    '大乐透': { index: 1, redCount: 5, blueCount: 2, redColor: '#FF3B30', blueColor: '#007AFF' },
    '排列三': { index: 2, redCount: 3, blueCount: 0, redColor: '#34C759', blueColor: '#007AFF' },
    '福彩 3D': { index: 3, redCount: 3, blueCount: 0, redColor: '#FF9500', blueColor: '#007AFF' },
    '福利': { index: 3, redCount: 3, blueCount: 0, redColor: '#FF9500', blueColor: '#007AFF' },
    '3D': { index: 3, redCount: 3, blueCount: 0, redColor: '#FF9500', blueColor: '#007AFF' },
    '七星彩': { index: 4, redCount: 6, blueCount: 1, redColor: '#34C759', blueColor: '#007AFF' },
    '七乐彩': { index: 5, redCount: 7, blueCount: 1, redColor: '#FF9500', blueColor: '#007AFF' },
    '排列五': { index: 6, redCount: 5, blueCount: 0, redColor: '#FF9500', blueColor: '#007AFF' },
  };

  const DEFAULT_LOTTERY = '七星彩';
  const API_URL = 'https://m.zhuying.com/api/lotapi/indexV2/1';

  const C = {
    bg:      { light: '#FFFFFF', dark: '#2C2C2E' },
    text:    { light: '#111111', dark: '#FFFFFF' },
    sub:     { light: '#8E8E93', dark: '#98989D' },
    title:   { light: '#34C759', dark: '#30D158' },
    date:    { light: '#C7C7CC', dark: '#636366' },
    pool:    { light: '#FF9500', dark: '#FF9F0A' },
  };

  const lotteryNameInput = ctx.env['彩票类型'] || DEFAULT_LOTTERY;
  const lotteryConfig = LOTTERY_CONFIG[lotteryNameInput] || LOTTERY_CONFIG[DEFAULT_LOTTERY];
  const lotteryIndex = lotteryConfig.index;

  const DISPLAY_NAMES = {
    0: '双色球', 1: '大乐透', 2: '排列三', 3: '福彩 3D',
    4: '七星彩', 5: '七乐彩', 6: '排列五',
  };
  const displayName = DISPLAY_NAMES[lotteryIndex];

  let data = null;
  let errorMsg = '';

  try {

    const cached = ctx.storage.getJSON(`lottery_${lotteryIndex}`);
    const cacheTime = ctx.storage.get(`lottery_time_${lotteryIndex}`);
    const now = Date.now();
    const cacheValid = 1 * 60 * 1000; 


    const res = await ctx.http.get(API_URL, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        'Accept': 'application/json'
      }
    });

    if (res.status !== 200) {
      if (cached && cacheTime && (now - parseInt(cacheTime)) < cacheValid) {
        data = cached;
        errorMsg = '使用缓存';
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } else {
      const json = await res.json();
      
      if (!json.data || !Array.isArray(json.data)) {
        if (cached) { data = cached; errorMsg = '数据格式错误，使用缓存'; }
        else throw new Error('API 返回 data 不是数组');
      } else {
        const dataArray = [...json.data];
        if (dataArray.length > 2) dataArray.splice(2, 1);

        const rawData = dataArray[lotteryIndex];
        if (!rawData) {
          if (cached) { data = cached; errorMsg = '数据索引错误，使用缓存'; }
          else throw new Error(`索引${lotteryIndex}无数据`);
        } else {
          const { firstNumbers, lastNumbers = '', ...rest } = rawData;
          
          if (!firstNumbers) {
            if (cached) { data = cached; errorMsg = '数据字段缺失，使用缓存'; }
            else throw new Error('缺少 firstNumbers 字段');
          } else {
            const firstArr = firstNumbers.split(',').map(n => n.trim()).filter(n => n);
            const lastArr = lastNumbers ? lastNumbers.split(',').map(n => n.trim()).filter(n => n) : [];
            const openCodeArr = [...firstArr, ...lastArr];

            const openTime = rest.openTime || '';
            const dateObj = openTime ? new Date(openTime.replace(' ', 'T')) : new Date();
            const dateStr = dateObj.toLocaleDateString('zh-CN');
            const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            const weekDay = weekDays[dateObj.getDay()];

            const poolAmount = rest.poolAmount || '0';
            const poolText = formatAmount(poolAmount);

            const frequency = rest.frequency || '';
            const officeTime = rest.officeOpenTime ? rest.officeOpenTime.substring(0, 5) : '';

            data = {
              issue: rest.issue || '',
              dateStr,
              weekDay,
              openCodeArr,
              poolText,
              frequency,
              officeTime,
              lotteryName: displayName
            };

            ctx.storage.setJSON(`lottery_${lotteryIndex}`, data);
            ctx.storage.set(`lottery_time_${lotteryIndex}`, now.toString());
          }
        }
      }
    }

  } catch (e) {
    errorMsg = e.message || '网络异常';
    const cached = ctx.storage.getJSON(`lottery_${lotteryIndex}`);
    if (cached) {
      data = cached;
    }
  }

  function formatAmount(amount) {
    const num = parseFloat(amount);
    if (num >= 100000000) {
      return (num / 100000000).toFixed(2) + '亿';
    } else if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return amount;
  }

  const text = (t, opts = {}) => ({
    type: 'text',
    text: t,
    font: { size: opts.size || 14, weight: opts.weight || 'regular' },
    textColor: opts.color || C.text,
    textAlign: opts.align || 'left',
    maxLines: opts.maxLines || 1,
    minScale: opts.minScale || 0.6
  });

  const totalBalls = data?.openCodeArr?.length || 0;
  const ballSize = totalBalls > 7 ? 36 : 40;
  const ballGap = totalBalls > 7 ? 6 : 8;
  const fontSize = totalBalls > 7 ? 15 : 17;

  const ball = (num, color) => ({
    type: 'stack',
    alignItems: 'center',
    justifyContent: 'center',
    width: ballSize,
    height: ballSize,
    backgroundColor: color,
    borderRadius: ballSize / 2,
    children: [
      text(String(num).padStart(2, '0'), {
        size: fontSize,
        weight: 'bold',
        color: { light: '#FFFFFF', dark: '#FFFFFF' }
      })
    ]
  });

  const issueNum = data?.issue ? data.issue.substring(4) : '---';
  
  const header = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
    children: [
      text(`〔${data?.lotteryName || displayName}〕`, {
        size: 16,
        weight: 'semibold',
        color: C.title
      }),
      text(`第${issueNum}期`, {
        size: 16,
        weight: 'medium',
        color: C.text
      }),
      { type: 'spacer' },
      text(data?.dateStr || '', {
        size: 14,
        color: C.date
      }),
      text(data?.weekDay || '', {
        size: 14,
        color: C.date
      })
    ]
  };

  const balls = [];
  const redCount = lotteryConfig.redCount;
  const redColor = lotteryConfig.redColor;
  const blueColor = lotteryConfig.blueColor;
  
  if (data && data.openCodeArr && data.openCodeArr.length > 0) {
    data.openCodeArr.forEach((num, index) => {
      const isBlue = index >= redCount;
      balls.push(ball(num, isBlue ? blueColor : redColor));
    });
  }

  const ballsRow = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ballGap,
    children: balls
  };

  const bottomRow = {
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
          text('奖池', { size: 13, color: C.sub }),
          text(data?.poolText || '0', { size: 14, color: C.pool, weight: 'semibold' })
        ]
      },
      { type: 'spacer', flex: 1 },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          text(data?.frequency || '', { size: 13, color: C.sub }),
          text(data?.officeTime ? `${data.officeTime}开奖` : '', { size: 13, color: C.sub })
        ]
      }
    ]
  };

  const content = data && data.openCodeArr && data.openCodeArr.length > 0
    ? {
        type: 'stack',
        direction: 'column',
        children: [
          { type: 'spacer', flex: 1 },  
          ballsRow,                      
          { type: 'spacer', flex: 1 },  
          bottomRow                      
        ]
      }
    : {
        type: 'stack',
        alignItems: 'center',
        justifyContent: 'center',
        padding: [16, 8],
        children: [
          text(errorMsg || '加载失败', {
            size: 13,
            color: C.sub,
            align: 'center'
          })
        ]
      };

  const refreshTime = new Date(Date.now() + 60 * 1000).toISOString();

  if (ctx.widgetFamily === 'systemSmall') {
    return {
      type: 'widget',
      refreshAfter: refreshTime,
      backgroundColor: C.bg,
      padding: 14,
      gap: 8,
      children: [
        header,
        { type: 'spacer', length: 6 },
        data && data.openCodeArr ? ballsRow : content
      ]
    };
  }

  return {
    type: 'widget',
    refreshAfter: refreshTime,
    backgroundColor: C.bg,
    padding: 16,
    gap: 0,
    children: [
      header,
      { type: 'spacer', length: 8 },
      content
    ]
  };
}

