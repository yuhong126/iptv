/* ============================================================
 * 北京台诊断脚本 v3  ——  只用于定位，测完换回正式 btime.js
 *
 * 和 v1/v2 的区别：诊断信息不再靠报错框显示（mytv 根本不显示），
 * 而是每一步都用 ku9.request 主动 POST 回传到收集端，我这边直接读日志。
 *
 * 用法：
 *   1) 把本文件上传到 yuhong126/iptv 仓库根目录
 *   2) wltv.txt 北京影视那行改成：
 *      btime-diag3.js?id=50mqo8t4n4e8gtarqr3orj9l93v
 *   3) 点一次北京影视（哪怕报错），然后告诉我，我读日志即可定位
 * ============================================================ */

var BX_HOOK = 'https://webhook.site/b4f1af79-8e4b-4ec1-8e26-374c46e68f99';

// 回传一条诊断。任何异常都吞掉，绝不影响主流程。
function bxRep(tag, val) {
  try {
    var s = 'BT3|' + tag + '|' +
      String(val === null || val === undefined ? '' : val)
        .replace(/[^A-Za-z0-9_.:=\/\-?&]/g, '_')
        .substring(0, 220);
    ku9.request(BX_HOOK, 'POST', { 'Content-Type': 'text/plain' }, s);
  } catch (e) { /* ignore */ }
}

// 公开可播的测试流：用来证明"JS 执行 + 返回格式 + 播放器取流"整条链路是否通
function bxTest() {
  return {
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    headers: { 'Access-Control-Allow-Origin': '*' }
  };
}

function bxB64decode(s) {
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

function main(item) {
  bxRep('01_CALLED', 'yes');

  // ---------- 1. id 解析 ----------
  var uri = (item && item.url) ? String(item.url) : '';
  var pid = '';
  if (item && item.id !== undefined && item.id !== null) pid = String(item.id);
  if (!pid && typeof ku9 !== 'undefined' && ku9 && typeof ku9.getQuery === 'function') {
    try { pid = String(ku9.getQuery(uri, 'id') || ''); } catch (e0) { bxRep('01a_getQueryErr', String(e0)); }
  }
  bxRep('02_PID', pid || 'EMPTY');
  bxRep('03_URI', uri);
  bxRep('04_KU9API',
    'req=' + (typeof ku9 !== 'undefined' && ku9 && typeof ku9.request === 'function') +
    '/get=' + (typeof ku9 !== 'undefined' && ku9 && typeof ku9.get === 'function') +
    '/q=' + (typeof ku9 !== 'undefined' && ku9 && typeof ku9.getQuery === 'function'));

  if (!pid) { bxRep('90', 'NO_PID_RETURN_TEST'); return bxTest(); }

  // ---------- 2. 请求官网 API ----------
  var ts = Math.floor((new Date()).getTime() / 1000);
  var api = 'https://pc.api.btime.com/video/play?from=pc&id=' + pid +
            '&type_id=151&timestamp=' + ts + '&sign=x&guid=x';
  bxRep('05_API', api);

  var body = '', code = '?';
  try {
    var res = ku9.request(api, 'GET', { 'User-Agent': 'Mozilla/5.0' });
    code = res ? String(res.code) : 'NULLRES';
    body = (res && res.body) ? String(res.body) : '';
    bxRep('06_REQ', 'code=' + code + ' bodylen=' + body.length);
    bxRep('07_BODYHEAD', body.substring(0, 200));
  } catch (e1) {
    bxRep('06_REQERR', String(e1));
    return bxTest();
  }
  if (!body) { bxRep('91', 'EMPTY_BODY_RETURN_TEST'); return bxTest(); }

  // ---------- 3. 解析 + 解码 ----------
  var j = null;
  try { j = JSON.parse(body); } catch (e2) {
    bxRep('92_BADJSON', String(e2));
    return bxTest();
  }
  bxRep('08_ERRNO', 'errno=' + (j ? String(j.errno) : 'NULLJ') + ' errmsg=' + (j ? String(j.errmsg || '') : ''));
  var su = j && j.data && j.data.video_stream && j.data.video_stream[0] && j.data.video_stream[0].stream_url;
  if (!su) { bxRep('93_NOSTREAM', ''); return bxTest(); }
  bxRep('09_STREAMURL', String(su).substring(0, 120));

  var stream = '';
  try {
    stream = bxB64decode(bxB64decode(String(su).split('').reverse().join('')));
    bxRep('10_DECODED', stream);
  } catch (e3) {
    bxRep('94_DECERR', String(e3));
    return bxTest();
  }
  if (stream.indexOf('http') !== 0) { bxRep('95_BADURL', stream.substring(0, 80)); return bxTest(); }

  // ---------- 4. 关键：脚本内部直接请求解出的 m3u8，看 CDN 在真机返回什么 ----------
  try {
    var mr = ku9.request(stream, 'GET', { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.btime.com/' });
    bxRep('11_M3U8', 'code=' + (mr ? String(mr.code) : 'NULL') +
                     ' len=' + (mr && mr.body ? String(mr.body).length : '0') +
                     ' head=' + (mr && mr.body ? String(mr.body).substring(0, 60) : ''));
  } catch (e4) {
    bxRep('11_M3U8ERR', String(e4));
  }

  bxRep('99_DONE', 'RETURN_REAL');
  return { url: stream, headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.btime.com/' } };
}
