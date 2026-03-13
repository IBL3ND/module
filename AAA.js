/**
 * ⛽ 实时油价小组件
 * ✅ 小尺寸：一行3个
 * ✅ 中尺寸：一行4个（字体放大）
 * ✅ 显示油价调整趋势
 */

// ========== 配置参数 ==========
// 格式：省份拼音/城市拼音
// 示例：guangdong/guangzhou, shanxi-3/xian, hainan/haikou
// 查询省份拼音：http://m.qiyoujiage.com/shanxi-3.shtml

export default async function(ctx) {
  try {
    const env = ctx.env || {};
    const widgetFamily = ctx.widgetFamily || 'systemMedium';
    
    // 从环境变量获取省份和城市，或默认值
    const region = env.REGION || 'guangdong/guangzhou';
    const showTrend = env.SHOW_TREND !== 'false'; // 是否显示调整趋势
    
    // 构建查询地址
    const queryAddr = `http://m.qiyoujiage.com/${region}.shtml`;
    
    // 获取油价数据
    let oilData = null;
    try {
      oilData = await fetchOilPrice(queryAddr);
    } catch (e) {
      console.error('获取油价失败:', e);
    }
    
    // 🔹 锁屏圆形
    if (widgetFamily === 'accessoryCircular') {
      const price = oilData && oilData.prices[0] ? oilData.prices[0].value : '--';
      return {
        type: 'widget',
        padding: 6,
        backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
        refreshAfter: 'PT12H',
        children: [{
          type: 'stack', direction: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          children: [
            { type: 'image', src: 'sf-symbol:fuelpump.fill', color: { light: '#FF9500', dark: '#FF9F0A' }, width: 22, height: 22 },
            { type: 'text', text: price.split(' ')[0] || '--', font: { size: 14, weight: 'bold' }, textColor: { light: '#1D1D1F', dark: '#F5F5F7' }, textAlign: 'center' }
          ]
        }]
      };
    }
    
    // 🔹 锁屏矩形
    if (widgetFamily === 'accessoryRectangular' || widgetFamily === 'accessoryInline') {
      const price92 = oilData && oilData.prices[0] ? `${oilData.prices[0].name} ${oilData.prices[0].value}` : '油价 --';
      return {
        type: 'widget',
        padding: 8,
        backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
        refreshAfter: 'PT12H',
        children: [{
          type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
          children: [
            { type: 'image', src: 'sf-symbol:fuelpump.fill', color: { light: '#FF9500', dark: '#FF9F0A' }, width: 18, height: 18 },
            { type: 'text', text: price92, font: { size: 11, weight: 'medium' }, textColor: { light: '#1D1D1F', dark: '#F5F5F7' }, maxLines: 1, flex: 1 }
          ]
        }]
      };
    }
    
    // 🔹 小尺寸（2×2）- 一行3个
    if (widgetFamily === 'systemSmall') {
      const prices = oilData ? oilData.prices.slice(0, 6) : [];
      
      const children = [];
      
      // 添加标题
      children.push({
        type: 'text',
        text: '⛽ 油价',
        font: { size: 10, weight: 'bold' },
        textColor: { light: '#1D1D1F', dark: '#F5F5F7' },
        maxLines: 1
      });
      
      // 添加油价（一行3个）
      for (let i = 0; i < prices.length; i += 3) {
        const rowItems = prices.slice(i, i + 3);
        const rowChildren = rowItems.map((p, idx) => ({
          type: 'text',
          text: `${p.name.split('油')[0]} ${p.value}`,
          font: { size: 9, weight: idx === 0 ? 'semibold' : 'regular' },
          textColor: idx === 0 ? { light: '#FF3B30', dark: '#FF453A' } : { light: '#333333', dark: '#CCCCCC' },
          flex: 1,
          maxLines: 1
        }));
        
        children.push({
          type: 'stack',
          direction: 'row',
          gap: 2,
          children: rowChildren
        });
      }
      
      // 添加调整趋势
      if (showTrend && oilData && oilData.trend) {
        children.push({
          type: 'text',
          text: `${oilData.trend.date} ${oilData.trend.symbol} ${oilData.trend.value}`,
          font: { size: 8, weight: 'regular' },
          textColor: oilData.trend.symbol === '↓' ? { light: '#34C759', dark: '#30D158' } : { light: '#FF3B30', dark: '#FF453A' },
          maxLines: 1
        });
      }
      
      return {
        type: 'widget',
        padding: 6,
        backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
        refreshAfter: 'PT12H',
        children
      };
    }
    
    // 🔹 中尺寸（2×4）- 一行4个（字体放大）
    if (widgetFamily === 'systemMedium') {
      const prices = oilData ? oilData.prices : [];
      
      const children = [];
      
      // 添加标题
      children.push({
        type: 'text',
        text: '⛽ 实时油价',
        font: { size: 12, weight: 'bold' },
        textColor: { light: '#1D1D1F', dark: '#F5F5F7' },
        maxLines: 1
      });
      
      // 添加油价（一行4个）
      for (let i = 0; i < prices.length; i += 4) {
        const rowItems = prices.slice(i, i + 4);
        const rowChildren = rowItems.map((p, idx) => {
          const globalIdx = i + idx;
          return {
            type: 'text',
            text: `${p.name} ${p.value}`,
            font: { size: 11, weight: globalIdx < 2 ? 'semibold' : 'regular' },
            textColor: globalIdx < 2 ? { light: '#FF3B30', dark: '#FF453A' } : (globalIdx < 4 ? { light: '#FF9500', dark: '#FF9F0A' } : { light: '#333333', dark: '#CCCCCC' }),
            flex: 1,
            maxLines: 1
          };
        });
        
        children.push({
          type: 'stack',
          direction: 'row',
          gap: 3,
          children: rowChildren
        });
      }
      
      // 添加调整趋势
      if (showTrend && oilData && oilData.trend) {
        children.push({
          type: 'text',
          text: `📅 ${oilData.trend.date} ${oilData.trend.symbol} ${oilData.trend.value}`,
          font: { size: 10, weight: 'medium' },
          textColor: oilData.trend.symbol === '↓' ? { light: '#34C759', dark: '#30D158' } : { light: '#FF3B30', dark: '#FF453A' },
          maxLines: 1
        });
      }
      
      return {
        type: 'widget',
        padding: 8,
        backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
        refreshAfter: 'PT12H',
        children
      };
    }
    
    // 🔹 大尺寸（4×4）- 完整显示
    const prices = oilData ? oilData.prices : [];
    const children = [];
    
    children.push({
      type: 'text',
      text: '⛽ 实时油价信息',
      font: { size: 14, weight: 'bold' },
      textColor: { light: '#1D1D1F', dark: '#F5F5F7' }
    });
    
    // 添加油价（一行4个）
    for (let i = 0; i < prices.length; i += 4) {
      const rowItems = prices.slice(i, i + 4);
      const rowChildren = rowItems.map((p, idx) => ({
        type: 'text',
        text: `${p.name} ${p.value}`,
        font: { size: 12, weight: idx < 2 ? 'semibold' : 'regular' },
        textColor: idx < 2 ? { light: '#FF3B30', dark: '#FF453A' } : { light: '#333333', dark: '#CCCCCC' },
        flex: 1,
        maxLines: 1
      }));
      
      children.push({
        type: 'stack',
        direction: 'row',
        gap: 4,
        children: rowChildren
      });
    }
    
    // 添加调整趋势
    if (showTrend && oilData && oilData.trend) {
      children.push({
        type: 'text',
        text: `📅 下次调整：${oilData.trend.date} ${oilData.trend.symbol} ${oilData.trend.value}`,
        font: { size: 11, weight: 'medium' },
        textColor: oilData.trend.symbol === '↓' ? { light: '#34C759', dark: '#30D158' } : { light: '#FF3B30', dark: '#FF453A' },
        maxLines: 2
      });
    }
    
    return {
      type: 'widget',
      backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
      padding: 10,
      refreshAfter: 'PT12H',
      children
    };
    
  } catch (error) {
    return {
      type: 'widget',
      padding: 12,
      backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
      children: [{
        type: 'stack', direction: 'column', alignItems: 'center', gap: 8,
        children: [
          { type: 'image', src: 'sf-symbol:fuelpump.fill', color: { light: '#FF9500', dark: '#FF9F0A' }, width: 22, height: 22 },
          { type: 'text', text: '加载失败', font: { size: 12, weight: 'medium' }, textColor: { light: '#FF3B30', dark: '#FF453A' } }
        ]
      }]
    };
  }
}

