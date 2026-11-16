/* ============================================================
 * 北京台(BRTV)直播 · mytv / 酷9 JS 源  (v5)
 *
 * 用法（一行一个台），id 就是官网的频道 gid：
 *   北京卫视,javascript://<本文件在线地址>?id=573ib1kp5nk92irinpumbo9krlb
 *
 * ===== v5 相对 v3/v4 的两处关键修正 =====
 * 1) API 调用改用 ku9.request —— 西藏/江西/山西三个确认能播的脚本都用它，
 *    v3 用的 ku9.get 在真机上自定义 UA 不生效 → 接口判「用户未登录」→ 返回
 *    的是错误文字而不是 m3u8 地址 → 播放器报 line:null。
 * 2) 返回结构改成和能播的 xztv.js 完全一致的最简形式 {url, headers}，
 *    去掉 v3 多加的 player:3 / Origin / 完整 UA —— 这些是我猜的字段，
 *    真机可能因此认不出线路。
 *
 * 接口准入（实测矩阵）：UA 必须短串(Mozilla/5.0 或 okhttp 任意版)；
 * 任何带括号的完整浏览器 UA 一律 errno:401。Referer/Origin/sign/guid/
 * timestamp 都不校验。
 *
 * stream_url = base64(base64(真实m3u8反转))，反转 + 解两次 base64 = 真地址。
 * ============================================================ */

function main(item) {
  var uri = (item && item.url) ? item.url : '';
  var pid = (item && item.id !== undefined && item.id !== null && String(item.id) !== '')
    ? String(item.id)
    : ((typeof ku9 !== 'undefined' && ku9 && typeof ku9.getQuery === 'function')
        ? String(ku9.getQuery(uri, 'id') || '') : '');

  if (!pid) return { url: '缺少频道 id' };

  var cacheKey = 'btime_v5_' + pid;
  if (typeof ku9 !== 'undefined' && ku9 && typeof ku9.getCache === 'function') {
    try {
      var cached = ku9.getCache(cacheKey);
      if (cached && String(cached).indexOf('http') === 0) return wrap(cached);
    } catch (e0) { /* 忽略 */ }
  }

  var ts = Math.floor((new Date()).getTime() / 1000);
  var api = 'https://pc.api.btime.com/video/play?from=pc&id=' + pid +
            '&type_id=151&timestamp=' + ts + '&sign=x&guid=x&_=' + ts;

  var body = '';
  // 主路径：ku9.request + 短 UA（与能播的脚本一致）
  if (typeof ku9 !== 'undefined' && ku9 && typeof ku9.request === 'function') {
    try {
      var resp = ku9.request(api, 'GET', { 'User-Agent': 'Mozilla/5.0' });
      if (resp && resp.body) body = String(resp.body);
    } catch (e1) { /* 继续兜底 */ }
  }
  // 兜底：ku9.get + 短 UA
  if (body.indexOf('"errno"') < 0 && typeof ku9 !== 'undefined' && ku9 && typeof ku9.get === 'function') {
    try {
      var g = String(ku9.get(api, { 'User-Agent': 'Mozilla/5.0' }) || '');
      if (g.indexOf('"errno"') >= 0) body = g;
    } catch (e2) { /* 忽略 */ }
  }
  if (!body) return { url: '接口无响应' };

  var j = null;
  try { j = JSON.parse(body); } catch (e3) {
    return { url: '接口返回异常：' + body.substring(0, 60) };
  }
  if (!j || j.errno !== 0) {
    return { url: '接口拒绝(errno=' + (j ? j.errno : '?') + ' ' + (j ? (j.errmsg || '') : '') + ')' };
  }

  var su = j.data && j.data.video_stream && j.data.video_stream[0] && j.data.video_stream[0].stream_url;
  if (!su) return { url: '未返回 stream_url' };

  var stream = String(su);
  if (stream.indexOf('http') === 0) { return wrap(stream); }

  try {
    stream = stream.split('').reverse().join('');
    stream = b64decode(b64decode(stream));
  } catch (e4) {
    return { url: '流地址解码失败：' + e4 };
  }
  if (stream.indexOf('http') !== 0) return { url: '解码结果异常：' + stream.substring(0, 60) };

  if (typeof ku9 !== 'undefined' && ku9 && typeof ku9.setCache === 'function') {
    try { ku9.setCache(cacheKey, stream, 60000 * 30); } catch (e5) { /* 忽略 */ }
  }
  return wrap(stream);
}

// 与能播的 xztv.js 完全一致的返回格式
function wrap(u) {
  return { url: u, headers: { 'Access-Control-Allow-Origin': '*' } };
}

/* ---- 纯 JS base64 解码 ---- */
function b64decode(s) {
  var ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var out = '', i = 0, buf = 0, bits = 0;
  s = String(s).replace(/[^A-Za-z0-9+/=]/g, '');
  for (i = 0; i < s.length; i++) {
    if (s.charAt(i) === '=') break;
    buf = (buf << 6) | ABC.indexOf(s.charAt(i));
    bits += 6;
    if (bits >= 8) { bits -= 8; out += String.fromCharCode((buf >> bits) & 0xFF); }
  }
  return out;
}
