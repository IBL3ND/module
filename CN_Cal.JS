/** 万年历
*/

export default async function(ctx) {
  // --- 辅助函数：计算当前是第几周 ---
  function getWeekNumber(date) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
  }

  // --- 真实农历核心算法 ---
  const lunarInfo = [
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
    0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,
    0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
    0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
    0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
    0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
    0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0
  ];

  function lYearDays(y) {
    let i, sum = 348;
    for (i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
    return sum + leapDays(y);
  }
  function leapDays(y) {
    if (lunarInfo[y - 1900] & 0xf) return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29;
    return 0;
  }
  function leapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
  function monthDays(y, m) { return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }

  function getLunarDate(dObj) {
    let baseDate = new Date(Date.UTC(1900, 0, 31));
    let objDate = new Date(Date.UTC(dObj.getFullYear(), dObj.getMonth(), dObj.getDate()));
    let offset = Math.floor((objDate - baseDate) / 86400000);
    let y, m, i, days = 0;
    for (y = 1900; y < 2050 && offset > 0; y++) {
      days = lYearDays(y);
      offset -= days;
    }
    if (offset < 0) { offset += days; y--; }
    let leap = leapMonth(y);
    let isLeap = false;
    for (i = 1; i < 13 && offset > 0; i++) {
      if (leap > 0 && i === (leap + 1) && !isLeap) {
        --i; isLeap = true; days = leapDays(y);
      } else {
        days = monthDays(y, i);
      }
      if (isLeap && i === (leap + 1)) isLeap = false;
      offset -= days;
    }
    if (offset === 0 && leap > 0 && i === leap + 1) {
      if (isLeap) isLeap = false; else { isLeap = true; --i; }
    }
    if (offset < 0) { offset += days; --i; }
    return { year: y, month: i, day: offset + 1, isLeap: isLeap };
  }

  const lunarMonths = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
  const lunarDaysStr = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

  function getRealLunarFull(dObj) {
    const l = getLunarDate(dObj);
    return (l.isLeap ? '闰' : '') + lunarMonths[l.month - 1] + lunarDaysStr[l.day - 1];
  }
  
  function getRealLunarDay(dObj) {
    const l = getLunarDate(dObj);
    if (l.day === 1) return (l.isLeap ? '闰' : '') + lunarMonths[l.month - 1];
    return lunarDaysStr[l.day - 1];
  }

  // --- 初始化日期 ---
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();
  const day = now.getDay();
  
  const currentWeekNum = getWeekNumber(now);
  const currentLunarStr = getRealLunarFull(now);

  const themeRed = { light: '#C83C3C', dark: '#C83C3C' }; 
  const textRed = { light: '#C83C3C', dark: '#FF6B6B' };  
  const textMain = { light: '#333333', dark: '#FFFFFF' }; 
  const textSub = { light: '#888888', dark: '#CCCCCC' };  
  const textFade = { light: '#C7C7CC', dark: '#777777' }; 

  const family = ctx.widgetFamily || 'systemLarge';
  const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
  const isTodayWeekend = day === 0 || day === 6;

  // ==========================================
  // 小号组件 (Small) - 今日聚焦
  // ==========================================
  if (family === 'systemSmall') {
    return {
      type: 'widget',
      url: 'calshow://',
      padding: 0,
      backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
      children: [
        {
          type: 'stack',
          direction: 'row',
          backgroundColor: themeRed,
          padding: [8, 12, 8, 12], 
          children: [
            { type: 'text', text: `${year}年${month + 1}月`, font: { size: 11, weight: 'bold' }, textColor: '#FFFFFF' },
            { type: 'spacer' },
            { type: 'text', text: `周${weekdays[day === 0 ? 6 : day - 1]}`, font: { size: 11, weight: 'bold' }, textColor: '#FFFFFF' }
          ]
        },
        {
          type: 'stack',
          direction: 'column',
          alignItems: 'center',
          flex: 1,
          children: [
            { type: 'spacer' },
            { type: 'text', text: String(date), font: { size: 46, weight: 'medium' }, textColor: isTodayWeekend ? textRed : textMain },
            { type: 'spacer', length: 2 },
            { type: 'text', text: currentLunarStr, font: { size: 14, weight: 'medium' }, textColor: textSub },
            { type: 'spacer' }
          ]
        }
      ]
    };
  }

  // ==========================================
  // 中号/大号组件 (Medium / Large) - 动态自适应网格
  // ==========================================
  
  let ui = {
    headerPad: [12, 16, 10, 16], headerTitle: 15, headerLunar: 16,
    weekPad: [0, 0, 6, 0], weekSize: 12, gridPad: [8, 16, 12, 16],
    rowGap: 4, dateSize: 16, lunarSize: 10, innerGap: 1,
    circleSize: 32 // 大号组件的圆圈宽高
  };

  if (family === 'systemMedium') {
    ui = {
      headerPad: [4, 16, 2, 16], // 极致压缩顶部空间，给日历网格留足高度
      headerTitle: 11, 
      headerLunar: 11,
      weekPad: [0, 0, 2, 0], 
      weekSize: 9, 
      gridPad: [2, 16, 2, 16], 
      rowGap: 0, 
      dateSize: 11,            
      lunarSize: 7,            
      innerGap: 0,
      circleSize: 20 // 【核心修改】精准控制到 20x20，绝对安全的高度，不会重叠！
    };
  } 

  const headerSection = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center', 
    backgroundColor: themeRed,
    padding: ui.headerPad,
    children: [
      {
        type: 'text',
        text: `${year}年${month + 1}月 第${currentWeekNum}周`,
        font: { size: ui.headerTitle, weight: 'medium' },
        textColor: '#FFFFFF'
      },
      { type: 'spacer' },
      {
        type: 'text',
        text: currentLunarStr, 
        font: { size: ui.headerLunar, weight: 'medium' },
        textColor: '#FFFFFF'
      }
    ]
  };

  const weekdayHeaderStack = {
    type: 'stack',
    direction: 'row',
    gap: 0,
    padding: ui.weekPad, 
    children: weekdays.map((wd, index) => {
      const isWeekend = index === 5 || index === 6; 
      return {
        type: 'stack',
        flex: 1,
        alignItems: 'center',
        children: [{
          type: 'text',
          text: wd,
          font: { size: ui.weekSize, weight: 'medium' },
          textColor: isWeekend ? textRed : textMain
        }]
      };
    })
  };

  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; 
  const daysInMonth = new Date(year, month + 1, 0).getDate(); 
  
  const weekStacks = [];
  let currentDayOffset = 1 - firstDayIndex; 

  for (let r = 0; r < 6; r++) {
    const dayCells = [];
    for (let c = 0; c < 7; c++) {
      const cellDateObj = new Date(year, month, currentDayOffset);
      const displayDate = cellDateObj.getDate();
      
      let isToday = false;
      let isCurrentMonth = false;
      const isWeekend = c === 5 || c === 6;

      if (cellDateObj.getMonth() === month) {
        isCurrentMonth = true;
        if (displayDate === date) isToday = true;
      }

      let primaryColor, secondaryColor;
      if (isToday) {
        primaryColor = '#FFFFFF';
        secondaryColor = '#FFFFFF'; 
      } else if (isCurrentMonth) {
        primaryColor = isWeekend ? textRed : textMain;
        secondaryColor = isWeekend ? textRed : textSub;
      } else {
        primaryColor = textFade;
        secondaryColor = textFade;
      }

      // --- 🌟 完美正圆 + 笔直对齐列 🌟 ---
      let textContent = [
        { type: 'spacer' }, // 顶部弹性占位（用于强制垂直居中）
        {
          type: 'text',
          text: String(displayDate),
          font: { size: ui.dateSize, weight: isToday ? 'bold' : 'regular' },
          textColor: primaryColor,
          minScale: 0.8
        }
      ];

      if (ui.innerGap > 0) {
        textContent.push({ type: 'spacer', length: ui.innerGap });
      }

      textContent.push({
        type: 'text',
        text: getRealLunarDay(cellDateObj),
        font: { size: ui.lunarSize, weight: 'regular' },
        textColor: secondaryColor,
        minScale: 0.8
      });
      
      textContent.push({ type: 'spacer' }); // 底部弹性占位（用于强制垂直居中）

      // 无论是不是今天，都给它套上一个绝对等宽、等高的隐形正方形盒子！
      let innerCell = {
        type: 'stack',
        direction: 'column',
        alignItems: 'center',
        width: ui.circleSize,  // 【关键修复】统一定义宽度，杜绝文字长短撑开导致列弯曲！
        height: ui.circleSize, // 【关键修复】统一定义高度（中号 20px，绝不重叠）
        backgroundColor: isToday ? themeRed : undefined,
        borderRadius: 100, // 给个极大的数值，iOS 会完美切成正圆
        children: textContent
      };

      // 外层用于按列均分布局
      let cellObj = {
        type: 'stack',
        flex: 1,
        direction: 'column',
        alignItems: 'center',
        children: [ innerCell ]
      };

      dayCells.push(cellObj);
      currentDayOffset++;
    }
    
    weekStacks.push({
      type: 'stack',
      direction: 'row',
      gap: 0,
      children: dayCells
    });
  }

  return {
    type: 'widget',
    url: 'calshow://',
    padding: 0, 
    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
    children: [
      headerSection, 
      {
        type: 'stack',
        direction: 'column',
        padding: ui.gridPad, 
        gap: ui.rowGap, 
        children: [
          weekdayHeaderStack,
          ...weekStacks
        ]
      }
    ]
  };
}
