/**
 * ════════════════════════════════════════════════════
 *  链上地址转账监控小组件
 *  数据源：TronGrid（波场）/ Blockstream + mempool.space（BTC）/ Blockscout + Routescan（ETH）/ Etherscan V2（需 Key 的链）
 * ════════════════════════════════════════════════════
 *
 * ⚙️ 配置方法（模块设置）：
 *   CHAIN          监控的链：TRON / BTC / ETH / BSC / POLYGON
 *   ADDRESS        要监控的钱包地址
 *   ETHERSCAN_KEY  Etherscan 免费 API Key（BSC、POLYGON 必填；ETH 可不填）
 *   NOTIFY         发现新转账时推送通知：true / false
 *
 * 📊 尺寸说明：
 *   • 小尺寸  : 最近 3 笔转账
 *   • 中尺寸  : 最近 4 笔转账
 *   • 大尺寸  : 最近 8 笔转账（带对方完整地址）
 *   • 锁屏    : 矩形显示最近 1 笔，单行显示最新动态
 *
 * 🔔 监控说明：
 *   每次刷新拉取最新记录，与上次记录对比，有新转账时推送一条通知；
 *   刷新节奏由 iOS 系统预算决定，不是秒级实时。
 * ════════════════════════════════════════════════════
 */

export default async function (ctx) {
  const safeCtx = ctx || {};
  const env = safeCtx.env || {};
  const family = safeCtx.widgetFamily || 'systemSmall';

  const CHAIN = String(env.CHAIN || 'TRON').trim().toUpperCase();
  const ADDRESS = String(env.ADDRESS || '').replace(/\s+/g, '');
  const ES_KEY = String(env.ETHERSCAN_KEY || '').trim();
  const NOTIFY = String(env.NOTIFY || 'true').trim().toLowerCase() !== 'false';

  const CHAIN_NAME = { TRON: '波场 TRON', BTC: '比特币 BTC', ETH: '以太坊 ETH', BSC: 'BNB 链', POLYGON: 'Polygon' };
  const ES_CHAIN_ID = { ETH: '1', BSC: '56', POLYGON: '137' };

  const C = {
    title: { light: '#000000', dark: '#D9E9F7' },
    inColor: { light: '#1DA851', dark: '#3ECF8E' },
    outColor: { light: '#E05E2B', dark: '#FF8A5C' }
  };
  const CARD_BG = { light: '#FFFFFF15', dark: '#FFFFFF10' };
  const CARD_BORDER = { light: '#E5E5EA', dark: '#48484A' };
  const HUES = [
    { light: '#1F7A99', dark: '#57B9D2' },
    { light: '#2B6CA3', dark: '#4A90C2' },
    { light: '#4A5CA8', dark: '#6D80C5' },
    { light: '#5F4DB0', dark: '#806FCF' },
    { light: '#6D3FA8', dark: '#8B5DCA' },
    { light: '#9C3FAE', dark: '#C05FD0' }
  ];

  const bgGradient = {
    type: 'linear',
    colors: [
      { light: '#FFFFFF00', dark: '#2C2C2E00' },
      { light: '#FFFFFF00', dark: '#2C2C2E00' }
    ],
    stops: [0, 1],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 0, y: 1 }
  };
  const A = {
    text: { light: '#000000', dark: '#FFFFFF' },
    sub: { light: '#555555', dark: '#8FA3B8' },
    time: { light: '#888888', dark: '#7C8DA6' },
    warn: { light: '#C77400', dark: '#FFB35C' },
    chain: { light: '#1D7A99', dark: '#57B9D2' }
  };

  const refreshAfter = (ms) => new Date(Date.now() + ms).toISOString();
  const pad2 = (n) => String(n).padStart(2, '0');
  const hhmm = (ts) => { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const rowTime = (ts) => {
    const d = new Date(ts); const now = new Date();
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) return hhmm(ts);
    return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hhmm(ts);
  };
  const shortAddr = (a) => {
    if (!a) return '-';
    if (a.length <= 15) return a;
    return a.slice(0, 7) + '…' + a.slice(-5);
  };
  const fmtNum = (n) => {
    if (!isFinite(n) || n === 0) return '0';
    if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (n >= 1) return String(parseFloat(n.toFixed(4)));
    return String(parseFloat(n.toFixed(6)));
  };
  const amt = (raw, decimals) => fmtNum(Number(raw) / Math.pow(10, decimals || 0));

  function sha256Bytes(msg) {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const bytes = msg.slice();
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(Math.floor(bitLen / Math.pow(2, 8 * i)) % 256);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    const w = new Array(64);
    for (let block = 0; block < bytes.length; block += 64) {
      for (let t = 0; t < 16; t++) {
        const i = block + t * 4;
        w[t] = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
      }
      for (let t = 16; t < 64; t++) {
        const s0 = (rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)) >>> 0;
        const s1 = (rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)) >>> 0;
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let t = 0; t < 64; t++) {
        const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
        const ch = ((e & f) ^ (~e & g)) >>> 0;
        const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
        const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        const temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    const out = [];
    for (const x of [h0, h1, h2, h3, h4, h5, h6, h7]) {
      out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
    }
    return out;
  }

  function tronHexToBase58(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
    const check = sha256Bytes(sha256Bytes(bytes)).slice(0, 4);
    const full = bytes.concat(check);
    const alpha = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const digits = [0];
    for (const byte of full) {
      let carry = byte;
      for (let i = 0; i < digits.length; i++) {
        const v = digits[i] * 256 + carry;
        digits[i] = v % 58;
        carry = Math.floor(v / 58);
      }
      while (carry > 0) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
    }
    let s = '';
    for (const byte of full) { if (byte === 0) s += '1'; else break; }
    return s + digits.reverse().map((d) => alpha[d]).join('');
  }

  const httpGet = async (url) => {
    const resp = await safeCtx.http.get(url, { timeout: 15000 });
    return resp.json();
  };
  const sameAddr = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

  async function fetchTron(addr) {
    const out = [];
    const tokenJson = await httpGet('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(addr) + '/transactions/trc20?limit=30');
    if (!tokenJson || tokenJson.success === false) throw new Error('波场接口返回异常');
    for (const t of tokenJson.data || []) {
      if (!t.value || t.value === '0') continue;
      const isIn = sameAddr(t.to, addr);
      out.push({
        id: t.transaction_id, ts: t.block_timestamp,
        dir: isIn ? 'in' : 'out',
        amount: amt(t.value, t.token_info && t.token_info.decimals),
        symbol: (t.token_info && t.token_info.symbol) || '',
        from: t.from, to: t.to,
        counterparty: isIn ? t.from : t.to,
        pending: false
      });
    }
    try {
      const nativeJson = await httpGet('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(addr) + '/transactions?limit=30');
      for (const t of (nativeJson && nativeJson.data) || []) {
        const ret = t.ret && t.ret[0] && t.ret[0].contractRet;
        const contract = t.raw_data && t.raw_data.contract && t.raw_data.contract[0];
        if (ret !== 'SUCCESS' || !contract || contract.type !== 'TransferContract') continue;
        const v = contract.parameter.value;
        const from = tronHexToBase58(v.owner_address);
        const to = tronHexToBase58(v.to_address);
        const isIn = sameAddr(to, addr);
        out.push({
          id: t.txID, ts: t.block_timestamp,
          dir: isIn ? 'in' : 'out',
          amount: amt(v.amount, 6),
          symbol: 'TRX',
          from, to,
          counterparty: isIn ? from : to,
          pending: false
        });
      }
    } catch (e) {}
    return out;
  }

  async function fetchBtc(addr) {
    let json = null;
    try { json = await httpGet('https://blockstream.info/api/address/' + encodeURIComponent(addr) + '/txs'); } catch (e) {}
    if (!Array.isArray(json)) {
      json = await httpGet('https://mempool.space/api/address/' + encodeURIComponent(addr) + '/txs');
    }
    if (!Array.isArray(json)) throw new Error('BTC 接口返回异常');
    const out = [];
    for (const t of json) {
      let vinFrom = 0, voutTo = 0, firstInAddr = '', firstOutAddr = '';
      for (const vin of t.vin || []) {
        const p = vin.prevout;
        if (!p) continue;
        if (!firstInAddr) firstInAddr = p.scriptpubkey_address || '';
        if (p.scriptpubkey_address === addr) vinFrom += p.value || 0;
      }
      for (const vout of t.vout || []) {
        if (vout.scriptpubkey_address === addr) voutTo += vout.value || 0;
        else if (!firstOutAddr) firstOutAddr = vout.scriptpubkey_address || '';
      }
      const confirmed = !!(t.status && t.status.confirmed);
      const ts = confirmed ? t.status.block_time * 1000 : Date.now();
      if (vinFrom > 0) {
        out.push({ id: t.txid, ts, dir: 'out', amount: fmtNum((vinFrom - voutTo) / 1e8), symbol: 'BTC', from: addr, to: firstOutAddr, counterparty: firstOutAddr, pending: !confirmed });
      } else if (voutTo > 0) {
        out.push({ id: t.txid, ts, dir: 'in', amount: fmtNum(voutTo / 1e8), symbol: 'BTC', from: firstInAddr, to: addr, counterparty: firstInAddr, pending: !confirmed });
      }
    }
    return out;
  }

  async function fetchBlockscout(addr) {
    const base = 'https://eth.blockscout.com/api/v2/addresses/' + encodeURIComponent(addr);
    const out = [];
    const txJson = await httpGet(base + '/transactions');
    if (!txJson || !Array.isArray(txJson.items)) throw new Error('ETH 接口返回异常');
    for (const t of txJson.items) {
      if (!t.value || t.value === '0') continue;
      const isIn = sameAddr(t.to && t.to.hash, addr);
      out.push({
        id: t.hash, ts: Date.parse(t.timestamp),
        dir: isIn ? 'in' : 'out',
        amount: amt(t.value, 18),
        symbol: 'ETH',
        from: t.from && t.from.hash, to: t.to && t.to.hash,
        counterparty: isIn ? (t.from && t.from.hash) : (t.to && t.to.hash),
        pending: false
      });
    }
    try {
      const tkJson = await httpGet(base + '/token-transfers');
      for (const t of (tkJson && tkJson.items) || []) {
        if (!t.total || !t.total.value || t.total.value === '0') continue;
        const isIn = sameAddr(t.to && t.to.hash, addr);
        out.push({
          id: t.transaction_hash, ts: Date.parse(t.timestamp),
          dir: isIn ? 'in' : 'out',
          amount: amt(t.total && t.total.value, t.total && t.total.decimals),
          symbol: (t.token && t.token.symbol) || '',
          from: t.from && t.from.hash, to: t.to && t.to.hash,
          counterparty: isIn ? (t.from && t.from.hash) : (t.to && t.to.hash),
          pending: false
        });
      }
    } catch (e) {}
    return out;
  }

  async function fetchEtherscan(chain, addr, mkOverride) {
    const cid = ES_CHAIN_ID[chain];
    const mk = mkOverride || ((action) => 'https://api.etherscan.io/v2/api?chainid=' + cid + '&module=account&action=' + action + '&address=' + encodeURIComponent(addr) + '&page=1&offset=30&sort=desc&apikey=' + ES_KEY);
    const check = (json) => {
      if (!json) throw new Error('接口返回异常');
      if (json.status === '0') {
        const msg = String(json.message || '') + ' ' + String(json.result || '');
        if (/No transactions found/i.test(msg)) return [];
        if (/Invalid API Key/i.test(msg)) throw new Error('Etherscan Key 无效');
        throw new Error('接口返回异常');
      }
      return Array.isArray(json.result) ? json.result : [];
    };
    const out = [];
    const txList = check(await httpGet(mk('txlist')));
    for (const t of txList) {
      if (t.isError === '1' || !t.value || t.value === '0') continue;
      const isIn = sameAddr(t.to, addr);
      out.push({
        id: t.hash, ts: Number(t.timeStamp) * 1000,
        dir: isIn ? 'in' : 'out',
        amount: amt(t.value, 18),
        symbol: { ETH: 'ETH', BSC: 'BNB', POLYGON: 'POL' }[chain],
        from: t.from, to: t.to,
        counterparty: isIn ? t.from : t.to,
        pending: false
      });
    }
    const tkList = check(await httpGet(mk('tokentx')));
    for (const t of tkList) {
      if (!t.value || t.value === '0') continue;
      const isIn = sameAddr(t.to, addr);
      out.push({
        id: t.hash, ts: Number(t.timeStamp) * 1000,
        dir: isIn ? 'in' : 'out',
        amount: amt(t.value, Number(t.tokenDecimal) || 0),
        symbol: t.tokenSymbol || '',
        from: t.from, to: t.to,
        counterparty: isIn ? t.from : t.to,
        pending: false
      });
    }
    return out;
  }

  async function fetchAll() {
    if (CHAIN === 'TRON') return fetchTron(ADDRESS);
    if (CHAIN === 'BTC') return fetchBtc(ADDRESS);
    if (CHAIN === 'ETH' && !ES_KEY) {
      try { return await fetchBlockscout(ADDRESS); } catch (e) {
        return fetchEtherscan('ETH', ADDRESS, (action) => 'https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api?module=account&action=' + action + '&address=' + encodeURIComponent(ADDRESS) + '&page=1&offset=30&sort=desc');
      }
    }
    if (ES_CHAIN_ID[CHAIN]) {
      if (!ES_KEY) throw new Error('nokey');
      return fetchEtherscan(CHAIN, ADDRESS);
    }
    throw new Error('不支持的链');
  }

  const storeGet = (key) => { try { return safeCtx.storage.getJSON(key); } catch (e) { return null; } };
  const storeSet = (key, val) => { try { safeCtx.storage.setJSON(key, val); } catch (e) {} };

  let state = { status: 'ok', txs: [], fetchedAt: Date.now(), errMsg: '' };
  const cacheKey = 'cm_cache_' + CHAIN + '_' + ADDRESS;
  const lastKey = 'cm_last_' + CHAIN + '_' + ADDRESS;

  const ADDR_OK = {
    TRON: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    BTC: /^(1|3)[1-9A-HJ-NP-Za-km-z]{25,34}$|^bc1[0-9a-z]{11,71}$/i,
    ETH: /^0x[0-9a-fA-F]{40}$/,
    BSC: /^0x[0-9a-fA-F]{40}$/,
    POLYGON: /^0x[0-9a-fA-F]{40}$/
  };
  if (!ADDRESS) {
    state = { status: 'noaddr', txs: [], fetchedAt: Date.now(), errMsg: '' };
  } else if (ADDR_OK[CHAIN] && !ADDR_OK[CHAIN].test(ADDRESS)) {
    state = { status: 'badaddr', txs: [], fetchedAt: Date.now(), errMsg: '' };
  } else {
    try {
      const raw = await fetchAll();
      const seen = new Set();
      const txs = [];
      for (const t of raw) {
        const k = t.id + '_' + t.symbol + '_' + t.amount + '_' + t.dir;
        if (seen.has(k)) continue;
        seen.add(k);
        txs.push(t);
      }
      txs.sort((a, b) => b.ts - a.ts);
      state = { status: txs.length ? 'ok' : 'empty', txs, fetchedAt: Date.now(), errMsg: '' };
      storeSet(cacheKey, { ts: Date.now(), txs });
      if (NOTIFY && txs.length) {
        const last = storeGet(lastKey);
        const newest = txs[0];
        if (last && last.id && last.id !== newest.id) {
          const fresh = txs.filter((t) => t.ts > (last.ts || 0) && t.id !== last.id);
          if (fresh.length) {
            const t0 = fresh[0];
            safeCtx.notify({
              title: (CHAIN_NAME[CHAIN] || CHAIN) + ' 新' + (t0.dir === 'in' ? '转入' : '转出'),
              body: (t0.dir === 'in' ? '+' : '-') + t0.amount + ' ' + t0.symbol + ' · ' + (t0.dir === 'in' ? '来自 ' : '转到 ') + shortAddr(t0.counterparty) + (fresh.length > 1 ? '（共 ' + fresh.length + ' 笔新记录）' : '')
            });
          }
        }
        storeSet(lastKey, { id: newest.id, ts: newest.ts });
      }
    } catch (e) {
      const cached = storeGet(cacheKey);
      if (e && e.message === 'nokey') {
        state = { status: 'nokey', txs: [], fetchedAt: Date.now(), errMsg: '' };
      } else if (cached && Array.isArray(cached.txs) && cached.txs.length) {
        state = { status: 'ok', txs: cached.txs, fetchedAt: cached.ts, errMsg: '' };
      } else {
        state = { status: 'error', txs: [], fetchedAt: Date.now(), errMsg: (e && e.message) || '获取失败' };
      }
    }
  }


  const titleRow = () => ({
    type: 'stack', direction: 'row', alignItems: 'center', children: [
      { type: 'text', text: '链上监控', font: { size: 14, weight: 'bold' }, textColor: C.title },
      { type: 'spacer', length: 6 },
      { type: 'text', text: CHAIN, font: { size: 14, weight: 'bold' }, textColor: A.chain },
      { type: 'spacer' },
      { type: 'image', src: 'sf-symbol:arrow.clockwise', width: 12, height: 12, color: A.time },
      { type: 'spacer', length: 4 },
      { type: 'text', text: hhmm(state.fetchedAt), font: { size: 11 }, textColor: A.time }
    ]
  });

  const addrRow = () => ({
    type: 'stack', direction: 'row', alignItems: 'center', children: [
      { type: 'text', text: ADDRESS ? shortAddr(ADDRESS) : '未填写地址', font: { size: 10 }, textColor: A.sub, maxLines: 1 },
      { type: 'spacer' },
      { type: 'text', text: state.txs.length ? state.txs.length + ' 笔记录' : '', font: { size: 10 }, textColor: A.sub }
    ]
  });

  const txRow = (tx, idx, detailed) => {
    const hue = HUES[idx % HUES.length];
    const isIn = tx.dir === 'in';
    const mainLine = {
      type: 'stack', direction: 'row', alignItems: 'center', children: [
        { type: 'stack', width: 3, height: 16, backgroundColor: hue, borderRadius: 1.5 },
        { type: 'spacer', length: 7 },
        { type: 'text', text: isIn ? '↓' : '↑', font: { size: 13, weight: 'bold' }, textColor: isIn ? C.inColor : C.outColor },
        { type: 'spacer', length: 5 },
        { type: 'text', text: (isIn ? '+' : '-') + tx.amount, font: { size: 13, weight: 'bold' }, textColor: A.text },
        { type: 'spacer', length: 4 },
        { type: 'text', text: tx.symbol, font: { size: 11, weight: 'bold' }, textColor: hue },
        { type: 'spacer' },
        { type: 'text', text: rowTime(tx.ts), font: { size: 10 }, textColor: A.time }
      ]
    };
    const children = [mainLine];
    if (detailed) {
      children.push({
        type: 'stack', direction: 'row', alignItems: 'center', children: [
          { type: 'spacer', length: 10 },
          { type: 'text', text: (isIn ? '来自 ' : '转到 ') + (tx.counterparty || '-'), font: { size: 10 }, textColor: A.sub, maxLines: 1 },
          { type: 'spacer' },
          ...(tx.pending ? [{ type: 'text', text: '确认中', font: { size: 10 }, textColor: A.warn }] : [])
        ]
      });
    } else {
      mainLine.children.splice(7, 0,
        { type: 'spacer', length: 6 },
        { type: 'text', text: shortAddr(tx.counterparty), font: { size: 10 }, textColor: A.sub, maxLines: 1 },
        { type: 'spacer', length: 6 });
    }
    return {
      type: 'stack', direction: 'column', backgroundColor: CARD_BG,
      borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 8,
      padding: detailed ? [6, 8, 6, 8] : [5, 8, 5, 8],
      children
    };
  };

  const msgWidget = (text) => ({
    type: 'widget', padding: 12, backgroundGradient: bgGradient, refreshAfter: refreshAfter(5 * 60 * 1000),
    children: [
      titleRow(),
      { type: 'spacer' },
      { type: 'text', text, font: { size: 12 }, textColor: A.warn, textAlign: 'center' },
      { type: 'spacer' }
    ]
  });

  if (family === 'accessoryInline') {
    let text = '链上监控 · ' + (CHAIN_NAME[CHAIN] || CHAIN);
    if (state.status === 'ok' && state.txs.length) {
      const t = state.txs[0];
      text = (t.dir === 'in' ? '↓ +' : '↑ -') + t.amount + ' ' + t.symbol + ' · ' + rowTime(t.ts);
    } else if (state.status === 'noaddr') text = '链上监控 · 未填写地址';
    else if (state.status === 'error') text = '链上监控 · 获取失败';
    return { type: 'widget', refreshAfter: refreshAfter(120 * 1000), children: [{ type: 'text', text, font: { size: 12 }, textColor: A.text }] };
  }

  if (family === 'accessoryRectangular') {
    const kids = [titleRow()];
    if (state.status === 'ok' && state.txs.length) {
      kids.push({ type: 'spacer', length: 4 }, txRow(state.txs[0], 0, false));
    } else {
      kids.push({ type: 'spacer', length: 6 }, { type: 'text', text: state.status === 'empty' ? '暂无转账记录' : '暂无数据', font: { size: 11 }, textColor: A.sub });
    }
    return { type: 'widget', padding: 10, backgroundGradient: bgGradient, refreshAfter: refreshAfter(120 * 1000), children: kids };
  }

  if (family === 'accessoryCircular') {
    const t = state.txs[0];
    return {
      type: 'widget', backgroundGradient: bgGradient, refreshAfter: refreshAfter(120 * 1000),
      children: [{
        type: 'stack', direction: 'column', alignItems: 'center', children: [
          { type: 'text', text: t ? (t.dir === 'in' ? '↓' : '↑') : '—', font: { size: 16, weight: 'bold' }, textColor: t ? (t.dir === 'in' ? C.inColor : C.outColor) : A.sub },
          { type: 'text', text: t ? t.amount : '0', font: { size: 10, weight: 'bold' }, textColor: A.text, maxLines: 1 },
          { type: 'text', text: t ? t.symbol : CHAIN, font: { size: 8 }, textColor: A.sub, maxLines: 1 }
        ]
      }]
    };
  }

  if (state.status === 'noaddr') return msgWidget('请先在模块设置里填写要监控的地址');
  if (state.status === 'badaddr') return msgWidget('地址和所选链对不上，请检查模块设置里的链和地址');
  if (state.status === 'nokey') return msgWidget(CHAIN + ' 需要填 Etherscan 免费 Key 后才能查询');
  if (state.status === 'error') return msgWidget('获取失败：' + state.errMsg);
  if (state.status === 'empty') return msgWidget('暂无转账记录');

  const limit = family === 'systemLarge' ? 8 : family === 'systemMedium' ? 4 : 3;
  const detailed = family === 'systemLarge';
  const kids = [titleRow(), { type: 'spacer', length: 5 }, addrRow(), { type: 'spacer', length: 7 }];
  state.txs.slice(0, limit).forEach((tx, i) => {
    kids.push(txRow(tx, i, detailed));
    if (i < limit - 1 && i < state.txs.length - 1) kids.push({ type: 'spacer', length: 5 });
  });
  return { type: 'widget', padding: 11, backgroundGradient: bgGradient, refreshAfter: refreshAfter(120 * 1000), children: kids };
}
