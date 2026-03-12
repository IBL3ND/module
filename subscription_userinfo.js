/**
 * 📅 节日倒计时小组件
 * 显示距离各种节日、节气、传统节日的天数
 */

/* ========== 🎊 节日数据定义 ========== */
const HOLIDAYS = {
  // 固定公历节日
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

// 传统节日（农历）
const LUNAR_HOLIDAYS = {
  '1-1': '春节',
  '1-15': '元宵节',
  '2-2': '龙抬头',
  '5-5': '端午节',
  '7-7': '七夕节',
  '7-15': '中元节',
  '8-15': '中秋节',
  '9-9': '重阳节',
  '10-1': '寒衣节',
  '12-8': '腊八节',
  '12-23': '小年',
  '12-30': '除夕'
};

// 二十四节气
const SOLAR_TERMS = {
  '01-05': '小寒', '01-20': '大寒',
  '02-03': '立春', '02-18': '雨水',
  '03-05': '惊蛰', '03-20': '春分',
  '04-04': '清明', '04-19': '谷雨',
  '05-05': '立夏', '05-20': '小满',
  '06-05': '芒种', '06-21': '夏至',
  '07-07': '小暑', '07-22': '大暑',
  '08-07': '立秋', '08-22': '处暑',
  '09-07': '白露', '09-22': '秋分',
  '10-08': '寒露', '10-23': '霜降',
  '11-07': '立冬', '11-22': '小雪',
  '12-07': '大雪', '12-21': '冬至'
};

// 其他节日（浮动日期）
const FLOATING_HOLIDAYS = {
  // 母亲节：5月第二个周日
  'mother': { name: '母亲节', calc: (y) => getNthWeekday(y, 5, 0, 2) },
  // 父亲节：6月第三个周日
  'father': { name: '父亲节', calc: (y) => getNthWeekday(y, 6, 0, 3) },
  // 万圣节
  'halloween': { name: '万圣节', calc: (y) => new Date(y, 9, 31) },
};

/* ========== 🌙 农历计算（简化版） ========== */
const Lunar = (function() {
  const lunarInfo = [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0];
  const nStr3 = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
  
  function getBit(num,n){return(num>>n)&1}
  function lunarYearDays(y){let s=348,i=0x8000;for(;i>0x8;i>>=1)s+=getBit(lunarInfo[y-1900],i)?1:0;return s+leapDays(y)}
  function leapDays(y){return leapMonth(y)?(getBit(lunarInfo[y-1900],0x10000)?30:29):0}
  function leapMonth(y){return lunarInfo[y-1900]&0xf}
  function monthDays(y,m){return getBit(lunarInfo[y-1900],0x10000-m)?30:29}
  
  function getLunarDate(objDate) {
    let baseDate = new Date(1900, 0, 31);
    let offset = Math.floor((objDate - baseDate) / 86400000);
    let y = 1900, m = 1, d = 1, leap = 0;
    for(; y < 2050 && offset > 0; y++) {
      let yearDays = lunarYearDays(y);
      if(offset > yearDays) offset -= yearDays; else break;
    }
    let lm = leapMonth(y);
    for(let i = 1; i < 13 && offset > 0; i++) {
      if(lm > 0 && i === lm + 1 && !leap) { --i; leap = 1; continue; }
      let md = leap ? leapDays(y) : monthDays(y, i);
      if(offset <= md) { m = i; d = offset; break; }
      offset -= md; leap = 0;
    }
    return { year: y, month: m, day: d };
  }
  
  return { getLunarDate };
})();

/* ========== 🔧 工具函数 ========== */
// 获取某年第n个星期几
function getNthWeekday(year, month, weekday, n) {
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = firstDay.getDay();
  const day = (weekday - firstWeekday + 7) % 7 + 1 + (n - 1) * 7;
  return new Date(year, month - 1, day);
}

// 计算天数差
function daysDiff(from, to) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.ceil((to - from) / oneDay);
}

