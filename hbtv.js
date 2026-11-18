/**
 * 湖北台 直播源 v3（长江云 cjyun 官方链路，纯 JS 完整实现）2026-11-18
 * ---------------------------------------------------------------
 * 频道 id：hbws / hbjs / hbzh / hbgg / hbys / hbjy / hbls
 *
 * 链路（每次播放都由 JS 现场生成，地址全部带时效签名，永不过期）：
 *   1. GET https://news.hbtv.com.cn/app/tv/<sid>   ← 取响应头 Set-Cookie
 *        → client-id / aa-look / client-token
 *   2. GET https://app.cjyun.org.cn/video/player/stream?stream_id=<sid>&site_id=10008
 *        → 带 auth_key 的 m3u8
 *   3. mytv.websocket() 连 wss://remote-wa.cjyun.org.cn/liveweb
 *        发送 {"client_id","aa_look","client_token"} 完成在线登记
 *        ★ 不登记时 CDN 一律 403 —— 这就是普通 HTTP 请求（含 php/curl）打不开的原因
 *   4. GET https://news.hbtv.com.cn/ajax/get_cdn_leech?url=<m3u8>&client-id=<cid>
 *        → 追加 extrakey / aalook 后的最终地址
 *   5. 播放必须带 Referer: https://news.hbtv.com.cn/（m3u8 与每个 .ts 都要）
 *
 * 兼容 mytv（返回 JSON 字符串 + headers 多行）与酷9（返回对象）两种宿主。
 */

var DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
               + '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
var REFERER = 'https://news.hbtv.com.cn/';
var SITE_ID = '10008';
var WS_URL  = 'wss://remote-wa.cjyun.org.cn/liveweb';
var WS_NAME = 'cjyun_hb';

// 别名 → { 频道名, 长江云 stream_id }
var HB_CH = {
  hbws: { n: '湖北卫视', id: 431 },
  hbjs: { n: '湖北经视', id: 432 },
  hbzh: { n: '湖北综合', id: 433 },
  hbgg: { n: '湖北公共', id: 434 },
  hbys: { n: '湖北影视', id: 435 },
  hbsh: { n: '湖北生活', id: 436 },
  hbjy: { n: '湖北教育', id: 437 },
  hbls: { n: '湖北垄上', id: 438 },
  mjgw: { n: '美嘉购物', id: 439 }
};

// 数字 id 也认（431 → hbws）
var HB_BY_ID = {};
for (var hbk in HB_CH) {
  if (HB_CH.hasOwnProperty(hbk)) { HB_BY_ID['' + HB_CH[hbk].id] = hbk; }
}

// ---------------- 宿主能力探测 ----------------

function hbHost() {
  var m = (typeof mytv !== 'undefined' && mytv) ? mytv : null;
  var k = (typeof ku9  !== 'undefined' && ku9)  ? ku9  : null;
  var h = { req: null, isKu9: false, ws: null };

  if (m && typeof m.request === 'function') {
    h.req = function (url, headers) {
      // mytv.request(url, method, headersArray, body, redirect)
      return m.request(url, 'GET', headers || [], '', true);
    };
    if (typeof m.websocket === 'function') { h.ws = function () { return m.websocket(); }; }
    return h;
  }
  if (k && typeof k.request === 'function') {
    h.isKu9 = true;
    h.req = function (url, headers) {
      var obj = {};
      var list = headers || [];
      for (var i = 0; i < list.length; i++) {
        var line = list[i], p = line.indexOf(':');
        if (p > 0) { obj[line.slice(0, p).trim()] = line.slice(p + 1).trim(); }
      }
      // ku9.request(url, method, headersObject, body)
      return k.request(url, 'GET', obj, '');
    };
    if (typeof k.websocket === 'function') { h.ws = function () { return k.websocket(); }; }
    return h;
  }
  return h;
}

