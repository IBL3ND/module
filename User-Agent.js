const userAgents = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];
const langPool = [
  "zh-HK,zh;q=0.9,en;q=0.8",
  "zh-HK,zh;q=0.9,en;q=0.8",
  "zh-HK,zh;q=0.9,en;q=0.8",
  "en-US,en;q=0.9"
];
const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
const randomLang = langPool[Math.floor(Math.random() * langPool.length)];
let headers = $request.headers;
Object.keys(headers).forEach(key => {
    const k = key.toLowerCase();
    if (k.includes('user-agent') || k.includes('accept-language')) {
        delete headers[key];
    }
});
headers['user-agent'] = randomUA;
headers['accept-language'] = randomLang;
headers['referer'] = 'https://github.com/';
headers['accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
headers['cache-control'] = 'no-cache';
$done({ headers });
