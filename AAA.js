/**
 * 🗓️ 我的排班小组件
 *
 * 排班数据：在模块设置里按班次填写本月日期号（逗号分隔），没填的日期默认休息。
 *   SHIFT_BAI   白班   例：1,8,15
 *   SHIFT_ZAO   早班
 *   SHIFT_YE    夜班
 *   SHIFT_WU    午班
 *   SHIFT_XIAYE 下夜
 *   SHIFT_DAYE  大夜
 */

export default async function (ctx) {
  return handleWidget(ctx);
}

async function handleWidget(ctx) {
  const safeCtx = ctx || {};
  const env = safeCtx.env || {};
  const family = safeCtx.widgetFamily || 'systemLarge';

  const SHIFT_DEFS = [
    { key: 'SHIFT_BAI',   name: '白班', color: '#D97D36' },
    { key: 'SHIFT_ZAO',   name: '早班', color: '#DE7A9C' },
    { key: 'SHIFT_YE',    name: '夜班', color: '#7C86E8' },
    { key: 'SHIFT_WU',    name: '午班', color: '#E8894F' },
    { key: 'SHIFT_XIAYE', name: '下夜', color: '#3FA796' },
    { key: 'SHIFT_DAYE',  name: '大夜', color: '#4E9464' },
  ];
  const REST = { name: '休息', color: '#3E9B5F' };


  function parseDays(str) {
    const out = new Set();
    if (str == null) return out;
    String(str).split(/[^0-9]+/).forEach((t) => {
      if (!t) return;
      const n = parseInt(t, 10);
      if (n >= 1 && n <= 31) out.add(n);
    });
    return out;
  }

  const dayMap = {};
  SHIFT_DEFS.forEach((def) => {
    const raw = env[def.key];
    parseDays(raw).forEach((d) => {
      if (!dayMap[d]) dayMap[d] = def;
    });
  });
  function shiftOf(dayNum) {
    return dayMap[dayNum] || REST;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const weekRows = Math.ceil((startOffset + daysInMonth) / 7);
  const WEEK_CHARS = ['一', '二', '三', '四', '五', '六', '日'];
  const weekCharOf = (dateObj) => WEEK_CHARS[(dateObj.getDay() + 6) % 7];

  const next = new Date(now.getTime() + 36 * 3600 * 1000);
  const refreshAfter = new Date(next.getFullYear(), next.getMonth(), next.getDate(), 0, 5).toISOString();

  const textMain = { light: '#1C1C1E', dark: '#F2F2F7' };
  const textSub = { light: '#8A8A8E', dark: '#98989F' };
  const textWeekend = { light: '#B9B9A8', dark: '#6E6E66' };
  const todayBg = { light: '#0000000D', dark: '#FFFFFF14' };
  const todayBorder = { light: '#A3B899', dark: '#7A9A72' };
  const capsuleColor = (hex) => ({ light: hex + 'E6', dark: hex + 'E6' });

  const counts = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const s = shiftOf(d);
    counts[s.name] = (counts[s.name] || 0) + 1;
  }
  const statsText = SHIFT_DEFS.concat([REST])
    .filter((s) => counts[s.name])
    .map((s) => `${s.name} ${counts[s.name]}`)
    .join(' · ');

  function capsule(shift, big) {
    return {
      type: 'stack',
      direction: 'row',
      backgroundColor: capsuleColor(shift.color),
      borderRadius: big ? 8 : 5,
      padding: big ? [3, 8, 3, 8] : [2, 7, 2, 7],
      children: [
        { type: 'text', text: shift.name, font: { size: big ? 12 : 10, weight: 'bold' }, textColor: '#FFFFFF' },
      ],
    };
  }

  function dayCell(dayNum, isToday, isWeekend, dateSize) {
    const shift = shiftOf(dayNum);
    const cell = {
      type: 'stack',
      direction: 'column',
      alignItems: 'center',
      flex: 1,
      padding: [3, 0, 3, 0],
      children: [
        {
          type: 'text',
          text: String(dayNum),
          font: { size: dateSize, weight: isToday ? 'bold' : 'medium' },
          textColor: isWeekend ? textWeekend : textMain,
        },
        { type: 'spacer', length: 2 },
        capsule(shift, false),
      ],
    };
    if (isToday) {
      cell.backgroundColor = todayBg;
      cell.borderRadius = 8;
      cell.borderWidth = 1;
      cell.borderColor = todayBorder;
    }
    return cell;
  }

  function emptyCell() {
    return { type: 'stack', direction: 'column', flex: 1, children: [{ type: 'spacer' }] };
  }

  function weekRow(rowIdx, dateSize) {
    const cells = [];
    for (let c = 0; c < 7; c++) {
      const dayNum = rowIdx * 7 + c - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) cells.push(emptyCell());
      else cells.push(dayCell(dayNum, dayNum === today, c >= 5, dateSize));
    }
    return { type: 'stack', direction: 'row', children: cells };
  }

  function weekdayHeader(size) {
    return {
      type: 'stack',
      direction: 'row',
      children: WEEK_CHARS.map((w, i) => ({
        type: 'stack',
        direction: 'column',
        alignItems: 'center',
        flex: 1,
        children: [
          { type: 'text', text: w, font: { size: size, weight: 'medium' }, textColor: i >= 5 ? textWeekend : textSub },
        ],
      })),
    };
  }

  function headerRow(titleSize) {
    const c1 = shiftOf(today).name;
    const c2 = shiftOf(today + 1 <= daysInMonth ? today + 1 : 1).name;
    return {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      children: [
        { type: 'text', text: '我的排班', font: { size: titleSize, weight: 'bold' }, textColor: textMain },
        { type: 'spacer' },
        { type: 'text', text: `今日 ${c1} · 明日 ${c2}`, font: { size: titleSize - 3, weight: 'bold' }, textColor: textMain },
        { type: 'spacer' },
        { type: 'text', text: `${year}年${month + 1}月`, font: { size: titleSize - 3, weight: 'medium' }, textColor: textSub },
      ],
    };
  }

  if (family === 'accessoryCircular') {
    return {
      type: 'widget',
      padding: 0,
      children: [
        {
          type: 'stack', direction: 'column', alignItems: 'center',
          children: [
            { type: 'text', text: shiftOf(today).name, font: { size: 13, weight: 'bold' } },
            { type: 'text', text: `${month + 1}/${today}`, font: { size: 9 } },
          ],
        },
      ],
      refreshAfter,
    };
  }
  if (family === 'accessoryInline') {
    return {
      type: 'widget',
      padding: 0,
      children: [
        { type: 'text', text: `今日${shiftOf(today).name} · 明日${shiftOf(today + 1 <= daysInMonth ? today + 1 : 1).name}`, font: { size: 12 } },
      ],
      refreshAfter,
    };
  }
  if (family && family.indexOf('accessory') === 0) {
    const t1 = shiftOf(today).name;
    const t2 = shiftOf(today + 1 <= daysInMonth ? today + 1 : 1).name;
    return {
      type: 'widget',
      padding: [4, 8, 4, 8],
      children: [
        {
          type: 'stack', direction: 'column',
          children: [
            { type: 'text', text: `今日 ${t1}`, font: { size: 13, weight: 'bold' } },
            { type: 'text', text: `明日 ${t2} · ${month + 1}月${today}日 周${weekCharOf(now)}`, font: { size: 11 } },
          ],
        },
      ],
      refreshAfter,
    };
  }

  if (family === 'systemSmall') {
    const rows = [1, 2, 3, 4].map((off) => {
      const d = new Date(year, month, today + off);
      const label = off === 1 ? '明日' : off === 2 ? '后日' : `周${weekCharOf(d)}`;
      const s = d.getMonth() === month ? shiftOf(d.getDate()) : shiftOf(d.getDate());
      return {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          { type: 'text', text: `${label} ${d.getMonth() + 1}/${d.getDate()}`, font: { size: 12, weight: 'medium' }, textColor: textSub },
          { type: 'spacer' },
          capsule(s, true),
        ],
      };
    });
    return {
      type: 'widget',
      padding: [12, 14, 12, 14],
      children: [
        {
          type: 'stack', direction: 'column',
          children: [
            {
              type: 'stack', direction: 'row', alignItems: 'center',
              children: [
                { type: 'text', text: `${month + 1}月${today}日`, font: { size: 14, weight: 'bold' }, textColor: textMain },
                { type: 'spacer' },
                { type: 'text', text: `今日${shiftOf(today).name}`, font: { size: 11, weight: 'bold' }, textColor: textMain },
                { type: 'spacer' },
                { type: 'text', text: `周${weekCharOf(now)}`, font: { size: 11, weight: 'medium' }, textColor: textSub },
              ],
            },
            { type: 'spacer', length: 8 },
            rows[0],
            { type: 'spacer', length: 6 },
            rows[1],
            { type: 'spacer', length: 6 },
            rows[2],
            { type: 'spacer', length: 6 },
            rows[3],
            { type: 'spacer' },
            { type: 'text', text: statsText, font: { size: 9 }, textColor: textSub, maxLines: 1 },
          ],
        },
      ],
      refreshAfter,
    };
  }

  if (family === 'systemMedium') {
    const todayRow = Math.floor((startOffset + today - 1) / 7);
    const rowA = todayRow;
    const rowB = todayRow + 1 < weekRows ? todayRow + 1 : todayRow - 1;
    const firstRow = Math.min(rowA, rowB);
    const secondRow = Math.max(rowA, rowB);
    return {
      type: 'widget',
      padding: [10, 14, 8, 14],
      children: [
        {
          type: 'stack', direction: 'column',
          children: [
            headerRow(14),
            { type: 'spacer', length: 6 },
            weekdayHeader(10),
            { type: 'spacer', length: 4 },
            weekRow(firstRow, 13),
            weekRow(secondRow, 13),
            { type: 'spacer' },
          ],
        },
      ],
      refreshAfter,
    };
  }

  const gridRows = [];
  for (let r = 0; r < weekRows; r++) {
    gridRows.push(Object.assign(weekRow(r, 15), { flex: 1 }));
  }
  return {
    type: 'widget',
    padding: [12, 14, 10, 14],
    children: [
      {
        type: 'stack', direction: 'column',
        children: [
          headerRow(16),
          { type: 'spacer', length: 8 },
          weekdayHeader(11),
          { type: 'spacer', length: 6 },
          { type: 'stack', direction: 'column', flex: 1, children: gridRows },
          { type: 'spacer', length: 4 },
          { type: 'text', text: statsText, font: { size: 10, weight: 'medium' }, textColor: textSub, maxLines: 1 },
        ],
      },
    ],
    refreshAfter,
  };
}
