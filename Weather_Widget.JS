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
            gap: 4,
            children: [
              { type: 'image', src: 'sf-symbol:location.fill', width: 14, height: 14, color: { light: '#FF3B30', dark: '#FF453A' } },
              { type: 'text', text: city, font: { size: 18, weight: 'bold' }, textColor: { light: '#000', dark: '#FFF' } }
            ]
          },
          { type: 'spacer' },
          {
            type: 'text',
            text: `AQI ${air.aqi}`,
            font: { size: 14, weight: 'semibold' },
            textColor: aqiColor
          },
          { type: 'text', text: timeStr, font: { size: 11 }, textColor: { light: '#8E8E93', dark: '#8E8E93' } }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 16,
        children: [
          { type: 'image', src: `sf-symbol:${icon}`, width: 68, height: 68, color: iconColor },
          {
            type: 'stack',
            direction: 'column',
            flex: 1,
            gap: 2,
            children: [
              { type: 'text', text: `${now.temp}°C`, font: { size: 36, weight: 'bold' }, textColor: { light: '#000', dark: '#FFF' } },
              { type: 'text', text: now.text, font: { size: 18 }, textColor: { light: '#444', dark: '#CCC' } }
            ]
          },
          {
            type: 'stack',
            direction: 'column',
            alignItems: 'center',
            gap: 2,
            children: [
              { type: 'text', text: '空气', font: { size: 11 }, textColor: { light: '#666', dark: '#AAA' } },
              { type: 'text', text: air.category, font: { size: 18, weight: 'bold' }, textColor: aqiColor }
            ]
          }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        gap: 10,
        children: [
          createInfoItem('drop.fill',   '湿度', `${now.humidity}%`, '#007AFF'),
          createInfoItem('wind',        '风向', `${now.windDir} ${now.windScale}级`, '#5856D6'),
          createInfoItem('gauge.medium','风速', `${now.windSpeed}km/h`, '#FF9500')
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
    gap: 5,
    children: [
      { type: 'image', src: `sf-symbol:${icon}`, width: 20, height: 20, color: { light: iconColor, dark: iconColor } },
      {
        type: 'stack',
        direction: 'column',
        children: [
          { type: 'text', text: label, font: { size: 10 }, textColor: { light: '#666', dark: '#AAA' } },
          { type: 'text', text: value, font: { size: 15, weight: 'semibold' }, textColor: { light: '#000', dark: '#FFF' }, lineLimit: 1 }
        ]
      }
    ]
  };
}

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
    // ──  海南省 (全省) ──
    '海口': { lon: '110.3288', lat: '20.0310' }, '三亚': { lon: '109.5119', lat: '18.2528' },
    '儋州': { lon: '109.5768', lat: '19.5209' }, '琼海': { lon: '110.4746', lat: '19.2584' },
    '万宁': { lon: '110.3893', lat: '18.7953' }, '文昌': { lon: '110.7530', lat: '19.6129' },
    '东方': { lon: '108.6536', lat: '19.1017' }, '五指山': { lon: '109.5169', lat: '18.7752' },
    '陵水': { lon: '110.0372', lat: '18.5050' }, '保亭': { lon: '109.7026', lat: '18.6390' },
    '屯昌': { lon: '110.1029', lat: '19.3638' }, '澄迈': { lon: '110.0073', lat: '19.7364' },
    '临高': { lon: '109.6877', lat: '19.9084' }, '定安': { lon: '110.3593', lat: '19.6849' },
    '乐东': { lon: '109.1717', lat: '18.7478' }, '昌江': { lon: '109.0556', lat: '19.2983' },
    '白沙': { lon: '109.4515', lat: '19.2240' }, '琼中': { lon: '109.8335', lat: '18.9982' },

    // ──  广东省 (21地级市) ──
    '广州': { lon: '113.2644', lat: '23.1291' }, '深圳': { lon: '114.0579', lat: '22.5431' },
    '珠海': { lon: '113.5767', lat: '22.2707' }, '汕头': { lon: '116.6813', lat: '23.3540' },
    '佛山': { lon: '113.1214', lat: '23.0215' }, '韶关': { lon: '113.5975', lat: '24.8104' },
    '湛江': { lon: '110.3593', lat: '21.2707' }, '肇庆': { lon: '112.4725', lat: '23.0515' },
    '江门': { lon: '113.0816', lat: '22.5787' }, '茂名': { lon: '110.9254', lat: '21.6629' },
    '惠州': { lon: '114.4161', lat: '23.1107' }, '梅州': { lon: '116.1225', lat: '24.2886' },
    '汕尾': { lon: '115.3752', lat: '22.7862' }, '河源': { lon: '114.7001', lat: '23.7337' },
    '阳江': { lon: '111.9826', lat: '21.8579' }, '清远': { lon: '113.0560', lat: '23.6817' },
    '东莞': { lon: '113.7517', lat: '23.0206' }, '中山': { lon: '113.3927', lat: '22.5170' },
    '潮州': { lon: '116.6226', lat: '23.6569' }, '揭阳': { lon: '116.3728', lat: '23.5497' },
    '云浮': { lon: '112.0444', lat: '22.9150' },

    // ──  全国热门城市 (50个) ──
    '北京': { lon: '116.4074', lat: '39.9042' }, '上海': { lon: '121.4737', lat: '31.2304' },
    '天津': { lon: '117.2008', lat: '39.0842' }, '重庆': { lon: '106.5049', lat: '29.5630' },
    '香港': { lon: '114.1733', lat: '22.3200' }, '澳门': { lon: '113.5491', lat: '22.1987' },
    '台北': { lon: '121.5090', lat: '25.0443' }, '杭州': { lon: '120.1551', lat: '30.2741' },
    '南京': { lon: '118.7674', lat: '32.0415' }, '苏州': { lon: '120.5853', lat: '31.2989' },
    '武汉': { lon: '114.2986', lat: '30.5844' }, '成都': { lon: '104.0657', lat: '30.6595' },
    '西安': { lon: '108.9480', lat: '34.2632' }, '长沙': { lon: '112.9388', lat: '28.2282' },
    '郑州': { lon: '113.6654', lat: '34.7579' }, '合肥': { lon: '117.2272', lat: '31.8206' },
    '南昌': { lon: '115.8582', lat: '28.6829' }, '济南': { lon: '117.0009', lat: '36.6758' },
    '青岛': { lon: '120.3826', lat: '36.0671' }, '福州': { lon: '119.3062', lat: '26.0753' },
    '厦门': { lon: '118.0894', lat: '24.4798' }, '南宁': { lon: '108.3200', lat: '22.8240' },
    '桂林': { lon: '110.2902', lat: '25.2736' }, '贵阳': { lon: '106.7135', lat: '26.5783' },
    '昆明': { lon: '102.8329', lat: '25.0406' }, '大理': { lon: '100.2246', lat: '25.5916' },
    '丽江': { lon: '100.2330', lat: '26.8721' }, '拉萨': { lon: '91.1322', lat: '29.6604' },
    '沈阳': { lon: '123.4315', lat: '41.8057' }, '大连': { lon: '121.6147', lat: '38.9140' },
    '长春': { lon: '125.3235', lat: '43.8171' }, '哈尔滨': { lon: '126.5350', lat: '45.8038' },
    '石家庄': { lon: '114.5148', lat: '38.0423' }, '太原': { lon: '112.5488', lat: '37.8706' },
    '呼和浩特': { lon: '111.6708', lat: '40.8183' }, '兰州': { lon: '103.8236', lat: '36.0581' },
    '西宁': { lon: '101.7789', lat: '36.6231' }, '银川': { lon: '106.2781', lat: '38.4664' },
    '乌鲁木齐': { lon: '87.6177', lat: '43.7928' }, '宁波': { lon: '121.5440', lat: '29.8683' },
    '无锡': { lon: '120.3016', lat: '31.5747' }, '常州': { lon: '119.9469', lat: '31.7727' },
    '徐州': { lon: '117.1848', lat: '34.2617' }, '扬州': { lon: '119.4129', lat: '32.3942' },
    '金华': { lon: '119.6495', lat: '29.0895' }, '台州': { lon: '121.4286', lat: '28.6613' },
    '温州': { lon: '120.6721', lat: '28.0005' }, '绍兴': { lon: '120.5821', lat: '29.9971' },
    '泉州': { lon: '118.5894', lat: '24.9088' }, '洛阳': { lon: '112.4344', lat: '34.6630' }
  };

  if (presets[locName]) return { ...presets[locName], city: locName };

  try {
    const url = `${host}/geo/v2/city/lookup?location=${encodeURIComponent(locName)}&key=${key}&number=1&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 6000 });
    const data = await resp.json();
    if (data.code === '200' && data.location?.[0]) {
      const loc = data.location[0];
      return { lon: loc.lon, lat: loc.lat, city: loc.name || locName };
    }
  } catch {}
  return { lon: '116.4074', lat: '39.9042', city: locName || '北京' };
}

async function fetchWeatherNow(ctx, key, lon, lat, host) {
  const url = `${host}/v7/weather/now?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url, { timeout: 8000 });
  const data = await resp.json();
  if (data.code !== '200') throw new Error(data.msg || `接口返回 ${data.code}`);
  return {
    temp: data.now.temp,
    text: data.now.text,
    icon: data.now.icon,
    humidity: data.now.humidity,
    windDir: data.now.windDir || '--',
    windScale: data.now.windScale || '--',
    windSpeed: data.now.windSpeed || '--'
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
      aqiData = { aqi: Math.round(Number(cnMee.aqi)), category: cnMee.category || getAQICategory(cnMee.aqi).text, color: getAQICategory(cnMee.aqi).color };
    }
  } catch (e) {}
  return aqiData || { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
}

