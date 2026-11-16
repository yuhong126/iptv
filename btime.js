/* ============================================================
 * 北京台(BRTV)直播 · mytv / 酷9 JS 源  (v7)
 *
 * 用法（一行一个台），id 就是官网的频道 gid：
 *   北京卫视,javascript://<本文件在线地址>?id=573ib1kp5nk92irinpumbo9krlb
 *
 * ===== v7 关键修复：返回时带正确的来源页 Referer + User-Agent =====
 * v6 卡点已解决(IPv4直连绕开电信IPv6)，错误从 line:null 变成
 * UK_ERROR_WHAT_-10000 —— 脚本跑通了、返回了地址，但播放器取 m3u8/分片被拒。
 * 根因：v5/v6 返回 headers:{'Access-Control-Allow-Origin':'*'}，这是响应头，
 * 点击流请求没有带来源页。酷9文档明确：要用 referer/userAgent 字段(或 headers)
 * 把来源页带给播放列表及分片请求。江西能播就是因为返回带了 Referer+User-Agent。
 *
 * v7 修复：
 *   1) API 直连移动 IPv4 绕开 IPv6（沿用 v6）
 *   2) 返回同时带 referer / userAgent(新客户端) 和 headers(旧客户端) 两套
 *   3) 埋点回传：把脚本内部取 m3u8 的结果发到收集端，一次定位取流层
 *
 * API 准入：UA 必须短串(Mozilla/5.0)；sign/guid/timestamp 都不校验。
 * stream_url = base64(base64(真实m3u8反转))。
 * ============================================================ */

var BT_HOOK = 'https://webhook.site/b4f1af79-8e4b-4ec1-8e26-374c46e68f99';
function btRep(tag, val) {
  try {
    var s = 'BT7|' + tag + '|' + String(val === null || val === undefined ? '' : val)
      .replace(/[^A-Za-z0-9_.:=\/\-?&]/g, '_').substring(0, 200);
    ku9.request(BT_HOOK, 'POST', { 'Content-Type': 'text/plain' }, s);
  } catch (e) { /* ignore */ }
}

function main(item) {
  btRep('01', 'call');
  var uri = (item && item.url) ? item.url : '';
  var pid = (item && item.id !== undefined && item.id !== null && String(item.id) !== '')
    ? String(item.id)
    : ((typeof ku9 !== 'undefined' && ku9 && typeof ku9.getQuery === 'function')
        ? String(ku9.getQuery(uri, 'id') || '') : '');
  if (!pid) return { url: '缺少频道 id' };
  btRep('02', pid);

  var ts = Math.floor((new Date()).getTime() / 1000);
  var q = 'from=pc&id=' + pid + '&type_id=151&timestamp=' + ts + '&sign=x&guid=x';
  var endpoints = [
    { u: 'https://111.32.153.124/video/play?' + q, h: { 'Host': 'pc.api.btime.com', 'User-Agent': 'Mozilla/5.0' } },
    { u: 'https://111.32.153.126/video/play?' + q, h: { 'Host': 'pc.api.btime.com', 'User-Agent': 'Mozilla/5.0' } },
    { u: 'https://pc.api.btime.com./video/play?' + q, h: { 'User-Agent': 'Mozilla/5.0' } },
    { u: 'https://pc.api.btime.com/video/play?' + q, h: { 'User-Agent': 'Mozilla/5.0' } }
  ];

  var body = '', used = 'none';
  for (var i = 0; i < endpoints.length && !body; i++) {
    try {
      var resp = ku9.request(endpoints[i].u, 'GET', endpoints[i].h, null);
      var b = resp && resp.body ? String(resp.body) : '';
      if (b.indexOf('"errno"') >= 0 && b.indexOf('"video_stream"') >= 0) {
        body = b; used = endpoints[i].u.split('/')[2];
      }
    } catch (e) { /* 换下一个 */ }
  }
  btRep('03_api', 'used=' + used + ' bodylen=' + body.length);
  if (!body) return { url: '接口无响应' };

  var j = null;
  try { j = JSON.parse(body); } catch (e3) { return { url: '接口返回异常' }; }
  if (!j || j.errno !== 0) return { url: '接口拒绝(errno=' + (j ? j.errno : '?') + ')' };

  var su = j.data && j.data.video_stream && j.data.video_stream[0] && j.data.video_stream[0].stream_url;
  if (!su) return { url: '未返回 stream_url' };

  var stream = String(su);
  if (stream.indexOf('http') !== 0) {
    try {
      stream = stream.split('').reverse().join('');
      stream = b64decode(b64decode(stream));
    } catch (e4) { return { url: '流地址解码失败' }; }
  }
  if (stream.indexOf('http') !== 0) return { url: '解码结果异常' };
  btRep('04_url', stream);

  // 埋点：脚本内部按真实播放头取一次 m3u8，验证取流层（不影响主流程）
  try {
    var mr = ku9.request(stream, 'GET', {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://www.btime.com/'
    });
    btRep('05_m3u8', 'code=' + (mr ? mr.code : 'NULL') +
      ' len=' + (mr && mr.body ? String(mr.body).length : 0) +
      ' head=' + (mr && mr.body ? String(mr.body).substring(0, 40) : ''));
  } catch (e5) { btRep('05_m3u8err', String(e5)); }

  // 返回：新旧两套来源页字段都带上，确保点击流请求带正确 Referer/UA
  return {
    url: stream,
    referer: 'https://www.btime.com/',
    userAgent: 'Mozilla/5.0',
    headers: {
      'Referer': 'https://www.btime.com/',
      'User-Agent': 'Mozilla/5.0'
    }
  };
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
