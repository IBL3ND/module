/**
 * ════════════════════════════════════════════════════
 *  虚拟货币价格小组件
 *  数据源：Binance API（无需 Key，无速率限制）
 * ════════════════════════════════════════════════════
 * 
 * ⚙️ 配置方法：
 *   在 Egern 小组件配置环境变量中添加 `btcType` 参数
 *   格式：币种符号，多个用英文逗号分隔
 * 
 * 💡 配置示例：
 *   ✓ btcType: "BTC"                    // 只显示比特币
 *   ✓ btcType: "BTC,ETH"                // 显示比特币+以太坊
 *   ✓ btcType: "BTC, ETH, BNB"          // 空格会自动忽略
 *   ✓ btcType: "bitcoin,ethereum"       // 支持英文全称
 *   ✓ 最多支持 8 个币种，超出部分自动忽略
 * 
 * 📊 尺寸说明：
 *   • 小尺寸  : 显示 3 个币种卡片（币种、名称、价格、涨跌幅）
 *   • 中尺寸  : 显示 3 个币种列表
 *   • 大尺寸  : 显示 8 个币种列表
 *   • 锁屏    : 单行 / 圆形 / 矩形（矩形显示 3 个币种）
 * 
 * 🎨 深色模式：
 *   • 所有颜色使用 { light, dark } 格式
 *   • Egern 自动根据系统外观切换，无需手动判断
 * 
 * 🔄 刷新频率：每 1 分钟自动刷新 (refreshAfter: "PT1M")
 * 
 * ════════════════════════════════════════════════════
 */

