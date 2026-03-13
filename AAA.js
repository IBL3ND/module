/**
 * 📅 节日倒计时小组件➕农历显示
 * ✅ 已优化小尺寸显示更多项目
 */

// ========== 节日数据配置 ==========
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

const SOLAR_TERMS = {
  '01-05': '小寒', '01-20': '大寒', '02-03': '立春', '02-18': '雨水',
  '03-05': '惊蛰', '03-20': '春分', '04-04': '清明', '04-19': '谷雨',
  '05-05': '立夏', '05-20': '小满', '06-05': '芒种', '06-21': '夏至',
  '07-07': '小暑', '07-22': '大暑', '08-07': '立秋', '08-22': '处暑',
  '09-07': '白露', '09-22': '秋分', '10-08': '寒露', '10-23': '霜降',
  '11-07': '立冬', '11-22': '小雪', '12-07': '大雪', '12-21': '冬至'
};

const FLOATING_HOLIDAYS = {
  'mother': { name: '母亲节', calc: (y) => getNthWeekday(y, 5, 0, 2) },
  'father': { name: '父亲节', calc: (y) => getNthWeekday(y, 6, 0, 3) },
};

// ========== 农历计算引擎 ==========
const Lunar = (function() {
  const lunarInfo = [
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

  const Gan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const Zhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const Animals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  const lunarMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];

  function lYearDays(y) {
    let i, sum = 348;
    for (i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
    return sum + leapDays(y);
  }

  function leapDays(y) {
    if (leapMonth(y)) return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29;
    return 0;
  }

  function leapMonth(y) { return lunarInfo[y - 1900] & 0xf; }

  function monthDays(y, m) { return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }

  function solarToLunar(yy, mm, dd) {
    let baseDate = new Date(1900, 0, 31);
    let objDate = new Date(yy, mm - 1, dd);
    let offset = Math.floor((objDate - baseDate) / 86400000);
    let i, year = 1900, temp = 0;

    for (i = 1900; i < 2100 && offset > 0; i++) {
      temp = lYearDays(i);
      offset -= temp;
      year = i;
    }
    if (offset < 0) { offset += temp; year--; }

    let leap = leapMonth(year), isLeap = false;
    for (i = 1; i < 13 && offset > 0; i++) {
      if (leap > 0 && i === (leap + 1) && !isLeap) { --i; isLeap = true; temp = leapDays(year); }
      else { temp = monthDays(year, i); }
      if (isLeap && i === (leap + 1)) isLeap = false;
      offset -= temp;
      if (offset < 0) { offset += temp; i++; break; }
    }

    let ganIndex = (year - 4) % 10, zhiIndex = (year - 4) % 12;
    return {
      year, month: i, day: offset + 1, isLeap,
      ganZhi: Gan[ganIndex] + Zhi[zhiIndex],
      animal: Animals[zhiIndex],
      monthStr: lunarMonths[i - 1],
      dayStr: getDayString(offset + 1)
    };
  }

  function getDayString(day) {
    const strs = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
                  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
                  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
    return strs[day - 1] || '';
  }

  return {
    getLunarDate: (d) => solarToLunar(d.getFullYear(), d.getMonth() + 1, d.getDate()),
    solarToLunar
  };
})();

// ========== 工具函数 ==========
function getNthWeekday(year, month, weekday, n) {
  const first = new Date(year, month - 1, 1);
  const diff = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month - 1, 1 + diff + (n - 1) * 7);
}

function daysDiff(from, to) {
  return Math.ceil((to - from) / (24 * 60 * 60 * 1000));
}

