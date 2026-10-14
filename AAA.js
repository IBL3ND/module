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
 * KEY获取: 开始请求API之前，你需要先创建项目和凭据 前往控制台-项目管理 点击右上角“创建项目”按钮 填写项目名称，项目名称最多20个字符。你可以稍后对名称进行修改。点击“保存”按钮。然后点你刚创建的项目名称 进去就可以看见了。 ⚠️重要提示: 应用限制 你需要选择不限制
 * ————————————————————————————————————————————————
 * 示例 教程
 * 名称里面填   LOCATION
 * 值里面填     海口                 你想要显示出来的地区
 * 名称里填     KEY
 * 值里面填     h**********f        你的和风天气KEY
 * 名称里面填    API_HOST       
 * 值里面填     **.qweatherapi.com  你的个人API Host
 */

export default async function (ctx) {
  const safeCtx = ctx || {};
  const env = safeCtx.env || {};
  const widgetFamily = safeCtx.widgetFamily || 'systemMedium';

  const apiKey     = (env.KEY || '').trim();
  const apiHostRaw = (env.API_HOST || '').trim();
  const location   = (env.LOCATION || '').trim();
  const userName   = (env.USER_NAME || '').trim();

  if (!apiKey)     return renderError('缺少 KEY 环境变量');
  if (!apiHostRaw) return renderError('缺少 API_HOST 环境变量');

  const apiHost = normalizeHost(apiHostRaw);

  try {
    const { lon, lat, city } = await getLocation(safeCtx, location, apiKey, apiHost);
    const now = await fetchWeatherNow(safeCtx, apiKey, lon, lat, apiHost);

    let air = null;
    if (widgetFamily !== 'systemSmall' && !isAccessoryFamily(widgetFamily)) {
      air = await fetchAirQuality(safeCtx, apiKey, lon, lat, apiHost);
    }

    if (isAccessoryFamily(widgetFamily)) {
      return renderAccessory(now, city, widgetFamily);
    }
    if (widgetFamily === 'systemSmall') {
      const [daily3d, airSmall] = await Promise.all([
        fetchDaily3d(safeCtx, apiKey, lon, lat, apiHost).catch(() => null),
        fetchAirQuality(safeCtx, apiKey, lon, lat, apiHost).catch(() => null),
      ]);
      return renderSmall(now, city, daily3d, airSmall);
    }
    if (widgetFamily === 'systemLarge') {
      const [daily3d, hourly24h] = await Promise.all([
        fetchDaily3d(safeCtx, apiKey, lon, lat, apiHost).catch(() => null),
        fetchHourly24h(safeCtx, apiKey, lon, lat, apiHost).catch(() => null),
      ]);
      return renderLarge(now, city, daily3d, hourly24h, userName);
    }
    const daily7d = await fetchDaily7d(safeCtx, apiKey, lon, lat, apiHost).catch(() => null);
    return renderMedium(now, city, daily7d);

  } catch (e) {
    try { console.error(e); } catch (_) {}
    const msg = String((e && e.message) || e || '未知错误').slice(0, 80);
    return renderError(`请求失败：${msg}`);
  }
}

function getNextHoliday() {
  const now = new Date();
  const y = now.getFullYear();
  const holidays = [
    { m: 1, d: 1, name: '元旦' },
    { m: 2, d: 17, name: '春节', y: 2026 }, { m: 2, d: 6, name: '春节', y: 2027 },
    { m: 3, d: 3, name: '元宵节', y: 2026 },
    { m: 5, d: 1, name: '劳动节' },
    { m: 6, d: 19, name: '端午节', y: 2026 }, { m: 6, d: 9, name: '端午节', y: 2027 },
    { m: 8, d: 19, name: '七夕节', y: 2026 },
    { m: 9, d: 25, name: '中秋节', y: 2026 }, { m: 9, d: 15, name: '中秋节', y: 2027 },
    { m: 10, d: 18, name: '重阳节', y: 2026 },
    { m: 10, d: 1, name: '国庆节' },
    { m: 12, d: 25, name: '圣诞节' },
    { m: 2, d: 4, name: '立春' }, { m: 2, d: 19, name: '雨水' },
    { m: 3, d: 5, name: '惊蛰' }, { m: 3, d: 20, name: '春分' },
    { m: 4, d: 4, name: '清明' }, { m: 4, d: 20, name: '谷雨' },
    { m: 5, d: 5, name: '立夏' }, { m: 5, d: 21, name: '小满' },
    { m: 6, d: 5, name: '芒种' }, { m: 6, d: 21, name: '夏至' },
    { m: 7, d: 7, name: '小暑' }, { m: 7, d: 22, name: '大暑' },
    { m: 8, d: 7, name: '立秋' }, { m: 8, d: 23, name: '处暑' },
    { m: 9, d: 7, name: '白露' }, { m: 9, d: 23, name: '秋分' },
    { m: 10, d: 8, name: '寒露' }, { m: 10, d: 23, name: '霜降' },
    { m: 11, d: 7, name: '立冬' }, { m: 11, d: 22, name: '小雪' },
    { m: 12, d: 7, name: '大雪' }, { m: 12, d: 21, name: '冬至' },
    { m: 1, d: 5, name: '小寒' }, { m: 1, d: 20, name: '大寒' },
  ];
  let best = null;
  for (const h of holidays) {
    for (const yy of [y, y + 1]) {
      if (h.y && h.y !== yy) continue;
      const dt = new Date(yy, h.m - 1, h.d);
      const days = Math.ceil((dt - now) / 86400000);
      if (days >= 0 && (!best || days < best.days)) {
        best = { name: h.name, days };
      }
    }
  }
  return best;
}

