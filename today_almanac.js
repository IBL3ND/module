(async () => {
  const today = new Date();

  // 🌸 中国节日（法定+传统+农历节日）
  const cnHolidays = [
    { name: "元旦", month: 1, day: 1, type: "main" },
    { name: "春节", month: 2, day: 10, type: "main" },
    { name: "元宵节", month: 2, day: 24, type: "main" },
    { name: "清明节", month: 4, day: 4, type: "main" },
    { name: "劳动节", month: 5, day: 1, type: "main" },
    { name: "端午节", month: 6, day: 10, type: "main" },
    { name: "七夕节", month: 8, day: 22, type: "main" },
    { name: "中秋节", month: 9, day: 17, type: "main" },
    { name: "国庆节", month: 10, day: 1, type: "main" },
    { name: "重阳节", month: 10, day: 25, type: "minor" },
    { name: "光棍节", month: 11, day: 11, type: "minor" },
    { name: "寒衣节", month: 10, day: 30, type: "minor" },
    { name: "下元节", month: 11, day: 15, type: "minor" },
    { name: "腊八节", month: 12, day: 20, type: "minor" },
    { name: "除夕", month: 1, day: 21, type: "minor" },
    { name: "寒食节", month: 4, day: 3, type: "minor" },
    { name: "青年节", month: 5, day: 4, type: "minor" },
    { name: "建党节", month: 7, day: 1, type: "minor" },
    { name: "中元节", month: 8, day: 29, type: "minor" }
  ];

  // 🌡 24节气
  const solarTerms = [
    { name: "立春", month: 2, day: 4 },
    { name: "雨水", month: 2, day: 19 },
    { name: "惊蛰", month: 3, day: 6 },
    { name: "春分", month: 3, day: 21 },
    { name: "清明", month: 4, day: 5 },
    { name: "谷雨", month: 4, day: 20 },
    { name: "立夏", month: 5, day: 6 },
    { name: "小满", month: 5, day: 21 },
    { name: "芒种", month: 6, day: 6 },
    { name: "夏至", month: 6, day: 21 },
    { name: "小暑", month: 7, day: 7 },
    { name: "大暑", month: 7, day: 23 },
    { name: "立秋", month: 8, day: 8 },
    { name: "处暑", month: 8, day: 23 },
    { name: "白露", month: 9, day: 8 },
    { name: "秋分", month: 9, day: 23 },
    { name: "寒露", month: 10, day: 8 },
    { name: "霜降", month: 10, day: 23 },
    { name: "立冬", month: 11, day: 7 },
    { name: "小雪", month: 11, day: 22 },
    { name: "大雪", month: 12, day: 7 },
    { name: "冬至", month: 12, day: 22 },
    { name: "小寒", month: 1, day: 5 },
    { name: "大寒", month: 1, day: 20 }
  ];

  // 🎃 西方节日
  const westernHolidays = [
    { name: "情人节", month: 2, day: 14 },
    { name: "复活节", month: 3, day: 31 },
    { name: "万圣节", month: 10, day: 31 },
    { name: "感恩节（美）", month: 11, day: 28 },
    { name: "平安夜", month: 12, day: 24 },
    { name: "圣诞节", month: 12, day: 25 },
    { name: "新年夜", month: 12, day: 31 }
  ];

  // 💡 计算倒计时天数
  const calcDays = (m, d) => {
    let target = new Date(today.getFullYear(), m - 1, d);
    if (target < today) target.setFullYear(today.getFullYear() + 1);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  };

  const addDays = arr => arr.map(item => ({ ...item, days: calcDays(item.month, item.day) }));

  const getNextN = (arr, n = 3) => addDays(arr).sort((a, b) => a.days - b.days).slice(0, n);

  const formatLine = arr => arr.map(h => `${h.name}${h.days ? h.days + '天' : ''}`).join("|");

  // 分类节日
  const mainCn = cnHolidays.filter(h => h.type === "main");
  const minorCn = cnHolidays.filter(h => h.type === "minor");

  // 🔹 面板内容
  const panelText = `坚持住，就快放假啦！
${formatLine(getNextN(mainCn))}
今天：${formatLine(getNextN(solarTerms))}
${formatLine(getNextN(minorCn))}
${formatLine(getNextN(westernHolidays))}`;

  $done({ content: panelText });
})();