/* ============================================================
 * 河南台直播 · mytv / 酷9 通用 JS 源（12 个电视频道）
 *
 * 用法（一行一个台）：
 *   河南卫视,javascript://<本文件的在线地址>?id=145
 *   河南都市,javascript://<本文件的在线地址>?id=141
 *   ...
 *
 * id = 官网频道 cid（详见下方 CHANNELS），也支持传台名。
 *
 * 原理：
 *   大象 TV / 河南台网页 (static.hntv.tv/total/television) 的取流接口需要
 *   两个头：sign = SHA256("6ca114a836ac7d73" + 秒级时间戳)，timestamp。
 *   本脚本在客户端算出签名 -> 调 getAuth 接口 -> 取 video_streams[0]
 *   的 m3u8 直接返回。m3u8 与分片均无需请求头，不需要中转服务器。
 * ============================================================ */

/* ---------------- 纯 JS SHA-256（ES5，不依赖宿主） ---------------- */
var HN_K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
];

function hnUtf8(s) {
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

function hnRor(x, n) { return (x >>> n) | (x << (32 - n)); }

function hnSha256(text) {
  var bytes = hnUtf8(text);
  var n = bytes.length;
  var bitLen = n * 8;
  var blocks = Math.ceil((n + 9) / 64);
  var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  var w = [], i, j, k, s0, s1, ch, maj, t1, t2;
  var a, b, c, d, e, f, g, h;

  for (k = 0; k < blocks; k++) {
    for (i = 0; i < 64; i++) w[i] = 0;
    for (i = 0; i < 16; i++) {
      var pos = k * 64 + i * 4, val = 0;
      for (j = 0; j < 4; j++) {
        var bp = pos + j;
        var byte = (bp < n) ? (bytes.charCodeAt(bp) & 0xff) : 0;
        if (bp === n) byte = 0x80;
        val = (val << 8) | byte;
      }
      w[i] = val >>> 0;
    }
    if (k === blocks - 1) {
      w[14] = Math.floor(bitLen / 4294967296) >>> 0;
      w[15] = bitLen >>> 0;
    }
    for (i = 16; i < 64; i++) {
      s0 = hnRor(w[i - 15], 7) ^ hnRor(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      s1 = hnRor(w[i - 2], 17) ^ hnRor(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    a = h0; b = h1; c = h2; d = h3; e = h4; f = h5; g = h6; h = h7;
    for (i = 0; i < 64; i++) {
      s1 = hnRor(e, 6) ^ hnRor(e, 11) ^ hnRor(e, 25);
      ch = (e & f) ^ (~e & g);
      t1 = (h + s1 + ch + HN_K[i] + w[i]) | 0;
      s0 = hnRor(a, 2) ^ hnRor(a, 13) ^ hnRor(a, 22);
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

/* ============================ 主入口 ============================ */
function main(item) {
  // 官网 class_id=11 的全部电视频道（cid 循环探测所得）
  var CHANNELS = [
    { id: 141, name: '都市频道' },
    { id: 145, name: '河南卫视' },
    { id: 146, name: '民生频道' },
    { id: 147, name: '法治频道' },
    { id: 148, name: '电视剧频道' },
    { id: 149, name: '新闻频道' },
    { id: 150, name: '欢腾购物' },
    { id: 151, name: '公共频道' },
    { id: 152, name: '河南乡村' },
    { id: 154, name: '梨园频道' },
    { id: 155, name: '文物宝库' },
    { id: 156, name: '武术频道' }
  ];

  var SECRET = '6ca114a836ac7d73';
  var API = 'https://pubmod.hntv.tv/program/getAuth/channel/channelIds/1/';

  var hasKu9 = (typeof ku9 !== 'undefined' && ku9);
  if (!hasKu9 || typeof ku9.request !== 'function') {
    return { url: '当前播放器不支持 JS 源（缺少 ku9.request），请升级到新版 mytv' };
  }

  // ---- 解析 id（cid 或台名）----
  var key = '';
  if (item && item.id !== undefined && item.id !== null && String(item.id) !== '') {
    key = String(item.id);
  } else if (item && item.url && typeof ku9.getQuery === 'function') {
    key = String(ku9.getQuery(item.url, 'id') || '');
  }
  var cid = parseInt(key, 10);
  if (isNaN(cid)) {
    for (var q = 0; q < CHANNELS.length; q++) {
      if (CHANNELS[q].name === key || key.indexOf(CHANNELS[q].name) >= 0) { cid = CHANNELS[q].id; break; }
    }
  }
  if (isNaN(cid) || cid <= 0) cid = 145; // 默认河南卫视

  // ---- 签名（带重试：避免同一秒重复签名被判重）----
  var ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
  var data = null, lastBody = '';
  for (var attempt = 0; attempt < 3 && !data; attempt++) {
    var ts = Math.floor((new Date()).getTime() / 1000) - attempt;
    var sign = (typeof ku9.sha256 === 'function') ? ku9.sha256(SECRET + ts) : hnSha256(SECRET + ts);
    var res = null;
    try {
      res = ku9.request(API + cid, 'GET', {
        'sign': sign,
        'timestamp': String(ts),
        'User-Agent': ua,
        'Referer': 'https://static.hntv.tv/'
      }, null);
    } catch (e) {
      lastBody = String(e);
      continue;
    }
    if (!res || !res.body) continue;
    lastBody = String(res.body);
    try {
      var arr = JSON.parse(res.body);
      if (arr && arr.length && arr[0] && arr[0].video_streams && arr[0].video_streams.length) {
        data = arr[0];
      }
    } catch (e2) { /* 落在下面统一报错 */ }
  }

  if (!data) {
    return { url: '河南台 cid=' + cid + ' 取流失败：' + lastBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 80) };
  }

  // video_streams[0]（wsSecret 型）实测 m3u8 与分片均无需请求头，直接返回
  return { url: data.video_streams[0] };
}
