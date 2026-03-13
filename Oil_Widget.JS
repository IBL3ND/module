/**
 * 油价实时查询小组件（简洁版）
 * 脚本作者 Egern群友 tg://user?id=5122789128
 * 由iBL3ND二次修改
 * 📚 使用教程
 * ═══════════════════════════════════════════════════
 *
 * 1️⃣ 环境变量配置
 * ─────────────────────────────────────────────────
 * 在 Egern 小组件配置中添加以下环境变量：
 *
 * 名称：城市
 * 值：海南（或其他省份名，见下方列表）
 *
 * 名称：SHOW_DIESEL
 * 值：true（显示柴油）或 false（不显示柴油）
 *
 *
 * 2️⃣ 支持的省份/直辖市
 * ─────────────────────────────────────────────────
 * 直辖市：
 * • 北京、上海、天津、重庆
 *
 * 省份：
 * • 广东、江苏、浙江、山东、河南、河北
 * • 四川、湖北、湖南、安徽、福建、江西
 * • 辽宁、陕西、海南、山西、吉林、黑龙江
 * • 云南、贵州、广西、甘肃、青海、宁夏
 * • 新疆、西藏、内蒙古
 *
 * 注意：必须填写省份名，不能填写城市名！
 *
 *
 * 3️⃣ 配置示例
 * ─────────────────────────────────────────────────
 * 示例1：查询海南油价（显示柴油）
 * 城市: 海南
 * SHOW_DIESEL: true
 *
 * 示例2：查询北京油价（不显示柴油）
 * 城市: 北京
 * SHOW_DIESEL: false
 *
 *
 * 4️⃣ 功能特性
 * ─────────────────────────────────────────────────
 * ✅ 实时查询汽车之家油价数据
 * ✅ 支持 92号、95号、98号汽油
 * ✅ 可选显示柴油
 * ✅ 纯白背景 + 深浅模式自适应
 * ✅ 6小时自动刷新
 * ✅ 数据缓存，离线也能看
 *
 * ═══════════════════════════════════════════════════
 */

export default async function (ctx) {
 const city = (ctx.env.城市 || "上海").trim();
 const SHOW_DIESEL = (ctx.env.SHOW_DIESEL || "true").trim() !== "false";

 const now = new Date();
 const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
 const refreshTime = new Date(Date.now() + 6*60*60*1000).toISOString();

 // 纯白背景 + 深浅模式自适应
 const backgroundColor = { light: "#FFFFFF", dark: "#1C1C1E" };

 // 深浅模式自适应的颜色配置
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
 };

 // 读取缓存
 const CACHE_KEY = `autohome_oil_${city}`;
 let prices = {p92:null,p95:null,p98:null,diesel:null};
 let lastUpdate = null;
 let hasCache = false;
 
 try {
  const cached = ctx.storage.getJSON(CACHE_KEY);
  if (cached && cached.prices) {
   prices = cached.prices;
   lastUpdate = cached.lastUpdate || null;
   hasCache = true;
  }
 } catch(_){}

 let fetchError = false;
 let errorMsg = "";

 try {
  const resp = await ctx.http.get("https://www.autohome.com.cn/oil", {
   headers:{ "User-Agent":"Mozilla/5.0" },
   timeout:15000
  });
  const html = await resp.text();

  // 尝试多种匹配方式
  let match = null;

  // 方式1：精确匹配省份名
  const regex1 = new RegExp(
   city + "[\s\S]*?(\d+\.\d+)[\s\S]*?(\d+\.\d+)[\s\S]*?(\d+\.\d+)[\s\S]*?(\d+\.\d+)"
  );
  match = html.match(regex1);

  // 方式2：模糊匹配（如果省份名有空格或其他字符）
  if (!match) {
   const regex2 = new RegExp(
    city.replace(/\s+/g, "\\s*") + "[\s\S]*?(\d+\.\d+)[\s\S]*?(\d+\.\d+)[\s\S]*?(\d+\.\d+)[\s\S]*?(\d+\.\d+)"
   );
   match = html.match(regex2);
  }

  if (match) {
   prices.p92 = parseFloat(match[1]);
   prices.p95 = parseFloat(match[2]);
   prices.p98 = parseFloat(match[3]);
   prices.diesel = SHOW_DIESEL ? parseFloat(match[4]) : null;
   lastUpdate = new Date().toISOString();

   // 保存缓存
   ctx.storage.setJSON(CACHE_KEY, { prices, lastUpdate });
   fetchError = false;
  } else {
   // 网络请求成功但没找到数据
   if (!hasCache) {
    fetchError = true;
    errorMsg = "未找到油价数据，请检查省份名";
   }
   console.log("❌ 未匹配到油价数据，省份:", city);
  }

 } catch (e) {
  // 网络请求失败
  console.log("❌ 网络请求失败:", e.message);
  
  // 没有缓存才显示错误
  if (!hasCache) {
   fetchError = true;
   errorMsg = e.message || "网络请求失败";
  }
 }

 const rows = [
  {label:"92号",price:prices.p92,color:COLORS.p92},
  {label:"95号",price:prices.p95,color:COLORS.p95},
  {label:"98号",price:prices.p98,color:COLORS.p98},
  ...(SHOW_DIESEL && prices.diesel ? [{label:"柴油",price:prices.diesel,color:COLORS.diesel}]:[])
 ].filter(r => r.price!==null);

 function priceCard(row){
  return {
   type:"stack",
   direction:"column",
   alignItems:"center",
   justifyContent:"center",
   width:90,
   padding:[10,8,10,8],
   backgroundColor: COLORS.card,
   borderRadius:14,
   borderWidth: 0.5,
   borderColor: COLORS.cardBorder,
   children:[
    {
     type:"stack",
     direction:"row",
     alignItems:"center",
     justifyContent:"center",
     width:48,
     height:24,
     backgroundColor: {
      light: row.color.light + "28",
      dark: row.color.dark + "28"
     },
     borderRadius:7,
     borderWidth:0.5,
     borderColor: {
      light: row.color.light + "55",
      dark: row.color.dark + "55"
     },
     children:[
      {
       type:"text",
       text:row.label,
       font:{size:"caption1",weight:"bold"},
       textColor: row.color,
       textAlign:"center"
      }
     ]
    },
    {
     type:"text",
     text:row.price.toFixed(2),
     font:{size:"title2",weight:"semibold"},
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
  padding:[12,8,12,8],
  gap:6,
  backgroundColor: backgroundColor,
  refreshAfter:refreshTime,
  children:[
   {
    type:"stack",
    direction:"row",
    alignItems:"center",
    gap:5,
    padding:[0,8,0,8],
    children:[
     {type:"image",src:"sf-symbol:fuelpump.fill",width:14,height:14,color:COLORS.p92},
     {type:"text",text:`${city}油价`,font:{size:"caption1",weight:"semibold"},textColor:COLORS.secondary},
     {type:"spacer"},
     // ✅ 只在完全没有数据时才显示错误
     fetchError
      ? {type:"text",text:errorMsg,font:{size:"caption2"},textColor:COLORS.p98}
      : null
    ].filter(Boolean)
   },
   rows.length > 0 ? {
    type:"stack",
    direction:"row",
    alignItems:"center",
    justifyContent:"space-between",
    gap:8,
    padding:[8,4,8,4],
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
    padding:[0,8,0,8],
    children:[
     {type:"text",text:`${timeStr} 更新`,font:{size:"caption2"},textColor:COLORS.tertiary},
     {type:"spacer"},
     {type:"text",text:"元/升",font:{size:"caption2"},textColor:COLORS.tertiary}
    ]
   }
  ]
 }
}

