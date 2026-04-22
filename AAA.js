// 2026/04/22
/*
@Name：WeTalk 自动化签到+视频奖励 (Egern 适配版)
@Author：TG@ZenMoFiShi

[rewrite_local]
^https:\/\/api\.wetalkapp\.com\/app\/queryBalanceAndBonus url script-request-header https://raw.githubusercontent.com/ZenmoFeiShi/Qx/refs/heads/main/WeTalk.js

[task_local]
20 8,20 * * * https://raw.githubusercontent.com/ZenmoFeiShi/Qx/refs/heads/main/WeTalk.js, tag=WeTalk签到, enabled=true

[MITM]
hostname = api.wetalkapp.com
*/

// --- 1. 环境兼容层 (Env框架，适配 Egern/QX) ---
function Env(name) {
  this.name = name;
  this.isEgern = typeof $egern !== "undefined" || typeof $httpClient !== "undefined";
  this.isQuanX = typeof $task !== "undefined";
  this.log = (msg) => console.log(`[${this.name}] ${msg}`);
  this.msg = (title = this.name, sub = "", msg = "") => {
    if (this.isEgern) $notification.post(title, sub, msg);
    if (this.isQuanX) $notify(title, sub, msg);
  };
  this.getdata = (key) => $persistentStore.read(key);
  this.setdata = (val, key) => $persistentStore.write(val, key);
  this.fetch = (opts) => {
    return new Promise((resolve, reject) => {
      if (this.isEgern) {
        const method = (opts.method || "GET").toLowerCase();
        $httpClient[method](opts, (err, resp, body) => {
          if (err) reject({ error: err });
          else resolve({ body, status: resp.status, headers: resp.headers });
        });
      } else if (this.isQuanX) {
        $task.fetch(opts).then(resolve, reject);
      }
    });
  };
  this.done = (obj = {}) => $done(obj);
}

const $ = new Env("WeTalk");

// --- 2. 脚本配置与常量 ---
const storeKey = 'wetalk_accounts_v1';
const SECRET = '0fOiukQq7jXZV2GRi9LGlO';
const API_HOST = 'api.wetalkapp.com';
const MAX_VIDEO = 5;
const VIDEO_DELAY = 8000;
const ACCOUNT_GAP = 3500;

const IOS_VERSIONS = ['17.5.1','17.6.1','17.4.1','17.2.1','16.7.8','17.6','17.3.1','18.0.1','17.1.2','16.6.1'];
const IOS_SCALES = ['2.00','3.00','3.00','2.00','3.00'];
const IPHONE_MODELS = ['iPhone14,3','iPhone13,3','iPhone15,3','iPhone16,1','iPhone14,7','iPhone13,2','iPhone15,2','iPhone12,1'];
const CFN_VERS = ['1410.0.3','1494.0.7','1568.100.1','1209.1','1474.0.4','1568.200.2'];
const DARWIN_VERS = ['22.6.0','23.5.0','23.6.0','24.0.0','22.4.0'];

