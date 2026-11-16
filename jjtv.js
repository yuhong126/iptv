/* ============================================================
 * 九江台直播 · mytv / 酷9 通用 JS 源（3 个台）
 *
 * 用法（一行一个台）：
 *   九江一套,javascript://<本文件的在线地址>?id=0
 *   九江二套,javascript://<本文件的在线地址>?id=1
 *   九江三套,javascript://<本文件的在线地址>?id=2
 *
 * id 对照：
 *   0 九江一套   1 九江二套   2 九江三套
 *   （也支持直接传台名，如 ?id=九江二套）
 *
 * 原理：
 *   九江 APP (app.jjntv.cn) 的接口需要 SHA-256 签名头
 *   (X-REQUEST-ID / X-TIMESTAMP / X-SIGNATURE / X-SESSION-ID / X-TENANT-ID)。
 *   本脚本在客户端复刻 APP 的签名算法：
 *     1) GET /api/tvLiveChannel/getChannelByType 取频道表（拿 activity_id）
 *     2) GET /api/quklive/generateTempPlayUrl 用 activity_id 换 30 分钟有效的 m3u8
 *   拿到的 m3u8 无需任何请求头即可直接播放，不需要中转服务器。
 * ============================================================ */

/* ---------------- 纯 JS SHA-256（ES5，不依赖宿主） ---------------- */
var JJ_K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
];