function renderMedium(now, city, daily7d) {
  const { icon, color: iconColor } = getWeatherStyle(now.icon);
  const T = { light: '#1C1C1E', dark: '#F2F2F7' };
  const S = { light: '#8E8E93', dark: '#AEAEB2' };
  const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  const nowT = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${nowT.getFullYear()}-${pad(nowT.getMonth() + 1)}-${pad(nowT.getDate())} ${pad(nowT.getHours())}:${pad(nowT.getMinutes())}`;

  const today = daily7d && daily7d[0];
  const hlText = today ? `H:${today.tempMax}° L:${today.tempMin}°` : '';

  const humidity = Math.max(0, Math.min(100, Number(now.humidity) || 0));
  const barW = 300, barH = 10;
  const fillW = Math.round(barW * humidity / 100);
  const dotX = Math.max(6, Math.min(barW - 6, fillW));
  const humiditySvg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${barW} ${barH}' preserveAspectRatio='none'>` +
    `<defs><linearGradient id='hg' x1='0' y1='0' x2='1' y2='0'>` +
    `<stop offset='0' stop-color='%2334C759'/><stop offset='0.35' stop-color='%23FFCC00'/>` +
    `<stop offset='0.55' stop-color='%23FF9500'/><stop offset='0.75' stop-color='%23FF3B30'/>` +
    `<stop offset='1' stop-color='%23AF52DE'/></linearGradient></defs>` +
    `<rect x='0' y='1' width='${barW}' height='${barH - 2}' rx='${(barH - 2) / 2}' fill='url(%23hg)' opacity='0.25'/>` +
    `<rect x='0' y='1' width='${fillW}' height='${barH - 2}' rx='${(barH - 2) / 2}' fill='url(%23hg)'/>` +
    `<circle cx='${dotX}' cy='${barH / 2}' r='5' fill='%23FFFFFF' opacity='0.95'/>` +
    `</svg>`;

  const forecastCells = [];
  if (daily7d) {
    for (let i = 1; i <= 6 && daily7d[i]; i++) {
      const d = daily7d[i];
      const dt = new Date(d.date + 'T12:00:00');
      const { icon: dic, color: dcolor } = getWeatherStyle(d.iconDay);
      forecastCells.push({
        type: 'stack',
        direction: 'column',
        alignItems: 'center',
        gap: 2,
        flex: 1,
        children: [
          { type: 'text', text: weekNames[dt.getDay()], font: { size: 11 }, textColor: S, maxLines: 1 },
          { type: 'image', src: `sf-symbol:${dic}`, width: 20, height: 20, color: dcolor },
          { type: 'text', text: `${d.tempMax}°`, font: { size: 12, weight: 'semibold' }, textColor: T, maxLines: 1 },
        ]
      });
    }
  }

  const hrLine = {
    type: 'text', text: ' ',
    font: { size: 1 },
    backgroundColor: { light: '#00000018', dark: '#FFFFFF20' },
  };

  const holiday = getNextHoliday();
  const holidayBlock = holiday ? {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    gap: 0,
    children: [
      { type: 'text', text: `距离${holiday.name}`, font: { size: 11, weight: 'semibold' }, textColor: { light: '#FF3B30', dark: '#FF6B62' }, maxLines: 1 },
      { type: 'text', text: holiday.days === 0 ? '就是今天' : `还有${holiday.days}天`, font: { size: 11 }, textColor: S, maxLines: 1 },
    ]
  } : { type: 'spacer' };

  const infoRow = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    children: [
      { type: 'spacer' },
      { type: 'text', text: `体感 ${now.feelsLike}° · 降水 ${now.precip}mm · 能见度 ${now.vis}km`, font: { size: 10 }, textColor: S, maxLines: 1 },
      { type: 'spacer' },
    ]
  };

  return {
    type: 'widget',
    padding: 10,
    gap: 3,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          { type: 'image', src: `sf-symbol:${icon}`, width: 36, height: 36, color: iconColor },
          { type: 'spacer', length: 8 },
          {
            type: 'stack',
            direction: 'column',
            gap: 1,
            children: [
              { type: 'text', text: city, font: { size: 18, weight: 'semibold' }, textColor: T, maxLines: 1 },
              { type: 'text', text: now.text, font: { size: 13 }, textColor: T, maxLines: 1 },
              { type: 'text', text: timeStr, font: { size: 10 }, textColor: S, maxLines: 1 },
            ]
          },
          { type: 'spacer' },
          holidayBlock,
          { type: 'spacer' },
          {
            type: 'stack',
            direction: 'column',
            alignItems: 'end',
            gap: 1,
            children: [
              { type: 'text', text: `${now.temp}°C`, font: { size: 30, weight: 'bold' }, textColor: T, maxLines: 1, minScale: 0.7 },
              { type: 'text', text: hlText, font: { size: 12 }, textColor: S, maxLines: 1 },
            ]
          },
        ]
      },

      infoRow,

      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          { type: 'text', text: '相对湿度', font: { size: 12 }, textColor: T, maxLines: 1 },
          {
            type: 'image',
            src: `data:image/svg+xml,${humiditySvg}`,
            flex: 1,
            height: 10,
          },
          { type: 'text', text: `${humidity}%`, font: { size: 12, weight: 'semibold' }, textColor: T, maxLines: 1 },
        ]
      },

      hrLine,

      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        flex: 1,
        children: forecastCells.length > 0 ? forecastCells : [{ type: 'spacer' }],
      },
    ]
  };
}

