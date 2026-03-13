/**
 * ⛽ 全国实时油价小组件
 * 数据源：http://m.qiyoujiage.com/
 * 脚本作者：Egern 群友 tg://user?id=5122789128
 * 由 iBL3ND 二次修改
 * 
 * 🔧 功能特性：
 * - 支持全国所有省份和城市
 * - 标题自动显示当前填写的地区
 * - 实时显示 92/95/98 号汽油和柴油价格
 * - 深色模式自动适配
 * - 全 iPhone 机型适配
 * 
 * 📚 使用教程
 * ═══════════════════════════════════════════════════
 *
 * 1️⃣ 环境变量配置
 * ─────────────────────────────────────────────────
 * 在 Egern 小组件配置中添加：
 *
 * 名称：region
 * 值：省份/城市（拼音，用 / 分隔）
 *
 * 名称：SHOW_TREND
 * 值：true（显示调价趋势）或 false（不显示）
 *
 *
 * 2️⃣ 地区代码对照表
 * ─────────────────────────────────────────────────
 * 【直辖市】
 * • 北京：beijing  • 上海：shanghai
 * • 天津：tianjin  • 重庆：chongqing
 *
 * 【省份 - 省会城市】
 * • 广东：guangdong/guangzhou
 * • 江苏：jiangsu/nanjing
 * • 浙江：zhejiang/hangzhou
 * • 山东：shandong/jinan
 * • 河南：henan/zhengzhou
 * • 河北：hebei/shijiazhuang
 * • 四川：sichuan/chengdu
 * • 湖北：hubei/wuhan
 * • 湖南：hunan/changsha
 * • 安徽：anhui/hefei
 * • 福建：fujian/fuzhou
 * • 江西：jiangxi/nanchang
 * • 辽宁：liaoning/shenyang
 * • 陕西：shanxi-3/xian  ⚠️
 * • 海南：hainan/haikou
 * • 山西：shanxi-1/taiyuan  ⚠️
 * • 吉林：jilin/changchun
 * • 黑龙江：heilongjiang/haerbin
 * • 云南：yunnan/kunming
 * • 贵州：guizhou/guiyang
 * • 广西：guangxi/nanning
 * • 甘肃：gansu/lanzhou
 * • 青海：qinghai/xining
 * • 宁夏：ningxia/yinchuan
 * • 新疆：xinjiang/wulumuqi
 * • 西藏：xizang/lasa
 * • 内蒙古：neimenggu/huhehaote
 * • 也可以去 http://m.qiyoujiage.com/shanxi-3.shtml 查看自己省份拼音
 * ═══════════════════════════════════════════════════
 */

