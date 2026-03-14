/**
 * 🌤️ 和风天气 - Egern 小组件（API Host版）
 * 
 * ⚠️ 重要：必须使用个人API Host，公共域名已停止服务！
 * 
 * 环境变量：
 * KEY: 和风天气 API Key（必填）
 * API_HOST: 你的个人API Host（必填！从控制台获取）
 * LOCATION: 城市名，如"北京"（可选，北京）
 *
 * ⚠️ 重要提示
 * 1.	公共域名已停用： devapi.qweather.com 、 api.qweather.com  等将从2026年起逐步停止服务
 * 2.	必须使用个人API Host：每个开发者账号都有独立的API Host
 * 3.	从控制台复制：登录 https://console.qweather.com/ → 设置 → 复制API Host
 */

export default async function(ctx) {
  const env = ctx.env || {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';
  const apiKey = env.KEY;
  const apiHost = env.API_HOST;  // 👈 新增：个人API Host
  const location = env.LOCATION || 'auto';

  if (!apiKey) {
    return renderError('⚠️ 请配置 KEY 环境变量');
  }
  
  if (!apiHost) {
    return renderError('⚠️ 请配置 API_HOST 环境变量\n\n获取方式：\n1. 登录和风天气控制台\n2. 进入 控制台→设置\n3. 复制你的API Host');
  }

  try {
    const { lon, lat, city } = await getLocation(ctx, location);
    const now = await fetchWeatherNow(ctx, apiKey, lon, lat, apiHost);  // 👈 传入apiHost

    let air = null;
    if (widgetFamily !== 'systemSmall') {
      air = await fetchAirNow(ctx, apiKey, lon, lat, apiHost);  // 👈 传入apiHost
    }

    if (widgetFamily === 'systemSmall') {
      return renderSmall(now, city);
    } else {
      return renderMedium(now, air, city);
    }

  } catch (e) {
    return renderError(`❌ ${e.message}`);
  }
}

// 获取位置
async function getLocation(ctx, location) {
  const locations = {
    '北京': { lon: '116.4074', lat: '39.9042' },
    '上海': { lon: '121.4737', lat: '31.2304' },
    '广州': { lon: '113.2644', lat: '23.1291' },
    '深圳': { lon: '114.0579', lat: '22.5431' },
    '海南': { lon: '110.3893', lat: '19.1959' },
    '杭州': { lon: '120.1551', lat: '30.2741' },
    '成都': { lon: '104.0665', lat: '30.5728' }
  };

  const pos = locations[location] || locations['北京'];
  return { ...pos, city: location };
}

// 获取实时天气 👈 新增 apiHost 参数
async function fetchWeatherNow(ctx, key, lon, lat, apiHost) {
  // 确保apiHost格式正确
  let host = apiHost.trim();
  if (!host.startsWith('http://') && !host.startsWith('https://')) {
    host = 'https://' + host;
  }
  host = host.replace(/\/$/, '');
  
  const url = `${host}/v7/weather/now?location=${lon},${lat}&key=${key}`;
  const resp = await ctx.http.get(url, { timeout: 8000 });
  const data = await resp.json();

  if (data.code !== '200') {
    throw new Error(data.msg || '天气获取失败');
  }

  const now = data.now;
  return {
    temp: now.temp,
    text: now.text,
    icon: now.icon,
    humidity: now.humidity,
    windDir: now.windDir,
    windScale: now.windScale,
    windSpeed: now.windSpeed
  };
}

// 获取空气质量 👈 修复：支持多种AQI字段 + 新增apiHost参数
async function fetchAirNow(ctx, key, lon, lat, apiHost) {
  // 确保apiHost格式正确
  let host = apiHost.trim();
  if (!host.startsWith('http://') && !host.startsWith('https://')) {
    host = 'https://' + host;
  }
  host = host.replace(/\/$/, '');
  
  const url = `${host}/v7/air/now?location=${lon},${lat}&key=${key}`;
  const resp = await ctx.http.get(url, { timeout: 8000 });
  const data = await resp.json();
  
  if (data.code !== '200') {
    throw new Error(data.msg || '空气质量获取失败');
  }
  
  // 👇 修复：尝试多种方式获取AQI值
  let aqiValue = '--';
  
  // 方式1: 从 indexes 数组获取（标准格式）
  if (data.indexes && data.indexes.length > 0) {
    for (let item of data.indexes) {
      if (item.aqi && !isNaN(parseInt(item.aqi))) {
        aqiValue = String(item.aqi);
        break;
      }
    }
  }
  
  // 方式2: 兼容 now.aqi（某些API版本）
  if (aqiValue === '--' && data.now?.aqi) {
    aqiValue = String(data.now.aqi);
  }
  
  // 方式3: 兼容根目录 aqi 字段
  if (aqiValue === '--' && data.aqi) {
    aqiValue = String(data.aqi);
  }
  
  return {
    aqi: aqiValue,
    category: getAQICategory(aqiValue)
  };
}

// AQI 等级
function getAQICategory(aqi) {
  const num = parseInt(aqi);
  if (isNaN(num)) return { text: '--', color: { light: '#999999', dark: '#888888' } };
  if (num <= 50) return { text: '优', color: { light: '#30D158', dark: '#34C759' } };
  if (num <= 100) return { text: '良', color: { light: '#FF9500', dark: '#FF9F0A' } };
  if (num <= 150) return { text: '轻度', color: { light: '#FF6B35', dark: '#FF7A3E' } };
  if (num <= 200) return { text: '中度', color: { light: '#FF3B30', dark: '#FF453A' } };
  return { text: '重度', color: { light: '#AF52DE', dark: '#BF5AF2' } };
}

// 图标映射
function getWeatherIcon(iconCode) {
  const map = {
    '100': 'sun.max.fill',
    '101': 'cloud.sun.fill',
    '102': 'cloud.fill',
    '103': 'cloud.sun.fill',
    '104': 'cloud.fill',
    '300': 'cloud.bolt.rain.fill',
    '301': 'cloud.rain.fill',
    '302': 'cloud.rain.fill',
    '303': 'cloud.heavyrain.fill',
    '304': 'cloud.heavyrain.fill',
    '305': 'cloud.rain.fill',
    '306': 'cloud.rain.fill',
    '307': 'cloud.heavyrain.fill',
    '308': 'cloud.heavyrain.fill',
    '309': 'cloud.rain.fill',
    '310': 'cloud.heavyrain.fill',
    '311': 'cloud.heavyrain.fill',
    '312': 'cloud.heavyrain.fill',
    '313': 'cloud.bolt.rain.fill',
    '314': 'cloud.rain.fill',
    '315': 'cloud.heavyrain.fill',
    '316': 'cloud.heavyrain.fill',
    '317': 'cloud.heavyrain.fill',
    '318': 'cloud.heavyrain.fill',
    '350': 'cloud.bolt.rain.fill',
    '351': 'cloud.bolt.rain.fill',
    '399': 'cloud.rain.fill',
    '400': 'cloud.snow.fill',
    '401': 'cloud.snow.fill',
    '402': 'cloud.snow.fill',
    '403': 'cloud.snow.fill',
    '404': 'cloud.sleet.fill',
    '405': 'cloud.sleet.fill',
    '406': 'cloud.sleet.fill',
    '407': 'cloud.sleet.fill',
    '408': 'cloud.snow.fill',
    '409': 'cloud.snow.fill',
    '410': 'cloud.snow.fill',
    '456': 'cloud.sleet.fill',
    '457': 'cloud.sleet.fill',
    '499': 'cloud.drizzle.fill',
    '500': 'cloud.fog.fill',
    '501': 'cloud.fog.fill',
    '502': 'cloud.fog.fill',
    '503': 'cloud.fog.fill',
    '504': 'cloud.fog.fill',
    '505': 'cloud.fog.fill',
    '506': 'cloud.fog.fill',
    '507': 'cloud.fog.fill',
    '508': 'cloud.fog.fill',
    '509': 'cloud.fog.fill',
    '510': 'cloud.fog.fill',
    '511': 'cloud.fog.fill',
    '512': 'cloud.fog.fill',
    '513': 'cloud.fog.fill',
    '514': 'cloud.fog.fill',
    '515': 'cloud.fog.fill',
    '800': 'wind',
    '801': 'wind',
    '802': 'wind',
    '803': 'wind',
    '804': 'wind',
    '805': 'wind',
    '806': 'wind',
    '807': 'wind',
    '900': 'thermometer.sun.fill',
    '901': 'cloud.bolt.fill',
    '999': 'exclamationmark.triangle.fill'
  };
  return map[iconCode] || 'cloud.fill';
}

// 获取天气颜色
function getWeatherColor(iconCode) {
  const code = parseInt(iconCode);
  if (code >= 100 && code <= 104) return { light: '#FF9F0A', dark: '#FFB347' };
  if (code >= 300 && code <= 399) return { light: '#007AFF', dark: '#0A84FF' };
  if (code >= 400 && code <= 499) return { light: '#5856D6', dark: '#5E5CE6' };
  if (code >= 500 && code <= 515) return { light: '#8E8E93', dark: '#98989D' };
  if (code >= 800 && code <= 807) return { light: '#5856D6', dark: '#5E5CE6' };
  return { light: '#FF9F0A', dark: '#FFB347' };
}

// 小尺寸渲染
function renderSmall(now, city) {
  const icon = getWeatherIcon(now.icon);
  const color = getWeatherColor(now.icon);
  const nowTime = new Date();
  const timeStr = `${nowTime.getHours()}:${String(nowTime.getMinutes()).padStart(2, '0')}`;

  return {
    type: 'widget',
    padding: [14, 14, 14, 14],
    gap: 8,
    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        children: [
          {
            type: 'text',
            text: `📍 ${city}`,
            font: { size: 'caption1', weight: 'bold' },
            textColor: { light: '#1A1A1A', dark: '#FFFFFF' }
          },
          {
            type: 'text',
            text: timeStr,
            font: { size: 'caption2' },
            textColor: { light: '#999999', dark: '#888888' }
          }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 10,
        children: [
          {
            type: 'image',
            src: `sf-symbol:${icon}`,
            width: 42,
            height: 42,
            color: color
          },
          {
            type: 'stack',
            direction: 'column',
            children: [
              {
                type: 'text',
                text: `${now.temp}°`,
                font: { size: 'title', weight: 'bold' },
                textColor: { light: '#1A1A1A', dark: '#FFFFFF' }
              },
              {
                type: 'text',
                text: now.text,
                font: { size: 'caption1' },
                textColor: { light: '#666666', dark: '#CCCCCC' }
              }
            ]
          }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        gap: 12,
        children: [
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 4,
            children: [
              {
                type: 'image',
                src: 'sf-symbol:drop.fill',
                width: 12,
                height: 12,
                color: { light: '#007AFF', dark: '#0A84FF' }
              },
              {
                type: 'text',
                text: `${now.humidity}%`,
                font: { size: 'caption2', weight: 'medium' },
                textColor: { light: '#666666', dark: '#CCCCCC' }
              }
            ]
          },
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 4,
            children: [
              {
                type: 'image',
                src: 'sf-symbol:wind',
                width: 12,
                height: 12,
                color: { light: '#5856D6', dark: '#5E5CE6' }
              },
              {
                type: 'text',
                text: `${now.windDir} ${now.windScale}级`,
                font: { size: 'caption2', weight: 'medium' },
                textColor: { light: '#666666', dark: '#CCCCCC' }
              }
            ]
          }
        ]
      }
    ]
  };
}