function renderSmall(now, city, daily3d, air) {
  const { icon, color: iconColor } = getWeatherStyle(now.icon);
  const T = { light: '#1C1C1E', dark: '#F2F2F7' };
  const S = { light: '#8E8E93', dark: '#AEAEB2' };
  const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  const header = {
    type: 'stack', direction: 'row', alignItems: 'center',
    children: [
      { type: 'text', text: city, font: { size: 17, weight: 'semibold' }, textColor: T, maxLines: 1 },
      { type: 'spacer' },
      { type: 'image', src: `sf-symbol:${icon}`, width: 28, height: 28, color: iconColor }
    ]
  };

  const today = daily3d && daily3d[0];
  const todayRow = {
    type: 'stack', direction: 'row', alignItems: 'center',
    children: [
      { type: 'text', text: `${now.temp}°`, font: { size: 38, weight: 'bold' }, textColor: T },
      { type: 'spacer' },
      today ? { type: 'text', text: `${today.tempMin}°`, font: { size: 20 }, textColor: S } : { type: 'spacer', length: 0 },
      today ? { type: 'spacer', length: 12 } : { type: 'spacer', length: 0 },
      today ? { type: 'text', text: `${today.tempMax}°`, font: { size: 20, weight: 'semibold' }, textColor: T } : { type: 'spacer', length: 0 }
    ]
  };

  const rows = [];
  const labels = ['明天'];
  for (let i = 1; i < 3 && daily3d && daily3d[i]; i++) {
    const d = daily3d[i];
    const dt = new Date(d.date + 'T12:00:00');
    const label = labels[i - 1] || weekNames[dt.getDay()];
    const { icon: dic, color: dcolor } = getWeatherStyle(d.iconDay);
    rows.push({ type: 'spacer', length: 6 });
    rows.push({
      type: 'stack', direction: 'row', alignItems: 'center',
      children: [
        { type: 'text', text: label, font: { size: 16 }, textColor: T, width: 44 },
        { type: 'image', src: `sf-symbol:${dic}`, width: 22, height: 22, color: dcolor },
        { type: 'spacer' },
        { type: 'text', text: `${d.tempMin}°`, font: { size: 17 }, textColor: S },
        { type: 'spacer', length: 12 },
        { type: 'text', text: `${d.tempMax}°`, font: { size: 17, weight: 'semibold' }, textColor: T }
      ]
    });
  }

  return {
    type: 'widget',
    padding: 14,
    children: [header, { type: 'spacer', length: 4 }, todayRow, ...rows, { type: 'spacer' }]
  };
}

function renderAccessory(now, city, family) {
  if (family === 'accessoryCircular') {
    return {
      type: 'widget',
      children: [{
        type: 'text',
        text: `${now.temp}°\n${city}`,
        font: { size: 14, weight: 'bold' },
        textAlign: 'center'
      }]
    };
  }
  return {
    type: 'widget',
    children: [{
      type: 'text',
      text: `${city} ${now.temp}° ${now.text}`
    }]
  };
}

function capsuleTag(text, textColor, bgColor) {
  return {
    type: 'stack',
    backgroundColor: bgColor,
    borderRadius: 20,
    padding: [4, 10, 4, 10],
    children: [{
      type: 'text',
      text,
      font: { size: 13, weight: 'semibold' },
      textColor,
      maxLines: 1
    }]
  };
}

function capsuleTagLarge(text, textColor, bgColor) {
  return {
    type: 'stack',
    backgroundColor: bgColor,
    borderRadius: 20,
    padding: [6, 14, 6, 14],
    children: [{
      type: 'text',
      text,
      font: { size: 18, weight: 'bold' },
      textColor,
      maxLines: 1
    }]
  };
}

function infoCard(_sfIcon, label, value, _iconColor, cardBg) {
  return {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    flex: 1,
    backgroundColor: cardBg,
    borderRadius: 14,
    padding: [8, 6, 8, 6],
    gap: 3,
    children: [
      {
        type: 'text',
        text: label,
        font: { size: 10 },
        textColor: { light: '#8E8E93', dark: '#636366' }
      },
      {
        type: 'text',
        text: value,
        font: { size: 13, weight: 'semibold' },
        textColor: { light: '#1C1C1E', dark: '#F2F2F7' },
        maxLines: 1,
        minScale: 0.7
      }
    ]
  };
}

