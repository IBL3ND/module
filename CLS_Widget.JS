/** 财联社电报小组件
*/

export default async function(ctx) {
  const colors = {
    bg: { light: "#FFFFFF", dark: "#2C2C2E" },
    text: { light: "#1c1c1e", dark: "#eee" },
    textDim: { light: "#8e8e93", dark: "#999" },
    accent: { light: "#007AFF", dark: "#0A84FF" }
  };

  // 根据尺寸显示不同数量的新闻
  let maxItems;
  if (['systemSmall', 'accessoryCircular', 'accessoryInline'].includes(ctx.widgetFamily)) {
    maxItems = 3;
  } else if (ctx.widgetFamily === 'systemMedium') {
    maxItems = 8;
  } else if (ctx.widgetFamily === 'systemLarge') {
    maxItems = 19;
  } else {
    maxItems = 5;
  }

  let news = [];
  
  try {
    const res = await ctx.http.get("https://api.98dou.cn/api/hotlist/cls/all", { timeout: 8000 });
    const data = await res.json();
    news = (data.data || []).slice(0, maxItems);
  } catch (e) {
    console.error("加载失败:", e);
  }

  const now = new Date().toISOString();

  // 过滤掉包含"日涨停分析"的新闻
  const filteredNews = news.filter(item => {
    const pattern = /日涨停分析/;
    return !pattern.test(item.title);
  });

  return {
    type: "widget",
    backgroundColor: colors.bg,
    padding: 10,
    gap: 6,
    refreshAfter: new Date(Date.now() + 30 * 1000).toISOString(),
    children: [
      // 标题栏 - 图标 + 标题 + 时间
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        height: 20,
        gap: 6,
        children: [
          // 📰 SF Symbols 报纸图标（Egern 文档格式）
          {
            type: "image",
            src: "sf-symbol:newspaper.fill",
            color: colors.accent,
            width: 14,
            height: 14
          },
          // 标题
          { 
            type: "text", 
            text: "财联社电报", 
            font: { size: 14, weight: "bold" },
            textColor: colors.text,
            lineLimit: 1
          },
          {
            type: "spacer",
            flex: 1
          },
          // 时间
          { 
            type: "date", 
            date: now, 
            format: "time",
            font: { size: 11 },
            textColor: colors.textDim
          }
        ]
      },
      
      // 新闻列表 - 严格单行
      ...(filteredNews.length > 0 
        ? filteredNews.map((item, index) => ({
            type: "text",
            text: `${index + 1}. ${item.title}`,
            font: { size: 11 },
            textColor: colors.text,
            maxLines: 1,
            lineLimit: 1,
            minScale: 0.5,
            textAlign: "left"
          }))
        : [{ 
            type: "text", 
            text: "暂无数据", 
            font: { size: 11 }, 
            textColor: colors.textDim 
          }]
      )
    ]
  };
}