function jjUtf8(s) {
  var o = '', i, c, c2, u;
  s = String(s);
  for (i = 0; i < s.length; i++) {
    c = s.charCodeAt(i);
    if (c < 0x80) {
      o += String.fromCharCode(c);
    } else if (c < 0x800) {
      o += String.fromCharCode(0xc0 | (c >> 6), 0x80 | (c & 63));
    } else if (c < 0xd800 || c >= 0xe000) {
      o += String.fromCharCode(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    } else {
      i++;
      c2 = s.charCodeAt(i);
      u = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      o += String.fromCharCode(
        0xf0 | (u >> 18), 0x80 | ((u >> 12) & 63),
        0x80 | ((u >> 6) & 63), 0x80 | (u & 63)
      );
    }
  }
  return o;
}

function jjRor(x, n) { return (x >>> n) | (x << (32 - n)); }

function jjSha256(text) {
  var bytes = jjUtf8(text);
  var n = bytes.length;
  var bitLen = n * 8;
  var blocks = Math.ceil((n + 9) / 64);
  var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  var w = [], i, j, k, s0, s1, ch, maj, t1, t2;
  var a, b, c, d, e, f, g, h;

  for (k = 0; k < blocks; k++) {
    // 每个 block 独立构造 64 个 32bit 字，避免跨块覆盖
    for (i = 0; i < 64; i++) w[i] = 0;
    for (i = 0; i < 16; i++) {
      var pos = k * 64 + i * 4, val = 0;
      for (j = 0; j < 4; j++) {
        var bp = pos + j;
        var byte = (bp < n) ? (bytes.charCodeAt(bp) & 0xff) : 0;
        if (bp === n) byte = 0x80;              // 填充位 0x80
        val = (val << 8) | byte;                // SHA-256 大端载入
      }
      w[i] = val >>> 0;
    }
    // 最后 8 字节写 64bit 长度（本场景字符串短，高 32 位为 0）
    if (k === blocks - 1) {
      w[14] = Math.floor(bitLen / 4294967296) >>> 0;
      w[15] = bitLen >>> 0;
    }
    for (i = 16; i < 64; i++) {
      s0 = jjRor(w[i - 15], 7) ^ jjRor(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      s1 = jjRor(w[i - 2], 17) ^ jjRor(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    a = h0; b = h1; c = h2; d = h3; e = h4; f = h5; g = h6; h = h7;
    for (i = 0; i < 64; i++) {
      s1 = jjRor(e, 6) ^ jjRor(e, 11) ^ jjRor(e, 25);
      ch = (e & f) ^ (~e & g);
      t1 = (h + s1 + ch + JJ_K[i] + w[i]) | 0;
      s0 = jjRor(a, 2) ^ jjRor(a, 13) ^ jjRor(a, 22);
      maj = (a & b) ^ (a & c) ^ (b & c);
      t2 = (s0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  var hs = [h0, h1, h2, h3, h4, h5, h6, h7];
  var out = '', v, byte;
  for (i = 0; i < 8; i++) {
    v = hs[i];
    for (j = 0; j < 4; j++) {
      byte = (v >>> (24 - j * 8)) & 0xff;
      out += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return out;
}

/* ---------------- 工具：随机 UUID（X-REQUEST-ID） ---------------- */
function jjUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) {
    var r = Math.floor(Math.random() * 16);
    var v = (ch === 'x') ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

/* ============================ 主入口 ============================ */
function main(item) {
  var CHANNELS = [
    { name: '九江一套', activityId: 1768529286203024 },
    { name: '九江二套', activityId: 1776821035295363 },
    { name: '九江三套', activityId: 1776821070594049 }
  ];

  // APP 前端逆向得到的固定签名常量
  var TENANT_ID = '314';
  var SESSION_ID = '111111111111111111111111';
  var SECRET = 'FR*r!isE5W';
  var API_CH = '/api/tvLiveChannel/getChannelByType';
  var API_URL = '/api/quklive/generateTempPlayUrl';

  var hasKu9 = (typeof ku9 !== 'undefined' && ku9);
  if (!hasKu9 || typeof ku9.request !== 'function') {
    return { url: '当前播放器不支持 JS 源（缺少 ku9.request），请升级到新版 mytv' };
  }

  // ---- 解析 id ----
  var key = '';
  if (item && item.id !== undefined && item.id !== null && String(item.id) !== '') {
    key = String(item.id);
  } else if (item && item.url && typeof ku9.getQuery === 'function') {
    key = String(ku9.getQuery(item.url, 'id') || '');
  }
  var ch = null, idx = parseInt(key, 10), i;
  if (!isNaN(idx) && idx >= 0 && idx < CHANNELS.length) ch = CHANNELS[idx];
  if (!ch && key) {
    for (i = 0; i < CHANNELS.length; i++) {
      if (CHANNELS[i].name === key) { ch = CHANNELS[i]; break; }
    }
  }
  if (!ch) ch = CHANNELS[0];

  // ---- 构造带签名的请求头（完全复刻 APP 网关）----
  function signedHeaders(path) {
    var rid = jjUuid();
    var ts = String((new Date()).getTime());
    var raw = path + '&&' + SESSION_ID + '&&' + rid + '&&' + ts + '&&' + SECRET + '&&' + TENANT_ID;
    var sha = (typeof ku9.sha256 === 'function') ? ku9.sha256(raw) : jjSha256(raw);
    return {
      'X-REQUEST-ID': rid,
      'X-TIMESTAMP': ts,
      'X-SIGNATURE': sha,
      'X-SESSION-ID': SESSION_ID,
      'X-TENANT-ID': TENANT_ID,
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://app.jjntv.cn/'
    };
  }

  // ---- 第二步：用 activity_id 换 30 分钟有效的 m3u8（带 1 次重试）----
  var m3u8 = '', lastBody = '';
  for (var attempt = 0; attempt < 2 && !m3u8; attempt++) {
    var res = null;
    try {
      res = ku9.request(
        'https://app.jjntv.cn' + API_URL + '?activityId=' + ch.activityId + '&minutes=30',
        'GET',
        signedHeaders(API_URL),
        null
      );
    } catch (e) {
      lastBody = String(e);
      continue;
    }
    if (!res || !res.body) continue;
    lastBody = String(res.body);
    try {
      var o = JSON.parse(res.body);
      if (o && o.code === 0 && o.data && o.data.hlsUrl) m3u8 = o.data.hlsUrl;
    } catch (e2) { /* 落在下面的统一报错 */ }
  }

  if (!m3u8) {
    return { url: ch.name + ' 取流失败：' + lastBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 80) };
  }

  // m3u8 与分片实测无需任何请求头，直接返回即可
  return { url: m3u8 };
}