export default async function (ctx) {
  const regionParam = ctx.env.region || "hainan/haikou";
  const SHOW_TREND = (ctx.env.SHOW_TREND || "true").trim() !== "false";

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const refreshTime = new Date(Date.now() + 6*60*60*1000).toISOString();

  const backgroundColor = { light: "#FFFFFF", dark: "#1C1C1E" };

  const COLORS = {
    primary: { light: "#1A1A1A", dark: "#FFFFFF" },
    secondary: { light: "#666666", dark: "#CCCCCC" },
    tertiary: { light: "#999999", dark: "#888888" },
    card: { light: "#F5F5F7", dark: "#2C2C2E" },
    cardBorder: { light: "#E0E0E0", dark: "#3A3A3C" },
    p92: { light: "#FF9F0A", dark: "#FFB347" },
    p95: { light: "#FF6B35", dark: "#FF8A5C" },
    p98: { light: "#FF3B30", dark: "#FF6B6B" },
    diesel: { light: "#30D158", dark: "#5CD67D" },
    trend: { light: "#007AFF", dark: "#0A84FF" },
  };

  const CACHE_KEY = `qiyoujiage_oil_${regionParam}`;
  let prices = {p92:null, p95:null, p98:null, diesel:null};
  let regionName = "";
  let trendInfo = "";
  let hasCache = false;
  
  try {
    const cached = ctx.storage.getJSON(CACHE_KEY);
    if (cached && cached.prices) {
      prices = cached.prices;
      regionName = cached.regionName || "";
      trendInfo = cached.trendInfo || "";
      hasCache = true;
    }
  } catch(_){}

  let fetchError = false;
  let errorMsg = "";

  try {
    const queryAddr = `http://m.qiyoujiage.com/${regionParam}.shtml`;
    
    const resp = await ctx.http.get(queryAddr, {
      headers: {
        'referer': 'http://m.qiyoujiage.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 15000
    });
    
    if (resp.status !== 200) {
      throw new Error(`HTTP ${resp.status}: 页面不存在`);
    }
    
    const html = await resp.text();

    // 🔹 从网页标题解析地区名（清理多余词汇）
    const titleMatch = html.match(/<title>([^_]+)_/);
    if (titleMatch && titleMatch[1]) {
      let rawName = titleMatch[1].trim();
      // 移除所有与"油价"相关的词
      regionName = rawName.replace(/(油价|实时|今日|最新|查询|价格)/g, '').trim();
    }

    // 解析油价
    const regPrice = /<dl>[\s\S]+?<dt>(.*油)<\/dt>[\s\S]+?<dd>(.*)\(元\)<\/dd>/gm;
    const priceList = [];
    let m = null;
    
    while ((m = regPrice.exec(html)) !== null) {
      if (m.index === regPrice.lastIndex) regPrice.lastIndex++;
      priceList.push({ name: m[1].trim(), value: m[2].trim() });
    }

    if (priceList.length >= 3) {
      const nameMap = { 
        "92 号": "p92", "92": "p92",
        "95 号": "p95", "95": "p95",
        "98 号": "p98", "98": "p98",
        "0 号": "diesel", "柴油": "diesel"
      };
      
      prices = {p92:null, p95:null, p98:null, diesel:null};
      
      priceList.forEach(item => {
        const key = Object.keys(nameMap).find(k => item.name.includes(k));
        if (key) {
          const priceVal = parseFloat(item.value);
          if (!isNaN(priceVal)) {
            prices[nameMap[key]] = priceVal;
          }
        }
      });

      // 🔹 解析调价趋势（完整信息）
      if (SHOW_TREND) {
        const regTrend = /<div class="tishi">[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<br\/>([\s\S]+?)<br\/>/;
        const trendMatch = html.match(regTrend);
        
        if (trendMatch && trendMatch.length >= 3) {
          const datePart = trendMatch[1].split('价')[1]?.slice(0, -2) || "";
          const valuePart = trendMatch[2];
          
          // 判断涨跌方向
          const trend = (valuePart.includes('下调') || valuePart.includes('下跌')) ? '↓' : '↑';
          
          // 🔹 提取完整的调价金额（优化正则）
          let amount = "";
          
          // 🔸 尝试多种格式匹配
          // 格式1：提取所有数字+单位 "0.55元/升" 和 "0.67元/升"
          const allPrices = valuePart.match(/([\d\.]+)\s*元\/升/g);
          if (allPrices && allPrices.length >= 2) {
            const nums = allPrices.map(p => p.match(/([\d\.]+)/)[1]);
            amount = `${nums[0]}-${nums[1]}元/L`;
          }
          // 格式2：每吨调整 "200元" 和 "195元"
          else {
            const allTons = valuePart.match(/([\d]+)\s*元(?:\/吨)?/g);
            if (allTons && allTons.length >= 2) {
              const nums = allTons.map(p => p.match(/([\d]+)/)[1]);
              amount = `${nums[0]}-${nums[1]}元/吨`;
            }
            // 格式3：单个数值
            else {
              const singleMatch = valuePart.match(/([\d\.]+)\s*元\/升/);
              if (singleMatch) {
                amount = `${singleMatch[1]}元/L`;
              }
            }
          }
          
          // 🔹 完整显示调价信息
          trendInfo = `${datePart}调整 ${trend} ${amount}`.trim();
        }
      }

      // 缓存包含地区名
      ctx.storage.setJSON(CACHE_KEY, { prices, regionName, trendInfo });
      fetchError = false;
    } else {
      if (!hasCache) {
        fetchError = true;
        errorMsg = `解析失败`;
      }
    }

  } catch (e) {
    if (!hasCache) {
      fetchError = true;
      errorMsg = e.message;
    }
  }

  const titleText = regionName ? `${regionName}实时油价` : "实时油价";

  const rows = [
    {label:"92 号", price:prices.p92, color:COLORS.p92},
    {label:"95 号", price:prices.p95, color:COLORS.p95},
    {label:"98 号", price:prices.p98, color:COLORS.p98},
    {label:"柴油", price:prices.diesel, color:COLORS.diesel},
  ].filter(r => r.price !== null);

  function priceCard(row){
    return {
      type:"stack",
      direction:"column",
      alignItems:"center",
      justifyContent:"center",
      flex:1,
      padding:[8,4,8,4],
      backgroundColor: COLORS.card,
      borderRadius:12,
      borderWidth: 0.5,
      borderColor: COLORS.cardBorder,
      children:[
        {
          type:"stack",
          direction:"row",
          alignItems:"center",
          justifyContent:"center",
          width:44,
          height:22,
          backgroundColor: {
            light: row.color.light + "28",
            dark: row.color.dark + "28"
          },
          borderRadius:6,
          borderWidth:0.5,
          borderColor: {
            light: row.color.light + "55",
            dark: row.color.dark + "55"
          },
          children:[{
            type:"text",
            text:row.label,
            font:{size:"caption2",weight:"bold"},
            textColor: row.color,
            textAlign:"center"
          }]
        },
        {
          type:"text",
          text:row.price !== null ? row.price.toFixed(2) : "--",
          font:{size:"title3",weight:"semibold"},
          textColor: COLORS.primary,
          textAlign:"center",
          lineLimit:1,
          minScale:0.7
        }
      ]
    }
  }

  return {
    type:"widget",
    padding:[10,8,10,8],
    gap:5,
    backgroundColor: backgroundColor,
    refreshAfter:refreshTime,
    children:[
      {
        type:"stack",
        direction:"row",
        alignItems:"center",
        gap:4,
        padding:[0,4,0,4],
        children:[
          {type:"image",src:"sf-symbol:fuelpump.fill",width:13,height:13,color:COLORS.p92},
          {type:"text",text:titleText,font:{size:"caption2",weight:"semibold"},textColor:COLORS.secondary},
          {type:"spacer"},
          // 🔹 右上角调价信息
          ...(SHOW_TREND && trendInfo ? [{
            type:"text",
            text: trendInfo,
            font:{size:"caption2"},
            textColor: COLORS.trend,
            textAlign:"right",
            lineLimit:1,
            minScale: 0.8
          }] : []),
          // 错误信息
          ...(fetchError ? [{
            type:"text",text:errorMsg,font:{size:"caption2"},textColor:COLORS.p98
          }] : [])
        ].filter(Boolean)
      },
      rows.length > 0 ? {
        type:"stack",
        direction:"row",
        alignItems:"center",
        justifyContent:"space-between",
        gap:6,
        padding:[6,0,6,0],
        children: rows.map(priceCard)
      } : {
        type:"stack",
        direction:"column",
        alignItems:"center",
        justifyContent:"center",
        padding:[20,10,20,10],
        children:[
          {type:"image",src:"sf-symbol:exclamationmark.triangle.fill",width:24,height:24,color:COLORS.p98},
          {type:"text",text:fetchError?"数据获取失败":"暂无数据",font:{size:"body"},textColor:COLORS.secondary}
        ]
      },
      {
        type:"stack",
        direction:"row",
        alignItems:"center",
        padding:[0,4,0,4],
        children:[
          {type:"text",text:`${timeStr} 更新`,font:{size:"caption2"},textColor:COLORS.tertiary},
          {type:"spacer"},
          {type:"text",text:"元/升",font:{size:"caption2"},textColor:COLORS.tertiary}
        ]
      }
    ]
  }
}
    ]
  }
}

