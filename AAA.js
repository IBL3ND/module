/**
 * Egern 黄历小组件 
 * 特点：纯本地计算 + 最小依赖 + 严格遵循 DSL 规范
 */

// ===== 常量定义 =====
const WEEK_DAY = ['日','一','二','三','四','五','六'];
const ANIMALS = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DI_ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 简化宜忌数据（演示用）
const YI_ITEMS = ['祭祀','祈福','出行','开市','纳财'];
const JI_ITEMS = ['安葬','破土','词讼','栽种'];

// ===== 工具函数 =====
function getGanZhi(year) {
  const offset = (year - 4) % 60;
  return TIAN_GAN[offset % 10] + DI_ZHI[offset % 12];
}

function getLunarDayStr(day) {
  const CH = ['初','十','廿','三十'];
  if (day === 1) return '初一';
  if (day < 11) return '初' + ['','一','二','三','四','五','六','七','八','九'][day];
  if (day === 10) return '初十';
  if (day < 20) return '十' + ['','一','二','三','四','五','六','七','八','九'][day-10];
  if (day === 20) return '二十';
  if (day < 30) return '廿' + ['','一','二','三','四','五','六','七','八','九'][day-20];
  return '三十';
}

function getHuangliSimple(date) {
  const y = date.getFullYear(), m = date.getMonth()+1, d = date.getDate();
  const hash = (y*10000 + m*100 + d) % 100;
  
  // 简化农历计算（演示精度）
  const base = new Date(2000,0,1);
  const diff = Math.floor((date - base) / 86400000);
  const lunarD = ((25 + diff) % 30) || 30;
  
  return {
    gregorian: `${m}月${d}日 星期${WEEK_DAY[date.getDay()]}`,
    lunar: `${getGanZhi(y)}年 ${getLunarDayStr(lunarD)}`,
    zodiac: ANIMALS[(y-4)%12],
    yi: YI_ITEMS.slice(0, 2 + hash%3),
    ji: JI_ITEMS.slice(0, 2 + (hash+5)%3),
    chong: ANIMALS[hash%12],
    sha: ['东','南','西','北'][hash%4],
    luck: (hash%5)+1
  };
}

// ===== 主入口（严格按文档：export default async function）=====
export default async function(ctx) {
  // 1. 基础信息
  const data = getHuangliSimple(new Date());
  const family = ctx.widgetFamily || 'systemMedium';
  const isSmall = family === 'systemSmall' || family === 'accessoryCircular';
  const isDark = false; // Egern 暂不支持自动深浅，用固定色
  
  // 2. 颜色配置（使用固定色，避免 {light, dark} 兼容问题）
  const BG = '#FFF9E6';
  const TEXT_MAIN = '#1A1A2E';
  const TEXT_SUB = '#5A5A7A';
  const COLOR_YI = '#E63946';
  const COLOR_JI = '#1D3557';
  
  // 3. 字体配置（严格按文档：对象格式）
  const FONT_TITLE = { size: isSmall ? 'subheadline' : 'title2', weight: 'bold' };
  const FONT_BODY = { size: isSmall ? 'caption2' : 'caption1', weight: 'regular' };
  const FONT_TINY = { size: 'caption2', weight: 'regular' };
  
  // 4. 构建元素（直接返回纯对象，避免封装函数增加复杂度）
  
  // 头部：日期 + 生肖
  const header = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 8,
    children: [
      {
        type: 'stack',
        direction: 'column',
        alignItems: 'start',
        gap: 2,
        flex: 1,
        children: [
          { type: 'text', text: data.gregorian, font: FONT_TITLE, textColor: TEXT_MAIN },
          { type: 'text', text: data.lunar, font: FONT_BODY, textColor: TEXT_SUB }
        ]
      },
      {
        type: 'stack',
        direction: 'column',
        alignItems: 'end',
        gap: 4,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:star.fill',  // 使用官方 SF Symbol
            width: 20,
            height: 20,
            color: COLOR_YI,
            borderRadius: 10
          },
          { type: 'text', text: data.zodiac, font: FONT_TINY, textColor: TEXT_SUB }
        ]
      }
    ]
  };
  
  // 中部：宜忌
  const yiji = {
    type: 'stack',
    direction: 'column',
    gap: 6,
    padding: [8, 12],
    backgroundColor: '#FFFFFF80',
    borderRadius: 8,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 4,
        children: [
          { type: 'image', src: 'sf-symbol:checkmark.circle.fill', width: 12, height: 12, color: COLOR_YI },
          { type: 'text', text: '宜', font: FONT_TINY, textColor: COLOR_YI },
          ...data.yi.map(t => ({ type: 'text', text: t, font: FONT_TINY, textColor: TEXT_MAIN }))
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 4,
        children: [
          { type: 'image', src: 'sf-symbol:xmark.circle.fill', width: 12, height: 12, color: COLOR_JI },
          { type: 'text', text: '忌', font: FONT_TINY, textColor: COLOR_JI },
          ...data.ji.map(t => ({ type: 'text', text: t, font: FONT_TINY, textColor: TEXT_MAIN }))
        ]
      }
    ]
  };
  
  // 底部：冲煞 + 幸运
  const footer = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 8,
    children: [
      { type: 'text', text: `冲${data.chong} 煞${data.sha}`, font: FONT_TINY, textColor: TEXT_SUB },
      { type: 'spacer' },
      { type: 'text', text: '★'.repeat(data.luck), font: FONT_TINY, textColor: COLOR_YI }
    ]
  };
  
  // 5. 组装根 Widget（严格按文档结构）
  return {
    type: 'widget',                    // ✅ 根类型必须为 'widget'
    padding: isSmall ? 12 : 16,        // ✅ 数值或 [上,右,下,左]
    gap: isSmall ? 6 : 8,              // ✅ 子元素间距
    backgroundColor: BG,               // ✅ 固定颜色字符串
    // ✅ 渐变示例（如需使用，替换 backgroundColor）:
    // backgroundGradient: {
    //   type: 'linear',
    //   colors: ['#FFF9E6', '#FFECB3'],  // ✅ 纯颜色字符串数组
    //   startPoint: { x: 0, y: 0 },
    //   endPoint: { x: 1, y: 1 }
    // },
    children: [                       // ✅ children 必须是纯对象数组
      header,
      yiji,
      footer
    ],
    // ✅ 刷新时间：次日 00:05（正确计算）
    refreshAfter: new Date(Date.now() + 24*60*60*1000).setHours(0,5,0,0),
    // ✅ 点击跳转（可选）
    url: 'egern://huangli'
  };
}

