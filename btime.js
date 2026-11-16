/* ============================================================
 * 北京台(BRTV)直播 · mytv / 酷9 JS 源  (v6)
 *
 * 用法（一行一个台），id 就是官网的频道 gid：
 *   北京卫视,javascript://<本文件在线地址>?id=573ib1kp5nk92irinpumbo9krlb
 *
 * ===== v6 关键修复：绕开卡死的 IPv6 =====
 * 根因：pc.api.btime.com 的 DNS 同时返回
 *   A    111.32.153.124 / 111.32.153.126  (中国移动 北京, 同网, 正常)
 *   AAAA 240e:95e:4003:f::16              (中国电信 IPv6, 移动网访问卡死)
 * 真机(移动 IPv6 2409:...)优先走电信 AAAA → 请求挂起 → 脚本停在这里 → line:null
 * （诊断证实：脚本执行了、id 对了，卡在 ku9.request 请求这个域名这一步。）
 *
 * v6 主路径改成直连中国移动 IPv4 + Host 头，完全绕开 IPv6；
 * 若个别引擎不支持自定义 Host 头，再退回原域名。
 *
 * 接口准入：UA 必须短串(Mozilla/5.0)；完整浏览器 UA → errno:401。
 * sign/guid/timestamp 都不校验。
 * stream_url = base64(base64(真实m3u8反转))。
 * ============================================================ */

function main(item) {
  var uri = (item && item.url) ? item.url : '';
  var pid = (item && item.id !== undefined && item.id !== null && String(item.id) !== '')
    ? String(item.id)
    : ((typeof ku9 !== 'undefined' && ku9 && typeof ku9.getQuery === 'function')
        ? String(ku9.getQuery(uri, 'id') || '') : '');

  if (!pid) return { url: '缺少频道 id' };

  var ts = Math.floor((new Date()).getTime() / 1000);
  var q = 'from=pc&id=' + pid + '&type_id=151&timestamp=' + ts + '&sign=x&guid=x';

  // 两种取接口的方式：①移动IPv4直连(绕开IPv6) ②原域名兜底
  var endpoints = [
    { u: 'https://111.32.153.124/video/play?' + q,
      h: { 'Host': 'pc.api.btime.com', 'User-Agent': 'Mozilla/5.0' } },
    { u: 'https://111.32.153.126/video/play?' + q,
      h: { 'Host': 'pc.api.btime.com', 'User-Agent': 'Mozilla/5.0' } },
    { u: 'https://pc.api.btime.com./video/play?' + q,      // 域名尾部加点
      h: { 'User-Agent': 'Mozilla/5.0' } },
    { u: 'https://pc.api.btime.com/video/play?' + q,
      h: { 'User-Agent': 'Mozilla/5.0' } }
  ];

  var body = '';
  for (var i = 0; i < endpoints.length && !body; i++) {
    try {
      var resp = ku9.request(endpoints[i].u, 'GET', endpoints[i].h, null);
      var b = resp && resp.body ? String(resp.body) : '';
      if (b.indexOf('"errno"') >= 0 && b.indexOf('"video_stream"') >= 0) {
        body = b;
      }
    } catch (e) { /* 换下一个 */ }
  }
  if (!body) return { url: '接口无响应' };

  var j = null;
  try { j = JSON.parse(body); } catch (e3) {
    return { url: '接口返回异常' };
  }
  if (!j || j.errno !== 0) {
    return { url: '接口拒绝(errno=' + (j ? j.errno : '?') + ')' };
  }

  var su = j.data && j.data.video_stream && j.data.video_stream[0] && j.data.video_stream[0].stream_url;
  if (!su) return { url: '未返回 stream_url' };

  var stream = String(su);
  if (stream.indexOf('http') !== 0) {
    try {
      stream = stream.split('').reverse().join('');
      stream = b64decode(b64decode(stream));
    } catch (e4) {
      return { url: '流地址解码失败' };
    }
  }
  if (stream.indexOf('http') !== 0) return { url: '解码结果异常' };

  return { url: stream, headers: { 'Access-Control-Allow-Origin': '*' } };
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