function getAQICategory(val) {
  const n = Number(val);
  if (isNaN(n)) return { text: '--', color: { light: '#999999', dark: '#888888' } };
  if (n <=  50) return { text: '优', color: { light: '#4CD964', dark: '#34C759' } };
  if (n <= 100) return { text: '良', color: { light: '#FFCC00', dark: '#FF9F0A' } };
  return { text: '轻度', color: { light: '#FF9500', dark: '#FF9500' } };
}

function getWeatherIcon(code) {
  const map = { '100': 'sun.max.fill', '101': 'cloud.sun.fill', '104': 'cloud.fill', '305': 'cloud.rain.fill' };
  return map[code] || 'cloud.fill';
}

function getWeatherColor(code) {
  const n = Number(code);
  if (n >= 100 && n <= 104) return { light: '#FF9500', dark: '#FFB340' };
  return { light: '#007AFF', dark: '#0A84FF' };
}

function renderSmall(now, city) {
  const icon = getWeatherIcon(now.icon);
  return {
    type: 'widget',
    padding: 14,
    backgroundColor: { light: '#FFFFFF', dark: '#000000' },
    children: [
      { type: 'text', text: city, font: { size: 14, weight: 'bold' } },
      { type: 'image', src: `sf-symbol:${icon}`, width: 34, height: 34 },
      { type: 'text', text: `${now.temp}°`, font: { size: 28, weight: 'bold' } }
    ]
  };
}

function renderAccessoryCompact(now, city, family) {
  return { type: 'widget', children: [{ type: 'text', text: `${now.temp}° ${city}` }] };
}

function renderError(msg) {
  return { type: 'widget', padding: 16, children: [{ type: 'text', text: msg, textColor: { light: '#FF3B30', dark: '#FF453A' } }] };
}
