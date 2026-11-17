/* ============================================================
 * 河南台直播 JS 源 —— 通用版（mytv 全版本 + 酷9 通吃）
 * 新文件名 hntv_u.js（换名避开 gh-proxy 缓存；并改走 gh-proxy，
 * 原列表直连 raw.githubusercontent.com 在国内常被墙/超时）
 *
 * ============ 为什么重写（2026-11-17 兼容性问题） ============
 * 旧 hntv.js 是「纯酷9方言」，有三处硬依赖，任何一处不满足就播不了：
 *   1) 开头就判断 if (!ku9 || !ku9.request) return 错误文本 —— 原版 mytv 没有 ku9 → 直接失败
 *   2) 只用 item.id 取频道 —— 原版 mytv 的 item 是查询串字符串，没有 .id
 *   3) 只用 ku9.request 发签名请求 —— 纯 mytv 环境无此对象
 * 本版照抄四川 sctv4.js 已验证的「双环境兼容」模型，三点全部兼容。
 *
 * 源：大象TV/河南台接口 sign = SHA256("6ca114a836ac7d73"+秒级时间戳)，
 *     自带纯 JS SHA-256（不依赖宿主 ku9.sha256 / CryptoJS），
 *     返回 video_streams[0]，m3u8 与分片均无需请求头。
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
    if (c < 0x80) o += String.fromCharCode(c);
    else if (c < 0x800) o += String.fromCharCode(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0xd800 || c >= 0xe000) o += String.fromCharCode(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else { i++; c2 = s.charCodeAt(i); u = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      o += String.fromCharCode(0xf0 | (u >> 18), 0x80 | ((u >> 12) & 63), 0x80 | ((u >> 6) & 63), 0x80 | (u & 63)); }
  }
  return o;
}
function hnRor(x, n) { return (x >>> n) | (x << (32 - n)); }
function hnSha256(text) {
  var bytes = hnUtf8(text), n = bytes.length, bitLen = n * 8, blocks = Math.ceil((n + 9) / 64);
  var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  var w = [], i, j, k, s0, s1, ch, maj, t1, t2, a, b, c, d, e, f, g, h;
  for (k = 0; k < blocks; k++) {
    for (i = 0; i < 64; i++) w[i] = 0;
    for (i = 0; i < 16; i++) {
      var pos = k * 64 + i * 4, val = 0;
      for (j = 0; j < 4; j++) {
        var bp = pos + j, byte = (bp < n) ? (bytes.charCodeAt(bp) & 0xff) : 0;
        if (bp === n) byte = 0x80;
        val = (val << 8) | byte;
      }
      w[i] = val >>> 0;
    }
    if (k === blocks - 1) { w[14] = Math.floor(bitLen / 4294967296) >>> 0; w[15] = bitLen >>> 0; }
    for (i = 16; i < 64; i++) {
      s0 = hnRor(w[i-15],7) ^ hnRor(w[i-15],18) ^ (w[i-15] >>> 3);
      s1 = hnRor(w[i-2],17) ^ hnRor(w[i-2],19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    a=h0;b=h1;c=h2;d=h3;e=h4;f=h5;g=h6;h=h7;
    for (i = 0; i < 64; i++) {
      s1 = hnRor(e,6) ^ hnRor(e,11) ^ hnRor(e,25);
      ch = (e & f) ^ (~e & g);
      t1 = (h + s1 + ch + HN_K[i] + w[i]) | 0;
      s0 = hnRor(a,2) ^ hnRor(a,13) ^ hnRor(a,22);
      maj = (a & b) ^ (a & c) ^ (b & c);
      t2 = (s0 + maj) | 0;
      h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    h0=(h0+a)|0;h1=(h1+b)|0;h2=(h2+c)|0;h3=(h3+d)|0;
    h4=(h4+e)|0;h5=(h5+f)|0;h6=(h6+g)|0;h7=(h7+h)|0;
  }
  var hs = [h0,h1,h2,h3,h4,h5,h6,h7], out = '', v, byte;
  for (i = 0; i < 8; i++) { v = hs[i];
    for (j = 0; j < 4; j++) { byte = (v >>> (24 - j*8)) & 0xff; out += (byte < 16 ? '0' : '') + byte.toString(16); } }
  return out;
}

/* ---------------- 双环境工具层 ---------------- */
var HN_IS_KU9 = (typeof ku9 !== 'undefined') && (typeof mytv === 'undefined');