function getWeatherStyle(code) {
  const n = Number(code);
  if (n === 100) return { icon: 'sun.max.fill',           color: { light: '#FF9500', dark: '#FFB340' } };
  if (n === 101) return { icon: 'cloud.sun.fill',         color: { light: '#FF9500', dark: '#FFB340' } };
  if (n === 102) return { icon: 'cloud.sun.fill',         color: { light: '#FF9500', dark: '#FFB340' } };
  if (n === 103) return { icon: 'cloud.sun.fill',         color: { light: '#FF9500', dark: '#FFB340' } };
  if (n === 104) return { icon: 'cloud.fill',             color: { light: '#8E8E93', dark: '#AEAEB2' } };
  if (n >= 200 && n <= 299) return { icon: 'cloud.bolt.rain.fill', color: { light: '#5856D6', dark: '#7D7AFF' } };
  if (n >= 300 && n <= 399) return { icon: 'cloud.rain.fill',      color: { light: '#007AFF', dark: '#0A84FF' } };
  if (n >= 400 && n <= 499) return { icon: 'cloud.snow.fill',      color: { light: '#5AC8FA', dark: '#64D2FF' } };
  if (n >= 105 && n <= 154) return { icon: 'cloud.fill',           color: { light: '#8E8E93', dark: '#AEAEB2' } };
  return { icon: 'cloud.fill', color: { light: '#8E8E93', dark: '#AEAEB2' } };
}

function getBadgeBg(code) {
  const n = Number(code);
  if (n >= 100 && n <= 103) return { light: '#FFF3E015', dark: '#3A280025' };
  if (n >= 200 && n <= 299) return { light: '#EDE7F615', dark: '#1E1A3625' };
  if (n >= 300 && n <= 399) return { light: '#E3F2FD15', dark: '#001A3625' };
  if (n >= 400 && n <= 499) return { light: '#E0F7FA15', dark: '#00333625' };
  return { light: '#F2F2F715', dark: '#2C2C2E25' };
}

function getAQIStyle(val) {
  const n = Number(val);
  if (isNaN(n) || val === '--') return {
    text: '--', color: { light: '#8E8E93', dark: '#636366' },
    bg: { light: '#F2F2F715', dark: '#FFFFFF15' }
  };
  if (n <= 50)  return { text: '优', color: { light: '#34C759', dark: '#30D158' }, bg: { light: '#34C75915', dark: '#30D15825' } };
  if (n <= 100) return { text: '良', color: { light: '#FF9500', dark: '#FF9F0A' }, bg: { light: '#FF950015', dark: '#FF9F0A25' } };
  if (n <= 150) return { text: '轻度', color: { light: '#FF6B35', dark: '#FF6B35' }, bg: { light: '#FF6B3515', dark: '#FF6B3525' } };
  return { text: '中度', color: { light: '#FF3B30', dark: '#FF453A' }, bg: { light: '#FF3B3015', dark: '#FF453A25' } };
}

function renderError(msg) {
  return {
    type: 'widget',
    
    padding: 16,
    children: [{
      type: 'stack',
      backgroundColor: { light: '#FF3B3015', dark: '#FF453A25' },
      borderRadius: 14,
      padding: 12,
      children: [{
        type: 'text',
        text: `⚠️ ${msg}`,
        font: { size: 13 },
        textColor: { light: '#FF3B30', dark: '#FF453A' }
      }]
    }]
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
    '海口': { lon: '110.3288', lat: '20.0310' }, '三亚': { lon: '109.5119', lat: '18.2528' },
    '儋州': { lon: '109.5768', lat: '19.5209' }, '琼海': { lon: '110.4746', lat: '19.2584' },
    '万宁': { lon: '110.3893', lat: '18.7953' }, '文昌': { lon: '110.7530', lat: '19.6129' },
    '东方': { lon: '108.6536', lat: '19.1017' }, '五指山': { lon: '109.5169', lat: '18.7752' },
    '陵水': { lon: '110.0372', lat: '18.5050' }, '保亭': { lon: '109.7026', lat: '18.6390' },
    '屯昌': { lon: '110.1029', lat: '19.3638' }, '澄迈': { lon: '110.0073', lat: '19.7364' },
    '临高': { lon: '109.6877', lat: '19.9084' }, '定安': { lon: '110.3593', lat: '19.6849' },
    '乐东': { lon: '109.1717', lat: '18.7478' }, '昌江': { lon: '109.0556', lat: '19.2983' },
    '白沙': { lon: '109.4515', lat: '19.2240' }, '琼中': { lon: '109.8335', lat: '18.9982' },
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
    '泉州': { lon: '118.5894', lat: '24.9088' }, '洛阳': { lon: '112.4344', lat: '34.6630' },
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
  if (data.code !== '200') throw new Error(describeApiError('实况', resp, data));
  return {
    temp: data.now.temp,
    feelsLike: data.now.feelsLike || '--',
    text: data.now.text,
    icon: data.now.icon,
    humidity: data.now.humidity,
    windDir: data.now.windDir || '--',
    windScale: data.now.windScale || '--',
    windSpeed: data.now.windSpeed || '--',
    precip: data.now.precip || '0',
    vis: data.now.vis || '--',
    pressure: data.now.pressure || '--'
  };
}

async function fetchDaily7d(ctx, key, lon, lat, host) {
  const url = `${host}/v7/weather/7d?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url, { timeout: 8000 });
  const data = await resp.json();
  if (data.code !== '200') throw new Error(describeApiError('7d预报', resp, data));
  return data.daily.map(d => ({
    date: d.fxDate,
    tempMax: d.tempMax,
    tempMin: d.tempMin,
    iconDay: d.iconDay,
    textDay: d.textDay,
  }));
}

async function fetchDaily3d(ctx, key, lon, lat, host) {
  const url = `${host}/v7/weather/3d?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url, { timeout: 8000 });
  const data = await resp.json();
  if (data.code !== '200') throw new Error(describeApiError('3d预报', resp, data));
  return data.daily.map(d => ({
    date: d.fxDate,           // 2026-10-12
    tempMax: d.tempMax,
    tempMin: d.tempMin,
    iconDay: d.iconDay,
    textDay: d.textDay,
  }));
}

