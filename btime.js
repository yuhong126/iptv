/* ============================================================
 * 北京台(BRTV)直播 · mytv / 酷9 通用 JS 源  (v3)
 *
 * 用法（一行一个台），id 就是官网的频道 gid：
 *   北京卫视,javascript://<本文件在线地址>?id=573ib1kp5nk92irinpumbo9krlb
 *
 * 基于曾能用的旧脚本结构，只修掉两个失效点：
 *   1) 旧脚本写死的 usid 会话已过期 → 去掉，改为免登录
 *   2) 关键发现：调 video/play 接口必须用「简短 UA = Mozilla/5.0」，
 *      用完整 Chrome UA 会被判 errno:401 用户未登录；短 UA 直接放行，
 *      不需要 usid / 登录，sign 也不校验。
 *
 * 返回给播放器的部分保持旧脚本原样（完整 UA + Referer + Origin + player:3），
 * 因为 m3u8 取流需要正常 UA —— 短 UA 只用来骗接口，不能给播放器。
 *
 * stream_url = base64(base64(真实m3u8地址反转))，反转 + 解两次 base64 得真地址。
 * ============================================================ */

var BT_UA_FULL = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

function main(item) {
  var uri = (item && item.url) ? item.url : '';
  var pid = (item && item.id !== undefined && item.id !== null && String(item.id) !== '')
    ? String(item.id)
    : ((typeof ku9 !== 'undefined' && ku9 && typeof ku9.getQuery === 'function')
        ? String(ku9.getQuery(uri, 'id') || '') : '');

  // 返回结构完全照搬旧脚本：完整 UA + Referer + Origin + player:3
  var r = {
    'url': '',
    'headers': {
      'User-Agent': BT_UA_FULL,
      'Referer': 'https://www.btime.com/',
      'Origin': 'https://www.btime.com'
    },
    'player': 3
  };
  if (!pid) { r.url = '缺少频道 id'; return r; }

  // 缓存（沿用旧脚本，30 分钟）
  var cacheKey = 'btime_v3_' + pid;
  if (typeof ku9 !== 'undefined' && ku9 && typeof ku9.getCache === 'function') {
    var cached = ku9.getCache(cacheKey);
    if (cached && String(cached).indexOf('http') === 0) {
      r.url = cached;
      return r;
    }
  }

  var ts = Math.floor((new Date()).getTime() / 1000);
  // 关键：接口用短 UA，且不带 Origin / 完整 UA
  var api = 'https://pc.api.btime.com/video/play?from=pc&id=' + pid +
            '&type_id=151&timestamp=' + ts + '&sign=x&guid=x&_=' + ts;

  var res;
  try {
    res = ku9.get(api, { 'User-Agent': 'Mozilla/5.0' });
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

  if (typeof ku9 !== 'undefined' && ku9 && typeof ku9.setCache === 'function') {
    try { ku9.setCache(cacheKey, stream, 60000 * 30); } catch (e4) { /* 缓存失败不影响播放 */ }
  }
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