function hnGetId(item) {
  var key = '';
  try { if (item && item.id !== undefined && item.id !== null) key = String(item.id); } catch (e) {}
  try { if (!key && item && item.params && item.params.id) key = String(item.params.id); } catch (e) {}
  if (!key) {
    var s = '';
    try { s = (item && item.url) ? String(item.url) : String(item == null ? '' : item); } catch (e) { s = ''; }
    var m = /(?:^|[?&])id=([^&]*)/.exec(s);
    if (m) { try { key = decodeURIComponent(m[1]); } catch (e2) { key = m[1]; } }
  }
  return key;
}

// 请求封装：酷9用对象头，mytv 用数组头；两者都试，取第一个拿到 body 的
function hnRequest(url, method, headersObj) {
  var body = '';
  // 路径1：ku9.request（酷9 / 带 ku9 桥接的改版 mytv）
  try {
    if (typeof ku9 !== 'undefined' && typeof ku9.request === 'function') {
      var r = ku9.request(url, method || 'GET', headersObj, null);
      if (r && r.body) body = String(r.body);
    }
  } catch (e) {}
  // 路径2：mytv.request（原版 mytv，headers 为数组）
  if (!body) {
    try {
      if (typeof mytv !== 'undefined' && typeof mytv.request === 'function') {
        var hs = [];
        for (var k in headersObj) hs.push(k + ': ' + headersObj[k]);
        var mr = mytv.request(url, method || 'GET', hs, '');
        if (mr) body = String((mr.body !== undefined ? mr.body : mr) || '');
      }
    } catch (e2) {}
  }
  return body;
}

/* ============================ 主入口 ============================ */
function main(item) {
  var CHANNELS = [
    { id: 141, name: '都市频道' }, { id: 145, name: '河南卫视' },
    { id: 146, name: '民生频道' }, { id: 147, name: '法治频道' },
    { id: 148, name: '电视剧频道' }, { id: 149, name: '新闻频道' },
    { id: 150, name: '欢腾购物' }, { id: 151, name: '公共频道' },
    { id: 152, name: '河南乡村' }, { id: 154, name: '梨园频道' },
    { id: 155, name: '文物宝库' }, { id: 156, name: '武术频道' }
  ];
  var SECRET = '6ca114a836ac7d73';
  var API = 'https://pubmod.hntv.tv/program/getAuth/channel/channelIds/1/';

  var key = hnGetId(item);
  var cid = parseInt(key, 10);
  if (isNaN(cid)) {
    for (var q = 0; q < CHANNELS.length; q++) {
      if (CHANNELS[q].name === key || key.indexOf(CHANNELS[q].name) >= 0) { cid = CHANNELS[q].id; break; }
    }
  }
  if (isNaN(cid) || cid <= 0) cid = 145;

  var ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
  var data = null, lastBody = '';
  for (var attempt = 0; attempt < 3 && !data; attempt++) {
    var ts = Math.floor(Date.now() / 1000) - attempt;
    var sign = (typeof ku9 !== 'undefined' && typeof ku9.sha256 === 'function')
      ? ku9.sha256(SECRET + ts) : hnSha256(SECRET + ts);
    var body = hnRequest(API + cid, 'GET', {
      'sign': sign, 'timestamp': String(ts), 'User-Agent': ua, 'Referer': 'https://static.hntv.tv/'
    });
    lastBody = body;
    if (!body) continue;
    try {
      var arr = JSON.parse(body);
      if (arr && arr.length && arr[0] && arr[0].video_streams && arr[0].video_streams.length) data = arr[0];
    } catch (e2) {}
  }

  if (!data) {
    var err = '河南台 cid=' + cid + ' 取流失败：' + String(lastBody).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 80);
    return HN_IS_KU9 ? { url: err } : JSON.stringify({ url: '', error: err });
  }

  var u = data.video_streams[0];
  return HN_IS_KU9 ? { url: u } : JSON.stringify({ url: u });
}
