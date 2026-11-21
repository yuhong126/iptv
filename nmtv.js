/* ============================================================
 * 内蒙古网络广播电视台 (nmtv.cn) · mytv/酷9 原生 JS 直播源  v2
 *
 * 用法（一行一个台）：
 *   内蒙古卫视,javascript://<本文件在线地址>?id=nmgws
 *   内蒙古蒙语卫视,javascript://<本文件在线地址>?id=nmgmyws
 *   内蒙古新闻综合,javascript://<本文件在线地址>?id=nmgxwzh
 *   内蒙古经济生活,javascript://<本文件在线地址>?id=nmgjjsh
 *   内蒙古少儿,javascript://<本文件在线地址>?id=nmgse
 *   内蒙古文体娱乐,javascript://<本文件在线地址>?id=nmgwtyl
 *   内蒙古农牧,javascript://<本文件在线地址>?id=nmgnm
 *   内蒙古蒙古语文化,javascript://<本文件在线地址>?id=nmgmgwh
 *
 * ===== v2 修掉 v1 的 4 个致命错误（2026-11-21 官网实测）=====
 * 1) ku9.request 不是 mytv.request；返回必须是 {url,referer,headers} 对象，
 *    不是 JSON.stringify 字符串 —— v1 两条都写错，播放器必然 line:null。
 * 2) 官网 XXTEA 加密结果是【Base64】(btoa)，v1 直接把密文字节转字符串，
 *    服务端 Base64 解不开 → 请求参数无效。
 * 3) 官网魔改点：toBytes 要把明文长度塞进 uint32 末尾 slot；
 *    解密循环初值 F=v[0]。这两处漏了就解不出响应。
 * 4) 频道 ID：内蒙古卫视官网真实 id=265（v1 写 125，永远找不到流）。
 *    另外必须带 Client-Type: web 请求头；播放地址必须带 Referer，否则 403。
 *
 * 实测：接口 8/8 返回 m3u8；带 Referer 全部 200 且能出 TS 分片。
 * 签名 txTime 是 3～7 年后，但 token 每次请求会变，所以仍走实时 JS。
 * ============================================================ */

var NM_KEY = '5b28bae827e651b3';
var NM_API = 'https://api-bt.nmtv.cn/broadcast/list';
var NM_HOME = 'https://www.nmtv.cn/';
var NM_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

/* 频道表：id -> 官网 data.id（2026-11-21 核实） */
var NM_CH = {
  nmgws:    { id: 265, name: '内蒙古卫视' },
  nmgmyws:  { id: 126, name: '内蒙古蒙古语卫视' },
  nmgxwzh:  { id: 127, name: '新闻综合' },
  nmgjjsh:  { id: 128, name: '经济生活' },
  nmgse:    { id: 129, name: '少儿频道' },
  nmgwtyl:  { id: 130, name: '文体娱乐' },
  nmgnm:    { id: 131, name: '农牧频道' },
  nmgmgwh:  { id: 132, name: '内蒙古蒙古语文化频道' }
};
var NM_ALIAS = {
  '内蒙古卫视': 'nmgws', '内蒙古蒙语卫视': 'nmgmyws', '内蒙古新闻综合': 'nmgxwzh',
  '内蒙古经济生活': 'nmgjjsh', '内蒙古少儿': 'nmgse', '内蒙古文体娱乐': 'nmgwtyl',
  '内蒙古农牧': 'nmgnm', '内蒙古蒙古语文化': 'nmgmgwh'
};

