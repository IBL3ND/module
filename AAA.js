/**
 * Egern 黄历小组件脚本
 * 功能：展示今日公历、农历、宜忌、冲煞、胎神、彭祖百忌等传统黄历信息
 * 特点：纯本地计算，无外部依赖，适配所有 Widget 尺寸
 */

// ==================== 工具函数区域 ====================

/**
 * 农历计算核心数据（简化版，1900-2100年）
 * 每月数据格式：0xXXXX = 闰月信息 + 每月天数
 * 实际生产建议使用完整农历库，此处为演示简化
 */
const LUNAR_INFO = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  // ... 实际应包含完整1900-2100年数据，此处省略
];

const CHINESE_NUMBER = ['零','一','二','三','四','五','六','七','八','九','十'];
const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DI_ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const ANIMALS = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const WEEK_DAY = ['日','一','二','三','四','五','六'];

// 简化黄历宜忌数据（按日期哈希生成，实际应使用专业数据源）
const YI_JI_DATA = {
  yi: ['祭祀','祈福','嫁娶','出行','动土','安床','开市','交易','纳财','入宅'],
  ji: ['安葬','破土','词讼','掘井','栽种','探病','余事勿取']
};

/**
 * 获取天干地支纪年
 */
function getGanZhiYear(year) {
  const offset = (year - 4) % 60;
  return TIAN_GAN[offset % 10] + DI_ZHI[offset % 12] + '年';
}

/**
 * 获取生肖
 */
function getZodiac(year) {
  return ANIMALS[(year - 4) % 12];
}

/**
 * 数字转中文（1-19）
 */
function numToChinese(num) {
  if (num === 10) return '十';
  if (num < 10) return CHINESE_NUMBER[num];
  if (num < 20) return '十' + CHINESE_NUMBER[num - 10];
  return CHINESE_NUMBER[Math.floor(num/10)] + '十' + (num%10 ? CHINESE_NUMBER[num%10] : '');
}

/**
 * 获取农历月份名称
 */
function getLunarMonth(month, isLeap) {
  return (isLeap ? '闰' : '') + 
         (month === 1 ? '正' : month === 11 ? '冬' : month === 12 ? '腊' : CHINESE_NUMBER[month]) + '月';
}

/**
 * 获取农历日期名称
 */
function getLunarDay(day) {
  if (day === 1) return '初一';
  if (day === 2) return '初二';
  if (day === 3) return '初三';
  if (day < 10) return '初' + CHINESE_NUMBER[day];
  if (day === 10) return '初十';
  if (day < 20) return '十' + CHINESE_NUMBER[day - 10];
  if (day === 20) return '二十';
  if (day < 30) return '廿' + CHINESE_NUMBER[day - 20];
  return '三十';
}

/**
 * 获取今日黄历数据（本地计算）
 */
function getHuangliData(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const week = date.getDay();
  
  // 简化：实际应通过 LUNAR_INFO 精确计算农历
  // 此处使用模拟算法生成农历日期（演示用）
  const baseDate = new Date(2000, 0, 1); // 2000-01-01 为农历庚辰年十一月廿五
  const diffDays = Math.floor((date - baseDate) / 86400000);
  
  // 简化农历计算（仅演示，精度有限）
  let lunarDay = (25 + diffDays) % 30;
  if (lunarDay <= 0) lunarDay += 30;
  let lunarMonth = ((11 + Math.floor((diffDays + 5) / 29.5)) % 12) + 1;
  const isLeap = Math.floor((diffDays + 100) / 400) % 2 === 0 && lunarMonth <= 10;
  
  // 生成宜忌（按日期哈希随机选择，实际应查专业数据）
  const hash = (year * 10000 + month * 100 + day) % 1000;
  const yiCount = 3 + (hash % 3);
  const jiCount = 2 + ((hash + 7) % 3);
  
  return {
    // 公历信息
    gregorian: {
      year,
      month,
      day,
      week: '星期' + WEEK_DAY[week],
      fullDate: `${year}年${month}月${day}日`
    },
    // 农历信息
    lunar: {
      year: year, // 农历年（简化）
      ganZhi: getGanZhiYear(year),
      zodiac: getZodiac(year),
      month: getLunarMonth(lunarMonth, isLeap),
      day: getLunarDay(lunarDay),
      full: `${getGanZhiYear(year)}${getLunarMonth(lunarMonth, isLeap)}${getLunarDay(lunarDay)}`
    },
    // 宜忌事项
    yiji: {
      yi: YI_JI_DATA.yi.slice(0, yiCount),
      ji: YI_JI_DATA.ji.slice(0, jiCount)
    },
    // 冲煞信息
    chongSha: {
      chong: ANIMALS[(hash % 12)] + '日冲',
      sha: ['东','南','西','北'][hash % 4] + '煞'
    },
    // 胎神方位
    taiShen: ['厨灶厕','门房栖','仓库碓','炉灶栖'][hash % 4],
    // 彭祖百忌（简化）
    pengZu: TIAN_GAN[hash % 10] + DI_ZHI[hash % 12] + ' ' + ['不哭','不嫁','不宴','不讼'][hash % 4],
    // 幸运指数（演示用）
    luck: {
      level: (hash % 5) + 1, // 1-5星
      color: ['#E63946','#F77F00','#FCBF49','#2A9D8F','#1D3557'][(hash % 5)],
      tip: ['大吉','吉','平','小凶','凶'][(hash % 5)]
    }
  };
}