// 格式化日期键
function dateKey(month, day) {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/* ========== 📊 获取所有倒计时 ========== */
function getCountdowns() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const results = [];
  
  // 1. 公历节日
  for (const [key, info] of Object.entries(HOLIDAYS)) {
    const [m, d] = key.split('-').map(Number);
    let targetDate = new Date(currentYear, m - 1, d);
    if (targetDate < now) targetDate = new Date(currentYear + 1, m - 1, d);
    const days = daysDiff(now, targetDate);
    results.push({ name: info.name, days, type: info.type });
  }
  
  // 2. 浮动节日
  for (const [key, info] of Object.entries(FLOATING_HOLIDAYS)) {
    let targetDate = info.calc(currentYear);
    if (targetDate < now) targetDate = info.calc(currentYear + 1);
    const days = daysDiff(now, targetDate);
    results.push({ name: info.name, days, type: 'floating' });
  }
  
  // 3. 节气
  for (const [key, name] of Object.entries(SOLAR_TERMS)) {
    const [m, d] = key.split('-').map(Number);
    let targetDate = new Date(currentYear, m - 1, d);
    if (targetDate < now) targetDate = new Date(currentYear + 1, m - 1, d);
    const days = daysDiff(now, targetDate);
    results.push({ name, days, type: 'term' });
  }
  
  // 4. 农历节日（简化处理）
  const lunar = Lunar.getLunarDate(now);
  for (const [key, name] of Object.entries(LUNAR_HOLIDAYS)) {
    const [lm, ld] = key.split('-').map(Number);
    // 简单处理：假设农历节日在公历的近似日期
    // 实际应该用农历转公历的算法
    let targetMonth = lm;
    let targetDay = ld;
    if (targetMonth < lunar.month || (targetMonth === lunar.month && targetDay <= lunar.day)) {
      targetMonth = (targetMonth % 12) + 1;
    }
    let targetDate = new Date(currentYear, targetMonth - 1, targetDay);
    if (targetDate < now) targetDate = new Date(currentYear + 1, targetMonth - 1, targetDay);
    const days = daysDiff(now, targetDate);
    results.push({ name, days, type: 'lunar' });
  }
  
  // 按天数排序
  results.sort((a, b) => a.days - b.days);
  
  return results;
}

/* ========== 🎨 DSL 组件 ========== */
function t(text, opts = {}) {
  const sizes = { title: 20, body: 15, caption: 12, tiny: 10 };
  return {
    type: 'text',
    text,
    font: { size: sizes[opts.size] || 14, weight: opts.weight || 'regular' },
    textColor: opts.color || { light: '#1D1D1F', dark: '#F5F5F7' },
    textAlign: opts.align || 'left',
    maxLines: opts.maxLines || 2
  };
}

function stack(children, opts = {}) {
  return {
    type: 'stack',
    direction: opts.direction || 'row',
    alignItems: opts.align || 'center',
    gap: opts.gap || 8,
    children: children.filter(Boolean)
  };
}

function img(src, opts = {}) {
  const s = opts.size || 24;
  return {
    type: 'image',
    src: src.startsWith('sf:') ? src.replace('sf:', 'sf-symbol:') : `sf-symbol:${src}`,
    width: s, height: s,
    color: opts.color || { light: '#007AFF', dark: '#0A84FF' }
  };
}

/* ========== 🧩 主入口 ========== */
export default async function(ctx) {
  const env = ctx.env || {};
  const title = env.TITLE || '📅 节日倒计时';
  const showHolidays = env.SHOW_HOLIDAYS !== 'false';
  const showTerms = env.SHOW_TERMS !== 'false';
  const showTraditional = env.SHOW_TRADITIONAL !== 'false';
  const itemsPerRow = parseInt(env.ITEMS_PER_ROW) || 3;
  
  const countdowns = getCountdowns();
  
  // 过滤类型
  let filtered = countdowns;
  if (!showHolidays) filtered = filtered.filter(c => c.type !== 'holiday');
  if (!showTerms) filtered = filtered.filter(c => c.type !== 'term');
  if (!showTraditional) filtered = filtered.filter(c => c.type !== 'lunar' && c.type !== 'floating');
  
  // 取前 N 个
  const displayItems = filtered.slice(0, itemsPerRow * 3); // 显示3行
  
  // 分组为行
  const rows = [];
  for (let i = 0; i < displayItems.length; i += itemsPerRow) {
    const rowItems = displayItems.slice(i, i + itemsPerRow);
    const rowText = rowItems.map(c => `${c.name}${c.days}天`).join(' | ');
    rows.push(rowText);
  }
  
  return {
    type: 'widget',
    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
    padding: 16,
    children: [
      // 标题
      t(title, { size: 'title', weight: 'semibold' }),
      
      // 倒计时行
      ...rows.map(row => t(row, { size: 'body', color: { light: '#333', dark: '#DDD' } }))
    ]
  };
}

