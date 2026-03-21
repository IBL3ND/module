/**
 * ============================================================================
 * 聚合热搜榜单 - Egern Widget
 * ============================================================================
 * 
 * 【功能说明】
 * 显示各大平台热搜榜单，支持自动适配小/中/大尺寸小组件
 * 
 * 【环境变量配置】
 * 在 Egern 小组件编辑页面添加以下环境变量（可选）：
 * 
 * 变量名      说明                  可选值
 * ─────────────────────────────────────────────────────────────
 * PLATFORM   热搜平台             微博 | 百度 | 抖音 | B站 | 贴吧 | 少数派 | 历史
 *            （不填则随机显示）    或 weibo | baidu | douyin | bilihot | tieba | sspai | history
 * 
 * TITLE      自定义标题           任意文本，例如：今日热点
 *            （不填则用平台名）
 * 
 * 【配置示例】
 * PLATFORM=微博
 * TITLE=全网热搜
 * 
 * 【使用方法】
 * 1. 复制本脚本到 Egern → 工具 → 脚本 → 新建（类型选 通用）
 * 2. 分析 → 小组件画廊 → 新建 → 选择本脚本
 * 3. 点击"编辑"添加环境变量（可选）
 * 4. 长按桌面 → + → Egern → 选择尺寸添加
 * 
 * 【尺寸说明】
 * - 小尺寸：显示 8 条
 * - 中尺寸：显示 8 条
 * - 大尺寸：显示 15 条
 * 
 * 【支持平台】
 * 微博     - 微博热搜
 * 百度     - 百度热搜
 * 抖音     - 抖音热搜
 * B站      - Bilibili热搜
 * 贴吧     - 贴吧热议榜
 * 少数派   - 少数派热搜
 * 历史     - 历史上的今天
 * 
 * ============================================================================
 */

export default async function(ctx) {
  // 平台简称映射（支持中文和英文）
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
    
    // 获取当前时间 HH:MM
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    
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
        // 标题栏 - 标题在左，刷新时间和图标在右
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 6,
          children: [
            {
              type: 'text',
              text: title,
              font: { size: 'subheadline', weight: 'bold' },
              textColor: { light: '#1C1C1E', dark: '#FFFFFF' },
              flex: 1
            },
            {
              type: 'text',
              text: `↻ ${currentTime}`,
              font: { size: 'caption1' },
              textColor: { light: '#8E8E93', dark: '#636366' }
            }
          ]
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