/**
 * 根据 widgetFamily 返回适配的布局配置
 */
function getLayoutConfig(widgetFamily) {
  const configs = {
    systemSmall: {
      padding: 12,
      gap: 6,
      fontSize: { title: 'caption1', body: 'caption2', tiny: 'caption2' },
      showPengZu: false,
      showTaiShen: false,
      maxYiJi: 2
    },
    systemMedium: {
      padding: 16,
      gap: 8,
      fontSize: { title: 'subheadline', body: 'caption1', tiny: 'caption2' },
      showPengZu: true,
      showTaiShen: true,
      maxYiJi: 3
    },
    systemLarge: {
      padding: 20,
      gap: 10,
      fontSize: { title: 'headline', body: 'subheadline', tiny: 'caption1' },
      showPengZu: true,
      showTaiShen: true,
      maxYiJi: 5
    },
    systemExtraLarge: {
      padding: 24,
      gap: 12,
      fontSize: { title: 'title2', body: 'headline', tiny: 'subheadline' },
      showPengZu: true,
      showTaiShen: true,
      maxYiJi: 6
    },
    // 锁定屏幕尺寸
    accessoryCircular: {
      padding: 8,
      gap: 4,
      fontSize: { title: 'caption2', body: 'caption2', tiny: 'caption2' },
      showPengZu: false,
      showTaiShen: false,
      maxYiJi: 1,
      compact: true
    },
    accessoryRectangular: {
      padding: 12,
      gap: 6,
      fontSize: { title: 'subheadline', body: 'caption1', tiny: 'caption2' },
      showPengZu: false,
      showTaiShen: true,
      maxYiJi: 2
    },
    accessoryInline: {
      padding: 4,
      gap: 4,
      fontSize: { title: 'caption2', body: 'caption2', tiny: 'caption2' },
      showPengZu: false,
      showTaiShen: false,
      maxYiJi: 1,
      inline: true
    }
  };
  return configs[widgetFamily] || configs.systemMedium;
}

// ==================== DSL 构建函数 ====================

/**
 * 创建文本元素
 */
function createText(text, options = {}) {
  return {
    type: 'text',
    text,
    font: options.font ? { size: options.font, weight: options.weight || 'regular' } : undefined,
    textColor: options.color,
    textAlign: options.align,
    maxLines: options.maxLines,
    minScale: options.minScale || 0.7,
    opacity: options.opacity,
    url: options.url,
    shadowColor: options.shadowColor,
    shadowRadius: options.shadowRadius,
    shadowOffset: options.shadowOffset
  };
}

/**
 * 创建图片元素（SF Symbol）
 */
function createImage(symbol, options = {}) {
  return {
    type: 'image',
    src: `sf-symbol:${symbol}`,
    width: options.width,
    height: options.height,
    color: options.color,
    borderRadius: options.borderRadius,
    opacity: options.opacity,
    url: options.url
  };
}

/**
 * 创建堆栈容器
 */