async function fetchHourly24h(ctx, key, lon, lat, host) {
  const url = `${host}/v7/weather/24h?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url, { timeout: 8000 });
  const data = await resp.json();
  if (data.code !== '200') throw new Error(describeApiError('24h预报', resp, data));
  return data.hourly.map(h => ({
    time: h.fxTime,           // 2026-10-12T14:00+08:00
    temp: Number(h.temp),
  }));
}

function describeApiError(tag, resp, data) {
  const status = resp ? resp.status : 'no-response';
  let snippet = '';
  try {
    snippet = JSON.stringify(data);
    if (snippet && snippet.length > 120) snippet = snippet.slice(0, 120) + '…';
  } catch (e) { snippet = String(data); }
  if (!snippet || snippet === '{}' || snippet === 'undefined') {
    return `${tag}接口无有效返回(HTTP ${status})，请检查 API_HOST 是否正确`;
  }
  return `${tag}接口返回 ${snippet} (HTTP ${status})`;
}

async function fetchAirQuality(ctx, key, lon, lat, host) {
  try {
    const url = `${host}/airquality/v1/current/${lat}/${lon}?key=${key}&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 7000 });
    const data = await resp.json();
    if (data.indexes && data.indexes.length > 0) {
      const cnMee = data.indexes.find(i => i.code === 'cn-mee') || data.indexes[0];
      return { aqi: Math.round(Number(cnMee.aqi)), category: cnMee.category };
    }
  } catch {}
  return { aqi: '--', category: '--' };
}


/* ===================== 节假日/农历数据（自 Holiday_Countdown 移植） ===================== */
/**
 * 📅 节日倒计时小组件
 */
const HOLIDAYS = {
  '01-01': { name: '元旦', type: 'holiday' },
  '02-14': { name: '情人节', type: 'holiday' },
  '03-08': { name: '妇女节', type: 'holiday' },
  '04-01': { name: '愚人节', type: 'holiday' },
  '05-01': { name: '劳动节', type: 'holiday' },
  '05-04': { name: '青年节', type: 'holiday' },
  '06-01': { name: '儿童节', type: 'holiday' },
  '07-01': { name: '建党节', type: 'holiday' },
  '08-01': { name: '建军节', type: 'holiday' },
  '09-10': { name: '教师节', type: 'holiday' },
  '10-01': { name: '国庆节', type: 'holiday' },
  '11-11': { name: '光棍节', type: 'holiday' },
  '12-25': { name: '圣诞节', type: 'holiday' },
  '12-31': { name: '跨年夜', type: 'holiday' },
};

const LUNAR_HOLIDAYS = {
  '1-1': '春节', '1-15': '元宵节', '2-2': '龙抬头',
  '5-5': '端午节', '7-7': '七夕节', '7-15': '中元节',
  '8-15': '中秋节', '9-9': '重阳节', '12-8': '腊八节', '12-30': '除夕'
};

const FLOATING_HOLIDAYS = {
  'mother': { name: '母亲节', calc: (y) => getNthWeekday(y, 5, 0, 2) },
  'father': { name: '父亲节', calc: (y) => getNthWeekday(y, 6, 0, 3) },
};

/* ===================== 农历核心算法(修正版) ===================== */
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14aa6, 0x02b60, 0x09570, 0x04976, 0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54,
  0x02b60, 0x09570, 0x052f2, 0x04970, 0x06566, 0x0d4a0, 0x0ea50, 0x16ea5, 0x05ad0, 0x02b60,
  0x186e3, 0x092e0, 0x1c8d7, 0x0c950, 0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0,
  0x092d0, 0x0d2b2, 0x0a950, 0x0b557, 0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x145ad,
  0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260,
  0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250
];

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];

const LUNAR_MIN_YEAR = 1900;
const LUNAR_MAX_YEAR = 2100;

function lunarYearDays(y) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - LUNAR_MIN_YEAR] & i) ? 1 : 0;
  return sum + lunarLeapDays(y);
}
function lunarLeapMonth(y) { return LUNAR_INFO[y - LUNAR_MIN_YEAR] & 0xf; }
function lunarLeapDays(y) {
  return lunarLeapMonth(y) ? ((LUNAR_INFO[y - LUNAR_MIN_YEAR] & 0x10000) ? 30 : 29) : 0;
}
function lunarMonthDays(y, m) {
  return (LUNAR_INFO[y - LUNAR_MIN_YEAR] & (0x10000 >> m)) ? 30 : 29;
}

