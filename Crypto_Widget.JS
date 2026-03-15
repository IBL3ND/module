/**
 * ════════════════════════════════════════════════════
 *  比特币价格小组件 - Egern 适配版
 *  数据源：Binance API（无需 Key，无速率限制）
 * ════════════════════════════════════════════════════
 * 
 * ⚙️ 配置方法：
 *   在 Egern 小组件配置中添加 `btcType` 参数
 *   格式：币种符号，多个用英文逗号分隔
 * 
 * 📋 支持的币种（符号/全称均可，大小写不敏感）：
 *   ┌──────┬─────────────┬──────┬─────────────┐
 *   │ 符号 │    名称     │ 符号 │    名称     │
 *   ├──────┼─────────────┼──────┼─────────────┤
 *   │ BTC  │ 比特币      │ ETH  │ 以太坊      │
 *   │ BNB  │ 币安币      │ SOL  │ 索拉纳      │
 *   │ XRP  │ 瑞波币      │ ADA  │ 卡尔达诺    │
 *   │ DOGE │ 狗狗币      │ DOT  │ 波卡        │
 *   │ MATIC│ Polygon     │ AVAX │ 雪崩        │
 *   │ LINK │ Chainlink   │ UNI  │ Uniswap     │
 *   └──────┴─────────────┴──────┴─────────────┘
 * 
 * 💡 配置示例：
 *   ✓ btcType: "BTC"                    // 只显示比特币
 *   ✓ btcType: "BTC,ETH"                // 显示比特币+以太坊
 *   ✓ btcType: "BTC, ETH, SOL"          // 空格会自动忽略
 *   ✓ btcType: "bitcoin,ethereum"       // 支持英文全称
 *   ✓ 最多支持 6 个币种，超出部分自动忽略
 * 
 * 📊 尺寸说明：
 *   • systemSmall  : 显示 1 个币种（大字价格+涨跌幅）
 *   • systemMedium : 显示 3 个币种列表
 *   • systemLarge  : 显示 6 个币种列表
 * 
 * 🎨 深色模式：
 *   • 所有颜色使用 { light, dark } 格式
 *   • Egern 自动根据系统外观切换，无需手动判断
 * 
 * 🔄 刷新频率：每 1 分钟自动刷新 (refreshAfter: "PT1M")
 * 
 * ════════════════════════════════════════════════════
 */