function createStack(children, options = {}) {
  return {
    type: 'stack',
    direction: options.direction || 'row',
    alignItems: options.alignItems || 'center',
    gap: options.gap,
    padding: options.padding,
    children,
    backgroundColor: options.bgColor,
    borderRadius: options.borderRadius,
    borderWidth: options.borderWidth,
    borderColor: options.borderColor,
    width: options.width,
    height: options.height,
    flex: options.flex,
    url: options.url
  };
}

/**
 * 创建弹性间距
 */
function createSpacer(length) {
  return {
    type: 'spacer',
    length: length !== undefined ? length : undefined
  };
}

// ==================== 主函数入口 ====================

export default async function(ctx) {
  // 1. 读取环境变量
  const env = ctx.env || {};
  const showLunar = env.SHOW_LUNAR !== 'false';
  const showYiJi = env.SHOW_YIJI !== 'false';
  const theme = env.THEME || 'traditional';
  const luckyColor = env.LUCKY_COLOR || '#E63946';
  const unluckyColor = env.UNLUCKY_COLOR || '#1D3557';
  
  // 2. 获取布局配置（根据 Widget 尺寸）
  const widgetFamily = ctx.widgetFamily || 'systemMedium';
  const layout = getLayoutConfig(widgetFamily);
  
  // 3. 获取今日黄历数据
  const data = getHuangliData(new Date());
  
  // 4. 颜色配置（支持深浅模式自适应）
  const colors = {
    bg: theme === 'modern' 
      ? { light: '#F8F9FA', dark: '#1A1A2E' }
      : { light: '#FFF9E6', dark: '#2C1810' },
    textPrimary: { light: '#1A1A2E', dark: '#FFFFFF' },
    textSecondary: { light: '#4A4A68', dark: '#AAAAAA' },
    textAccent: luckyColor,
    textWarning: unluckyColor,
    border: { light: '#E0E0E0', dark: '#444444' }
  };
  
  // 5. 根据尺寸构建不同布局
  if (layout.inline) {
    // ===== 内联模式（accessoryInline）=====
    return {
      type: 'widget',
      padding: layout.padding,
      backgroundColor: colors.bg,
      children: [
        createStack([
          createImage('calendar', { 
            width: 16, height: 16, 
            color: colors.textPrimary,
            marginRight: 4
          }),
          createText(`${data.gregorian.month}/${data.gregorian.day}`, {
            font: layout.fontSize.body,
            weight: 'semibold',
            color: colors.textPrimary
          }),
          createText(data.lunar.day, {
            font: layout.fontSize.tiny,
            color: colors.textSecondary,
            marginLeft: 4
          })
        ], {
          direction: 'row',
          alignItems: 'center',
          gap: 4
        })
      ]
    };
  }
  
  if (widgetFamily === 'accessoryCircular') {
    // ===== 圆形锁定屏幕 =====
    return {
      type: 'widget',
      padding: layout.padding,
      backgroundColor: colors.bg,
      children: [
        createText(data.gregorian.day.toString(), {
          font: 'title',
          weight: 'bold',
          color: colors.textPrimary,
          textAlign: 'center'
        }),
        createText(data.lunar.day, {
          font: layout.fontSize.tiny,
          color: colors.textSecondary,
          textAlign: 'center',
          maxLines: 1
        })
      ]
    };
  }
  
  // ===== 主屏幕尺寸 / 矩形锁定屏幕 =====
  
  // 顶部：公历日期 + 农历 + 生肖
  const headerSection = createStack([
    // 左侧：公历日期
    createStack([
      createText(`${data.gregorian.month}月`, {
        font: layout.fontSize.body,
        color: colors.textSecondary
      }),
      createText(data.gregorian.day.toString(), {
        font: layout.fontSize.title,
        weight: 'bold',
        color: colors.textPrimary
      }),
      createText(data.gregorian.week, {
        font: layout.fontSize.tiny,
        color: colors.textSecondary
      })
    ], {
      direction: 'column',
      alignItems: 'start',
      gap: 2,
      flex: 1
    }),
    
    // 右侧：农历 + 生肖图标
    createStack([
      createImage(`animal.${data.lunar.zodiac}`, {
        width: 24, height: 24,
        color: colors.textAccent,
        borderRadius: 12
      }),
      showLunar ? createText(data.lunar.day, {
        font: layout.fontSize.body,
        weight: 'medium',
        color: colors.textPrimary,
        textAlign: 'right',
        maxLines: 1
      }) : null
    ].filter(Boolean), {
      direction: 'column',
      alignItems: 'end',
      gap: 4
    })
  ], {
    direction: 'row',
    alignItems: 'center',
    gap: layout.gap
  });
  
  // 中部：宜忌事项（核心内容）
  const yijiSection = showYiJi ? createStack([
    // 宜
    createStack([
      createImage('checkmark.circle.fill', {
        width: 14, height: 14,
        color: colors.textAccent
      }),
      createText('宜', {
        font: layout.fontSize.tiny,
        weight: 'semibold',
        color: colors.textAccent,
        marginLeft: 2
      }),
      createSpacer(4),
      ...data.yiji.yi.slice(0, layout.maxYiJi).map(item => 
        createText(item, {
          font: layout.fontSize.tiny,
          color: colors.textPrimary,
          marginRight: 6
        })
      )
    ], {
      direction: 'row',
      alignItems: 'center',
      gap: 3
    }),
    
    // 忌
    createStack([
      createImage('xmark.circle.fill', {
        width: 14, height: 14,
        color: colors.textWarning
      }),
      createText('忌', {
        font: layout.fontSize.tiny,
        weight: 'semibold',
        color: colors.textWarning,
        marginLeft: 2
      }),
      createSpacer(4),
      ...data.yiji.ji.slice(0, layout.maxYiJi).map(item => 
        createText(item, {
          font: layout.fontSize.tiny,
          color: colors.textPrimary,
          marginRight: 6
        })
      )
    ], {
      direction: 'row',
      alignItems: 'center',
      gap: 3
    })
  ], {
    direction: 'column',
    gap: 6,
    padding: [8, 12],
    backgroundColor: { light: '#FFFFFF80', dark: '#FFFFFF10' },
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  }) : null;
  
  // 底部：冲煞 + 胎神 + 彭祖百忌（大尺寸显示）
  const footerSection = (layout.showPengZu || layout.showTaiShen) ? createStack([
    layout.showTaiShen ? createText(`胎神：${data.taiShen}`, {
      font: layout.fontSize.tiny,
      color: colors.textSecondary,
      maxLines: 1
    }) : null,
    
    createText(`${data.chongSha.chong} ${data.chongSha.sha}`, {
      font: layout.fontSize.tiny,
      color: colors.textSecondary,
      maxLines: 1
    }),
    
    layout.showPengZu ? createText(data.pengZu, {
      font: layout.fontSize.tiny,
      color: colors.textSecondary,
      maxLines: 1
    }) : null
  ].filter(Boolean), {
    direction: 'column',
    gap: 3,
    padding: [8, 0]
  }) : null;
  
  // 幸运指数徽章（可选）
  const luckBadge = createStack([
    createText('★'.repeat(data.luck.level) + '☆'.repeat(5 - data.luck.level), {
      font: layout.fontSize.tiny,
      color: data.luck.color
    }),
    createText(data.luck.tip, {
      font: layout.fontSize.tiny,
      color: colors.textSecondary,
      marginLeft: 4
    })
  ], {
    direction: 'row',
    alignItems: 'center',
    gap: 4,
    padding: [4, 8],
    backgroundColor: { light: '#F1FAEE', dark: '#1D355780' },
    borderRadius: 6
  });
  
  // 6. 组装完整 Widget DSL
  const widgetChildren = [
    headerSection,
    yijiSection,
    footerSection,
    createSpacer(), // 弹性填充
    luckBadge
  ].filter(Boolean);
  
  // 7. 返回根容器
  return {
    type: 'widget',
    padding: layout.padding,
    gap: layout.gap,
    backgroundColor: colors.bg,
    // 可选：背景渐变（传统主题）
    backgroundGradient: theme === 'traditional' ? {
      type: 'linear',
      colors: [
        { light: '#FFF9E6', dark: '#3D2817' },
        { light: '#FFECB3', dark: '#2C1810' }
      ][theme === 'traditional' ? 1 : 0],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 }
    } : undefined,
    // 点击整个 Widget 打开黄历详情（可选）
    url: 'egern://huangli/detail',
    children: widgetChildren,
    // 设置刷新时间：每日 00:05 自动刷新
    refreshAfter: new Date(new Date().setHours(24, 5, 0, 0)).toISOString()
  };
}

