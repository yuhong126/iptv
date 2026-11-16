/* ============================================================
 * 北京台(BRTV)直播 · mytv / 酷9 原生 JS 源  (v8 —— 游客 usid 方案)
 *
 * 【原理】别人 PHP 源(作者 Doubebly)的移植改良版：
 *   1) 接口 https://pc.api.btime.com/video/play 用签名鉴权：
 *        sign = md5(pid + "151" + 秒级时间戳 + "TtJSg@2g*$K4PjUH") 取前 8 位
 *   2) 关键：请求必须带【完整浏览器 UA】+【游客 usid Cookie】。
 *      - 短 UA(Mozilla/5.0) 虽也返回 errno=0，但给的是 hsplay-360 线路(CDN 403 不可播)；
 *      - 完整 Chrome UA + 真实游客 usid 才会给 brtv-play 线路(可播)。
 *   3) stream_url = base64(base64(真实m3u8反转))，需 reverse→b64decode→b64decode。
 *   4) 返回的 m3u8 请求时必须带 UA + Referer，否则腾讯云 CDN 403。
 *
 * 【usid 说明】不是登录态，是 btime 官网首次访问时种的游客标识，约 2 个月有效，
 *   不绑 IP、不绑浏览器会话。本脚本内置一个新鲜 usid，并会尝试自动刷新：
 *   每次执行先 GET 官网首页，若响应头 Set-Cookie 带 usid 就用新的(并缓存)。
 *   即使自动刷新失败，内置 usid 也能撑约 2 个月。
 *
 * 【用法】一行一个台，id 用下方频道表的英文码或官网 pid：
 *   北京卫视,javascript://<本文件在线地址>?id=bjws
 *   北京卫视4K,javascript://<本文件在线地址>?id=bjws4k
 *   北京文艺,javascript://<本文件在线地址>?id=bjwy
 *   北京纪实科教,javascript://<本文件在线地址>?id=bjjs
 *   北京影视,javascript://<本文件在线地址>?id=bjys
 *   北京财经,javascript://<本文件在线地址>?id=bjcj
 *   北京体育休闲,javascript://<本文件在线地址>?id=bjty
 *   北京生活,javascript://<本文件在线地址>?id=bjsh
 *   北京新闻,javascript://<本文件在线地址>?id=bjxw
 *   北京卡酷少儿,javascript://<本文件在线地址>?id=bjkk
 *
 *   也可直接 ?id=<32位官网pid>，或用 ?usid=xxx 临时覆盖游客标识。
 * ============================================================ */

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
var SECRET = 'TtJSg@2g*$K4PjUH';
var HOME = 'https://www.btime.com/';
var API = 'https://pc.api.btime.com/video/play';
// 默认游客 usid（2026-11-16 采集，约 2 个月有效；失效时用 ?usid= 覆盖或等自动刷新）
var DEFAULT_USID = 'a38f8f4bf91f57ce52175657ca4aeac0';

var CHANNELS = {
  bjws:   '573ib1kp5nk92irinpumbo9krlb', // 北京卫视
  bjws4k: '5755n511tbk8flo40l4c71l0sdf', // 北京卫视4K超高清
  bjwy:   '54db6gi5vfj8r8q1e6r89imd64s', // 北京文艺
  bjjs:   '53bn9rlalq08lmb8nf8iadoph0b', // 北京纪实科教
  bjys:   '50mqo8t4n4e8gtarqr3orj9l93v', // 北京影视
  bjcj:   '50e335k9dq488lb7jo44olp71f5', // 北京财经
  bjty:   '54hv0f3pq079d4oiil2k12dkvsc', // 北京体育休闲
  bjsh:   '50j015rjrei9vmp3h8upblr41jf', // 北京生活
  bjxw:   '53gpt1ephlp86eor6ahtkg5b2hf', // 北京新闻
  bjkk:   '55skfjq618b9kcq9tfjr5qllb7r'  // 北京卡酷少儿
};

