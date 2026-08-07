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

// 在给定公历年份 ~ 次年3月10日范围内，找到对应"农历 targetLunarMonth月targetLunarDay日"(非闰月)的公历日期
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

/* ===================== 组件渲染 ===================== */
export default async function(ctx) {
  try {
    const env = ctx.env || {};
    const widgetFamily = ctx.widgetFamily || 'systemMedium';

    const CONFIG = {
      padding: 8, itemGap: 6, maxRows: 6,
      fontSize: { small: 9, medium: 10, large: 11 },
      maxNameLength: 4, warningDays: 7, urgentDays: 3
    };

    const truncateName = (name) => name.length <= CONFIG.maxNameLength ? name : name.slice(0, CONFIG.maxNameLength) + '…';

    const getCapsuleColor = (days) => {
      if (days === 0) {
        return {
          bg: { light: "#FF858515", dark: "#FF858525" },
          border: { light: "#FF858550", dark: "#FF858570" },
          text: { light: "#D44444", dark: "#FFB3B3" }
        };
      }
      if (days <= CONFIG.urgentDays) {
        return {
          bg: { light: "#FF3B3015", dark: "#FF453A20" },
          border: { light: "#FF3B3050", dark: "#FF453A60" },
          text: { light: "#D43028", dark: "#FF5E56" }
        };
      }
      if (days <= CONFIG.warningDays) {
        return {
          bg: { light: "#FF950015", dark: "#FF9F0A20" },
          border: { light: "#FF950050", dark: "#FF9F0A60" },
          text: { light: "#D47D00", dark: "#FFB340" }
        };
      }
      return {
        bg: { light: "#34C75915", dark: "#30D15820" },
        border: { light: "#34C75950", dark: "#30D15860" },
        text: { light: "#2E8B57", dark: "#4CD964" }
      };
    };

    const renderGrid = (items, maxColumns, fontSize) => {
      if (!items?.length) return [];
      const cols = maxColumns;
      const limit = CONFIG.maxRows * cols;
      const rows = [];
      for (let i = 0; i < Math.min(items.length, limit); i += cols) {
        const chunk = items.slice(i, i + cols);
        rows.push({
          type: 'stack', direction: 'row', alignItems: 'center', justifyContent: 'space-between', gap: CONFIG.itemGap,
          children: chunk.map(c => {
            const dayText = c.days === 0 ? '今天' : `${c.days}天`;
            return {
              type: 'stack', direction: 'row', alignItems: 'center', justifyContent: 'center', flex: 1,
              padding: [5, 8, 5, 8], backgroundColor: getCapsuleColor(c.days).bg, borderRadius: 10,
              borderWidth: 1, borderColor: getCapsuleColor(c.days).border,
              children: [{
                type: 'text',
                text: `${truncateName(c.name)} ${dayText}`,
                font: { size: fontSize, weight: 'medium' },
                textColor: getCapsuleColor(c.days).text,
                textAlign: 'center',
                maxLines: 1,
                minScale: 0.7
              }]
            };
          })
        });
      }
      return rows;
    };

    if (widgetFamily === 'accessoryCircular') {
      const next = getCountdowns()[0];
      const c = getCapsuleColor(next?.days ?? 999);
      const displayText = next?.days === 0 ? '今' : (next ? String(next.days) : '--');
      return { type: 'widget', padding: 6, children: [{ type: 'stack', direction: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, children: [
        { type: 'image', src: 'sf-symbol:calendar.circle.fill', width: 22, height: 22, color: c.text },
        { type: 'text', text: displayText, font: { size: 16, weight: 'bold' }, textColor: c.text, textAlign: 'center' }
      ]}] };
    }

    if (widgetFamily === 'accessoryRectangular' || widgetFamily === 'accessoryInline') {
      const next = getCountdowns()[0];
      const c = getCapsuleColor(next?.days ?? 999);
      const displayText = next ? (next.days === 0 ? `${next.name} 今天` : `${next.name} ${next.days}天`) : '节日倒计时';
      return { type: 'widget', padding: 8, children: [{ type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [
        { type: 'image', src: 'sf-symbol:calendar', width: 18, height: 18, color: c.text },
        { type: 'text', text: displayText, font: { size: 12, weight: 'medium' }, textColor: c.text, flex: 1, maxLines: 1, textAlign: 'left' }
      ]}] };
    }

    const genWidget = (size) => {
      const items = getCountdowns();
      const showH = env.SHOW_HOLIDAYS !== 'false';
      const showT = env.SHOW_TERMS !== 'false';
      const showL = env.SHOW_TRADITIONAL !== 'false';
      let filtered = items;
      if (!showH) filtered = filtered.filter(c => c.type !== 'holiday');
      if (!showT) filtered = filtered.filter(c => c.type !== 'term');
      if (!showL) filtered = filtered.filter(c => c.type !== 'lunar' && c.type !== 'floating');

      return { type: 'widget', padding: CONFIG.padding, children: renderGrid(filtered, size.cols, size.font) };
    };

    if (widgetFamily === 'systemSmall') return genWidget({ cols: 4, font: CONFIG.fontSize.small });
    if (widgetFamily === 'systemMedium') return genWidget({ cols: 5, font: CONFIG.fontSize.medium });
    return genWidget({ cols: 6, font: CONFIG.fontSize.large });

  } catch (error) {
    console.error('[Widget Error]', error);
    return { type: 'widget', padding: 12, children: [{ type: 'stack', direction: 'column', alignItems: 'center', gap: 8, children: [
      { type: 'image', src: 'sf-symbol:exclamationmark.triangle.fill', color: { light: '#FF9500', dark: '#FF9F0A' }, width: 22, height: 22 },
      { type: 'text', text: '加载失败', font: { size: 12, weight: 'medium' }, textColor: { light: '#FF3B30', dark: '#FF453A' } }
    ]}] };
  }
}
