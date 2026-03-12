export default async function(ctx) {
  // ✅ 读取 argument 参数
  const args = ctx.args || {};
  
  // 解析参数
  const A_NAME = args.title1 || args.A_NAME || '未命名机场A';
  const A_URL = args.url1 || args.A_URL;
  const A_RESET = args.resetDay1 || args.A_RESET;
  
  const B_NAME = args.title2 || args.B_NAME || '未命名机场B';
  const B_URL = args.url2 || args.B_URL;
  const B_RESET = args.resetDay2 || args.B_RESET;
  
  const C_NAME = args.title3 || args.C_NAME || '未命名机场C';
  const C_URL = args.url3 || args.C_URL;
  const C_RESET = args.resetDay3 || args.C_RESET;
  
  const D_NAME = args.title4 || args.D_NAME || '未命名机场D';
  const D_URL = args.url4 || args.D_URL;
  const D_RESET = args.resetDay4 || args.D_RESET;
  
  const E_NAME = args.title5 || args.E_NAME || '未命名机场E';
  const E_URL = args.url5 || args.E_URL;
  const E_RESET = args.resetDay5 || args.E_RESET;
  
  // 收集所有机场
  const airports = [
    { name: A_NAME, url: A_URL, reset: A_RESET },
    { name: B_NAME, url: B_URL, reset: B_RESET },
    { name: C_NAME, url: C_URL, reset: C_RESET },
    { name: D_NAME, url: D_URL, reset: D_RESET },
    { name: E_NAME, url: E_URL, reset: E_RESET },
  ].filter(airport => airport.url); // 只保留有URL的机场
  
  if (airports.length === 0) {
    return {
      type: 'widget',
      children: [{
        type: 'text',
        text: '⚠️ 请至少配置一个机场订阅',
        textColor: { light: '#FF3B30', dark: '#FF453A' }
      }]
    };
  }
  
  // 获取所有机场的流量信息
  const results = [];
  for (const airport of airports) {
    try {
      const data = await fetchSubscriptionInfo(airport.url);
      results.push({
        name: airport.name,
        ...data,
        reset: airport.reset
      });
    } catch (error) {
      results.push({
        name: airport.name,
        error: '获取失败',
        reset: airport.reset
      });
    }
  }
  
  // 构建 Widget UI
  const children = [];
  
  children.push({
    type: 'text',
    text: '📡 机场流量监控',
    font: { size: 16, weight: 'semibold' },
    textColor: { light: '#1D1D1F', dark: '#F5F5F7' }
  });
  
  for (const result of results) {
    let text = `${result.name}: `;
    
    if (result.error) {
      text += result.error;
    } else {
      text += `${result.used}/${result.total}GB`;
      if (result.reset) {
        text += ` | 重置:${result.reset}`;
      }
    }
    
    children.push({
      type: 'text',
      text: text,
      font: { size: 13, weight: 'regular' },
      textColor: { light: '#333333', dark: '#CCCCCC' }
    });
  }
  
  return {
    type: 'widget',
    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
    padding: 12,
    children: children
  };
}

async function fetchSubscriptionInfo(url) {
  // TODO: 实现你的流量查询逻辑
  // const response = await fetch(url);
  // const data = await response.json();
  // return { used: data.used, total: data.total };
  
  // 示例返回
  return {
    used: 50,
    total: 100
  };
}