function solarToLunar(yy, mm, dd) {
  const baseDate = new Date(Date.UTC(1900, 0, 31));
  const objDate = new Date(Date.UTC(yy, mm - 1, dd));
  let offset = Math.round((objDate - baseDate) / 86400000);

  let i, temp = 0;
  for (i = LUNAR_MIN_YEAR; i < LUNAR_MAX_YEAR && offset > 0; i++) {
    temp = lunarYearDays(i);
    offset -= temp;
  }
  if (offset < 0) { offset += temp; i--; }
  const year = i;

  const leap = lunarLeapMonth(year);
  let isLeap = false;
  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === leap + 1 && !isLeap) {
      --i;
      isLeap = true;
      temp = lunarLeapDays(year);
    } else {
      temp = lunarMonthDays(year, i);
    }
    if (isLeap && i === leap + 1) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) { isLeap = false; }
    else { isLeap = true; --i; }
  }
  if (offset < 0) { offset += temp; i--; }

  const month = i;
  const day = offset + 1;
  const ganIndex = (year - 4) % 10;
  const zhiIndex = (year - 4) % 12;

  return {
    year, month, day, isLeap,
    ganZhi: GAN[(ganIndex + 10) % 10] + ZHI[(zhiIndex + 12) % 12],
    animal: ANIMALS[(zhiIndex + 12) % 12],
    monthStr: (isLeap ? '闰' : '') + LUNAR_MONTH_NAMES[month - 1],
    dayStr: LUNAR_DAY_NAMES[day - 1] || ''
  };
}

const Lunar = {
  getLunarDate: (d) => solarToLunar(d.getFullYear(), d.getMonth() + 1, d.getDate()),
  solarToLunar
};

/* ===================== 24节气(修正版) ===================== */
const SOLAR_TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
  '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
  '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
  '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
];

const SOLAR_TERM_OFFSETS_MIN = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693,
  263343, 285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758
];

const TROPICAL_YEAR_MS = 365.24219878 * 86400000;
const SOLAR_TERM_BASE = Date.UTC(1900, 0, 6, 2, 5, 0);

function getSolarTermDate(year, termIndex) {
  const ms = SOLAR_TERM_BASE + TROPICAL_YEAR_MS * (year - 1900) + SOLAR_TERM_OFFSETS_MIN[termIndex] * 60000;
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/* ===================== 通用日期工具 ===================== */
function getNthWeekday(year, month, weekday, n) {
  const first = new Date(year, month - 1, 1);
  const diff = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month - 1, 1 + diff + (n - 1) * 7);
}

function daysDiff(from, to) {
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const t = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((t - f) / 86400000);
}

function findSolarDateByLunar(targetLunarMonth, targetLunarDay, year) {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 2, 10);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const lunar = solarToLunar(d.getFullYear(), d.getMonth() + 1, d.getDate());
    if (lunar.month === targetLunarMonth && lunar.day === targetLunarDay && !lunar.isLeap) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }
  return null;
}

/* ===================== 汇总所有倒计时 ===================== */
function getCountdowns(customToday) {
  const now = customToday || new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const year = today.getFullYear();
  const results = [];

  for (const [k, v] of Object.entries(HOLIDAYS)) {
    const [m, d] = k.split('-').map(Number);
    let t = new Date(year, m - 1, d);
    if (t < today) t = new Date(year + 1, m - 1, d);
    results.push({ name: v.name, days: daysDiff(today, t), type: v.type });
  }

  for (const v of Object.values(FLOATING_HOLIDAYS)) {
    let t = v.calc(year);
    if (t < today) t = v.calc(year + 1);
    results.push({ name: v.name, days: daysDiff(today, t), type: 'floating' });
  }

  for (let i = 0; i < 24; i++) {
    const term = getSolarTermDate(year, i);
    let t = new Date(term.year, term.month - 1, term.day);
    if (t < today) {
      const term2 = getSolarTermDate(year + 1, i);
      t = new Date(term2.year, term2.month - 1, term2.day);
    }
    results.push({ name: SOLAR_TERM_NAMES[i], days: daysDiff(today, t), type: 'term' });
  }

  try {
    for (const [k, name] of Object.entries(LUNAR_HOLIDAYS)) {
      const [lm, ld] = k.split('-').map(Number);
      const isChuxi = k === '12-30';

      let t = findSolarDateByLunar(lm, ld, year);
      if (isChuxi && !t) t = findSolarDateByLunar(12, 29, year);

      if (!t || t < today) {
        t = findSolarDateByLunar(lm, ld, year + 1);
        if (isChuxi && !t) t = findSolarDateByLunar(12, 29, year + 1);
      }

      if (t) results.push({ name, days: daysDiff(today, t), type: 'lunar' });
    }
  } catch (e) {
    console.warn('[Lunar Calc Fallback]', e);
  }

  results.sort((a, b) => a.days - b.days);
  const seen = new Set();
  return results.filter(r => !seen.has(r.name) && seen.add(r.name));
}

/* ===================== SVG 构建器 ===================== */

