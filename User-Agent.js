const userAgents = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
];

const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
let headers = $request.headers;
Object.keys(headers).forEach(key => {
    const k = key.toLowerCase();
    if (k.includes('user-agent') || k.includes('accept-language')) {
        delete headers[key];
    }
});
headers['user-agent'] = randomUA;
headers['accept-language'] = 'en-US,en;q=0.9';
headers['referer'] = 'https://github.com/';

$done({ headers });
