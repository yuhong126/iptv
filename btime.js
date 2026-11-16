/* ============================================================
 * 北京台(BRTV)直播 · mytv / 酷9 通用 JS 源  (v2 重写)
 *
 * 用法（一行一个台），id 就是官网的频道 gid：
 *   北京卫视,javascript://<本文件在线地址>?id=573ib1kp5nk92irinpumbo9krlb
 *
 * 原理：
 *   1) 用「简短 UA = Mozilla/5.0」调官方 video/play 接口拿 stream_url
 *      —— 关键！用完整的 Chrome UA 会被判「用户未登录」(errno:401)
 *      简短 UA 直接放行，不需要 usid、不需要登录、sign 也不校验
 *   2) stream_url = base64(base64( m3u8地址反转 ))，反转+解两次 base64 得真地址
 *   3) 真地址是带 time/sign 的临时 m3u8，所以每次都现取，不缓存
 *
 * 旧版失效原因：写死了会过期的 usid + 用完整 Chrome UA → 接口 401
 * ============================================================ */

function main(item) {
  var uri = (item && item.url) ? item.url : '';
  var pid = (item && item.id !== undefined && item.id !== null && String(item.id) !== '')
    ? String(item.id)
    : ((typeof ku9 !== 'undefined' && ku9 && typeof ku9.getQuery === 'function')
        ? String(ku9.getQuery(uri, 'id') || '') : '');

  var r = { url: '', headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.btime.com/' } };
  if (!pid) { r.url = '缺少频道 id'; return r; }

  // 关键：简短 UA。完整 Chrome UA 会被判未登录。
  var UA = 'Mozilla/5.0';
  var ts = Math.floor((new Date()).getTime() / 1000);
  var api = 'https://pc.api.btime.com/video/play?from=pc&id=' + pid +
            '&type_id=151&timestamp=' + ts + '&sign=x&guid=x&_=' + ts;

  var res;
  try {
    res = ku9.get(api, { 'User-Agent': UA, 'Referer': 'https://www.btime.com/' });
  } catch (e) {
    r.url = '接口请求异常：' + e;
    return r;
  }
  if (!res) { r.url = '接口无响应'; return r; }

  var j = null;
  try { j = JSON.parse(res); } catch (e2) {
    r.url = '接口返回异常：' + String(res).substring(0, 80);
    return r;
  }
  if (!j || j.errno !== 0) {
    r.url = '接口拒绝(errno=' + (j ? j.errno : '?') + ')：' + (j ? (j.errmsg || '') : '');
    return r;
  }

  var su = j.data && j.data.video_stream && j.data.video_stream[0] && j.data.video_stream[0].stream_url;
  if (!su) { r.url = '未返回 stream_url'; return r; }

  var stream = String(su);
  if (stream.indexOf('http') === 0) {
    r.url = stream;
    return r;
  }

  // 解码：先反转字符串，再连续 base64 解码两次
  try {
    stream = stream.split('').reverse().join('');
    stream = b64decode(b64decode(stream));
  } catch (e3) {
    r.url = '流地址解码失败：' + e3;
    return r;
  }
  if (stream.indexOf('http') !== 0) { r.url = '解码结果异常：' + stream.substring(0, 80); return r; }

  r.url = stream;
  return r;
}

/* ---- 纯 JS base64 解码（不依赖播放器内置实现）---- */
function b64decode(s) {
  var ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var out = '', i = 0, buf = 0, bits = 0;
  s = String(s).replace(/[^A-Za-z0-9+/=]/g, '');
  for (i = 0; i < s.length; i++) {
    if (s.charAt(i) === '=') break;
    buf = (buf << 6) | ABC.indexOf(s.charAt(i));
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buf >> bits) & 0xFF);
    }
  }
  return out;
}
