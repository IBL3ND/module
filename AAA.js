/**
 * Egern 黄历小组件 - 严格复刻 Holiday_Countdown.js 成功模式
 * 基于 jnlaoshu/Almanac.js 农历核心
 */

// ===== 农历核心数据（1900-2100）=====
const LUNAR_INFO = [
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
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
  0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
  0x0d520
];

const GAN = "甲乙丙丁戊己庚辛壬癸";
const ZHI = "子丑寅卯辰巳午未申酉戌亥";
const ANI = "鼠牛虎兔龙蛇马羊猴鸡狗猪";
const N_STR = ["","一","二","三","四","五","六","七","八","九","十"];
const MON_STR = ["正","二","三","四","五","六","七","八","九","十","冬","腊"];
const WEEK = ["日","一","二","三","四","五","六"];
const YI_POOL = ["祭祀","祈福","嫁娶","出行","动土","安床","开市","交易","纳财","入宅"];
const JI_POOL = ["安葬","破土","词讼","掘井","栽种","探病","余事勿取"];

// ===== 工具函数 =====
function hashDate(y, m, d) { return ((y*10000 + m*100 + d) * 31 + 7) % 1000; }

function getLunar(y, m, d) {
  let offset = (Date.UTC(y, m-1, d) - Date.UTC(1900, 0, 31)) / 86400000;
  let i, temp;
  for (i = 1900; i < 2101 && offset > 0; i++) {
    temp = 348;
    for (let j = 0x8000; j > 0x8; j >>= 1) if (LUNAR_INFO[i-1900] & j) temp += 1;
    const leap = LUNAR_INFO[i-1900] & 0xf;
    if (leap) temp += (LUNAR_INFO[i-1900] & 0x10000) ? 30 : 29;
    offset -= temp;
  }
  if (offset < 0) { offset += temp; i--; }
  const lYear = i, leap = LUNAR_INFO[lYear-1900] & 0xf;
  let isLeap = false, lMonth = 1;
  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === leap+1 && !isLeap) { i--; isLeap = true; temp = (LUNAR_INFO[lYear-1900] & 0x10000) ? 30 : 29; }
    else temp = (LUNAR_INFO[lYear-1900] & (0x10000 >> i)) ? 30 : 29;
    if (isLeap && i === leap+1) isLeap = false;
    offset -= temp;
  }
  if (offset < 0) { offset += temp; i--; }
  const lDay = Math.floor(offset) + 1;
  let dayStr;
  if (lDay === 10) dayStr = "初十";
  else if (lDay === 20) dayStr = "二十";
  else if (lDay === 30) dayStr = "三十";
  else {
    const p = ["初","十","廿","卅"][Math.floor(lDay/10)];
    dayStr = p + N_STR[lDay % 10];
  }
  return {
    gz: GAN[(lYear-4)%10] + ZHI[(lYear-4)%12],
    ani: ANI[(lYear-4)%12],
    cn: (isLeap?"闰":"") + MON_STR[i-1] + "月" + dayStr
  };
}

function getLocalYiJi(y, m, d) {
  const h = hashDate(y, m, d);
  return {
    yi: YI_POOL.slice(0, 3 + h%3),
    ji: JI_POOL.slice(0, 2 + (h+5)%3)
  };
}

// ===== 主入口（严格复刻成功脚本模式）=====
export default async function(ctx) {
  // 1. 读取环境变量（参考成功脚本）
  const env = ctx.env || {};
  const showLunar = env.SHOW_LUNAR !== 'false';
  const showYiJi = env.SHOW_YIJI !== 'false';
  
  // 2. 时间计算（+8 时区）
  const now = new Date(Date.now() + (new Date().getTimezoneOffset() + 480) * 60000);
  const [Y, M, D] = [now.getFullYear(), now.getMonth()+1, now.getDate()];
  const W = WEEK[now.getDay()];
  
  // 3. 获取数据
  const lunar = getLunar(Y, M, D);
  const yiji = getLocalYiJi(Y, M, D);
  const hash = hashDate(Y, M, D);
  
  // 4. 尺寸适配（用数字字号）
  const family = ctx.widgetFamily || "systemMedium";
  const isSmall = family === "systemSmall" || family === "accessoryCircular";
  const FONT_TITLE = isSmall ? 14 : 16;
  const FONT_BODY = isSmall ? 11 : 13;
  const FONT_TINY = isSmall ? 10 : 11;
  
  // 5. 构建 children 数组（直接构建，参考成功脚本）
  const children = [
    // 头部：图标 + 标题 + 日期
    {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 8,
      children: [
        {
          type: 'image',
          src: 'sf-symbol:calendar',
          color: { light: '#E63946', dark: '#FF6B6B' },
          width: 22,
          height: 22
        },
        {
          type: 'text',
          text: '今日黄历',
          font: { size: FONT_TITLE, weight: 'semibold' },
          textColor: { light: '#1D1D1F', dark: '#F5F5F7' },
          textAlign: 'left'
        }
      ]
    },
    // 公历日期
    {
      type: 'text',
      text: `${Y}年${M}月${D}日 星期${W}`,
      font: { size: FONT_BODY, weight: 'medium' },
      textColor: { light: '#666666', dark: '#999999' },
      textAlign: 'left',
      maxLines: 1
    },
    // 农历信息（可选）
    showLunar ? {
      type: 'text',
      text: `${lunar.gz}年 ${lunar.ani}年 ${lunar.cn}`,
      font: { size: FONT_TINY, weight: 'regular' },
      textColor: { light: '#999999', dark: '#777777' },
      textAlign: 'left',
      maxLines: 1
    } : null,
    // 宜事项
    showYiJi ? {
      type: 'text',
      text: '宜：' + yiji.yi.join(' '),
      font: { size: FONT_TINY, weight: 'regular' },
      textColor: { light: '#E63946', dark: '#FF6B6B' },
      textAlign: 'left',
      maxLines: 1
    } : null,
    // 忌事项
    showYiJi ? {
      type: 'text',
      text: '忌：' + yiji.ji.join(' '),
      font: { size: FONT_TINY, weight: 'regular' },
      textColor: { light: '#1D3557', dark: '#457B9D' },
      textAlign: 'left',
      maxLines: 1
    } : null,
    // 冲煞信息
    {
      type: 'text',
      text: `冲${ANI[hash%12]} 煞${["东","南","西","北"][hash%4]}`,
      font: { size: FONT_TINY, weight: 'regular' },
      textColor: { light: '#888888', dark: '#666666' },
      textAlign: 'left',
      maxLines: 1
    }
  ].filter(Boolean); // 过滤 null
  
  // 6. 返回根 Widget（严格复刻成功格式）
  return {
    type: 'widget',
    backgroundColor: { light: '#FFF9E6', dark: '#2C1810' },  // ✅ 对象格式
    padding: 12,                                              // ✅ 单一数值
    children: children                                        // ✅ 直接数组
    // ✅ 不设置 refreshAfter，让 Egern 自动管理
  };
}

