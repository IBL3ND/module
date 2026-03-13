/**
 * ⛽ 实时油价小组件 - 增强版
 */

export default async function(ctx) {
  try {
    const env = ctx.env || {};
    const widgetFamily = ctx.widgetFamily || 'systemMedium';
    
    const region = env.REGION || 'guangdong/guangzhou';
    const showTrend = env.SHOW_TREND !== 'false';
    
    // 获取油价数据
    let oilData = null;
    try {
      oilData = await fetchOilPrice(region);
    } catch (e) {
      console.error('获取油价失败:', e.message);
    }
    
    // 🔹 锁屏圆形
    if (widgetFamily === 'accessoryCircular') {
      const price = oilData && oilData.prices[0] ? oilData.prices[0].value.split(' ')[0] : '--';
      return {
        type: 'widget',
        padding: 6,
        backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
        refreshAfter: 'PT12H',
        children: [{
          type: 'stack', direction: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          children: [
            { type: 'image', src: 'sf-symbol:fuelpump.fill', color: { light: '#FF9500', dark: '#FF9F0A' }, width: 22, height: 22 },
            { type: 'text', text: price, font: { size: 14, weight: 'bold' }, textColor: { light: '#1D1D1F', dark: '#F5F5F7' }, textAlign: 'center' }
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
      
      // 标题
      children.push({
        type: 'text',
        text: '⛽ 油价',
        font: { size: 10, weight: 'bold' },
        textColor: { light: '#1D1D1F', dark: '#F5F5F7' },
        maxLines: 1
      });
      
      // 油价列表
      if (prices.length > 0) {
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
        
        // 调整趋势
        if (showTrend && oilData.trend) {
          children.push({
            type: 'text',
            text: `${oilData.trend.date} ${oilData.trend.symbol} ${oilData.trend.value}`,
            font: { size: 8, weight: 'regular' },
            textColor: oilData.trend.symbol === '↓' ? { light: '#34C759', dark: '#30D158' } : { light: '#FF3B30', dark: '#FF453A' },
            maxLines: 1
          });
        }
      } else {
        // 无数据提示
        children.push({
          type: 'text',
          text: '暂无数据',
          font: { size: 10, weight: 'regular' },
          textColor: { light: '#999999', dark: '#666666' },
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
    
    // 🔹 中尺寸（2×4）- 一行4个
    if (widgetFamily === 'systemMedium') {
      const prices = oilData ? oilData.prices : [];
      
      const children = [];
      
      children.push({
        type: 'text',
        text: '⛽ 实时油价',
        font: { size: 12, weight: 'bold' },
        textColor: { light: '#1D1D1F', dark: '#F5F5F7' },
        maxLines: 1
      });
      
      if (prices.length > 0) {
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
        
        if (showTrend && oilData.trend) {
          children.push({
            type: 'text',
            text: `📅 ${oilData.trend.date} ${oilData.trend.symbol} ${oilData.trend.value}`,
            font: { size: 10, weight: 'medium' },
            textColor: oilData.trend.symbol === '↓' ? { light: '#34C759', dark: '#30D158' } : { light: '#FF3B30', dark: '#FF453A' },
            maxLines: 1
          });
        }
      } else {
        children.push({
          type: 'text',
          text: '暂无数据\n请检查地区配置',
          font: { size: 11, weight: 'regular' },
          textColor: { light: '#999999', dark: '#666666' },
          maxLines: 2
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
    
    // 🔹 大尺寸
    const prices = oilData ? oilData.prices : [];
    const children = [];
    
    children.push({
      type: 'text',
      text: '⛽ 实时油价信息',
      font: { size: 14, weight: 'bold' },
      textColor: { light: '#1D1D1F', dark: '#F5F5F7' }
    });
    
    if (prices.length > 0) {
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
      
      if (showTrend && oilData.trend) {
        children.push({
          type: 'text',
          text: `📅 下次调整：${oilData.trend.date} ${oilData.trend.symbol} ${oilData.trend.value}`,
          font: { size: 11, weight: 'medium' },
          textColor: oilData.trend.symbol === '↓' ? { light: '#34C759', dark: '#30D158' } : { light: '#FF3B30', dark: '#FF453A' },
          maxLines: 2
        });
      }
    } else {
      children.push({
        type: 'text',
        text: '暂无数据\n请检查地区配置',
        font: { size: 12, weight: 'regular' },
        textColor: { light: '#999999', dark: '#666666' },
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
    console.error('小组件渲染失败:', error);
    return {
      type: 'widget',
      padding: 12,
      backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
      children: [{
        type: 'stack', direction: 'column', alignItems: 'center', gap: 8,
        children: [
          { type: 'image', src: 'sf-symbol:fuelpump.fill', color: { light: '#FF9500', dark: '#FF9F0A' }, width: 22, height: 22 },
          { type: 'text', text: '加载失败', font: { size: 12, weight: 'medium' }, textColor: { light: '#FF3B30', dark: '#FF453A' } },
          { type: 'text', text: error.message, font: { size: 10, weight: 'regular' }, textColor: { light: '#999999', dark: '#666666' }, textAlign: 'center' }
        ]
      }]
    };
  }
}

// 获取油价数据
async function fetchOilPrice(region) {
  try {
    const url = `http://m.qiyoujiage.com/${region}.shtml`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      },
      timeout: 5000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // 解析油价
    const prices = [];
    const priceRegex = /<dt>([\u4e00-\u9fa5]+油)<\/dt>\s*<dd>([\d.]+)<\/dd>/g;
    let match;
    
    while ((match = priceRegex.exec(html)) !== null) {
      prices.push({
        name: match[1],
        value: `${match[2]} 元/L`
      });
    }
    
    // 解析调整趋势
    let trend = null;
    const trendMatch = html.match(/<span[^>]*>([\u4e00-\u9fa5]+价[\d月\d日]*)<\/span>[\s\n]*([\u4e00-\u9fa5]+)/);
    
    if (trendMatch) {
      const date = trendMatch[1].split('价')[1] || trendMatch[1];
      const trendText = trendMatch[2];
      const symbol = (trendText.includes('下调') || trendText.includes('下跌')) ? '↓' : '↑';
      
      const valueMatch = trendText.match(/([\d.]+)\u5143\/\u5347-([\d.]+)\u5143\/\u5347/);
      let value = trendText;
      
      if (valueMatch) {
        value = `${valueMatch[1]}-${valueMatch[2]}元/L`;
      }
      
      trend = { date, symbol, value };
    }
    
    return {
      prices: prices.length >= 2 ? prices : [],
      trend
    };
    
  } catch (error) {
    console.error('获取油价数据失败:', error.message);
    throw error;
  }
}