function getCountdowns() {
  const now = new Date(), year = now.getFullYear(), results = [];

  for (const [k, v] of Object.entries(HOLIDAYS)) {
    const [m, d] = k.split('-').map(Number);
    let t = new Date(year, m - 1, d);
    if (t < now) t = new Date(year + 1, m - 1, d);
    results.push({ name: v.name, days: daysDiff(now, t), type: v.type });
  }

  for (const [k, v] of Object.entries(FLOATING_HOLIDAYS)) {
    let t = v.calc(year);
    if (t < now) t = v.calc(year + 1);
    results.push({ name: v.name, days: daysDiff(now, t), type: 'floating' });
  }

  for (const [k, name] of Object.entries(SOLAR_TERMS)) {
    const [m, d] = k.split('-').map(Number);
    let t = new Date(year, m - 1, d);
    if (t < now) t = new Date(year + 1, m - 1, d);
    results.push({ name, days: daysDiff(now, t), type: 'term' });
  }

  try {
    const lunar = Lunar.getLunarDate(now);
    for (const [k, name] of Object.entries(LUNAR_HOLIDAYS)) {
      const [lm, ld] = k.split('-').map(Number);
      let tm = (lunar.month > lm || (lunar.month === lm && lunar.day >= ld)) ? lm + 12 : lm;
      let t = new Date(year, tm - 1, ld);
      if (t < now) t = new Date(year + 1, tm - 1, ld);
      results.push({ name, days: daysDiff(now, t), type: 'lunar' });
    }
  } catch (e) {}

  results.sort((a, b) => a.days - b.days);
  const seen = new Set();
  return results.filter(r => !seen.has(r.name + r.days) && seen.add(r.name + r.days));
}

