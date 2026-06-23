/**
 * 2026 世界杯 - Egern 小组件
 * 数据来源：ESPN
 */

const teamNamesCN = {
  "Canada": "加拿大", "United States": "美国", "USA": "美国", "Mexico": "墨西哥",
  "Argentina": "阿根廷", "Brazil": "巴西", "Colombia": "哥伦比亚",
  "Ecuador": "厄瓜多尔", "Paraguay": "巴拉圭", "Uruguay": "乌拉圭",
  "Haiti": "海地", "Panama": "巴拿马", "Curaçao": "库拉索", "Curacao": "库拉索",
  "Costa Rica": "哥斯达黎加", "Jamaica": "牙买加", "Honduras": "洪都拉斯",
  "France": "法国", "Spain": "西班牙", "England": "英格兰",
  "Germany": "德国", "Portugal": "葡萄牙", "Netherlands": "荷兰",
  "Belgium": "比利时", "Croatia": "克罗地亚", "Switzerland": "瑞士",
  "Scotland": "苏格兰", "Norway": "挪威", "Austria": "奥地利",
  "Serbia": "塞尔维亚", "Ukraine": "乌克兰", "Turkey": "土耳其", "Türkiye": "土耳其",
  "Albania": "阿尔巴尼亚",
  "Morocco": "摩洛哥", "Senegal": "塞内加尔", "South Africa": "南非",
  "Algeria": "阿尔及利亚", "Tunisia": "突尼斯", "Egypt": "埃及",
  "Ghana": "加纳", "Cameroon": "喀麦隆", "Ivory Coast": "科特迪瓦", "Côte d'Ivoire": "科特迪瓦",
  "Cape Verde": "佛得角",
  "Japan": "日本", "South Korea": "韩国", "Korea Republic": "韩国",
  "Australia": "澳大利亚", "Iran": "伊朗", "IR Iran": "伊朗",
  "Saudi Arabia": "沙特", "Qatar": "卡塔尔",
  "Uzbekistan": "乌兹别克斯坦", "Jordan": "约旦",
  "New Zealand": "新西兰",
  "Bosnia-Herzegovina": "波黑", "Bosnia and Herzegovina": "波黑",
  "Czechia": "捷克", "Czech Republic": "捷克",
  "Denmark": "丹麦", "Poland": "波兰", "Sweden": "瑞典",
  "Wales": "威尔士", "Italy": "意大利",
  "Peru": "秘鲁", "Chile": "智利", "Nigeria": "尼日利亚",
  "Mali": "马里", "Iraq": "伊拉克",
  "Congo DR": "刚果(金)", "DR Congo": "刚果(金)", "DR Congo Republic": "刚果(金)",
  "Democratic Republic of the Congo": "刚果(金)", "Congo": "刚果(金)",
};