// 中尺寸渲染
function renderMedium(now, air, city) {
  const icon = getWeatherIcon(now.icon);
  const color = getWeatherColor(now.icon);
  const aqiColor = air ? getAQICategory(air.aqi).color : { light: '#999999', dark: '#888888' };
  const aqiText = air ? air.category.text : '--';
  const nowTime = new Date();
  const timeStr = `${nowTime.getMonth()+1}/${nowTime.getDate()} ${nowTime.getHours()}:${String(nowTime.getMinutes()).padStart(2, '0')}`;

  return {
    type: 'widget',
    padding: [16, 16, 16, 16],
    gap: 10,
    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
    children: [
      // 标题行
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        children: [
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 6,
            children: [
              {
                type: 'image',
                src: 'sf-symbol:location.fill',
                width: 14,
                height: 14,
                color: { light: '#FF3B30', dark: '#FF453A' }
              },
              {
                type: 'text',
                text: city,
                font: { size: 'title3', weight: 'bold' },
                textColor: { light: '#1A1A1A', dark: '#FFFFFF' }
              }
            ]
          },
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 8,
            children: [
              {
                type: 'text',
                text: `AQI ${air?.aqi || '--'}`,
                font: { size: 'caption1', weight: 'semibold' },
                textColor: aqiColor
              },
              {
                type: 'text',
                text: timeStr,
                font: { size: 'caption2' },
                textColor: { light: '#999999', dark: '#888888' }
              }
            ]
          }
        ]
      },

      // 主内容区
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 12,
        children: [
          {
            type: 'image',
            src: `sf-symbol:${icon}`,
            width: 56,
            height: 56,
            color: color
          },
          {
            type: 'stack',
            direction: 'column',
            flex: 1,
            children: [
              {
                type: 'text',
                text: `${now.temp}°C`,
                font: { size: 'largeTitle', weight: 'bold' },
                textColor: { light: '#1A1A1A', dark: '#FFFFFF' }
              },
              {
                type: 'text',
                text: now.text,
                font: { size: 'title3', weight: 'medium' },
                textColor: { light: '#666666', dark: '#CCCCCC' }
              }
            ]
          },
          {
            type: 'stack',
            direction: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            children: [
              {
                type: 'text',
                text: '空气质量',
                font: { size: 'caption2' },
                textColor: { light: '#666666', dark: '#CCCCCC' }
              },
              {
                type: 'text',
                text: aqiText,
                font: { size: 'title3', weight: 'bold' },
                textColor: aqiColor
              }
            ]
          }
        ]
      },

      // 详细数据
      {
        type: 'stack',
        direction: 'row',
        gap: 16,
        children: [
          // 湿度
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            flex: 1,
            gap: 8,
            children: [
              {
                type: 'image',
                src: 'sf-symbol:drop.fill',
                width: 18,
                height: 18,
                color: { light: '#007AFF', dark: '#0A84FF' }
              },
              {
                type: 'stack',
                direction: 'column',
                children: [
                  {
                    type: 'text',
                    text: '湿度',
                    font: { size: 'caption2' },
                    textColor: { light: '#999999', dark: '#888888' }
                  },
                  {
                    type: 'text',
                    text: `${now.humidity}%`,
                    font: { size: 'title3', weight: 'semibold' },
                    textColor: { light: '#1A1A1A', dark: '#FFFFFF' }
                  }
                ]
              }
            ]
          },

          // 风力
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            flex: 1,
            gap: 8,
            children: [
              {
                type: 'image',
                src: 'sf-symbol:wind',
                width: 18,
                height: 18,
                color: { light: '#5856D6', dark: '#5E5CE6' }
              },
              {
                type: 'stack',
                direction: 'column',
                children: [
                  {
                    type: 'text',
                    text: '风力',
                    font: { size: 'caption2' },
                    textColor: { light: '#999999', dark: '#888888' }
                  },
                  {
                    type: 'text',
                    text: `${now.windDir} ${now.windScale}级`,
                    font: { size: 'title3', weight: 'semibold' },
                    textColor: { light: '#1A1A1A', dark: '#FFFFFF' }
                  }
                ]
              }
            ]
          },

          // 风速
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            flex: 1,
            gap: 8,
            children: [
              {
                type: 'image',
                src: 'sf-symbol:gauge.medium',
                width: 18,
                height: 18,
                color: { light: '#FF9500', dark: '#FF9F0A' }
              },
              {
                type: 'stack',
                direction: 'column',
                children: [
                  {
                    type: 'text',
                    text: '风速',
                    font: { size: 'caption2' },
                    textColor: { light: '#999999', dark: '#888888' }
                  },
                  {
                    type: 'text',
                    text: `${now.windSpeed}km/h`,
                    font: { size: 'title3', weight: 'semibold' },
                    textColor: { light: '#1A1A1A', dark: '#FFFFFF' }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

// 错误渲染
function renderError(msg) {
  return {
    type: 'widget',
    padding: 16,
    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
    children: [{
      type: 'stack',
      direction: 'column',
      alignItems: 'center',
      gap: 8,
      children: [
        {
          type: 'image',
          src: 'sf-symbol:exclamationmark.triangle.fill',
          width: 28,
          height: 28,
          color: { light: '#FF3B30', dark: '#FF453A' }
        },
        {
          type: 'text',
          text: msg,
          font: { size: 'body' },
          textColor: { light: '#FF3B30', dark: '#FF453A' },
          textAlign: 'center'
        }
      ]
    }]
  };
}