// 获取油价数据
async function fetchOilPrice(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'referer': 'http://m.qiyoujiage.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    // 解析油价信息
    const regPrice = /\s+?(.*油)<\/dt>\s+?(.*)(元)<\/dd>/gm;
    const prices = [];
    let m = null;
    
    while ((m = regPrice.exec(html)) !== null) {
      if (m.index === regPrice.lastIndex) {
        regPrice.lastIndex++;
      }
      
      prices.push({
        name: m[1].trim(),
        value: `${m[2].trim()} 元/L`
      });
    }
    
    // 解析油价调整趋势
    let adjustDate = '';
    let adjustTrend = '';
    let adjustValue = '';
    
    const regAdjustTips = /<span[^>]*>(.*)<\/span>([\s\S]+?)/;
    const adjustTipsMatch = html.match(regAdjustTips);
    
    if (adjustTipsMatch && adjustTipsMatch.length === 3) {
      adjustDate = adjustTipsMatch[1].split('价')[1].slice(0, -2);
      adjustValue = adjustTipsMatch[2];
      adjustTrend = (adjustValue.indexOf('下调') > -1 || adjustValue.indexOf('下跌') > -1) ? '↓' : '↑';
      
      const adjustValueRe = /([\d.]+)元/升-([\d.]+)元/升/;
      const adjustValueMatch = adjustValue.match(adjustValueRe);
      
      if (adjustValueMatch && adjustValueMatch.length === 3) {
        adjustValue = `${adjustValueMatch[1]}-${adjustValueMatch[2]}元/L`;
      } else {
        const adjustValueRe2 = /[\d.]+元/吨/;
        const adjustValueMatch2 = adjustValue.match(adjustValueRe2);
        if (adjustValueMatch2) {
          adjustValue = adjustValueMatch2[0];
        }
      }
    }
    
    return {
      prices: prices.length === 4 ? prices : [],
      trend: adjustDate ? {
        date: adjustDate,
        symbol: adjustTrend,
        value: adjustValue
      } : null
    };
    
  } catch (error) {
    console.error('获取油价数据失败:', error);
    throw error;
  }
}