const teamFlags = {
  "Canada": "🇨🇦", "United States": "🇺🇸", "USA": "🇺🇸", "Mexico": "🇲🇽",
  "Argentina": "🇦🇷", "Brazil": "🇧🇷", "Colombia": "🇨🇴",
  "Ecuador": "🇪🇨", "Paraguay": "🇵🇾", "Uruguay": "🇺🇾",
  "Haiti": "🇭🇹", "Panama": "🇵🇦", "Curaçao": "🇨🇼", "Curacao": "🇨🇼",
  "Costa Rica": "🇨🇷", "Jamaica": "🇯🇲", "Honduras": "🇭🇳",
  "France": "🇫🇷", "Spain": "🇪🇸", "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Germany": "🇩🇪", "Portugal": "🇵🇹", "Netherlands": "🇳🇱",
  "Belgium": "🇧🇪", "Croatia": "🇭🇷", "Switzerland": "🇨🇭",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Norway": "🇳🇴", "Austria": "🇦🇹",
  "Serbia": "🇷🇸", "Ukraine": "🇺🇦", "Turkey": "🇹🇷", "Türkiye": "🇹🇷",
  "Albania": "🇦🇱",
  "Morocco": "🇲🇦", "Senegal": "🇸🇳", "South Africa": "🇿🇦",
  "Algeria": "🇩🇿", "Tunisia": "🇹🇳", "Egypt": "🇪🇬",
  "Ghana": "🇬🇭", "Cameroon": "🇨🇲", "Ivory Coast": "🇨🇮", "Côte d'Ivoire": "🇨🇮",
  "Cape Verde": "🇨🇻",
  "Japan": "🇯🇵", "South Korea": "🇰🇷", "Korea Republic": "🇰🇷",
  "Australia": "🇦🇺", "Iran": "🇮🇷", "IR Iran": "🇮🇷",
  "Saudi Arabia": "🇸🇦", "Qatar": "🇶🇦",
  "Uzbekistan": "🇺🇿", "Jordan": "🇯🇴",
  "New Zealand": "🇳🇿",
  "Bosnia-Herzegovina": "🇧🇦", "Bosnia and Herzegovina": "🇧🇦",
  "Czechia": "🇨🇿", "Czech Republic": "🇨🇿",
  "Denmark": "🇩🇰", "Poland": "🇵🇱", "Sweden": "🇸🇪",
  "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "Italy": "🇮🇹",
  "Peru": "🇵🇪", "Chile": "🇨🇱", "Nigeria": "🇳🇬",
  "Mali": "🇲🇱", "Iraq": "🇮🇶",
  "Congo DR": "🇨🇩", "DR Congo": "🇨🇩", "DR Congo Republic": "🇨🇩",
  "Democratic Republic of the Congo": "🇨🇩", "Congo": "🇨🇩",
};

