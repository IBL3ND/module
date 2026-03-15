/**
 * 🌤️ 和风天气 - Egern 小组件
 *
 * ⚠️ 重要提示
 * 环境变量：
 * KEY: 和风天气 API Key（必填）
 * API_HOST: 你的个人API Host（必填！从控制台获取）
 * LOCATION: 城市名，如"北京" （支持预设城市自动经纬度，非预设城市会尝试 geo 查询）
 *
 * ⚠️ 重要提示
 * 公共域名已停用： devapi.qweather.com 、 api.qweather.com  等将从2026年起逐步停止服务
 * 必须使用个人API Host：每个开发者账号都有独立的API Host
 * 从控制台复制：登录 https://console.qweather.com/ → 设置 → 复制API Host
 *
 */

export default async function(ctx) {
  const env = ctx.env || {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  // 防御性获取环境变量
  const apiKey     = (env.KEY || '').trim();
  const apiHostRaw = (env.API_HOST || '').trim();
  const location   = (env.LOCATION || '北京').trim();

  if (!apiKey)     return renderError('缺少 KEY 环境变量');
  if (!apiHostRaw) return renderError('缺少 API_HOST 环境变量');

  const apiHost = normalizeHost(apiHostRaw);

  try {
    const { lon, lat, city } = await getLocation(ctx, location, apiKey, apiHost);
    const now = await fetchWeatherNow(ctx, apiKey, lon, lat, apiHost);

    let air = null;
    if (widgetFamily !== 'systemSmall' && !isAccessoryFamily(widgetFamily)) {
      air = await fetchAirQuality(ctx, apiKey, lon, lat, apiHost);
    }

    if (isAccessoryFamily(widgetFamily)) {
      return renderAccessoryCompact(now, city, widgetFamily);
    }

    if (widgetFamily === 'systemSmall') {
      return renderSmall(now, city);
    } else {
      return renderMedium(now, air, city);
    }

  } catch (e) {
    console.error(e);
    return renderError(`请求失败：${e.message.slice(0, 60)}`);
  }
}

// ────────────────────────────────────────────────
// 辅助函数（不变）
// ────────────────────────────────────────────────

function normalizeHost(host) {
  let h = host;
  if (!/^https?:\/\//i.test(h)) h = 'https://' + h;
  return h.replace(/\/+$/, '');
}

function isAccessoryFamily(family) {
  return family.startsWith('accessory');
}

async function getLocation(ctx, locName, key, host) {
  const presets = {
    // ── 海南省 ──
    '海口':       { lon: '110.3288', lat: '20.0310' },
    '三亚':       { lon: '109.5119', lat: '18.2528' },
    '儋州':       { lon: '109.5768', lat: '19.5209' },
    '琼海':       { lon: '110.4746', lat: '19.2584' },
    '万宁':       { lon: '110.3893', lat: '18.7953' },
    '文昌':       { lon: '110.7530', lat: '19.6129' },
    '东方':       { lon: '108.6536', lat: '19.1017' },
    '五指山':     { lon: '109.5169', lat: '18.7752' },
    '陵水':       { lon: '110.0372', lat: '18.5050' },
    '保亭':       { lon: '109.7026', lat: '18.6390' },
    '屯昌':       { lon: '110.1029', lat: '19.3638' },
    '澄迈':       { lon: '110.0073', lat: '19.7364' },
    '临高':       { lon: '109.6877', lat: '19.9084' },
    '定安':       { lon: '110.3593', lat: '19.6849' },
    '乐东':       { lon: '109.1717', lat: '18.7478' },
    '昌江':       { lon: '109.0556', lat: '19.2983' },
    '白沙':       { lon: '109.4515', lat: '19.2240' },
    '琼中':       { lon: '109.8335', lat: '18.9982' },

    // ── 其他热门城市 ──
    '北京':       { lon: '116.4074', lat: '39.9042' },
    '上海':       { lon: '121.4737', lat: '31.2304' },
    '广州':       { lon: '113.2644', lat: '23.1291' },
    '深圳':       { lon: '114.0579', lat: '22.5431' },
    '杭州':       { lon: '120.1551', lat: '30.2741' },
    '成都':       { lon: '104.0657', lat: '30.6595' },
    '重庆':       { lon: '106.5049', lat: '29.5630' },
    '武汉':       { lon: '114.2986', lat: '30.5844' },
    '西安':       { lon: '108.9480', lat: '34.2632' },
    '南京':       { lon: '118.7674', lat: '32.0415' },
    '天津':       { lon: '117.2008', lat: '39.0842' },
    '苏州':       { lon: '120.5853', lat: '31.2989' },
    '青岛':       { lon: '120.3826', lat: '36.0671' },
    '厦门':       { lon: '118.0894', lat: '24.4798' },
    '长沙':       { lon: '112.9388', lat: '28.2282' },
    '郑州':       { lon: '113.6654', lat: '34.7579' },
    '沈阳':       { lon: '123.4315', lat: '41.8057' },
    '大连':       { lon: '121.6147', lat: '38.9140' },
    '昆明':       { lon: '102.8329', lat: '25.0406' },
    '哈尔滨':     { lon: '126.5350', lat: '45.8038' },
    '济南':       { lon: '117.0009', lat: '36.6758' },
    '合肥':       { lon: '117.2272', lat: '31.8206' },
    '福州':       { lon: '119.3062', lat: '26.0753' },
  };

  if (presets[locName]) {
    return { ...presets[locName], city: locName };
  }

  try {
    const url = `${host}/geo/v2/city/lookup?location=${encodeURIComponent(locName)}&key=${key}&number=1&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 6000 });
    const data = await resp.json();

    if (data.code === '200' && data.location?.[0]) {
      const loc = data.location[0];
      return {
        lon: loc.lon,
        lat: loc.lat,
        city: loc.name || locName
      };
    }
  } catch {}

  return { lon: '116.4074', lat: '39.9042', city: locName || '北京' };
}

async function fetchWeatherNow(ctx, key, lon, lat, host) {
  const url = `${host}/v7/weather/now?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url, { timeout: 8000 });
  const data = await resp.json();

  if (data.code !== '200') {
    throw new Error(data.msg || `天气接口返回 ${data.code}`);
  }

  const now = data.now;
  return {
    temp: now.temp,
    text: now.text,
    icon: now.icon,
    humidity: now.humidity,
    windDir: now.windDir || '--',
    windScale: now.windScale || '--',
    windSpeed: now.windSpeed || '--'
  };
}

async function fetchAirQuality(ctx, key, lon, lat, host) {
  let aqiData = null;

  try {
    const url = `${host}/airquality/v1/current/${lat}/${lon}?key=${key}&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 7000 });
    const data = await resp.json();

    if (data.indexes && data.indexes.length > 0) {
      const cnMee = data.indexes.find(i => i.code === 'cn-mee') || data.indexes[0];
      if (cnMee?.aqi != null) {
        aqiData = {
          aqi: Math.round(Number(cnMee.aqi)),
          category: cnMee.category || getAQICategory(cnMee.aqi).text,
          color: getAQICategory(cnMee.aqi).color
        };
      }
    }
  } catch (e) {}

  if (!aqiData) {
    try {
      const url = `${host}/v7/air/now?location=${lon},${lat}&key=${key}&lang=zh`;
      const resp = await ctx.http.get(url, { timeout: 7000 });
      const data = await resp.json();
      if (data.code === '200' && data.now?.aqi) {
        const val = Number(data.now.aqi);
        aqiData = {
          aqi: Math.round(val),
          category: data.now.category || getAQICategory(val).text,
          color: getAQICategory(val).color
        };
      }
    } catch {}
  }

  return aqiData || { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
}

function getAQICategory(val) {
  const n = Number(val);
  if (isNaN(n)) return { text: '--', color: { light: '#999999', dark: '#888888' } };
  if (n <=  50) return { text: '优',   color: { light: '#4CD964', dark: '#34C759' } };
  if (n <= 100) return { text: '良',   color: { light: '#FFCC00', dark: '#FF9F0A' } };
  if (n <= 150) return { text: '轻度污染', color: { light: '#FF9500', dark: '#FF9500' } };
  if (n <= 200) return { text: '中度污染', color: { light: '#FF3B30', dark: '#FF453A' } };
  if (n <= 300) return { text: '重度污染', color: { light: '#AF52DE', dark: '#BF5AF2' } };
  return               { text: '严重污染', color: { light: '#8E3C9E', dark: '#9F5FC9' } };
}

function getWeatherIcon(code) {
  const map = {
    '100': 'sun.max.fill',     '101': 'cloud.sun.fill',   '102': 'cloud.fill',
    '103': 'cloud.sun.fill',   '104': 'cloud.fill',
    '300': 'cloud.drizzle.fill','301': 'cloud.drizzle.fill','302': 'cloud.sun.rain.fill',
    '303': 'cloud.heavyrain.fill','305': 'cloud.rain.fill','306': 'cloud.rain.fill',
    '307': 'cloud.heavyrain.fill','308': 'cloud.heavyrain.fill','309': 'cloud.rain.fill',
    '310': 'cloud.heavyrain.fill','311': 'cloud.heavyrain.fill','312': 'cloud.heavyrain.fill',
    '313': 'cloud.bolt.rain.fill',
    '400': 'snowflake', '401': 'snowflake', '402': 'snowflake', '403': 'snowflake',
    '404': 'cloud.sleet.fill', '405': 'cloud.sleet.fill', '406': 'cloud.sleet.fill', '407': 'cloud.sleet.fill',
    '500': 'cloud.fog.fill', '501': 'cloud.fog.fill', '502': 'cloud.fog.fill',
    '503': 'cloud.fog.fill', '504': 'cloud.fog.fill', '507': 'cloud.fog.fill', '508': 'cloud.fog.fill',
    '800': 'wind', '801': 'wind', '802': 'wind', '803': 'wind', '804': 'wind'
  };
  return map[code] || 'cloud.fill';
}

function getWeatherColor(code) {
  const n = Number(code);
  if (n >= 100 && n <= 104) return { light: '#FF9500', dark: '#FFB340' };
  if (n >= 300 && n <= 399) return { light: '#007AFF', dark: '#0A84FF' };
  if (n >= 400 && n <= 499) return { light: '#5856D6', dark: '#5E5CE6' };
  if (n >= 500 && n <= 515) return { light: '#8E8E93', dark: '#98989D' };
  return { light: '#FF9500', dark: '#FFB340' };
}

// ────────────────────────────────────────────────
// 渲染函数（已改为纯白/纯黑背景）
// ────────────────────────────────────────────────

function renderSmall(now, city) {
  const icon = getWeatherIcon(now.icon);
  const color = getWeatherColor(now.icon);
  const time = new Date();
  const timeStr = `${time.getHours()}:${String(time.getMinutes()).padStart(2,'0')}`;

  return {
    type: 'widget',
    padding: 14,
    gap: 6,
    backgroundColor: { light: '#FFFFFF', dark: '#000000' },
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 8,
        children: [
          { type: 'text', text: city, font: { size: 'caption1', weight: 'bold' }, textColor: { light: '#000', dark: '#FFF' } },
          { type: 'spacer' },
          { type: 'text', text: timeStr, font: { size: 'caption2' }, textColor: { light: '#8E8E93', dark: '#8E8E93' } }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 10,
        children: [
          { type: 'image', src: `sf-symbol:${icon}`, width: 40, height: 40, color },
          {
            type: 'stack',
            direction: 'column',
            children: [
              { type: 'text', text: `${now.temp}°`, font: { size: 'title2', weight: 'bold' }, textColor: { light: '#000', dark: '#FFF' } },
              { type: 'text', text: now.text, font: { size: 'caption1' }, textColor: { light: '#666', dark: '#AAA' } }
            ]
          }
        ]
      }
    ]
  };
}

function renderMedium(now, air, city) {
  const icon = getWeatherIcon(now.icon);
  const iconColor = getWeatherColor(now.icon);
  const aqiColor = air.color;
  const time = new Date();
  const timeStr = `${time.getMonth()+1}/${time.getDate()} ${time.getHours()}:${String(time.getMinutes()).padStart(2,'0')}`;

  return {
    type: 'widget',
    padding: 16,
    gap: 12,
    backgroundColor: { light: '#FFFFFF', dark: '#2C2C2E' },
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 8,
        children: [
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 6,
            children: [
              { type: 'image', src: 'sf-symbol:location.fill', width: 14, height: 14, color: { light: '#FF3B30', dark: '#FF453A' } },
              { type: 'text', text: city, font: { size: 'title3', weight: 'bold' }, textColor: { light: '#000', dark: '#FFF' } }
            ]
          },
          { type: 'spacer' },
          {
            type: 'text',
            text: `AQI ${air.aqi}`,
            font: { size: 'caption1', weight: 'semibold' },
            textColor: aqiColor
          },
          { type: 'text', text: timeStr, font: { size: 'caption2' }, textColor: { light: '#8E8E93', dark: '#8E8E93' } }
        ]
      },

      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 16,
        children: [
          { type: 'image', src: `sf-symbol:${icon}`, width: 64, height: 64, color: iconColor },

          {
            type: 'stack',
            direction: 'column',
            flex: 1,
            gap: 4,
            children: [
              { type: 'text', text: `${now.temp}°C`, font: { size: 'largeTitle', weight: 'bold' }, textColor: { light: '#000', dark: '#FFF' } },
              { type: 'text', text: now.text, font: { size: 'title3' }, textColor: { light: '#444', dark: '#CCC' } }
            ]
          },

          {
            type: 'stack',
            direction: 'column',
            alignItems: 'center',
            gap: 2,
            children: [
              { type: 'text', text: '空气', font: { size: 'caption2' }, textColor: { light: '#666', dark: '#AAA' } },
              { type: 'text', text: air.category, font: { size: 'title3', weight: 'bold' }, textColor: aqiColor }
            ]
          }
        ]
      },

      {
        type: 'stack',
        direction: 'row',
        gap: 12,
        children: [
          createInfoItem('drop.fill',   '湿度',   `${now.humidity}%`,   '#007AFF'),
          createInfoItem('wind',        '风力',   `${now.windDir} ${now.windScale}级`, '#5856D6'),
          createInfoItem('gauge.medium','风速',   `${now.windSpeed}km/h`,'#FF9500')
        ]
      }
    ]
  };
}

function createInfoItem(icon, label, value, iconColor) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    children: [
      { type: 'image', src: `sf-symbol:${icon}`, width: 20, height: 20, color: { light: iconColor, dark: iconColor } },
      {
        type: 'stack',
        direction: 'column',
        children: [
          { type: 'text', text: label, font: { size: 'caption2' }, textColor: { light: '#666', dark: '#AAA' } },
          { type: 'text', text: value,  font: { size: 'title3', weight: 'semibold' }, textColor: { light: '#000', dark: '#FFF' } }
        ]
      }
    ]
  };
}

function renderAccessoryCompact(now, city, family) {
  const icon = getWeatherIcon(now.icon);
  return {
    type: 'widget',
    padding: 8,
    backgroundColor: { light: '#FFFFFF', dark: '#000000' },
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          { type: 'image', src: `sf-symbol:${icon}`, width: 24, height: 24, color: getWeatherColor(now.icon) },
          { type: 'text', text: `${now.temp}° ${city.slice(0,4)}`, font: { size: family === 'accessoryInline' ? 'footnote' : 'subheadline' }, textColor: { light: '#000', dark: '#FFF' } }
        ]
      }
    ]
  };
}

function renderError(msg) {
  return {
    type: 'widget',
    padding: 16,
    backgroundColor: { light: '#FFFFFF', dark: '#000000' },
    children: [
      {
        type: 'stack',
        direction: 'column',
        alignItems: 'center',
        gap: 8,
        children: [
          { type: 'image', src: 'sf-symbol:exclamationmark.triangle.fill', width: 32, height: 32, color: { light: '#FF3B30', dark: '#FF453A' } },
          { type: 'text', text: msg, font: { size: 'body' }, textColor: { light: '#FF3B30', dark: '#FF453A' }, textAlign: 'center' }
        ]
      }
    ]
  };
}