// --- 3. 算法工具类 (MD5 & UA) ---
function MD5(string) {
  function RotateLeft(lValue, iShiftBits) { return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits)); }
  function AddUnsigned(lX, lY) {
    const lX4 = lX & 0x40000000, lY4 = lY & 0x40000000, lX8 = lX & 0x80000000, lY8 = lY & 0x80000000;
    const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) return (lResult & 0x40000000) ? (lResult ^ 0xC0000000 ^ lX8 ^ lY8) : (lResult ^ 0x40000000 ^ lX8 ^ lY8);
    return lResult ^ lX8 ^ lY8;
  }
  function F(x, y, z) { return (x & y) | ((~x) & z); }
  function G(x, y, z) { return (x & z) | (y & (~z)); }
  function H(x, y, z) { return x ^ y ^ z; }
  function I(x, y, z) { return y ^ (x | (~z)); }
  function FF(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function GG(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function HH(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function II(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function ConvertToWordArray(str) {
    const lMessageLength = str.length;
    const lNumberOfWords_temp1 = lMessageLength + 8;
    const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    const lWordArray = Array(lNumberOfWords - 1).fill(0);
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lWordArray[lWordCount] |= str.charCodeAt(lByteCount) << ((lByteCount % 4) * 8);
      lByteCount++;
    }
    const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lWordArray[lWordCount] |= 0x80 << ((lByteCount % 4) * 8);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  function WordToHex(lValue) {
    let WordToHexValue = '';
    for (let lCount = 0; lCount <= 3; lCount++) {
      const lByte = (lValue >>> (lCount * 8)) & 255;
      const WordToHexValue_temp = '0' + lByte.toString(16);
      WordToHexValue += WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
    }
    return WordToHexValue;
  }
  const x = ConvertToWordArray(string);
  let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
  const S11 = 7, S12 = 12, S13 = 17, S14 = 22, S21 = 5, S22 = 9, S23 = 14, S24 = 20, S31 = 4, S32 = 11, S33 = 16, S34 = 23, S41 = 6, S42 = 10, S43 = 15, S44 = 21;
  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = FF(a,b,c,d,x[k+0],S11,0xD76AA478); d = FF(d,a,b,c,x[k+1],S12,0xE8C7B756); c = FF(c,d,a,b,x[k+2],S13,0x242070DB); b = FF(b,c,d,a,x[k+3],S14,0xC1BDCEEE);
    a = FF(a,b,c,d,x[k+4],S11,0xF57C0FAF); d = FF(d,a,b,c,x[k+5],S12,0x4787C62A); c = FF(c,d,a,b,x[k+6],S13,0xA8304613); b = FF(b,c,d,a,x[k+7],S14,0xFD469501);
    a = FF(a,b,c,d,x[k+8],S11,0x698098D8); d = FF(d,a,b,c,x[k+9],S12,0x8B44F7AF); c = FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1); b = FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
    a = FF(a,b,c,d,x[k+12],S11,0x6B901122); d = FF(d,a,b,c,x[k+13],S12,0xFD987193); c = FF(c,d,a,b,x[k+14],S13,0xA679438E); b = FF(b,c,d,a,x[k+15],S14,0x49B40821);
    a = GG(a,b,c,d,x[k+1],S21,0xF61E2562); d = GG(d,a,b,c,x[k+6],S22,0xC040B340); c = GG(c,d,a,b,x[k+11],S23,0x265E5A51); b = GG(b,c,d,a,x[k+0],S24,0xE9B6C7AA);
    a = GG(a,b,c,d,x[k+5],S21,0xD62F105D); d = GG(d,a,b,c,x[k+10],S22,0x02441453); c = GG(c,d,a,b,x[k+15],S23,0xD8A1E681); b = GG(b,c,d,a,x[k+4],S24,0xE7D3FBC8);
    a = GG(a,b,c,d,x[k+9],S21,0x21E1CDE6); d = GG(d,a,b,c,x[k+14],S22,0xC33707D6); c = GG(c,d,a,b,x[k+3],S23,0xF4D50D87); b = GG(b,c,d,a,x[k+8],S24,0x455A14ED);
    a = GG(a,b,c,d,x[k+13],S21,0xA9E3E905); d = GG(d,a,b,c,x[k+2],S22,0xFCEFA3F8); c = GG(c,d,a,b,x[k+7],S23,0x676F02D9); b = GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
    a = HH(a,b,c,d,x[k+5],S31,0xFFFA3942); d = HH(d,a,b,c,x[k+8],S32,0x8771F681); c = HH(c,d,a,b,x[k+11],S33,0x6D9D6122); b = HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
    a = HH(a,b,c,d,x[k+1],S31,0xA4BEEA44); d = HH(d,a,b,c,x[k+4],S32,0x4BDECFA9); c = HH(c,d,a,b,x[k+7],S33,0xF6BB4B60); b = HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
    a = HH(a,b,c,d,x[k+13],S31,0x289B7EC6); d = HH(d,a,b,c,x[k+0],S32,0xEAA127FA); c = HH(c,d,a,b,x[k+3],S33,0xD4EF3085); b = HH(b,c,d,a,x[k+6],S34,0x04881D05);
    a = HH(a,b,c,d,x[k+9],S31,0xD9D4D039); d = HH(d,a,b,c,x[k+12],S32,0xE6DB99E5); c = HH(c,d,a,b,x[k+15],S33,0x1FA27CF8); b = HH(b,c,d,a,x[k+2],S34,0xC4AC5665);
    a = II(a,b,c,d,x[k+0],S41,0xF4292244); d = II(d,a,b,c,x[k+7],S42,0x432AFF97); c = II(c,d,a,b,x[k+14],S43,0xAB9423A7); b = II(b,c,d,a,x[k+5],S44,0xFC93A039);
    a = II(a,b,c,d,x[k+12],S41,0x655B59C3); d = II(d,a,b,c,x[k+3],S42,0x8F0CCC92); c = II(c,d,a,b,x[k+10],S43,0xFFEFF47D); b = II(b,c,d,a,x[k+1],S44,0x85845DD1);
    a = II(a,b,c,d,x[k+8],S41,0x6FA87E4F); d = II(d,a,b,c,x[k+15],S42,0xFE2CE6E0); c = II(c,d,a,b,x[k+6],S43,0xA3014314); b = II(b,c,d,a,x[k+13],S44,0x4E0811A1);
    a = II(a,b,c,d,x[k+4],S41,0xF7537E82); d = II(d,a,b,c,x[k+11],S42,0xBD3AF235); c = II(c,d,a,b,x[k+2],S43,0x2AD7D2BB); b = II(b,c,d,a,x[k+9],S44,0xEB86D391);
    a = AddUnsigned(a,AA); b = AddUnsigned(b,BB); c = AddUnsigned(c,CC); d = AddUnsigned(d,DD);
  }
  return (WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d)).toLowerCase();
}

