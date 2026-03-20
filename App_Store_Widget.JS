// AppStore 内购限免小组件
// 数据源：api.zxki.cn / api.03k.org

export default async function(ctx) {
  const widgetFamily = ctx.widgetFamily || 'systemMedium';
  
  // 根据尺寸调整显示数量
  let maxItems = 7;
  if (widgetFamily === 'systemLarge') {
    maxItems = 12;
  }
  maxItems = parseInt(ctx.env?.maxItems) || maxItems;

  // 不支持的尺寸
  if (['systemSmall', 'accessoryCircular', 'accessoryInline', 'accessoryRectangular'].includes(widgetFamily)) {
    return {
      type: 'widget',
      padding: 16,
      backgroundColor: { light: '#FFFFFF', dark: '#2C2C2E' },
      children: [{
        type: 'text',
        text: '请使用中号或大号组件',
        font: { size: 'callout' },
        textColor: { light: '#1D1D1F', dark: '#F5F5F7' },
        textAlign: 'center'
      }]
    };
  }

  let apps = [];
  let source = 'none';

  // 获取数据
  try {
    apps = await fetchFromAPI(ctx);
    if (apps.length > 0) source = 'api';
  } catch (e) {
    console.log('API error:', e.message);
  }

  // 使用缓存（24 小时内）
  if (apps.length === 0) {
    const cached = ctx.storage.getJSON('ithome_cache');
    const cacheTime = ctx.storage.get('ithome_cache_time');
    if (cached && cached.length > 0 && cacheTime) {
      const age = Date.now() - parseInt(cacheTime);
      if (age < 24 * 60 * 60 * 1000) {
        apps = cached;
        source = 'cache';
      }
    }
  }

  // 保存缓存
  if (apps.length > 0) {
    ctx.storage.setJSON('ithome_cache', apps);
    ctx.storage.set('ithome_cache_time', Date.now().toString());
  }

  return buildWidget(apps.slice(0, maxItems), source);
}

// ============ 数据获取 ============

async function fetchFromAPI(ctx) {
  const apis = [
    { url: 'https://api.zxki.cn/api/appfree', parse: parseZXKI },
    { url: 'https://api.03k.org/app/free', parse: parseGeneric }
  ];

  for (const api of apis) {
    try {
      const resp = await ctx.http.get(api.url, { timeout: 8000 });
      const json = await resp.json();
      const apps = api.parse(json);
      if (apps.length > 0) return apps;
    } catch (e) {
      continue;
    }
  }
  return [];
}

// 解析 zxki.cn API - 强化清理逻辑
function parseZXKI(json) {
  const apps = [];
  if (json.apps) {
    for (const cat in json.apps) {
      const items = json.apps[cat];
      if (Array.isArray(items)) {
        items.forEach(item => {
          let name = item.name ? item.name.trim() : '';
          if (name) {
            name = name.replace(/\/\//g, ' — ');
            name = name.replace(/\s*\[.*?\]/g, '');
            const httpsIndex = name.toLowerCase().lastIndexOf('http');
            if (httpsIndex !== -1) {
              name = name.substring(0, httpsIndex).trim();
            }
            name = name.replace(/[\s—]+$/, '').trim();
            if (name.length > 50) {
              name = name.substring(0, 50).trim() + '...';
            }
            const searchName = name.split(' — ')[0].trim();
            apps.push({
              name: name,
              url: item.url || `https://apps.apple.com/search?term=${encodeURIComponent(searchName)}`,
              isFree: true
            });
          }
        });
      }
    }
  }
  return apps;
}

// 解析通用 API - 强化清理逻辑
function parseGeneric(json) {
  const apps = [];
  const items = json.data || json;
  if (Array.isArray(items)) {
    items.forEach(item => {
      if (item.name || item.title) {
        let name = item.name || item.title;
        name = name.replace(/\/\//g, ' — ');
        name = name.replace(/\s*\[.*?\]/g, '');
        const httpsIndex = name.toLowerCase().lastIndexOf('http');
        if (httpsIndex !== -1) {
          name = name.substring(0, httpsIndex).trim();
        }
        name = name.replace(/[\s—]+$/, '').trim();
        if (name.length > 50) {
          name = name.substring(0, 50).trim() + '...';
        }
        const searchName = name.split(' — ')[0].trim();
        apps.push({
          name: name,
          url: item.url || item.link || `https://apps.apple.com/search?term=${encodeURIComponent(searchName)}`,
          isFree: true
        });
      }
    });
  }
  return apps;
}

// ============ 构建组件 ============

function buildWidget(apps, source) {
  const children = [];
  
  // 获取当前时间
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  
  // 标题行：左侧标题 + 右侧时间
  children.push({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    padding: [0, 0, 6, 0],
    children: [
      {
        type: 'text',
        text: `🎁 iOS 内购限免 · ${apps.length}款`,
        font: { size: 'subheadline', weight: 'bold' },
        textColor: { light: '#1D1D1F', dark: '#F5F5F7' },
        flex: 1
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 4,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:arrow.clockwise',
            width: 14,
            height: 14,
            color: { light: '#86868B', dark: '#8E8E93' }
          },
          {
            type: 'text',
            text: timeStr,
            font: { size: 'caption2' },
            textColor: { light: '#86868B', dark: '#8E8E93' }
          }
        ]
      }
    ]
  });
  
  // 空状态
  if (apps.length === 0) {
    children.push({
      type: 'text',
      text: '暂无限免应用\n\n请检查网络或稍后再试',
      font: { size: 'callout' },
      textColor: { light: '#666', dark: '#AAA' },
      textAlign: 'center',
      padding: [20, 0]
    });
  } else {
    // 应用列表
    apps.forEach((app, i) => {
      // 分隔线
      if (i > 0) {
        children.push({
          type: 'stack',
          height: 0.5,
          backgroundColor: { light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.12)' },
          margin: [4, 0]
        });
      }
      
      // 应用项
      children.push({
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 10,
        url: app.url,
        padding: [4, 0],
        children: [
          {
            type: 'text',
            text: app.name,
            font: { size: 'subheadline' },
            textColor: { light: '#1D1D1F', dark: '#F5F5F7' },
            flex: 1,
            maxLines: 2,
            minScale: 0.85
          },
          {
            type: 'text',
            text: '限免',
            font: { size: 'caption2', weight: 'semibold' },
            textColor: '#34C759',
            maxLines: 1
          },
          {
            type: 'image',
            src: 'sf-symbol:chevron.right',
            width: 12,
            height: 12,
            color: { light: '#86868B', dark: '#8E8E93' }
          }
        ]
      });
    });
  }
  
  return {
    type: 'widget',
    padding: [10, 12, 10, 12],
    gap: 4,
    backgroundColor: { light: '#FFFFFF', dark: '#2C2C2E' },
    refreshAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    children: children
  };
}

