/**
 * 聚合热搜榜单 - Egern Widget
 * 
 * 【环境变量配置说明】
 * 在 Egern 小组件配置中添加以下环境变量（可选）：
 * 
 * PLATFORM    →  热搜平台（不填则随机显示）
 *               可选值：微博 | 百度 | 抖音 | B站 | 贴吧 | 少数派 | 历史
 *               示例：微博
 * 
 * TITLE       →  自定义标题（不填则使用平台默认名）
 *               示例：🔥 今日热点
 * 
 * 【使用方法】
 * 1. 在 Egern 中创建此脚本
 * 2. 创建小组件时，点击"编辑"添加环境变量
 * 3. 不填 PLATFORM 会每次随机显示不同平台的热搜
 */

export default async function(ctx) {
  // 平台简称映射
  const platformMap = {
    '微博': 'weibo',
    'weibo': 'weibo',
    '百度': 'baidu',
    'baidu': 'baidu',
    '抖音': 'douyin',
    'douyin': 'douyin',
    'B站': 'bilihot',
    'bilihot': 'bilihot',
    '贴吧': 'tieba',
    'tieba': 'tieba',
    '少数派': 'sspai',
    'sspai': 'sspai',
    '历史': 'history',
    'history': 'history'
  };
  
  // 平台列表（用于随机选择）
  const platforms = ['weibo', 'baidu', 'douyin', 'bilihot', 'tieba', 'sspai', 'history'];
  
  // 处理 PLATFORM 配置（支持中文简称）
  let platformValue = ctx.env?.PLATFORM || '';
  const PLATFORM = platformMap[platformValue] || platforms[Math.floor(Math.random() * platforms.length)];
  
  const CUSTOM_TITLE = ctx.env?.TITLE || '';
  
  const platformNames = {
    weibo: '微博热搜',
    baidu: '百度热搜',
    douyin: '抖音热搜',
    bilihot: 'B站热搜',
    tieba: '贴吧热议',
    sspai: '少数派',
    history: '历史上的今天'
  };

  // 根据尺寸决定显示条数
  const widgetFamily = ctx.widgetFamily || 'systemMedium';
  const isLarge = widgetFamily === 'systemLarge';
  const count = isLarge ? 15 : 8;

  try {
    const resp = await ctx.http.get(`https://api.zxki.cn/api/jhrs?type=${PLATFORM}`, { timeout: 15000 });
    if (resp.status !== 200) {
      throw new Error(`HTTP ${resp.status}`);
    }
    
    const data = await resp.json();
    let hotList = [];
    
    if (Array.isArray(data)) {
      hotList = data;
    } else if (data && typeof data === 'object') {
      hotList = data.data || data.list || data.result || [];
      if (!Array.isArray(hotList)) hotList = [];
    }
    
    const title = CUSTOM_TITLE || data?.title || platformNames[PLATFORM] || '🔥 热搜榜单';
    
    const displayCount = Math.min(count, hotList.length);
    const items = [];
    
    for (let i = 0; i < displayCount; i++) {
      const item = hotList[i];
      if (!item) continue;
      
      const rank = i + 1;
      const text = item.title || item.name || item.keyword || `热搜 ${rank}`;
      const hot = item.hot || item.hot_num || item.desc || '';
      
      const rankColor = rank === 1 ? '#FF3B30' : rank === 2 ? '#FF9500' : rank === 3 ? '#FFCC00' : '#8E8E93';
      
      items.push({
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          {
            type: 'text',
            text: `#${rank}`,
            font: { size: 'subheadline', weight: 'bold' },
            textColor: rankColor,
            width: 30
          },
          {
            type: 'text',
            text: text,
            font: { size: 'subheadline' },
            textColor: { light: '#1C1C1E', dark: '#FFFFFF' },
            flex: 1,
            maxLines: 1
          },
          {
            type: 'text',
            text: hot,
            font: { size: 'caption1' },
            textColor: { light: '#8E8E93', dark: '#636366' }
          }
        ]
      });
    }
    
    return {
      type: 'widget',
      refreshAfter: new Date(Date.now() + 1800000).toISOString(),
      padding: 8,
      gap: 4,
      backgroundColor: { light: '#FFFFFF', dark: '#2C2C2E' },
      children: [
        {
          type: 'text',
          text: title,
          font: { size: 'subheadline', weight: 'bold' },
          textColor: { light: '#1C1C1E', dark: '#FFFFFF' }
        },
        {
          type: 'stack',
          height: 0.5,
          backgroundColor: { light: '#E5E5EA', dark: '#3A3A3C' }
        },
        ...items
      ]
    };
    
  } catch (e) {
    return {
      type: 'widget',
      padding: 16,
      backgroundColor: { light: '#F2F2F7', dark: '#1C1C1E' },
      children: [
        {
          type: 'text',
          text: `⚠️ 加载失败\n${e.message}`,
          font: { size: 'body' },
          textColor: { light: '#1C1C1E', dark: '#FFFFFF' }
        }
      ]
    };
  }
}