// 把宿主各式返回体统一成 { code, body, raw }（raw = 原始响应头文本）
function hbPick(res) {
  var out = { code: 0, body: '', raw: '' };
  if (res === null || res === undefined) { return out; }
  if (typeof res === 'string') {
    out.body = res; out.raw = res; out.code = res ? 200 : 0;
    return out;
  }
  try {
    if (typeof res.headersText === 'string' && res.headersText) { out.raw = res.headersText; }
  } catch (e) {}
  if (!out.raw) { try { if (typeof res.headers === 'string') { out.raw = res.headers; } } catch (e1) {} }
  if (!out.raw) {
    // headers 被包装成对象时拼回文本（多个 Set-Cookie 可能被合并，仍可正则捞）
    try {
      var hs = res.headers;
      if (hs && typeof hs === 'object') {
        var buf = '';
        for (var kk in hs) { if (hs.hasOwnProperty(kk)) { buf += kk + ': ' + hs[kk] + '\n'; } }
        out.raw = buf;
      }
    } catch (e2) {}
  }
  try {
    if (typeof res.body === 'string') { out.body = res.body; }
    else if (res.body !== null && res.body !== undefined) { out.body = String(res.body); }
  } catch (e3) {}
  try {
    if (typeof res.code === 'number') { out.code = res.code; }
    else if (res.code !== null && res.code !== undefined) { out.code = parseInt(res.code, 10) || 0; }
  } catch (e4) {}
  return out;
}

function hbGet(host, url) {
  try { return hbPick(host.req(url, ['User-Agent: ' + DESKTOP_UA])); }
  catch (e) { return { code: -1, body: '', raw: '' }; }
}

// ---------------- 取 client-id / aa-look / client-token ----------------

function hbCookie(raw, name) {
  if (!raw) { return ''; }
  var m = new RegExp(name + '=([^;,\\s]+)').exec(raw);
  return m ? m[1] : '';
}

function hbFetchClient(host, sid) {
  var r = hbGet(host, 'https://news.hbtv.com.cn/app/tv/' + sid);
  var cid  = hbCookie(r.raw, 'client-id');
  var look = hbCookie(r.raw, 'aa-look');
  var tok  = hbCookie(r.raw, 'client-token');
  if (!cid && r.body) {
    cid = hbCookie(r.body, 'client-id');
    if (!look) { look = hbCookie(r.body, 'aa-look'); }
    if (!tok)  { tok  = hbCookie(r.body, 'client-token'); }
  }
  return { cid: cid, look: look, tok: tok };
}

// ---------------- 拿带 auth_key 的 m3u8 ----------------