function buildClockSVG(hour, minute, second) {
  const cx = 100, cy = 100, r = 92;
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const a = (i * 6 - 90) * Math.PI / 180;
    const isHour = i % 5 === 0;
    const r1 = isHour ? r - 14 : r - 8;
    const x1 = cx + r1 * Math.cos(a), y1 = cy + r1 * Math.sin(a);
    const x2 = cx + r * Math.cos(a), y2 = cy + r * Math.sin(a);
    ticks += `<line x1='${x1.toFixed(1)}' y1='${y1.toFixed(1)}' x2='${x2.toFixed(1)}' y2='${y2.toFixed(1)}' stroke='%23333' stroke-width='${isHour ? 3 : 1.5}'/>`;
  }
  let nums = '';
  for (let n = 1; n <= 12; n++) {
    const a = (n * 30 - 90) * Math.PI / 180;
    const x = cx + (r - 28) * Math.cos(a), y = cy + (r - 28) * Math.sin(a);
    nums += `<text x='${x.toFixed(1)}' y='${(y + 7).toFixed(1)}' text-anchor='middle' font-size='20' font-weight='600' fill='%23333'>${n}</text>`;
  }
  const ha = ((hour % 12) * 30 + minute * 0.5 - 90) * Math.PI / 180;
  const ma = (minute * 6 - 90) * Math.PI / 180;
  const sa = (second * 6 - 90) * Math.PI / 180;
  const hx = cx + 45 * Math.cos(ha), hy = cy + 45 * Math.sin(ha);
  const mx = cx + 68 * Math.cos(ma), my = cy + 68 * Math.sin(ma);
  const sx = cx + 75 * Math.cos(sa), sy = cy + 75 * Math.sin(sa);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>` +
    `<circle cx='100' cy='100' r='96' fill='none' stroke='%23999' stroke-width='2'/>` +
    ticks + nums +
    `<line x1='100' y1='100' x2='${hx.toFixed(1)}' y2='${hy.toFixed(1)}' stroke='%23333' stroke-width='7' stroke-linecap='round'/>` +
    `<line x1='100' y1='100' x2='${mx.toFixed(1)}' y2='${my.toFixed(1)}' stroke='%23333' stroke-width='5' stroke-linecap='round'/>` +
    `<line x1='100' y1='100' x2='${sx.toFixed(1)}' y2='${sy.toFixed(1)}' stroke='%23FF9500' stroke-width='2.5' stroke-linecap='round'/>` +
    `<circle cx='100' cy='100' r='7' fill='%23FF9500'/>` +
    `</svg>`;
  return 'data:image/svg+xml,' + svg;
}

function buildTempCurveSVG(hourly) {
  const W = 360, H = 120, padL = 8, padR = 8, padT = 22, padB = 16;
  const pts = hourly.slice(0, 9);
  if (!pts.length) return '';
  const temps = pts.map(p => p.temp);
  const min = Math.min(...temps), max = Math.max(...temps);
  const span = Math.max(max - min, 1);
  const iw = W - padL - padR, ih = H - padT - padB;
  const xy = pts.map((p, i) => {
    const x = padL + (iw * i) / (pts.length - 1);
    const y = padT + ih * (1 - (p.temp - min) / span);
    return { x, y, temp: p.temp };
  });
  let grid = '';
  for (let g = 0; g <= 3; g++) {
    const y = padT + (ih * g) / 3;
    grid += `<line x1='${padL}' y1='${y.toFixed(1)}' x2='${W - padR}' y2='${y.toFixed(1)}' stroke='%23999' stroke-width='1' stroke-dasharray='5,4' opacity='0.5'/>`;
  }
  const line = xy.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  let dots = '';
  xy.forEach(p => {
    dots += `<circle cx='${p.x.toFixed(1)}' cy='${p.y.toFixed(1)}' r='3' fill='%23007AFF'/>` +
      `<text x='${p.x.toFixed(1)}' y='${(p.y - 8).toFixed(1)}' text-anchor='middle' font-size='11' fill='%23333'>${p.temp}</text>`;
  });
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}'>` +
    grid +
    `<polyline points='${line}' fill='none' stroke='%23007AFF' stroke-width='2.5'/>` +
    dots +
    `</svg>`;
  return 'data:image/svg+xml,' + svg;
}

/* ===================== 大尺寸多合一 ===================== */

function getGreeting(hour) {
  if (hour >= 5 && hour < 9) return '早晨好';
  if (hour >= 9 && hour < 12) return '上午好';
  if (hour >= 12 && hour < 14) return '中午好';
  if (hour >= 14 && hour < 18) return '下午好';
  if (hour >= 18 && hour < 23) return '晚上好';
  return '夜深了';
}

/* ===================== 大尺寸（简化测试版） ===================== */