/* ---------- XXTEA（与 nmtv.cn 官网逐字节一致，纯 ES5） ---------- */
var NM_D = 0x9E3779B9;
var NM_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function nmB64enc(bytes) {
  var out = [], i = 0, n = bytes.length;
  while (i < n) {
    var a = bytes[i++] & 255;
    var hb = i < n, b = hb ? bytes[i++] & 255 : 0;
    var hc = i < n, c = hc ? bytes[i++] & 255 : 0;
    var x = (a << 16) | (b << 8) | c;
    out.push(NM_B64.charAt((x >>> 18) & 63), NM_B64.charAt((x >>> 12) & 63));
    out.push(hb ? NM_B64.charAt((x >>> 6) & 63) : '=');
    out.push(hc ? NM_B64.charAt(x & 63) : '=');
  }
  return out.join('');
}
function nmB64dec(s) {
  var out = [], i = 0, n = s.length, acc = 0, bits = 0, v;
  for (i = 0; i < n; i++) {
    v = NM_B64.indexOf(s.charAt(i));
    if (v < 0) break;
    acc = (acc << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
  }
  return out;
}
function nmUtf8(s) {
  var out = [], i = 0, n = s.length;
  for (i = 0; i < n; i++) {
    var cc = s.charCodeAt(i);
    if (cc < 128) out.push(cc);
    else if (cc < 2048) out.push(192 | (cc >> 6), 128 | (cc & 63));
    else if (cc < 55296 || cc > 57343) out.push(224 | (cc >> 12), 128 | ((cc >> 6) & 63), 128 | (cc & 63));
    else {
      var n2 = i + 1 < n ? s.charCodeAt(i + 1) : 0;
      var e = (((cc & 1023) << 10) | (n2 & 1023)) + 65536;
      out.push(240 | (e >> 18), 128 | ((e >> 12) & 63), 128 | ((e >> 6) & 63), 128 | (e & 63));
      i++;
    }
  }
  return out;
}
function nmStr(bytes) {
  var out = '', i = 0, n = bytes.length;
  while (i < n) {
    var c = bytes[i++];
    if ((c >> 4) < 8) out += String.fromCharCode(c);
    else if ((c >> 4) === 12 || (c >> 4) === 13) out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
    else if ((c >> 4) === 14) out += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
    else if ((c >> 4) === 15) {
      var e = (((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63)) - 65536;
      out += String.fromCharCode(55296 + (e >> 10), 56320 + (e & 1023));
    }
  }
  return out;
}
function nmA32(bytes, withLen) {
  var R = bytes.length, H = R >> 2;
  if ((R & 3) !== 0) ++H;
  var F = [], k, total = H + (withLen ? 1 : 0);
  for (k = 0; k < total; k++) F[k] = 0;
  if (withLen) F[H] = R;
  for (k = 0; k < R; k++) F[k >> 2] |= bytes[k] << ((k & 3) << 3);
  return F;
}
function nmKey32(key) {
  var b = nmUtf8(key);
  while (b.length < 16) b.push(0);
  return nmA32(b, false);
}
function nmR32(v, includeLen) {
  var H = v.length << 2;
  if (includeLen) {
    var F = v[v.length - 1];
    H -= 4;
    if (F < H - 3 || F > H) return null;
    H = F;
  }
  var out = [], i;
  for (i = 0; i < H; i++) out.push((v[i >> 2] >>> ((i & 3) << 3)) & 255);
  return out;
}
function nmI32(t) { return t & 4294967295; }
function nmMx(sum, y, z, e, p, k) {
  return ((z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4)) ^ ((sum ^ y) + (k[(p & 3) ^ e] ^ z));
}
function nmEnc32(v, k) {
  var R = v.length, H = R - 1, F, M, N = 0, E, P, j = Math.floor(6 + 52 / R) | 0;
  M = v[H];
  for (; j > 0; --j) {
    N = nmI32(N + NM_D); E = N >>> 2 & 3;
    for (P = 0; P < H; ++P) { F = v[P + 1]; M = v[P] = nmI32(v[P] + nmMx(N, F, M, E, P, k)); }
    F = v[0]; M = v[H] = nmI32(v[H] + nmMx(N, F, M, E, H, k));
  }
  return v;
}
function nmDec32(v, k) {
  var R = v.length, H = R - 1, F, M, N, E, P, j = Math.floor(6 + 52 / R);
  F = v[0]; N = nmI32(j * NM_D);
  for (; N !== 0; N = nmI32(N - NM_D)) {
    E = N >>> 2 & 3;
    for (P = H; P > 0; --P) { M = v[P - 1]; F = v[P] = nmI32(v[P] - nmMx(N, F, M, E, P, k)); }
    M = v[H]; F = v[0] = nmI32(v[0] - nmMx(N, F, M, E, 0, k));
  }
  return v;
}
function nmEncrypt(str, key) {
  return nmB64enc(nmR32(nmEnc32(nmA32(nmUtf8(str), true), nmKey32(key)), false));
}
function nmDecrypt(b64, key) {
  var v = nmDec32(nmA32(nmB64dec(b64), false), nmKey32(key));
  var bytes = nmR32(v, true);
  return bytes ? nmStr(bytes) : '';
}

/* ---------- 入口 ---------- */
function main(item) {
  if (typeof ku9 === 'undefined' || !ku9 || typeof ku9.request !== 'function') {
    return { url: '当前播放器不支持 JS 源（缺少 ku9.request），请升级到新版 mytv' };
  }
  var uri = (item && item.url) ? item.url : '';
  function q(n) { try { return (typeof ku9.getQuery === 'function') ? ku9.getQuery(uri, n) : ''; } catch (e) { return ''; } }
  var key = q('id');
  if (!key && item && item.id !== undefined && item.id !== null) key = String(item.id);
  if (!key) key = 'nmgws';
  if (NM_ALIAS[key]) key = NM_ALIAS[key];

  // 支持直接写数字 id 或频道名，方便排查
  var ch = NM_CH[key];
  if (!ch) {
    for (var kk in NM_CH) {
      if (NM_CH[kk].id === parseInt(key, 10) || NM_CH[kk].name === key) { ch = NM_CH[kk]; break; }
    }
  }
  if (!ch) return { url: '未知的内蒙古频道: ' + key };

  var payload = nmEncrypt(JSON.stringify({ size: 100, type: 1 }), NM_KEY);
  var headers = {
    'Content-Type': 'application/json',
    'Client-Type': 'web',
    'Referer': NM_HOME,
    'Origin': 'https://www.nmtv.cn',
    'User-Agent': NM_UA,
    'Accept': '*/*'
  };

  var resp = null, body = '', last = '';
  try {
    resp = ku9.request(NM_API, 'POST', headers, payload);
    if (resp && resp.body) body = String(resp.body);
    else if (typeof resp === 'string') body = resp;
  } catch (e) { last = String(e && e.message ? e.message : e); }
  body = body.replace(/^\s+|\s+$/g, '');
  if (!body) return { url: '内蒙古取流失败：接口无响应' + (last ? '（' + last + '）' : '') };
  // 服务端返回的是 JSON 字符串字面量："<base64密文>"，先剥掉外层引号
  if (body.charAt(0) === '"') {
    try { var unq = JSON.parse(body); if (typeof unq === 'string') body = unq; } catch (eU) { /* 保留原样 */ }
  }

  var obj = null, plain = '';
  try { plain = nmDecrypt(body, NM_KEY); } catch (e2) { last = String(e2); }
  if (plain) { try { obj = JSON.parse(plain); } catch (e3) { last = String(e3); } }
  if (!obj || obj.code !== 0 || !obj.data) {
    return { url: '内蒙古取流失败：解密或解析异常' + (last ? '（' + last + '）' : '') };
  }

  var stream = '';
  for (var i = 0; i < obj.data.length; i++) {
    var d = obj.data[i] && obj.data[i].data;
    if (d && d.id === ch.id && d.streamUrl) { stream = String(d.streamUrl); break; }
  }
  if (stream.indexOf('http') !== 0) return { url: '未找到频道 ' + ch.name + ' 的播放地址（id=' + ch.id + '）' };

  // 实测：不带 Referer 一律 403，必须回传
  return {
    url: stream,
    referer: NM_HOME,
    userAgent: NM_UA,
    headers: { 'Referer': NM_HOME, 'Origin': 'https://www.nmtv.cn', 'User-Agent': NM_UA }
  };
}