function getUTCSignDate() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

function parseRawQuery(url) {
  const query = (url.split('?')[1] || '').split('#')[0];
  const rawMap = {};
  query.split('&').forEach(pair => {
    if (!pair) return;
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    rawMap[pair.slice(0, idx)] = pair.slice(idx + 1);
  });
  return rawMap;
}

function fingerprintOf(paramsRaw) {
  const drop = { sign:1, signDate:1, timestamp:1, ts:1, nonce:1, random:1, reqTime:1, reqId:1, requestId:1 };
  const base = Object.keys(paramsRaw || {}).filter(k => !drop[k]).sort().map(k => `${k}=${paramsRaw[k]}`).join('&');
  return MD5(base).slice(0, 12);
}

function pickItem(arr, seed) { return arr[seed % arr.length]; }

function buildUA(baseUA, seed) {
  const iosVer = pickItem(IOS_VERSIONS, seed), scale = pickItem(IOS_SCALES, seed + 1);
  const model = pickItem(IPHONE_MODELS, seed + 2), cfn = pickItem(CFN_VERS, seed + 3), darwin = pickItem(DARWIN_VERS, seed + 4);
  if (baseUA && typeof baseUA === 'string') {
    let ua = baseUA;
    ua = ua.replace(/iOS \d+(\.\d+){0,2}/, `iOS ${iosVer}`).replace(/Scale\/\d+(\.\d+)?/, `Scale/${scale}`);
    ua = ua.replace(/iPhone\d+,\d+/, model).replace(/CFNetwork\/[\d.]+/, `CFNetwork/${cfn}`).replace(/Darwin\/[\d.]+/, `Darwin/${darwin}`);
    return ua;
  }
  return `WeTalk/30.6.0 (com.innovationworks.wetalk; build:28; iOS ${iosVer}) Alamofire/5.4.3`;
}