// ========== 🎯 核心：按尺寸渲染不同布局 ==========
export default async function(ctx) {
  try {
    const env = ctx.env || {};
    const widgetFamily = ctx.widgetFamily || 'systemMedium';
    
    const title = env.TITLE || '节日倒计时';
    const showHolidays = env.SHOW_HOLIDAYS !== 'false';
    const showTerms = env.SHOW_TERMS !== 'false';
    const showTraditional = env.SHOW_TRADITIONAL !== 'false';
    const itemsPerRow = parseInt(env.ITEMS_PER_ROW) || 4;
    const maxRows = parseInt(env.MAX_ROWS) || 5;

    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
    const weekday = ['日','一','二','三','四','五','六'][now.getDay()];
    const solarDate = `${m}月${d}日`;

    let lunarDate = '';
    try {
      const lunar = Lunar.getLunarDate(now);
      if (lunar) {
        lunarDate = `农历${lunar.monthStr}${lunar.dayStr}`;
      }
    } catch (e) { lunarDate = ''; }

    let countdowns = [];
    try { countdowns = getCountdowns(); } catch (e) {}
    if (!showHolidays) countdowns = countdowns.filter(c => c.type !== 'holiday');
    if (!showTerms) countdowns = countdowns.filter(c => c.type !== 'term');
    if (!showTraditional) countdowns = countdowns.filter(c => c.type !== 'lunar' && c.type !== 'floating');

    // 🔹 锁屏圆形 (24×24)
    if (widgetFamily === 'accessoryCircular') {
      const next = countdowns[0];
      return {
        type: 'widget',
        padding: 6,
        backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
        refreshAfter: 'PT1H',
        children: [{
          type: 'stack', direction: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          children: [
            { type: 'image', src: 'sf-symbol:calendar.circle.fill', color: { light: '#FF3B30', dark: '#FF453A' }, width: 22, height: 22 },
            { type: 'text', text: next ? String(next.days) : '--', font: { size: 16, weight: 'bold' }, textColor: { light: '#1D1D1F', dark: '#F5F5F7' }, textAlign: 'center' }
          ]
        }]
      };
    }

    // 🔹 锁屏矩形/内联
    if (widgetFamily === 'accessoryRectangular' || widgetFamily === 'accessoryInline') {
      const next = countdowns[0];
      return {
        type: 'widget',
        padding: 8,
        backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
        refreshAfter: 'PT1H',
        children: [{
          type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
          children: [
            { type: 'image', src: 'sf-symbol:calendar', color: { light: '#FF3B30', dark: '#FF453A' }, width: 18, height: 18 },
            { type: 'text', text: next ? `${next.name} ${next.days}天` : title, font: { size: 12, weight: 'medium' }, textColor: { light: '#1D1D1F', dark: '#F5F5F7' }, maxLines: 1, flex: 1 }
          ]
        }]
      };
    }

    // 🔹 主屏幕小尺寸 (2×2) - 优化版：显示更多项目
    if (widgetFamily === 'systemSmall') {
      // 小尺寸显示 4-5 个项目
      const items = countdowns.slice(0, 5);
      
      return {
        type: 'widget',
        padding: 8,  // 减小边距
        backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
        refreshAfter: 'PT1H',
        children: [
          // 标题行（紧凑）
          { 
            type: 'text', 
            text: title, 
            font: { size: 11, weight: 'bold' }, 
            textColor: { light: '#1D1D1F', dark: '#F5F5F7' },
            maxLines: 1 
          },
          // 日期行（紧凑，农历可选）
          { 
            type: 'text', 
            text: lunarDate ? `${solarDate} ${lunarDate}` : solarDate, 
            font: { size: 9, weight: 'regular' }, 
            textColor: { light: '#666666', dark: '#999999' }, 
            maxLines: 1 
          },
          // 倒计时列表（紧凑格式）
          ...items.map((c, i) => ({ 
            type: 'text', 
            text: `${c.name} ${c.days}天`, 
            font: { size: 10, weight: i < 2 ? 'semibold' : 'regular' }, 
            textColor: { light: i < 2 ? '#FF3B30' : '#333333', dark: i < 2 ? '#FF453A' : '#CCCCCC' }, 
            maxLines: 1 
          }))
        ]
      };
    }

    // 🔹 主屏幕中尺寸（默认完整布局）
    if (widgetFamily === 'systemMedium') {
      const total = itemsPerRow * maxRows;
      const items = countdowns.slice(0, total);
      const rows = [];
      for (let i = 0; i < items.length; i += itemsPerRow) {
        const row = items.slice(i, i + itemsPerRow).map(c => `${c.name} ${c.days}天`).join('  ');
        rows.push(row);
      }

      const children = [
        { type: 'text', text: title, font: { size: 14, weight: 'bold' }, textColor: { light: '#1D1D1F', dark: '#F5F5F7' } },
        { type: 'text', text: lunarDate ? `${solarDate} ${lunarDate}` : solarDate, font: { size: 11, weight: 'medium' }, textColor: { light: '#666666', dark: '#999999' }, maxLines: 1 }
      ];
      rows.forEach((row, i) => {
        children.push({ type: 'text', text: row, font: { size: 12, weight: i < 2 ? 'semibold' : 'regular' }, textColor: { light: i < 2 ? '#FF3B30' : '#333333', dark: i < 2 ? '#FF453A' : '#CCCCCC' }, maxLines: 1 });
      });

      return {
        type: 'widget',
        backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
        padding: 10,
        refreshAfter: 'PT30M',
        children
      };
    }

    // 🔹 主屏幕大尺寸（4×4）
    const total = itemsPerRow * maxRows;
    const items = countdowns.slice(0, total);
    const rows = [];
    for (let i = 0; i < items.length; i += itemsPerRow) {
      const row = items.slice(i, i + itemsPerRow).map(c => `${c.name} ${c.days}天`).join('  ');
      rows.push(row);
    }

    const children = [
      { type: 'text', text: title, font: { size: 15, weight: 'bold' }, textColor: { light: '#1D1D1F', dark: '#F5F5F7' } },
      { type: 'text', text: lunarDate ? `${solarDate} ${lunarDate}` : solarDate, font: { size: 12, weight: 'medium' }, textColor: { light: '#666666', dark: '#999999' }, maxLines: 1 }
    ];
    rows.forEach((row, i) => {
      children.push({ type: 'text', text: row, font: { size: 13, weight: i < 3 ? 'semibold' : 'regular' }, textColor: { light: i < 3 ? '#FF3B30' : '#333333', dark: i < 3 ? '#FF453A' : '#CCCCCC' }, maxLines: 1 });
    });

    return {
      type: 'widget',
      backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
      padding: 12,
      refreshAfter: 'PT30M',
      children
    };

  } catch (error) {
    return {
      type: 'widget',
      padding: 12,
      backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
      children: [{
        type: 'stack', direction: 'column', alignItems: 'center', gap: 8,
        children: [
          { type: 'image', src: 'sf-symbol:exclamationmark.triangle.fill', color: { light: '#FF9500', dark: '#FF9F0A' }, width: 22, height: 22 },
          { type: 'text', text: '加载失败', font: { size: 12, weight: 'medium' }, textColor: { light: '#FF3B30', dark: '#FF453A' } }
        ]
      }]
    };
  }
}