// 比特币价格小组件 - Egern 适配版（使用 Binance API - 更稳定）
export default async function(ctx) {
  // 🎨 主题配置
  const theme = {
    bg: { light: "#FFFFFF", dark: "#2C2C2E" },
    text: { light: "#000000", dark: "#FFFFFF" },
    textSecondary: { light: "#666666", dark: "#AAAAAA" },
    up: { light: "#00AA00", dark: "#30D158" },
    down: { light: "#FF0000", dark: "#FF453A" }
  };

  const widgetFamily = ctx.widgetFamily || "systemMedium";
  const btcType = ctx.config?.btcType || "BTC,ETH,BNB";

  // 🔹 Binance API（无需 Key，无速率限制）
  const API = "https://api.binance.com/api/v3";

  // 🔹 币种符号映射（Binance 交易对）
  const SYMBOL_MAP = {
    "BTC": "BTCUSDT",
    "ETH": "ETHUSDT",
    "BNB": "BNBUSDT",
    "SOL": "SOLUSDT",
    "XRP": "XRPUSDT",
    "ADA": "ADAUSDT",
    "DOGE": "DOGEUSDT",
    "DOT": "DOTUSDT",
    "MATIC": "MATICUSDT",
    "AVAX": "AVAXUSDT",
    "LINK": "LINKUSDT",
    "UNI": "UNIUSDT"
  };

  // 🔹 解析用户配置
  const parseSymbols = (input) => {
    if (!input) return ["BTCUSDT"];
    return input.split(",")
      .map(s => s.trim().toUpperCase())
      .map(s => SYMBOL_MAP[s] || `${s}USDT`)
      .slice(0, 6);
  };

  // 🔹 获取价格数据
  const fetchPrices = async () => {
    const symbols = parseSymbols(btcType);
    
    try {
      // 批量获取价格（Binance 支持一次查询多个交易对）
      const promises = symbols.map(symbol => 
        ctx.http.get(`${API}/ticker/24hr?symbol=${symbol}`, {
          timeout: 8000
        }).then(resp => resp.json()).catch(() => null)
      );
      
      const results = await Promise.all(promises);
      
      return results.filter(Boolean).map(data => ({
        symbol: data.symbol.replace("USDT", ""),
        name: getCoinName(data.symbol.replace("USDT", "")),
        price: parseFloat(data.lastPrice),
        high: parseFloat(data.highPrice),
        low: parseFloat(data.lowPrice),
        change: parseFloat(data.priceChangePercent),
        volume: parseFloat(data.volume)
      }));
    } catch (e) {
      console.error("Fetch error:", e);
      return null;
    }
  };

  // 🔹 币种名称映射
  const getCoinName = (symbol) => {
    const names = {
      "BTC": "Bitcoin",
      "ETH": "Ethereum",
      "BNB": "BNB",
      "SOL": "Solana",
      "XRP": "XRP",
      "ADA": "Cardano",
      "DOGE": "Dogecoin",
      "DOT": "Polkadot",
      "MATIC": "Polygon",
      "AVAX": "Avalanche",
      "LINK": "Chainlink",
      "UNI": "Uniswap"
    };
    return names[symbol] || symbol;
  };

  // 🔹 获取数据
  let dataSource = await fetchPrices();
  
  // 🔹 空状态
  if (!dataSource || dataSource.length === 0) {
    return {
      type: "widget",
      padding: 16,
      backgroundColor: theme.bg,
      children: [{
        type: "stack",
        direction: "column",
        alignItems: "center",
        gap: 8,
        children: [
          {
            type: "text",
            text: "⚠️ 数据加载失败",
            font: { size: "subheadline", weight: "medium" },
            textColor: theme.textSecondary,
            textAlign: "center"
          },
          {
            type: "text",
            text: "请检查网络连接",
            font: { size: "caption2" },
            textColor: theme.textSecondary,
            textAlign: "center"
          }
        ]
      }]
    };
  }

  // 🔹 渲染单行
  const renderRow = (coin) => {
    const isUp = coin.change >= 0;
    const color = isUp ? theme.up : theme.down;
    
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      padding: [8, 0],
      url: `https://www.binance.com/zh-CN/price/${coin.symbol}`,
      children: [
        {
          type: "stack",
          direction: "column",
          flex: 1,
          children: [
            {
              type: "stack",
              direction: "row",
              children: [
                {
                  type: "text",
                  text: coin.symbol,
                  font: { size: "subheadline", weight: "semibold" },
                  textColor: theme.text
                },
                { type: "spacer", flex: 1 },
                {
                  type: "text",
                  text: `$${coin.price.toLocaleString()}`,
                  font: { size: "subheadline", weight: "semibold" },
                  textColor: theme.text,
                  textAlign: "right"
                }
              ]
            },
            {
              type: "stack",
              direction: "row",
              children: [
                {
                  type: "text",
                  text: coin.name,
                  font: { size: "caption2" },
                  textColor: theme.textSecondary
                },
                { type: "spacer", flex: 1 },
                {
                  type: "text",
                  text: `H:${coin.high.toFixed(2)} L:${coin.low.toFixed(2)}`,
                  font: { size: "caption2" },
                  textColor: theme.textSecondary,
                  textAlign: "right"
                }
              ]
            }
          ]
        },
        { type: "spacer", length: 8 },
        {
          type: "stack",
          width: 70,
          height: 26,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 4,
          backgroundColor: color,
          children: [{
            type: "text",
            text: `${isUp ? "+" : ""}${coin.change.toFixed(2)}%`,
            font: { size: "caption2", weight: "semibold" },
            textColor: { light: "#FFFFFF", dark: "#FFFFFF" },
            textAlign: "center",
            lineLimit: 1,
            minScale: 0.6
          }]
        }
      ]
    };
  };

  // 🔹 小尺寸
  if (widgetFamily === "systemSmall") {
    const coin = dataSource[0];
    const isUp = coin.change >= 0;
    const color = isUp ? theme.up : theme.down;
    
    return {
      type: "widget",
      padding: 12,
      backgroundColor: theme.bg,
      url: `https://www.binance.com/zh-CN/price/${coin.symbol}`,
      refreshAfter: "PT1M",
      children: [
        {
          type: "stack",
          direction: "row",
          justifyContent: "space-between",
          alignItems: "center",
          children: [
            {
              type: "stack",
              direction: "column",
              children: [
                {
                  type: "text",
                  text: coin.symbol,
                  font: { size: "title2", weight: "bold" },
                  textColor: theme.text
                },
                {
                  type: "text",
                  text: coin.name,
                  font: { size: "caption2" },
                  textColor: theme.textSecondary
                }
              ]
            }
          ]
        },
        { type: "spacer", length: 8 },
        {
          type: "text",
          text: `${isUp ? "📈" : "📉"} ${coin.change.toFixed(2)}%`,
          font: { size: "title3", weight: "semibold" },
          textColor: color,
          textAlign: "right"
        },
        {
          type: "text",
          text: `$${coin.price.toLocaleString()}`,
          font: { size: "title1", weight: "bold" },
          textColor: theme.text,
          textAlign: "right",
          lineLimit: 1,
          minScale: 0.5
        },
        {
          type: "text",
          text: `H:${coin.high.toFixed(2)} L:${coin.low.toFixed(2)}`,
          font: { size: "caption2" },
          textColor: theme.textSecondary,
          textAlign: "right",
          lineLimit: 1
        }
      ]
    };
  }

  // 🔹 中尺寸（3行）
  if (widgetFamily === "systemMedium") {
    return {
      type: "widget",
      padding: 12,
      backgroundColor: theme.bg,
      refreshAfter: "PT1M",
      children: dataSource.slice(0, 3).flatMap((coin, i) => [
        renderRow(coin),
        i < 2 ? { type: "spacer", length: 6 } : null
      ]).filter(Boolean)
    };
  }

  // 🔹 大尺寸（6行）
  return {
    type: "widget",
    padding: 12,
    backgroundColor: theme.bg,
    refreshAfter: "PT1M",
    children: dataSource.slice(0, 6).flatMap((coin, i) => [
      renderRow(coin),
      i < 5 ? { type: "spacer", length: 6 } : null
    ]).filter(Boolean)
  };
}

