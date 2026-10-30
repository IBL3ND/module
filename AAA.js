//YouTube 双语字幕
(() => {
  const hostResponse = typeof $response !== "undefined" ? $response : undefined;
  const hostDone = typeof $done !== "undefined" ? $done : undefined;

  function runSubtitle(hostResponse, hostDone) {
    const rawBody = hostResponse ? hostResponse.body : undefined;
    let textBody = "";
    if (rawBody instanceof Uint8Array) {
      textBody = new TextDecoder().decode(rawBody);
    } else if (typeof rawBody === "string") {
      textBody = rawBody;
    } else if (rawBody) {
      textBody = String(rawBody);
    }
    const $response = hostResponse
      ? Object.assign(Object.create(Object.getPrototypeOf(hostResponse) || null), hostResponse, { body: textBody })
      : { body: textBody };
    const __origDone = hostDone;
    const $done = (result) => {
      if (result && typeof result.body === "string") {
        __origDone({ ...result, body: new TextEncoder().encode(result.body) });
      } else {
        __origDone(result);
      }
    };








    const $ = {

      request: typeof $request !== "undefined" ? $request : {},

      response: typeof $response !== "undefined" ? $response : {},

      argument: typeof $argument !== "undefined" ? $argument : "",

      done: (o) => $done(o)

    };


    if (!$response || !$response.body) {

      $.done({});

    } else {

      main().catch((e) => {

        console.log("[YT DualSubs] " + e);

        $.done({});

      });

    }


    async function main() {

      const params = parseArgument($.argument);

      const subtitleType = String(params.subtitle_type || "Translate").toLowerCase();

      if (subtitleType === "official" || subtitleType === "offical") {

        $.done({});

        return;

      }


      const showOnly = toBool(params.show_only_auto_translation, false);

      const requestUrl = $.request.url || "";

      const explicitTarget = queryParam(requestUrl, "tlang");

      let targetLang = normalizeLang(explicitTarget || storeGet("ytdual:lastTarget") || "zh-CN", "zh-CN");

      const sourceLang = normalizeLang(queryParam(requestUrl, "lang"), "auto");

      const fmt = (queryParam(requestUrl, "fmt") || queryParam(requestUrl, "format") || "").toLowerCase();


      if (/^zh(?:-|$)/i.test(sourceLang)) {

        $.done({});

        return;

      }

      if (!explicitTarget && sameBaseLang(sourceLang, targetLang)) targetLang = "zh-CN";

      if (explicitTarget) storeSet("ytdual:lastTarget", targetLang);


      let body = $.response.body;

      if (typeof body !== "string") body = String(body || "");

      if (!body) {

        $.done({});

        return;

      }


      const headers = $.response.headers || {};

      const contentType = (headers["Content-Type"] || headers["content-type"] || "").split(";")[0].toLowerCase();

      const trimmed = body.trim();

      const bodyCacheKey = responseCacheKey(body, sourceLang, targetLang, fmt, showOnly, requestUrl);

      const cached = storeGet(bodyCacheKey);

      if (cached) {

        $.done({ body: cached });

        return;

      }


      let outText = "";

      if (contentType.indexOf("json") >= 0 || fmt.indexOf("json") >= 0 || trimmed.charAt(0) === "{") {

        outText = await translateJson(body, sourceLang, targetLang, showOnly);

      } else if (contentType.indexOf("vtt") >= 0 || fmt.indexOf("vtt") >= 0 || /^WEBVTT/i.test(trimmed)) {

        outText = await translateVtt(body, sourceLang, targetLang, showOnly);

      } else if (contentType.indexOf("xml") >= 0 || fmt === "srv3" || fmt === "ttml" || trimmed.charAt(0) === "<") {

        outText = await translateXml(body, sourceLang, targetLang, fmt, showOnly);

      }


      if (!outText) {

        $.done({});

        return;

      }

      storeSet(bodyCacheKey, outText);

      $.done({ body: outText });

    }




    function parseArgument(arg) {

      const result = {};

      if (!arg) return result;

      String(arg).split("&").forEach((pair) => {

        const eq = pair.indexOf("=");

        if (eq < 0) return;

        const key = decodeURIComponent(pair.slice(0, eq).trim());

        const value = decodeURIComponent(pair.slice(eq + 1).trim());

        if (key) result[key] = value;

      });

      return result;

    }

    function toBool(v, fb) {

      if (v === undefined || v === null || v === "") return fb;

      const s = String(v).toLowerCase();

      return s === "1" || s === "true" || s === "on" || s === "yes";

    }

    function queryParam(url, name) {

      const query = String(url || "").split("#")[0].split("?")[1] || "";

      for (const part of query.split("&")) {

        const eq = part.indexOf("=");

        const key = decode(eq >= 0 ? part.slice(0, eq) : part);

        if (key === name) return decode(eq >= 0 ? part.slice(eq + 1) : "");

      }

      return "";

    }

    function decode(v) {

      v = String(v == null ? "" : v).replace(/\+/g, " ");

      try { return decodeURIComponent(v); } catch (_) { return v; }

    }

    function encodeQuery(v) { return encodeURIComponent(String(v == null ? "" : v)); }

    function normalizeLang(value, fallback) {

      value = String(value || fallback || "").trim();

      if (!value || value.toLowerCase() === "und") return fallback || "auto";

      const lower = value.toLowerCase();

      if (lower === "zh" || lower === "zh-hans" || lower === "zh-cn") return "zh-CN";

      if (lower === "zh-hant" || lower === "zh-tw" || lower === "zh-hk") return "zh-TW";

      return value;

    }

    function sameBaseLang(a, b) {

      a = String(a || "").toLowerCase().split(/[-_]/)[0];

      b = String(b || "").toLowerCase().split(/[-_]/)[0];

      return !!a && a !== "auto" && a === b;

    }

    function storeGet(k) { try { return $persistentStore.read(k) || ""; } catch (_) { return ""; } }

    function storeSet(k, v) { try { $persistentStore.write(String(v), k); } catch (_) {} }

    function hashText(value) {

      value = String(value == null ? "" : value);

      let h = 2166136261;

      for (let i = 0; i < value.length; i++) {

        h ^= value.charCodeAt(i);

        h = Math.imul(h, 16777619);

      }

      return (h >>> 0).toString(36);

    }

    function responseCacheKey(text, sl, tl, fmt, showOnly, url) {

      return "ytdualproxy:rowfix1:body:" + (queryParam(url, "v") || "-") + ":" + (sl || "auto") + ":" + (tl || "zh-CN") + ":" + (fmt || "-") + ":" + showOnly + ":"
    + text.length + ":" + hashText(text);

    }

    function htmlDecode(value) {

      const entities = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

      return String(value == null ? "" : value).replace(/(&(?:lt|gt|amp|apos|quot|#(?:\d{1,7}|x[0-9a-fA-F]{1,6}));)/g, (entity) => {

        if (entity.charAt(1) === "#") {

          const code = entity.charAt(2) === "x" ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);

          if (code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) return String.fromCodePoint(code);

        }

        return entities[entity] || entity;

      });

    }

    function htmlEncode(value) {

      return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    }

    function cleanCueText(value) {

      return String(value == null ? "" : value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    }

    function combine(source, translated, showOnly, xmlMode) {

      translated = xmlMode ? String(translated == null ? "" : translated).replace(/\s+/g, " ").trim() : cleanCueText(translated);

      if (!translated) return source;

      source = String(source == null ? "" : source);

      if (showOnly) return translated || source;

      return source ? source + "\n" + translated : translated;

    }

    function googleText(data) {

      const out = [];

      if (Array.isArray(data) && Array.isArray(data[0])) {

        for (let i = 0; i < data[0].length; i++) if (Array.isArray(data[0][i]) && data[0][i][0]) out.push(data[0][i][0]);

      }

      return out.join("");

    }


    async function translateRows(rows, sourceLang, targetLang) {

      const out = new Array(rows.length);

      const sep = "\r";

      const sepCost = encodeQuery(sep).length;

      const maxChunks = 16, maxEncoded = 14000;

      const chunks = [];

      let current = [], currentEncoded = 0;

      const costs = rows.map((r) => encodeQuery(String(r == null ? "" : r)).length);

      if (costs.some((c) => c > maxEncoded)) return null;


      function pushChunk() {

        if (!current.length) return;

        chunks.push({ offset: 0, rows: current, encoded: currentEncoded });

        current = []; currentEncoded = 0;

      }

      for (let ri = 0; ri < rows.length; ri++) {

        const row = String(rows[ri] == null ? "" : rows[ri]);

        let cost = costs[ri] + (current.length ? sepCost : 0);

        if (current.length && currentEncoded + cost > maxEncoded) { pushChunk(); cost = costs[ri]; }

        current.push(row); currentEncoded += cost;

      }

      pushChunk();

      if (chunks.length > maxChunks) return null;


      let offset = 0;

      for (const c of chunks) { c.offset = offset; offset += c.rows.length; }


      function httpGet(url) {

        return new Promise((resolve, reject) => {

          $httpClient.get({ url, headers: { Accept: "application/json", "Accept-Encoding": "identity" }, timeout: 8 }, (err, resp, data) => {

            if (err) reject(err);

            else resolve({ status: resp.status, body: data });

          });

        });

      }


      async function translateChunk(chunk) {

        const url = "http://translate.googleapis.com/translate_a/single?client=gtx&dt=t"

          + "&sl=" + encodeQuery(sourceLang || "auto")

          + "&tl=" + encodeQuery(targetLang || "zh-CN")

          + "&q=" + encodeQuery(chunk.rows.join(sep));

        let res;

        try { res = await httpGet(url); } catch (_) { return null; }

        if ((res.status || 0) < 200 || (res.status || 0) >= 300 || !res.body) return null;

        let translated;

        try { translated = googleText(JSON.parse(res.body)); } catch (_) { return null; }

        let parts = translated.split(/\r\n?|\n/);

        if (parts.length !== chunk.rows.length) parts = chunk.rows.length === 1 ? [translated] : translated.split(/\n+/);

        return chunk.rows.map((_, j) => (parts[j] || "").trim());

      }


      for (let ci = 0; ci < chunks.length; ci += 4) {

        const batch = chunks.slice(ci, ci + 4);

        const results = await Promise.all(batch.map(translateChunk));

        for (let bi = 0; bi < results.length; bi++) {

          if (!results[bi]) return null;

          const chunk = batch[bi];

          for (let rj = 0; rj < chunk.rows.length; rj++) out[chunk.offset + rj] = results[bi][rj] || "";

        }

      }

      return out;

    }


    async function translateJson(text, sl, tl, showOnly) {

      let data; try { data = JSON.parse(text); } catch (_) { return ""; }

      const slots = [];

      (data.events || []).forEach((event) => {

        const segs = Array.isArray(event && event.segs) ? event.segs : [];

        const source = segs.map((s) => (s && s.utf8 ? s.utf8 : "")).join("").trim();

        if (source) slots.push({ event, source });

      });

      if (!slots.length) return "";

      const translated = await translateRows(slots.map((i) => i.source), sl, tl);

      if (!translated) return "";

      slots.forEach((item, i) => {

        item.event.segs = [{ utf8: combine(item.source, translated[i], showOnly, false) }];

        delete item.event.wWinId;

      });

      return JSON.stringify(data);

    }


    async function translateVtt(text, sl, tl, showOnly) {

      const blocks = text.replace(/\r\n/g, "\n").split(/\n\n+/);

      const cueSlots = [];

      blocks.forEach((block, blockIndex) => {

        const lines = block.split("\n");

        let timeIndex = -1;

        for (let i = 0; i < lines.length; i++) if (lines[i].indexOf("-->") >= 0) { timeIndex = i; break; }

        if (timeIndex < 0) return;

        const cueText = cleanCueText(lines.slice(timeIndex + 1).join(" "));

        if (cueText) cueSlots.push({ blockIndex, lines, timeIndex, source: cueText });

      });

      if (!cueSlots.length) return "";

      const translated = await translateRows(cueSlots.map((i) => i.source), sl, tl);

      if (!translated) return "";

      cueSlots.forEach((item, i) => {

        item.lines.splice(item.timeIndex + 1, item.lines.length - item.timeIndex - 1, combine(item.source, translated[i], showOnly, false));

        blocks[item.blockIndex] = item.lines.join("\n");

      });

      return blocks.join("\n\n");

    }


    function normalizeTimedtextHead(xml) {

      let seen = 0;

      return xml.replace(/<wp\b([^>]*)>/g, (full, attrs) => {

        seen++;

        if (seen === 2 && /\brc="[^"]*"/.test(attrs)) return "<wp" + attrs.replace(/\brc="[^"]*"/, 'rc="1"') + ">";

        return full;

      });

    }


    async function translateXml(text, sl, tl, fmt, showOnly) {

      let re = /<(text|p)\b([^>]*)>([\s\S]*?)<\/\1>/g;

      const matches = [];

      let match;

      while ((match = re.exec(text))) {

        const cleanSource = htmlDecode(cleanCueText(match[3]));

        if (cleanSource) matches.push({ tag: match[1], attrs: match[2], source: cleanSource });

      }

      if (!matches.length && (fmt === "srv3" || /<s\b/i.test(text))) {

        re = /<(s)\b([^>]*)>([\s\S]*?)<\/\1>/g;

        while ((match = re.exec(text))) {

          const cleanSegment = htmlDecode(cleanCueText(match[3]));

          if (cleanSegment) matches.push({ tag: match[1], attrs: match[2], source: cleanSegment });

        }

      }

      if (!matches.length) return "";

      const translated = await translateRows(matches.map((i) => i.source), sl, tl);

      if (!translated) return "";

      let idx = 0;

      return normalizeTimedtextHead(text).replace(re, (full, tag, attrs, body) => {

        const displaySource = htmlDecode(cleanCueText(body));

        if (!displaySource) return full;

        const translatedText = String(translated[idx++] || "").replace(/\s+/g, " ").trim();

        const newline = tag === "text" ? "&#10;" : "&#x000A;";

        return "<" + tag + attrs + ">" + htmlEncode(combine(displaySource, translatedText, showOnly, true)).replace(/\n/g, newline) + "</" + tag + ">";

      });

    }

  }


  runSubtitle(hostResponse, hostDone);
})();