/* ---- 从 btime 官网响应头里尝试提取并刷新 usid（有则用，无则用缓存/默认）---- */
function getUsid(override) {
  if (override && /^[0-9a-f]{32}$/.test(override)) return override;
  // ku9 缓存里若有之前刷新的 usid，直接用
  var cached = '';
  try { cached = ku9.getCache('btime_usid_v8') || ''; } catch (e) {}
  if (cached) return cached;

  // 尝试从首页响应头自动抓取 usid
  try {
    var r = ku9.request(HOME, 'GET', { 'User-Agent': UA }, null);
    if (r && r.headers) {
      var sc = '';
      for (var k in r.headers) {
        if (k.toLowerCase() === 'set-cookie') sc += (r.headers[k] || '') + ';';
      }
      var m = sc.match(/usid=([0-9a-f]{32})/i);
      if (m) {
        try { ku9.setCache('btime_usid_v8', m[1], 45 * 24 * 3600 * 1000); } catch (e2) {}
        return m[1];
      }
    }
  } catch (e3) { /* 抓不到就用默认 */ }
  return DEFAULT_USID;
}

/* ---- 纯 JS 双层 base64 解码（ASCII 二进制串语义）---- */
function b64decode(s) {
  var ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var out = '', buf = 0, bits = 0, i, c;
  s = String(s).replace(/[^A-Za-z0-9+/=]/g, '');
  for (i = 0; i < s.length; i++) {
    if (s.charAt(i) === '=') break;
    c = ABC.indexOf(s.charAt(i));
    if (c < 0) break;
    buf = (buf << 6) | c;
    bits += 6;
    if (bits >= 8) { bits -= 8; out += String.fromCharCode((buf >> bits) & 0xFF); }
  }
  return out;
}

function main(item) {
  if (typeof ku9 === 'undefined' || !ku9 || typeof ku9.request !== 'function') {
    return { url: '当前播放器不支持 JS 源（缺少 ku9.request），请升级到新版 mytv' };
  }
  var uri = (item && item.url) ? item.url : '';
  function q(n) {
    try { return (typeof ku9.getQuery === 'function') ? ku9.getQuery(uri, n) : ''; }
    catch (e) { return ''; }
  }
  var key = q('id') || ((item && item.id !== undefined && item.id !== null) ? String(item.id) : '');
  var overrideUsid = q('usid');

  var pid = CHANNELS[key] || (/^[0-9a-z]{20,40}$/.test(key) ? key : CHANNELS.bjws);
  var usid = getUsid(overrideUsid);

  // 签名：md5(pid + "151" + ts + SECRET) 前 8 位
  var ts = Math.floor((new Date()).getTime() / 1000);
  var sign = ku9.md5(pid + '151' + ts + SECRET).slice(0, 8);
  var t2 = (new Date()).getTime();
  var url = API + '?from=pc&id=' + pid + '&type_id=151&timestamp=' + ts + '&sign=' + sign + '&_=' + t2;

  var body = '', last = '';
  // 同一秒签名可能被判重，向后错开时间戳重试
  for (var attempt = 0; attempt < 3 && !body; attempt++) {
    var useTs = ts - attempt;
    var useSign = ku9.md5(pid + '151' + useTs + SECRET).slice(0, 8);
    var useUrl = API + '?from=pc&id=' + pid + '&type_id=151&timestamp=' + useTs + '&sign=' + useSign + '&_=' + t2;
    var resp = null;
    try {
      resp = ku9.request(useUrl, 'GET', {
        'User-Agent': UA,
        'Referer': HOME,
        'Cookie': 'usid=' + usid + '; lf=1;',
        'Accept': '*/*'
      }, null);
    } catch (e) { last = String(e); continue; }
    if (!resp || !resp.body) continue;
    last = String(resp.body);
    if (last.indexOf('"errno"') < 0) continue;
    var j = null;
    try { j = JSON.parse(last.replace(/^jQuery[^(]*\(/, '').replace(/\)\s*;?\s*$/, '')); } catch (e2) { continue; }
    if (j && j.errno === 0 && j.data && j.data.video_stream && j.data.video_stream[0] && j.data.video_stream[0].stream_url) {
      body = j.data.video_stream[0].stream_url;
    }
  }

  if (!body) return { url: '北京台取流失败: ' + last.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').substring(0, 60) };

  var stream = String(body);
  if (stream.indexOf('http') !== 0) {
    try {
      stream = stream.split('').reverse().join('');
      stream = b64decode(b64decode(stream));
    } catch (e3) { return { url: '流地址解码失败' }; }
  }
  if (stream.indexOf('http') !== 0) return { url: '解码结果异常' };

  // 关键：返回时带完整 UA + 来源页 Referer，否则腾讯云 CDN 403
  return {
    url: stream,
    referer: HOME,
    userAgent: UA,
    headers: { 'Referer': HOME, 'User-Agent': UA, 'Origin': 'https://www.btime.com' }
  };
}