export default async function(ctx) {
  const theme = {
    bg: { light: "#FFFFFF", dark: "#2C2C2E" },
    text: { light: "#000000", dark: "#FFFFFF" },
    textSecondary: { light: "#666666", dark: "#AAAAAA" },
    up: { light: "#00AA00", dark: "#30D158" },
    down: { light: "#FF0000", dark: "#FF453A" }
  };

  // 没有传入尺寸时（例如脚本预览），按小尺寸处理
  const widgetFamily = ctx.widgetFamily || "systemSmall";
  const btcType = ctx.env?.btcType || "BTC,ETH,BNB";
  const API = "https://api.binance.com/api/v3";

  const SYMBOL_MAP = {
    "BTC": "BTCUSDT", "ETH": "ETHUSDT", "BNB": "BNBUSDT",
    "SOL": "SOLUSDT", "XRP": "XRPUSDT", "ADA": "ADAUSDT",
    "DOGE": "DOGEUSDT", "DOT": "DOTUSDT", "MATIC": "MATICUSDT",
    "AVAX": "AVAXUSDT", "LINK": "LINKUSDT", "UNI": "UNIUSDT",
    "SHIB": "SHIBUSDT", "PEPE": "PEPEUSDT", "FLOKI": "FLOKIUSDT",
    "BONK": "BONKUSDT", "WIF": "WIFUSDT", "BOME": "BOMEUSDT",
    "TRX": "TRXUSDT", "LTC": "LTCUSDT", "APT": "APTUSDT"
  };

  const parseSymbols = (input) => {
    if (!input) return ["BTCUSDT"];
    return input.split(",")
      .map(s => s.trim().toUpperCase())
      .map(s => SYMBOL_MAP[s] || `${s}USDT`)
      .slice(0, 8);
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return "0";
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    if (price >= 0.01) return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    return price.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
  };

  const fetchPrices = async () => {
    const symbols = parseSymbols(btcType);
    try {
      const promises = symbols.map(symbol => 
        ctx.http.get(`${API}/ticker/24hr?symbol=${symbol}`, { timeout: 8000 })
          .then(resp => resp.json()).catch(() => null)
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

  const getCoinName = (symbol) => {
    const names = {
      "BTC": "Bitcoin", "ETH": "Ethereum", "BNB": "BNB",
      "SOL": "Solana", "XRP": "XRP", "ADA": "Cardano",
      "DOGE": "Dogecoin", "DOT": "Polkadot", "MATIC": "Polygon",
      "AVAX": "Avalanche", "LINK": "Chainlink", "UNI": "Uniswap",
      "SHIB": "Shiba Inu", "PEPE": "Pepe", "FLOKI": "Floki",
      "BONK": "Bonk", "WIF": "dogwifhat", "BOME": "Book of Meme",
      "TRX": "Tron", "LTC": "Litecoin", "APT": "Aptos"
    };
    return names[symbol] || symbol;
  };

  let dataSource = await fetchPrices();
  
  if (!dataSource || dataSource.length === 0) {
    return {
      type: "widget", padding: 16, backgroundColor: theme.bg,
      children: [{
        type: "stack", direction: "column", alignItems: "center", gap: 8,
        children: [
          { type: "text", text: "⚠️ 数据加载失败", font: { size: 15, weight: "medium" }, textColor: theme.textSecondary, textAlign: "center" },
          { type: "text", text: "请检查网络连接", font: { size: 11 }, textColor: theme.textSecondary, textAlign: "center" }
        ]
      }]
    };
  }

  const renderRow = (coin) => {
    const isUp = coin.change >= 0;
    const color = isUp ? theme.up : theme.down;
    return {
      type: "stack", direction: "row", alignItems: "center", padding: [8, 0],
      url: `https://www.binance.com/zh-CN/price/${coin.symbol}`,
      children: [
        {
          type: "stack", direction: "column", flex: 1,
          children: [
            {
              type: "stack", direction: "row",
              children: [
                { type: "text", text: coin.symbol, font: { size: 15, weight: "semibold" }, textColor: theme.text },
                { type: "spacer", flex: 1 },
                { type: "text", text: `$${formatPrice(coin.price)}`, font: { size: 15, weight: "semibold" }, textColor: theme.text, textAlign: "right" }
              ]
            },
            {
              type: "stack", direction: "row",
              children: [
                { type: "text", text: coin.name, font: { size: 11 }, textColor: theme.textSecondary },
                { type: "spacer", flex: 1 },
                { type: "text", text: `H:${formatPrice(coin.high)} L:${formatPrice(coin.low)}`, font: { size: 11 }, textColor: theme.textSecondary, textAlign: "right" }
              ]
            }
          ]
        },
        { type: "spacer", length: 8 },
        {
          type: "stack", width: 70, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: color,
          children: [{
            type: "text", text: `${isUp ? "+" : ""}${coin.change.toFixed(2)}%`,
            font: { size: 11, weight: "semibold" }, textColor: { light: "#FFFFFF", dark: "#FFFFFF" },
            textAlign: "center", lineLimit: 1, minScale: 0.6
          }]
        }
      ]
    };
  };

  // ═══════════ 锁屏专用布局（仅 accessory 系列生效）═══════════
  if (widgetFamily.startsWith("accessory")) {
    // 锁屏背景透明，文字颜色交给系统处理，次要文字用半透明白色
    const SUB = { light: "#FFFFFFB3", dark: "#FFFFFFB3" };
    const sign = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
    // 锁屏空间小：1000 以上不显示小数
    const lockPrice = (p) => p >= 1000 ? Math.round(p).toLocaleString("en-US") : formatPrice(p);
    const compact = (p) => p >= 1000 ? `${(p / 1000).toFixed(1)}K` : formatPrice(p);
    const c1 = dataSource[0];

    // 单行：BTC $82,256 -0.63%
    if (widgetFamily === "accessoryInline") {
      return {
        type: "widget", refreshAfter: "PT1M",
        children: [{
          type: "text",
          text: `${c1.symbol} $${lockPrice(c1.price)} ${sign(c1.change)}`,
          font: { size: "caption1", weight: "medium" },
          lineLimit: 1, minScale: 0.5
        }]
      };
    }

    // 圆形：币种 / 价格 / 涨跌幅
    if (widgetFamily === "accessoryCircular") {
      return {
        type: "widget", padding: 2, refreshAfter: "PT1M",
        children: [
          { type: "spacer" },
          { type: "text", text: c1.symbol, font: { size: "caption2", weight: "medium" }, textColor: SUB, textAlign: "center", lineLimit: 1 },
          { type: "text", text: compact(c1.price), font: { size: "headline", weight: "bold" }, textAlign: "center", lineLimit: 1, minScale: 0.5 },
          { type: "text", text: sign(c1.change), font: { size: "caption2" }, textColor: SUB, textAlign: "center", lineLimit: 1, minScale: 0.6 },
          { type: "spacer" }
        ]
      };
    }

    // 矩形：三行，左边币种，右边加粗价格 + 涨跌幅
    const line = (coin) => ({
      type: "stack", direction: "row", alignItems: "center", gap: 4,
      children: [
        { type: "text", text: coin.symbol, font: { size: "caption2", weight: "medium" }, textColor: SUB, lineLimit: 1 },
        { type: "spacer" },
        { type: "text", text: `$${lockPrice(coin.price)}`, font: { size: "caption1", weight: "bold" }, lineLimit: 1, minScale: 0.6 },
        { type: "text", text: sign(coin.change), font: { size: "caption2" }, textColor: SUB, lineLimit: 1, minScale: 0.6 }
      ]
    });

    return {
      type: "widget", padding: 2, gap: 2, refreshAfter: "PT1M",
      children: dataSource.slice(0, 3).map(line)
    };
  }
  // ═══════════ 锁屏专用布局结束 ═══════════

  // ═══════════ 小尺寸专用布局：每个币种一张卡片 ═══════════
  if (widgetFamily === "systemSmall") {
    // 小尺寸空间有限：1000 以上不显示小数
    const smallPrice = (p) => p >= 1000 ? `$${Math.round(p).toLocaleString("en-US")}` : `$${formatPrice(p)}`;

    const smallCard = (coin) => {
      const isUp = coin.change >= 0;
      const color = isUp ? theme.up : theme.down;
      return {
        type: "stack", direction: "row", alignItems: "center", flex: 1, gap: 6,
        padding: [4, 8, 4, 8], borderRadius: 12,
        backgroundColor: { light: "#F5F5F7", dark: "#3A3A3C" },
        url: `https://www.binance.com/zh-CN/price/${coin.symbol}`,
        children: [
          {
            // 左边：币种 + 全称
            type: "stack", direction: "column",
            children: [
              {
                type: "stack", direction: "row", alignItems: "center",
                children: [
                  { type: "text", text: coin.symbol, font: { size: 15, weight: "bold" }, textColor: theme.text, lineLimit: 1 },
                  { type: "spacer" }
                ]
              },
              {
                type: "stack", direction: "row", alignItems: "center",
                children: [
                  { type: "text", text: coin.name, font: { size: 10 }, textColor: theme.textSecondary, lineLimit: 1, minScale: 0.7 },
                  { type: "spacer" }
                ]
              }
            ]
          },
          { type: "spacer" },
          {
            // 右边：价格 + 涨跌幅
            type: "stack", direction: "column",
            children: [
              {
                type: "stack", direction: "row", alignItems: "center",
                children: [
                  { type: "spacer" },
                  { type: "text", text: smallPrice(coin.price), font: { size: 15, weight: "semibold" }, textColor: theme.text, lineLimit: 1, minScale: 0.6 }
                ]
              },
              {
                type: "stack", direction: "row", alignItems: "center",
                children: [
                  { type: "spacer" },
                  { type: "text", text: `${isUp ? "+" : ""}${coin.change.toFixed(2)}%`, font: { size: 11, weight: "semibold" }, textColor: color, lineLimit: 1, minScale: 0.7 }
                ]
              }
            ]
          }
        ]
      };
    };

    return {
      type: "widget", padding: 10, gap: 6, backgroundColor: theme.bg,
      url: `https://www.binance.com/zh-CN/price/${dataSource[0].symbol}`, refreshAfter: "PT1M",
      children: dataSource.slice(0, 3).map(smallCard)
    };
  }
  // ═══════════ 小尺寸专用布局结束 ═══════════

  if (widgetFamily === "systemMedium") {
    return {
      type: "widget", padding: 12, backgroundColor: theme.bg, refreshAfter: "PT1M",
      children: dataSource.slice(0, 3).flatMap((coin, i) => [ renderRow(coin), i < 2 ? { type: "spacer", length: 6 } : null ]).filter(Boolean)
    };
  }

  return {
    type: "widget", padding: 12, backgroundColor: theme.bg, refreshAfter: "PT1M",
    children: dataSource.slice(0, 8).flatMap((coin, i) => [
      renderRow(coin),
      i < 7 ? { type: "spacer", length: 6 } : null
    ]).filter(Boolean)
  };
}