function getTeamInfo(name) {
  if (!name) return { flag: "🏳️", name: "未知" };
  let n = name.replace(/ national (football|soccer) team/i, "").replace(/ men's/i, "").trim();
  return { flag: teamFlags[n] || "🏳️", name: teamNamesCN[n] || n };
}

export default async function (ctx) {
  const family = ctx.widgetFamily || 'systemMedium';
  const now = new Date();

  const fetchStart = new Date(now.getTime() - 2 * 86400000);
  const fetchEnd   = new Date(now.getTime() + 3 * 86400000);
  const apiDate = d => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${apiDate(fetchStart)}-${apiDate(fetchEnd)}`;

  let matches = [];
  for (let i = 0; i < 3; i++) {
    try {
      const res = await ctx.http.get(url, { timeout: 8000 });
      const data = await res.json();
      if (data?.events) { matches = data.events; break; }
    } catch (e) {}
  }

  if (!matches.length) return renderError('赛程同步中...');

  // 用北京时间字符串做日期比较，避免时区偏差
  const bjStr = d => d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '');
  const todayBJ    = bjStr(now);
  const yesterdayBJ = bjStr(new Date(now.getTime() - 86400000));
  const tomorrowBJ  = bjStr(new Date(now.getTime() + 86400000));

  // 用北京时间计算昨明天的月日显示
  const fmtDay = s => `${parseInt(s.slice(4,6))}-${parseInt(s.slice(6,8))}`;

  const sections = [
    { key: 'yesterday', label: '昨天', day: fmtDay(yesterdayBJ), color: { light: '#8E8E93', dark: '#636366' }, list: [] },
    { key: 'today',     label: '今天', day: fmtDay(todayBJ),     color: { light: '#34C759', dark: '#30D158' }, list: [] },
    { key: 'tomorrow',  label: '明天', day: fmtDay(tomorrowBJ),  color: { light: '#007AFF', dark: '#0A84FF' }, list: [] },
  ];

  matches.forEach(match => {
    if (!match?.date) return;
    const utc = new Date(match.date);
    const ds = bjStr(utc);
    const sec = ds === yesterdayBJ ? sections[0] : ds === todayBJ ? sections[1] : ds === tomorrowBJ ? sections[2] : null;
    if (!sec) return;

    const comps = match.competitions?.[0]?.competitors || [];
    const home = comps.find(c => c.homeAway === 'home');
    const away = comps.find(c => c.homeAway === 'away');
    if (!home || !away) return;

    const stateRaw = match.status?.type?.state || 'pre';
    const stateComp = match.status?.type?.completed;
    const state = stateComp ? 'post' : stateRaw;
    const detail = match.status?.type?.shortDetail || '';

    sec.list.push({
      time: utc.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }),
      home: getTeamInfo(home.team?.name || home.team?.shortDisplayName),
      away: getTeamInfo(away.team?.name || away.team?.shortDisplayName),
      homeScore: home.score ?? '-',
      awayScore: away.score ?? '-',
      state,
      detail
    });
  });

  sections.forEach(s => s.list.sort((a, b) => a.time.localeCompare(b.time)));

  if (family === 'systemSmall') return renderSmall(sections, now);
  if (family === 'systemLarge') return renderLarge(sections, now);
  return renderMedium(sections, now);
}

function renderSmall(sections, now) {
  const today  = sections[1];
  const bg     = { light: '#FFFFFF', dark: '#2C2C2E' };
  const cardBg = { light: '#F2F2F7', dark: '#3A3A3C' };

  const children = [
    {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
      children: [
        { type: 'image', src: 'sf-symbol:soccerball', width: 13, height: 13, color: { light: '#FF9500', dark: '#FFB340' } },
        { type: 'text', text: '世界杯', font: { size: 13, weight: 'bold' }, textColor: { light: '#1C1C1E', dark: '#F2F2F7' } },
        { type: 'spacer' },
        capsule('今天', today.color, smallCapsuleBg(today.key))
      ]
    }
  ];

  if (today.list.length === 0) {
    children.push({ type: 'spacer' });
    children.push({
      type: 'text', text: '今日暂无赛事 ⚽',
      font: { size: 12 }, textColor: { light: '#8E8E93', dark: '#636366' }, textAlign: 'center'
    });
    children.push({ type: 'spacer' });
  } else {
    children.push({ type: 'spacer', length: 8 });
    today.list.slice(0, 2).forEach((m, idx) => {
      const { scoreStr, scoreColor, statusLabel, statusColor } = matchStyle(m);
      children.push({
        type: 'stack', direction: 'column',
        backgroundColor: cardBg, borderRadius: 12, padding: [8, 10, 8, 10], gap: 5,
        children: [
          {
            type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
            children: [
              { type: 'text', text: m.time, font: { size: 10 }, textColor: { light: '#8E8E93', dark: '#636366' } },
              { type: 'spacer' },
              capsule(statusLabel, statusColor, statusBg(m.state))
            ]
          },
          {
            type: 'stack', direction: 'row', alignItems: 'center', gap: 0,
            children: [
              { type: 'text', text: m.home.name, font: { size: 12, weight: 'bold' }, textColor: { light: '#1C1C1E', dark: '#F2F2F7' }, flex: 1, maxLines: 1 },
              { type: 'text', text: scoreStr, font: { size: 13, weight: 'bold' }, textColor: scoreColor, textAlign: 'center', width: 44 },
              { type: 'text', text: m.away.name, font: { size: 12, weight: 'bold' }, textColor: { light: '#1C1C1E', dark: '#F2F2F7' }, flex: 1, maxLines: 1, textAlign: 'right' }
            ]
          }
        ]
      });
      if (idx === 0) children.push({ type: 'spacer', length: 8 });
    });
  }

  return { type: 'widget', backgroundColor: bg, padding: 14, gap: 0, children };
}

function renderMedium(sections, now) {
  const bg     = { light: '#FFFFFF', dark: '#2C2C2E' };
  const cardBg = { light: '#F2F2F7', dark: '#3A3A3C' };
  const today  = sections[1];
  const timeStr = `${now.getMonth()+1}-${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const children = [
    {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
      children: [
        { type: 'image', src: 'sf-symbol:soccerball', width: 15, height: 15, color: { light: '#FF9500', dark: '#FFB340' } },
        { type: 'text', text: '2026 世界杯', font: { size: 14, weight: 'bold' }, textColor: { light: '#1C1C1E', dark: '#F2F2F7' } },
        { type: 'spacer' },
        { type: 'text', text: timeStr, font: { size: 10 }, textColor: { light: '#8E8E93', dark: '#636366' } }
      ]
    }
  ];

  if (today.list.length === 0) {
    children.push({ type: 'spacer' });
    children.push({
      type: 'stack', direction: 'row', alignItems: 'center',
      children: [
        { type: 'spacer' },
        { type: 'text', text: '⚽ 今日暂无赛事', font: { size: 13 }, textColor: { light: '#8E8E93', dark: '#636366' } },
        { type: 'spacer' }
      ]
    });
    children.push({ type: 'spacer' });
  } else {
    const display = selectMediumMatches(today.list);
    display.forEach(m => children.push(matchCard(m, cardBg)));
  }

  return { type: 'widget', backgroundColor: bg, padding: 14, gap: 8, children };
}

function renderLarge(sections, now) {
  const bg     = { light: '#FFFFFF', dark: '#2C2C2E' };
  const cardBg = { light: '#F2F2F7', dark: '#3A3A3C' };
  const timeStr = `${now.getMonth()+1}-${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const limits = [
    Math.min(sections[0].list.length, 4),
    Math.min(sections[1].list.length, 4),
    Math.min(sections[2].list.length, 4),
  ];

  const children = [
    {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
      children: [
        { type: 'image', src: 'sf-symbol:soccerball', width: 16, height: 16, color: { light: '#FF9500', dark: '#FFB340' } },
        { type: 'text', text: '2026 世界杯赛程', font: { size: 15, weight: 'bold' }, textColor: { light: '#1C1C1E', dark: '#F2F2F7' } },
        { type: 'spacer' },
        { type: 'text', text: timeStr, font: { size: 10 }, textColor: { light: '#8E8E93', dark: '#636366' } }
      ]
    }
  ];

  sections.forEach((sec, idx) => {
    const limit = limits[idx];
    const list = sec.list.slice(0, limit);

    children.push({
      type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
      children: [
        capsule(`${sec.label} ${sec.day}`, sec.color, smallCapsuleBg(sec.key)),
        { type: 'spacer' }
      ]
    });

    if (sec.list.length === 0) {
      children.push({
        type: 'stack', backgroundColor: cardBg, borderRadius: 12, padding: [8, 12, 8, 12],
        children: [{ type: 'text', text: '暂无赛事', font: { size: 11 }, textColor: { light: '#8E8E93', dark: '#636366' } }]
      });
    } else {
      list.forEach(m => children.push(matchCard(m, cardBg)));
      if (sec.list.length > limit) {
        children.push({
          type: 'stack', direction: 'row', padding: [2, 10, 2, 10],
          children: [
            { type: 'spacer' },
            { type: 'text', text: `另有 ${sec.list.length - limit} 场未显示`, font: { size: 10 }, textColor: { light: '#8E8E93', dark: '#636366' } },
            { type: 'spacer' }
          ]
        });
      }
    }
  });

  return { type: 'widget', backgroundColor: bg, padding: 14, gap: 6, children };
}

function matchCard(m, cardBg) {
  const { scoreStr, scoreColor, statusLabel, statusColor } = matchStyle(m);
  return {
    type: 'stack', direction: 'row', alignItems: 'center',
    backgroundColor: cardBg, borderRadius: 12, padding: [7, 10, 7, 10], gap: 6,
    url: 'xhsdiscover://live_audience?emceeUserId=59b3829850c4b4197d115edf&pre_source=wcup26_home&source=live_calendar&liveTrailerId=137950885801406275',
    children: [
      { type: 'text', text: m.time, font: { size: 11 }, textColor: { light: '#8E8E93', dark: '#636366' }, width: 36, textAlign: 'center' },
      capsule(statusLabel, statusColor, statusBg(m.state)),
      {
        type: 'stack', direction: 'row', alignItems: 'center', flex: 1, gap: 3,
        children: [
          { type: 'spacer' },
          { type: 'text', text: m.home.name, font: { size: 12, weight: 'semibold' }, textColor: { light: '#1C1C1E', dark: '#F2F2F7' }, maxLines: 1, textAlign: 'right' },
          { type: 'text', text: m.home.flag, font: { size: 15 } }
        ]
      },
      { type: 'text', text: scoreStr, font: { size: 13, weight: 'bold' }, textColor: scoreColor, textAlign: 'center', width: 42 },
      {
        type: 'stack', direction: 'row', alignItems: 'center', flex: 1, gap: 3,
        children: [
          { type: 'text', text: m.away.flag, font: { size: 15 } },
          { type: 'text', text: m.away.name, font: { size: 12, weight: 'semibold' }, textColor: { light: '#1C1C1E', dark: '#F2F2F7' }, maxLines: 1 },
          { type: 'spacer' }
        ]
      }
    ]
  };
}

function matchStyle(m) {
  const isPost = m.state === 'post' || m.state === 'final' || m.state === 'STATUS_FINAL';
  const isLive = !isPost && (m.state === 'in' || m.state === 'in_progress' || m.state === 'STATUS_IN_PROGRESS' || m.state === 'halftime' || m.state === 'STATUS_HALFTIME');
  if (isPost) return {
    scoreStr: `${m.homeScore} - ${m.awayScore}`,
    scoreColor: { light: '#8E8E93', dark: '#636366' },
    statusLabel: '完场', statusColor: { light: '#8E8E93', dark: '#636366' }
  };
  if (isLive) return {
    scoreStr: `${m.homeScore} - ${m.awayScore}`,
    scoreColor: { light: '#FF3B30', dark: '#FF453A' },
    statusLabel: '直播', statusColor: { light: '#FF3B30', dark: '#FF453A' }
  };
  return {
    scoreStr: 'VS',
    scoreColor: { light: '#8E8E93', dark: '#636366' },
    statusLabel: '未开始', statusColor: { light: '#34C759', dark: '#30D158' }
  };
}

function statusBg(state) {
  if (state === 'in')   return { light: '#FFF0EE', dark: '#3A1F1F' };
  if (state === 'post') return { light: '#F2F2F7', dark: '#3A3A3C' };
  return { light: '#E8F8ED', dark: '#0D2E15' };
}

function smallCapsuleBg(key) {
  if (key === 'today')    return { light: '#E8F8ED', dark: '#0D2E15' };
  if (key === 'tomorrow') return { light: '#E3F2FD', dark: '#001A36' };
  return { light: '#F2F2F7', dark: '#3A3A3C' };
}

function capsule(text, textColor, bgColor) {
  return {
    type: 'stack', backgroundColor: bgColor, borderRadius: 20, padding: [3, 8, 3, 8],
    children: [{ type: 'text', text, font: { size: 11, weight: 'semibold' }, textColor, maxLines: 1 }]
  };
}

function selectMediumMatches(list) {
  return list.slice(0, 4);
}

function renderError(msg) {
  return {
    type: 'widget', backgroundColor: { light: '#FFFFFF', dark: '#2C2C2E' }, padding: 16,
    children: [{
      type: 'stack', backgroundColor: { light: '#FFF0EE', dark: '#3A1F1F' }, borderRadius: 14, padding: 12,
      children: [{ type: 'text', text: `⚽ ${msg}`, font: { size: 13 }, textColor: { light: '#FF3B30', dark: '#FF453A' } }]
    }]
  };
}
