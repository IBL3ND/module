const args = {};
$argument.split("&").forEach(p => {
  const index = p.indexOf("=");
  const key = p.substring(0, index);
  const value = p.substring(index + 1);
  args[key] = decodeURIComponent(value);
});

function getResetInfo(resetDay) {
  if (!resetDay) return ""; 
  const today = new Date();
  const nowDay = today.getDate();
  const nowMonth = today.getMonth();
  const nowYear = today.getFullYear();

  let resetDate;
  if (nowDay < resetDay) {
    resetDate = new Date(nowYear, nowMonth, resetDay);
  } else {
    resetDate = new Date(nowYear, nowMonth + 1, resetDay);
  }

  const diff = Math.ceil((resetDate - today) / (1000 * 60 * 60 * 24));
  return `重置：${diff}天`;
}

function fetchInfo(url, resetDay) {
  return new Promise(resolve => {
    $httpClient.get({ url, headers: { "User-Agent": "Quantumult%20X/1.5.2" } }, (err, resp) => {
      if (err || !resp || resp.status !== 200) {
        resolve(`订阅请求失败，状态码：${resp ? resp.status : "请求错误"}`);
        return;
      }

      const data = {};
      const headerKey = Object.keys(resp.headers).find(k => k.toLowerCase() === "subscription-userinfo");
      if (headerKey && resp.headers[headerKey]) {
        resp.headers[headerKey].split(";").forEach(p => {
          const [k, v] = p.trim().split("=");
          if (k && v) data[k] = parseInt(v);
        });
      }

      const used = (data.upload || 0) + (data.download || 0);
      const total = data.total || 0;
      const percent = total > 0 ? Math.round((used / total) * 100) : 0;

      const lines = [
        `已用：${percent}%`,
        `流量：${(used / 1024 / 1024 / 1024).toFixed(2)} GB｜${(total / 1024 / 1024 / 1024).toFixed(2)} GB`
      ];

      if (data.expire) {
        const d = new Date(data.expire * 1000);
        lines.push(`到期：${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}号`);
      }

      if (resetDay) {
        lines.push(getResetInfo(resetDay));
      }

      resolve(lines.join("\n"));
    });
  });
}

// 检查是否是有效的订阅地址
function isValidUrl(url) {
  if (!url || url.trim() === "") return false;
  if (url === "#") return false;
  // 跳过模块默认的占位符文本
  if (url.includes("订阅") && url.includes("地址")) return false;
  if (url.startsWith("订阅")) return false;
  // 必须是 http 或 https 开头
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  return true;
}

(async () => {
  const panels = [];

  for (let i = 1; i <= 10; i++) {
    const urlKey = `url${i}`;
    const titleKey = `title${i}`;
    const resetKey = `resetDay${i}`;
    
    // 跳过无效的订阅地址
    if (!isValidUrl(args[urlKey])) {
      continue;
    }
    
    const content = await fetchInfo(args[urlKey], args[resetKey] ? parseInt(args[resetKey]) : null);
    panels.push(args[titleKey] ? `机场：${args[titleKey]}\n${content}` : content);
  }

  $done({
    title: "订阅流量",
    content: panels.join("\n\n"),
    icon: "antenna.radiowaves.left.and.right.circle.fill",
    "icon-color": "#00E28F"
  });
})();
