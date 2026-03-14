/**
 * 🌤️ 和风天气 - Egern 小组件 测试版
 * 
 * 环境变量：
 * KEY: 和风天气 API Key（必填）
 * LOCATION: 城市名（用于查经纬度）
 * API_HOST: 专属域名（必填）
 */

export default async function(ctx) {
  const env = ctx.env || {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';
  const apiKey = env.KEY;
  const location = env.LOCATION || '北京';
  const apiHost = env.API_HOST;

  if (!apiKey) {
    return renderError('⚠️ 请配置 KEY 环境变量');
  }
  
  if (!apiHost) {
    return renderError('⚠️ 请配置 API_HOST 环境变量');
  }

  try {
    const host = normalizeHost(apiHost);
    const { lon, lat, city } = await getLocation(ctx, location, apiKey, host);
    const now = await fetchWeatherNow(ctx, apiKey, lon, lat, host);

    let air = null;
    if (widgetFamily !== 'systemSmall') {
      air = await fetchAirQuality(ctx, apiKey, lon, lat, host);
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

function normalizeHost(host) {
  let h = (host || '').trim();
  if (!h.startsWith('http://') && !h.startsWith('https://')) {
    h = 'https://' + h;
  }
  return h.replace(/\/$/, '');
}

async function getLocation(ctx, location, apiKey, apiHost) {
  const presetLocations = {
    '北京': { lon: '116.4074', lat: '39.9042' },
    '上海': { lon: '121.4737', lat: '31.2304' },
    '天津': { lon: '117.2008', lat: '39.0842' },
    '重庆': { lon: '106.5516', lat: '29.5630' },
    '广州': { lon: '113.2644', lat: '23.1291' },
    '深圳': { lon: '114.0579', lat: '22.5431' },
    '杭州': { lon: '120.1551', lat: '30.2741' },
    '成都': { lon: '104.0665', lat: '30.5728' },
    '武汉': { lon: '114.3055', lat: '30.5931' },
    '西安': { lon: '108.9398', lat: '34.3416' },
    '南京': { lon: '118.7969', lat: '32.0603' },
    '长沙': { lon: '112.9388', lat: '28.2282' },
    '郑州': { lon: '113.6654', lat: '34.7579' },
    '济南': { lon: '117.0009', lat: '36.6758' },
    '福州': { lon: '119.3062', lat: '26.0753' },
    '合肥': { lon: '117.2272', lat: '31.8206' },
    '南昌': { lon: '115.8581', lat: '28.6829' },
    '昆明': { lon: '102.8329', lat: '25.0406' },
    '贵阳': { lon: '106.6302', lat: '26.6477' },
    '南宁': { lon: '108.3665', lat: '22.8170' },
    '海口': { lon: '110.1989', lat: '20.0440' },
    '哈尔滨': { lon: '126.5350', lat: '45.8038' },
    '长春': { lon: '125.3235', lat: '43.8171' },
    '沈阳': { lon: '123.4315', lat: '41.8057' },
    '石家庄': { lon: '114.5149', lat: '38.0428' },
    '太原': { lon: '112.5489', lat: '37.8706' },
    '兰州': { lon: '103.8343', lat: '36.0611' },
    '西宁': { lon: '101.7782', lat: '36.6231' },
    '银川': { lon: '106.2309', lat: '38.4872' },
    '乌鲁木齐': { lon: '87.6168', lat: '43.8256' },
    '拉萨': { lon: '91.1409', lat: '29.6456' },
    '呼和浩特': { lon: '111.7492', lat: '40.8414' },
    '青岛': { lon: '120.3826', lat: '36.0671' },
    '厦门': { lon: '118.0894', lat: '24.4798' },
    '宁波': { lon: '121.5440', lat: '29.8683' },
    '大连': { lon: '121.6147', lat: '38.9140' },
    '无锡': { lon: '120.3119', lat: '31.4912' },
    '苏州': { lon: '120.5853', lat: '31.2989' },
    '东莞': { lon: '113.7518', lat: '23.0205' },
    '佛山': { lon: '113.1228', lat: '23.0218' },
    '温州': { lon: '120.6994', lat: '28.0006' },
    '珠海': { lon: '113.5767', lat: '22.2719' },
    '常州': { lon: '119.9733', lat: '31.7978' },
    '南通': { lon: '120.8943', lat: '31.9897' },
    '徐州': { lon: '117.2844', lat: '34.2058' },
    '烟台': { lon: '121.3915', lat: '37.5393' },
    '唐山': { lon: '118.1803', lat: '39.6309' },
    '泉州': { lon: '118.5894', lat: '24.8740' },
    '惠州': { lon: '114.4152', lat: '23.1122' },
    '潍坊': { lon: '119.1021', lat: '36.7067' },
    '绍兴': { lon: '120.5820', lat: '30.0333' },
    '嘉兴': { lon: '120.7555', lat: '30.7467' },
    '扬州': { lon: '119.4129', lat: '32.3942' },
    '镇江': { lon: '119.4520', lat: '32.2044' },
    '泰州': { lon: '119.9223', lat: '32.4527' },
    '盐城': { lon: '120.1253', lat: '33.3475' },
    '临沂': { lon: '118.3563', lat: '35.1043' },
    '三亚': { lon: '109.5119', lat: '18.2528' },
    '琼海': { lon: '110.4667', lat: '19.2460' },
    '万宁': { lon: '110.3887', lat: '18.7962' },
    '陵水': { lon: '110.0372', lat: '18.5050' },
    '文昌': { lon: '110.7516', lat: '19.6127' },
    '儋州': { lon: '109.5776', lat: '19.5175' },
    '东方': { lon: '108.6536', lat: '19.1017' },
    '乐东': { lon: '109.1717', lat: '18.7478' },
    '澄迈': { lon: '110.0073', lat: '19.7364' },
    '临高': { lon: '109.6877', lat: '19.9084' },
    '定安': { lon: '110.3429', lat: '19.6849' },
    '屯昌': { lon: '110.1029', lat: '19.3638' },
    '桂林': { lon: '110.2901', lat: '25.2736' },
    '丽江': { lon: '100.2299', lat: '26.8721' },
    '大理': { lon: '100.2673', lat: '25.6065' },
    '北海': { lon: '109.1201', lat: '21.4733' },
    '秦皇岛': { lon: '119.5872', lat: '39.9353' },
    '威海': { lon: '122.1172', lat: '37.5128' },
    '承德': { lon: '117.9630', lat: '40.9534' },
    '张家界': { lon: '110.4791', lat: '29.1254' },
    '黄山': { lon: '118.3373', lat: '29.7116' },
    '九寨沟': { lon: '103.9306', lat: '33.2600' },
    '喀什': { lon: '75.9934', lat: '39.4702' },
    '敦煌': { lon: '94.6613', lat: '40.1424' },
    '香格里拉': { lon: '99.7065', lat: '27.8269' },
    '西双版纳': { lon: '100.7979', lat: '22.0017' },
    '呼伦贝尔': { lon: '119.7656', lat: '49.2117' },
    '保定': { lon: '115.4645', lat: '38.8738' },
    '邯郸': { lon: '114.5391', lat: '36.6255' },
    '洛阳': { lon: '112.4540', lat: '34.6197' },
    '开封': { lon: '114.3073', lat: '34.7973' },
    '绵阳': { lon: '104.7438', lat: '31.4677' },
    '宜宾': { lon: '104.6308', lat: '28.7603' },
    '泸州': { lon: '105.4433', lat: '28.8420' },
    '南充': { lon: '106.0847', lat: '30.7991' },
    '柳州': { lon: '109.4281', lat: '24.3262' },
    '赣州': { lon: '114.9335', lat: '25.8452' },
    '九江': { lon: '115.9929', lat: '29.7048' },
    '株洲': { lon: '113.1338', lat: '27.8274' },
    '湘潭': { lon: '112.9388', lat: '27.8296' },
    '安庆': { lon: '117.0436', lat: '30.5088' },
    '芜湖': { lon: '118.3764', lat: '31.3263' },
    '蚌埠': { lon: '117.3632', lat: '32.9397' },
    '襄阳': { lon: '112.1225', lat: '32.0420' },
    '宜昌': { lon: '111.2900', lat: '30.6919' },
    '荆州': { lon: '112.2392', lat: '30.3352' },
    '常德': { lon: '111.6985', lat: '29.0319' },
    '衡阳': { lon: '112.6079', lat: '26.8968' },
    '宣城': { lon: '118.7580', lat: '30.9456' },
    '马鞍山': { lon: '118.5079', lat: '31.6893' },
    '铜陵': { lon: '117.8166', lat: '30.1477' },
    '池州': { lon: '117.4892', lat: '30.6560' },
    '滁州': { lon: '118.3162', lat: '32.3036' },
    '阜阳': { lon: '115.8197', lat: '32.8969' },
    '淮南': { lon: '116.9840', lat: '32.6475' },
    '淮北': { lon: '116.7946', lat: '33.9717' },
    '亳州': { lon: '115.7829', lat: '33.8693' },
    '六安': { lon: '116.5077', lat: '31.7528' },
    '宿州': { lon: '116.9840', lat: '33.6338' }
  };

  const cityName = location && location !== 'auto' ? location : '北京';
  
  if (presetLocations[cityName]) {
    return { ...presetLocations[cityName], city: cityName };
  }

  try {
    const geoUrl = `${apiHost}/geo/v2/city/lookup?location=${encodeURIComponent(cityName)}&key=${apiKey}&number=1&lang=zh`;
    const geoResp = await ctx.http.get(geoUrl, { timeout: 5000 });
    const geoData = await geoResp.json();
    
    if (geoData.code == 200 && geoData.location?.[0]) {
      const loc = geoData.location[0];
      return { lon: loc.lon, lat: loc.lat, city: loc.name || cityName };
    }
  } catch (e) {}

  return { lon: '116.4074', lat: '39.9042', city: cityName };
}

async function fetchWeatherNow(ctx, key, lon, lat, apiHost) {
  const url = `${apiHost}/v7/weather/now?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url, { timeout: 8000 });
  const data = await resp.json();

  if (data.code != 200 && data.code !== '200' && data.code !== 'ok') {
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

// 🔥 空气质量 - 完全按照参考脚本逻辑
async function fetchAirQuality(ctx, key, lon, lat, apiHost) {
  let aqi = null;
  let categoryText = '--';
  let categoryColor = { light: '#999999', dark: '#888888' };

  // 尝试新版 V1 接口
  try {
    const urlV1 = `${apiHost}/airquality/v1/current/${lat}/${lon}?key=${key}&lang=zh`;
    const respV1 = await ctx.http.get(urlV1, { timeout: 8000 });
    const dataV1 = await respV1.json();

    if (dataV1.code == 200 || dataV1.code === '200' || dataV1.code === 'ok') {
      if (Array.isArray(dataV1.indexes) && dataV1.indexes.length > 0) {
        const cnMee = dataV1.indexes.find(i => i.code === 'cn-mee');
        const info = cnMee || dataV1.indexes[0];
        if (info && info.aqi != null) {
          aqi = Number(info.aqi);
          categoryText = info.category || getAQICategory(aqi).text;
          categoryColor = getAQICategory(aqi).color;
        }
      }
    }
  } catch (e) {
    console.log('❌ AQI V1 请求失败:', e.message);
  }

  // fallback: 旧版 V7 接口（兼容备用）
  if (aqi == null || isNaN(aqi)) {
    try {
      const urlV7 = `${apiHost}/v7/air/now?location=${lon},${lat}&key=${key}&lang=zh`;
      const respV7 = await ctx.http.get(urlV7, { timeout: 8000 });
      const dataV7 = await respV7.json();
      if (dataV7.code == 200 || dataV7.code === '200' || dataV7.code === 'ok') {
        if (dataV7.now && dataV7.now.aqi) {
          aqi = Number(dataV7.now.aqi);
          categoryText = dataV7.now.category || getAQICategory(aqi).text;
          categoryColor = getAQICategory(aqi).color;
        }
      }
    } catch (e) {
      console.log('⚠️ AQI V7 请求失败:', e.message);
    }
  }

  // 统一返回
  if (aqi != null && !isNaN(aqi)) {
    return {
      aqi: Math.round(aqi),
      category: { text: categoryText, color: categoryColor }
    };
  } else {
    return { aqi: '--', category: { text: '--', color: categoryColor } };
  }
}

function getAQICategory(aqi) {
  const num = parseInt(aqi);
  if (!num || isNaN(num)) return { text: '--', color: { light: '#999999', dark: '#888888' } };
  if (num <= 50) return { text: '优', color: { light: '#30D158', dark: '#34C759' } };
  if (num <= 100) return { text: '良', color: { light: '#FF9500', dark: '#FF9F0A' } };
  if (num <= 150) return { text: '轻度', color: { light: '#FF6B35', dark: '#FF7A3E' } };
  if (num <= 200) return { text: '中度', color: { light: '#FF3B30', dark: '#FF453A' } };
  if (num <= 300) return { text: '重度', color: { light: '#AF52DE', dark: '#BF5AF2' } };
  return { text: '严重', color: { light: '#7E3C9E', dark: '#8E5FC9' } };
}

function getWeatherIcon(iconCode) {
  const map = {
    '100': 'sun.max.fill', '101': 'cloud.sun.fill', '102': 'cloud.fill',
    '103': 'cloud.sun.fill', '104': 'cloud.fill',
    '300': 'cloud.bolt.rain.fill', '301': 'cloud.rain.fill', '302': 'cloud.rain.fill',
    '303': 'cloud.heavyrain.fill', '304': 'cloud.heavyrain.fill',
    '305': 'cloud.rain.fill', '306': 'cloud.rain.fill', '307': 'cloud.heavyrain.fill',
    '308': 'cloud.heavyrain.fill', '309': 'cloud.rain.fill', '310': 'cloud.heavyrain.fill',
    '311': 'cloud.heavyrain.fill', '312': 'cloud.heavyrain.fill', '313': 'cloud.bolt.rain.fill',
    '314': 'cloud.rain.fill', '315': 'cloud.heavyrain.fill', '316': 'cloud.heavyrain.fill',
    '317': 'cloud.heavyrain.fill', '318': 'cloud.heavyrain.fill', '350': 'cloud.bolt.rain.fill',
    '351': 'cloud.bolt.rain.fill', '399': 'cloud.rain.fill',
    '400': 'cloud.snow.fill', '401': 'cloud.snow.fill', '402': 'cloud.snow.fill',
    '403': 'cloud.snow.fill', '404': 'cloud.sleet.fill', '405': 'cloud.sleet.fill',
    '406': 'cloud.sleet.fill', '407': 'cloud.sleet.fill', '408': 'cloud.snow.fill',
    '409': 'cloud.snow.fill', '410': 'cloud.snow.fill', '456': 'cloud.sleet.fill',
    '457': 'cloud.sleet.fill', '499': 'cloud.drizzle.fill',
    '500': 'cloud.fog.fill', '501': 'cloud.fog.fill', '502': 'cloud.fog.fill',
    '503': 'cloud.fog.fill', '504': 'cloud.fog.fill', '505': 'cloud.fog.fill',
    '506': 'cloud.fog.fill', '507': 'cloud.fog.fill', '508': 'cloud.fog.fill',
    '509': 'cloud.fog.fill', '510': 'cloud.fog.fill', '511': 'cloud.fog.fill',
    '512': 'cloud.fog.fill', '513': 'cloud.fog.fill', '514': 'cloud.fog.fill',
    '515': 'cloud.fog.fill',
    '800': 'wind', '801': 'wind', '802': 'wind', '803': 'wind',
    '804': 'wind', '805': 'wind', '806': 'wind', '807': 'wind',
    '900': 'thermometer.sun.fill', '901': 'cloud.bolt.fill',
    '999': 'exclamationmark.triangle.fill'
  };
  return map[iconCode] || 'cloud.fill';
}

function getWeatherColor(iconCode) {
  const code = parseInt(iconCode);
  if (code >= 100 && code <= 104) return { light: '#FF9F0A', dark: '#FFB347' };
  if (code >= 300 && code <= 399) return { light: '#007AFF', dark: '#0A84FF' };
  if (code >= 400 && code <= 499) return { light: '#5856D6', dark: '#5E5CE6' };
  if (code >= 500 && code <= 515) return { light: '#8E8E93', dark: '#98989D' };
  if (code >= 800 && code <= 807) return { light: '#5856D6', dark: '#5E5CE6' };
  return { light: '#FF9F0A', dark: '#FFB347' };
}

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

function renderMedium(now, air, city) {
  const icon = getWeatherIcon(now.icon);
  const color = getWeatherColor(now.icon);
  const aqiColor = air ? air.category.color : { light: '#999999', dark: '#888888' };
  const aqiText = air ? air.category.text : '--';
  const nowTime = new Date();
  const timeStr = `${nowTime.getMonth()+1}/${nowTime.getDate()} ${nowTime.getHours()}:${String(nowTime.getMinutes()).padStart(2, '0')}`;

  return {
    type: 'widget',
    padding: [16, 16, 16, 16],
    gap: 10,
    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
    children: [
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
              // ✅ 采用参考脚本的显示格式：AQI 数值 • 分类
              {
                type: 'text',
                text: `AQI ${air?.aqi || '--'} • ${aqiText}`,
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
      {
        type: 'stack',
        direction: 'row',
        gap: 16,
        children: [
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