function renderLarge(now, city, daily3d, hourly24h, userName) {
  const T = { light: '#1C1C1E', dark: '#F2F2F7' };
  const S = { light: '#8E8E93', dark: '#AEAEB2' };
  const { icon, color } = getWeatherStyle(now.icon);
  const d = new Date();
  const clockSrc = buildClockSVG(d.getHours(), d.getMinutes(), d.getSeconds());
  const curveSrc = hourly24h && hourly24h.length ? buildTempCurveSVG(hourly24h) : '';
  const greeting = getGreeting(d.getHours());

  let schedules = [];
  try {
    schedules = getCountdowns().slice(0, 2).map(c => {
      const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + c.days);
      return { name: c.name, md: `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` };
    });
  } catch (e) {}

  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const weekNames = ['一', '二', '三', '四', '五', '六', '日'];
  const weekCells = [];
  for (let i = 0; i < 7; i++) {
    const wd = new Date(monday);
    wd.setDate(monday.getDate() + i);
    const isToday = wd.getDate() === d.getDate() && wd.getMonth() === d.getMonth();
    weekCells.push({
      type: 'stack', direction: 'column', alignItems: 'center', flex: 1, gap: 1,
      children: [
        { type: 'text', text: weekNames[i], font: { size: 10 }, textColor: S },
        {
          type: 'stack', alignItems: 'center',
          ...(isToday ? { backgroundColor: { light: '#FF3B3025', dark: '#FF453A30' } } : {}),
          borderRadius: 10, padding: [3, 10, 3, 10],
          children: [
            { type: 'text', text: String(wd.getDate()), font: { size: 15, weight: 'semibold' },
              textColor: isToday ? { light: '#FF3B30', dark: '#FF453A' } : T },
          ]
        },
      ]
    });
  }

  const today = daily3d && daily3d[0];
  const tomorrow = daily3d && daily3d[1];
  const dayAfter = daily3d && daily3d[2];

  const dayCard = (label, dayInfo) => {
    if (!dayInfo) return { type: 'stack', flex: 1, children: [] };
    const s = getWeatherStyle(dayInfo.iconDay);
    return {
      type: 'stack', direction: 'row', alignItems: 'center', flex: 1, gap: 6,
      children: [
        { type: 'text', text: label, font: { size: 13 }, textColor: S },
        { type: 'image', src: `sf-symbol:${s.icon}`, width: 22, height: 22, color: s.color },
        { type: 'text', text: `${dayInfo.tempMin}°-${dayInfo.tempMax}°`, font: { size: 13, weight: 'semibold' }, textColor: T },
      ]
    };
  };

  return {
    type: 'widget',
    padding: [12, 12, 4, 12],
    gap: 8,
    children: [
      {
        type: 'stack', direction: 'row', alignItems: 'center',
        children: [
          {
            type: 'stack', direction: 'column', gap: 4, alignItems: 'start',
            children: [
              { type: 'text', text: `${d.getFullYear()} ${d.getMonth() + 1}月`, font: { size: 22, weight: 'bold' }, textColor: T },
              {
                type: 'stack',
                backgroundColor: { light: '#AF52DE25', dark: '#BF5AF230' },
                borderRadius: 6, padding: [2, 8, 2, 8],
                children: [{ type: 'text', text: '日程', font: { size: 12, weight: 'bold' },
                  textColor: { light: '#AF52DE', dark: '#BF5AF2' } }]
              },
              ...schedules.map((s, i) => ({
                type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
                children: [
                  { type: 'stack', width: 3, height: 28,
                    backgroundColor: i === 0 ? { light: '#34C75960', dark: '#30D15860' } : { light: '#FF950060', dark: '#FF9F0A60' },
                    borderRadius: 2 },
                  { type: 'text', text: `${s.name} ${s.md}`, font: { size: 13 }, textColor: T, maxLines: 1 },
                ]
              })),
            ]
          },
          { type: 'spacer' },
          { type: 'image', src: clockSrc, width: 88, height: 88 },
          { type: 'spacer' },
          {
            type: 'stack', direction: 'column', alignItems: 'center',
            children: [
              { type: 'text', text: String(d.getDate()), font: { size: 68, weight: 'bold' }, textColor: T },
              { type: 'text', text: userName ? `${userName}，${greeting}！` : greeting + '!', font: { size: 14, weight: 'semibold' }, textColor: S },
            ]
          },
        ]
      },
      { type: 'stack', direction: 'row', gap: 4, children: weekCells },
      {
        type: 'stack', direction: 'row', alignItems: 'center', gap: 10,
        children: [
          { type: 'image', src: `sf-symbol:${icon}`, width: 36, height: 36, color },
          { type: 'text', text: `${now.temp}°`, font: { size: 36, weight: 'bold' }, textColor: T },
          {
            type: 'stack', direction: 'column', gap: 1,
            children: [
              { type: 'text', text: today ? `${today.tempMax}°-${today.tempMin}°` : '', font: { size: 14 }, textColor: S },
              { type: 'text', text: `${city} ${now.text}`, font: { size: 13 }, textColor: S },
            ]
          },
          { type: 'spacer' },
          {
            type: 'stack', direction: 'column', alignItems: 'end', gap: 1,
            children: [
              { type: 'text', text: `体感${now.feelsLike}°`, font: { size: 12 }, textColor: S },
              { type: 'text', text: `湿度${now.humidity}%`, font: { size: 12 }, textColor: S },
            ]
          },
        ]
      },
      { type: 'stack', direction: 'row', gap: 16, children: [ dayCard('明天', tomorrow), dayCard('后天', dayAfter) ] },
      { type: 'spacer' },
      ...(curveSrc ? [{
        type: 'image', src: curveSrc, height: 112
      }] : []),
    ]
  };
}