function buildUrl(path, capture) {
  const params = {};
  Object.keys(capture.paramsRaw || {}).forEach(k => { if (k !== 'sign' && k !== 'signDate') params[k] = capture.paramsRaw[k]; });
  params.signDate = getUTCSignDate();
  const signBase = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  params.sign = MD5(signBase + SECRET);
  const qs = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
  return `https://${API_HOST}/app/${path}?${qs}`;
}

// --- 4. 核心业务流程 ---
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runAccount(acc, index, total) {
  const tag = `[账号${index+1}/${total} ${acc.alias || acc.id}]`;
  const ua = buildUA(acc.baseUA, acc.uaSeed);
  const headers = { 'Host': API_HOST, 'Accept': 'application/json', 'User-Agent': ua };
  Object.assign(headers, acc.capture.headers);
  delete headers['Content-Length']; delete headers['content-length'];
  
  const msgs = [tag];
  const fetchApi = (path) => $.fetch({ url: buildUrl(path, acc.capture), method: 'GET', headers });

  try {
    let res = await fetchApi('queryBalanceAndBonus');
    let d = JSON.parse(res.body);
    msgs.push(d.retcode === 0 ? `💰 余额：${d.result.balance}` : `⚠️ 查询失败`);

    res = await fetchApi('checkIn');
    d = JSON.parse(res.body);
    msgs.push(d.retcode === 0 ? `✅ 签到成功` : `⚠️ ${d.retmsg || '签到失败'}`);

    for (let i = 1; i <= MAX_VIDEO; i++) {
      await sleep(i === 1 ? 1000 : VIDEO_DELAY);
      res = await fetchApi('videoBonus');
      try {
        d = JSON.parse(res.body);
        if (d.retcode === 0) msgs.push(`🎬 视频${i}: +${d.result?.bonus} Coins`);
        else { msgs.push(`⏸ 视频${i}结束: ${d.retmsg}`); break; }
      } catch (e) { msgs.push(`⏸ 视频${i}停止`); break; }
    }
  } catch (e) { msgs.push(`❌ 错误: ${e.message || '请求异常'}`); }
  return msgs.join('\n');
}

// --- 5. 入口逻辑 ---
(async () => {
  const loadStore = () => {
    const raw = $.getdata(storeKey);
    return raw ? JSON.parse(raw) : { version: 1, accounts: {}, order: [] };
  };

  if (typeof $request !== 'undefined') {
    // 抓包模式
    const paramsRaw = parseRawQuery($request.url);
    const store = loadStore();
    const fp = fingerprintOf(paramsRaw);
    const existed = !!store.accounts[fp];
    
    store.accounts[fp] = {
      id: fp,
      alias: existed ? store.accounts[fp].alias : `账号${store.order.length + 1}`,
      uaSeed: existed ? store.accounts[fp].uaSeed : store.order.length,
      baseUA: $request.headers['User-Agent'] || $request.headers['user-agent'] || '',
      capture: { url: $request.url, paramsRaw, headers: $request.headers },
      updatedAt: Date.now()
    };
    if (!existed) store.order.push(fp);
    $.setdata(JSON.stringify(store), storeKey);
    $.msg(existed ? '🔄 WeTalk 账号更新' : '✅ WeTalk 账号入库', `当前总数：${store.order.length}`);
    $.done({});
  } else {
    // 定时任务模式
    const store = loadStore();
    const ids = store.order.filter(id => store.accounts[id]);
    if (!ids.length) return $.msg('⚠️ 无账号', '请先打开APP触发抓包'), $.done();

    const results = [];
    for (let i = 0; i < ids.length; i++) {
      results.push(await runAccount(store.accounts[ids[i]], i, ids.length));
      if (i < ids.length - 1) await sleep(ACCOUNT_GAP);
    }
    $.msg('🎉 WeTalk 任务完成', results.join('\n———\n'));
    $.done();
  }
})().catch(e => { $.log(e); $.done(); });