function hbStreamUrl(host, sid) {
  var r = hbGet(host, 'https://app.cjyun.org.cn/video/player/stream?stream_id=' + sid
                      + '&site_id=' + SITE_ID);
  if (!r.body) { return ''; }
  try {
    var d = JSON.parse(r.body);
    if (d && typeof d.stream === 'string' && d.stream) { return d.stream; }
    if (d && typeof d.play_url === 'string' && d.play_url) { return d.play_url; }
  } catch (e) {}
  var m = /"stream"\s*:\s*"([^"]+)"/.exec(r.body);
  if (m && m[1]) { return m[1].replace(/\\\//g, '/'); }
  return '';
}

// ---------------- WebSocket 在线登记 ----------------

function hbWait(ms) {
  var t = Date.now();
  while (Date.now() - t < ms) { /* 分片阻塞等待，单片 <=40ms 较安全 */ }
}

function hbWsRegister(host, ck) {
  if (!host.ws || !ck.cid || !ck.look || !ck.tok) { return false; }
  try {
    var api = host.ws();
    if (!api || typeof api.connect !== 'function') { return false; }

    // 必须带 Origin，否则握手被拒（实测：不带 Origin 即使连上也拿不到放行）
    api.connect(WS_URL, ['Origin: https://news.hbtv.com.cn', 'User-Agent: ' + DESKTOP_UA], WS_NAME);

    // 等握手完成：status() === 1 表示已 open(-1 失败 / 0 连接中 / 2 关闭中 / 3 已关)
    var sock = null, st = 0;
    for (var i = 0; i < 60; i++) {
      hbWait(40);
      try {
        sock = api.get(WS_NAME);
        if (sock && typeof sock.status === 'function') {
          st = sock.status();
          if (st === 1) { break; }
          if (st === -1) { sock = null; break; }
        } else if (sock) {
          break; // 拿不到 status 就按已连处理，send 会自行判断
        }
      } catch (e) { sock = null; }
    }
    if (!sock) { return false; }

    var payload = '{"client_id":"' + ck.cid + '","aa_look":"' + ck.look
                + '","client_token":"' + ck.tok + '"}';
    try { sock.send(payload); } catch (e2) { return false; }

    hbWait(300); // 给服务端一点落库时间
    return true;
  } catch (e3) {
    return false;
  }
}

// ---------------- 换 extrakey ----------------

function hbLeech(host, streamUrl, cid) {
  var r = hbGet(host, 'https://news.hbtv.com.cn/ajax/get_cdn_leech?url='
                      + streamUrl + '&client-id=' + cid);
  if (!r.body) { return ''; }
  try {
    var d = JSON.parse(r.body);
    if (d && d.state && typeof d.data === 'string' && d.data) { return d.data; }
  } catch (e) {}
  var m = /"data"\s*:\s*"([^"]+)"/.exec(r.body);
  if (m && m[1]) { return m[1].replace(/\\\//g, '/'); }
  return '';
}

// 真拉一次 m3u8，避免“地址拿到了但 403”的假成功
var HB_LAST_CODE = 0;
function hbPlayable(host, url) {
  HB_LAST_CODE = 0;
  try {
    var r = hbPick(host.req(url, ['Referer: ' + REFERER, 'User-Agent: okhttp/5.4.0']));
    HB_LAST_CODE = r.code || 0;
    if (r.code && r.code !== 200) { return false; }
    var b = r.body || '';
    return b.indexOf('#EXTM3U') >= 0 || b.indexOf('#EXTINF') >= 0;
  } catch (e) {
    return false;
  }
}

// ---------------- 返回封装 ----------------

function hbOk(host, url) {
  if (host.isKu9) { return { url: url, referer: REFERER }; }
  return JSON.stringify({ url: url, headers: 'Referer: ' + REFERER });
}

function hbErr(host, msg) {
  if (host.isKu9) { return { url: '', referer: REFERER, error: msg }; }
  return JSON.stringify({ error: msg });
}

// ---------------- 入口 ----------------

function hbParseId(item) {
  var raw = '';
  try {
    if (item === null || item === undefined) { raw = ''; }
    else if (typeof item === 'string') { raw = item; }
    else if (typeof item === 'object') {
      if (item.id) { raw = String(item.id); }
      else if (item.params && item.params.id) { raw = String(item.params.id); }
      else if (item.url) { raw = String(item.url); }
      else { raw = String(item); }
    } else { raw = String(item); }
  } catch (e) { raw = ''; }

  var m = /(?:^|[?&])id=([^&#]+)/.exec(raw);
  var id = m ? m[1] : raw;
  try { id = decodeURIComponent(id); } catch (e2) {}
  id = (id || '').trim().toLowerCase();
  if (HB_BY_ID[id]) { id = HB_BY_ID[id]; }
  return id;
}

function main(item) {
  var host = hbHost();
  if (!host.req) { return hbErr(host, '宿主不支持网络请求'); }

  var id = hbParseId(item);
  var ch = HB_CH[id];
  if (!ch) { return hbErr(host, '未知频道: ' + id); }
  var sid = ch.id;

  // 1) 取流地址（不依赖 cookie）
  var streamUrl = hbStreamUrl(host, sid);
  if (!streamUrl) { return hbErr(host, ch.n + ' 取流地址失败'); }

  // 2) 该频道页面 → 拿三个 cookie
  var ck = hbFetchClient(host, sid);

  // 3) WS 在线登记（不登记后面一定 403）
  var wsOk = hbWsRegister(host, ck);

  // 4) 换 extrakey，最多 4 次（首发可能抢在登记落库之前）
  var finalUrl = '', lastUrl = '';
  for (var i = 0; i < 4; i++) {
    lastUrl = hbLeech(host, streamUrl, ck.cid);
    if (lastUrl && hbPlayable(host, lastUrl)) { finalUrl = lastUrl; break; }
    hbWait(250);
  }

  if (finalUrl) { return hbOk(host, finalUrl); }

  if (HB_LAST_CODE === 404) {
    return hbErr(host, ch.n + '：官方流已下线（HTTP 404）');
  }
  if (!wsOk) {
    return hbErr(host, ch.n + '：本机播放器不支持 WebSocket，该源必需 ws');
  }
  return hbErr(host, ch.n + '：CDN 鉴权未通过（extrakey 校验失败）');
}
