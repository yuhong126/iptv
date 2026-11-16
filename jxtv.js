/* ============================================================
 * 江西台直播 · mytv / 酷9 通用 JS 源
 *
 * 用法（一行一个台）：
 *   江西卫视,javascript://<本文件的在线地址>?id=0
 *
 * id 对照：
 *   0 江西卫视   1 江西都市   2 江西经济生活   3 江西公共农业
 *   4 江西少儿   5 江西新闻   6 江西移动电视   7 江西陶瓷
 *
 * 原理：官网 CDN 取流需要一次性 token，token 由前端 md5 签名换得。
 *       本脚本在客户端完成「签名 -> 换票 -> 拼出播放地址」，
 *       播放器拿到的就是一条可直接播的 m3u8，不需要任何中转服务器。
 * ============================================================ */

// ---------- 内嵌 MD5（不依赖宿主是否提供 ku9.md5，纯 ES5 实现）----------
var JX_K = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
];
var JX_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];

// 字符串 -> UTF-8 字节串（每个 charCode 是一个字节）
function jxUtf8(s) {
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

function jxHexLE(n) {
  var s = '', i, b;
  for (i = 0; i < 4; i++) {
    b = (n >>> (i * 8)) & 0xff;
    s += (b < 16 ? '0' : '') + b.toString(16);
  }
  return s;
}

function jxMd5(text) {
  var s = jxUtf8(text);
  var n = s.length, i, blk;
  var blocks = Math.ceil((n + 9) / 64);
  var total = blocks * 16;            // 以 32bit word 计
  var w = [];
  for (i = 0; i < total; i++) w[i] = 0;
  for (i = 0; i < n; i++) w[i >> 2] |= s.charCodeAt(i) << ((i % 4) * 8);
  w[n >> 2] |= 0x80 << ((n % 4) * 8);
  var bitLen = n * 8;
  w[total - 2] = bitLen & 0xffffffff;
  w[total - 1] = Math.floor(bitLen / 4294967296);

  var a0 = 1732584193, b0 = -271733879, c0 = -1732584194, d0 = 271733878;
  var a, b, c, d, f, g, tmp, sum, k, t;

  for (k = 0; k < total; k += 16) {
    a = a0; b = b0; c = c0; d = d0;
    for (i = 0; i < 64; i++) {
      if (i < 16) {
        f = (b & c) | (~b & d); g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c); g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d; g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d); g = (7 * i) % 16;
      }
      tmp = d;
      d = c;
      c = b;
      sum = (a + f + JX_K[i] + w[k + g]) | 0;
      t = JX_S[i];
      b = (b + ((sum << t) | (sum >>> (32 - t)))) | 0;
      a = tmp;
    }
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }
  return jxHexLE(a0) + jxHexLE(b0) + jxHexLE(c0) + jxHexLE(d0);
}

/* ============================ 主入口 ============================ */
function main(item) {
  // ---- 频道表 ----
  var CH = [
    { name: '江西卫视', stream: 'tv_jxtv1' },
    { name: '江西都市', stream: 'tv_jxtv2' },
    { name: '江西经济生活', stream: 'tv_jxtv3_hd' },
    { name: '江西公共农业', stream: 'tv_jxtv5' },
    { name: '江西少儿', stream: 'tv_jxtv6' },
    { name: '江西新闻', stream: 'tv_jxtv7' },
    { name: '江西移动电视', stream: 'tv_jxtv8' },
    { name: '江西陶瓷', stream: 'tv_taoci' }
  ];

  // ---- 签名常量（从官网前端 JS 逆向得到）----
  var CHARSET = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678oOLl9gqVvUuI1';
  var TAIL = 'gXmNaQROStYfd';
  var UUID = '09b07a0ae01c';
  var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
           'Chrome/126.0.0.0 Safari/537.36';
  var GPU = 'Google Inc. (Microsoft), ANGLE (Microsoft, Microsoft Basic Render Driver ' +
            '(0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)';
  var AUTH_URL = 'https://cdnauth.jxgdw.com/liveauth/pc';
  var PLAY_HOST = 'https://yun-live.jxtvcn.com.cn/live-jxtv/';

  var hasKu9 = (typeof ku9 !== 'undefined' && ku9);

  // ---- 解析 id ----
  var key = '', i;
  if (item && item.id !== undefined && item.id !== null && String(item.id) !== '') {
    key = String(item.id);
  } else if (item && item.url && hasKu9 && typeof ku9.getQuery === 'function') {
    key = String(ku9.getQuery(item.url, 'id') || '');
  }

  var ch = null;
  var idx = parseInt(key, 10);
  if (!isNaN(idx) && idx >= 0 && idx < CH.length) ch = CH[idx];
  if (!ch && key) {
    for (i = 0; i < CH.length; i++) {
      if (CH[i].name === key || CH[i].stream === key) { ch = CH[i]; break; }
    }
  }
  if (!ch) ch = CH[0];

  // ---- 换票 ----
  if (!hasKu9 || typeof ku9.request !== 'function') {
    return { url: '当前播放器不支持 JS 源（缺少 ku9.request），请升级到新版 mytv' };
  }

  var md5 = (typeof ku9.md5 === 'function') ? ku9.md5 : jxMd5;
  var stream = ch.stream + '.m3u8';
  var tok = null, lastCode = '?', lastBody = '';

  // 换票失败多半是偶发的网关抖动或同一秒重复签名，重新取 t 与 etag 再试一次即可
  for (var attempt = 0; attempt < 2 && !tok; attempt++) {
    var t = Math.floor((new Date()).getTime() / 1000) + attempt;
    var etag = '';
    for (i = 0; i < 8; i++) etag += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
    var sign = md5(String(t) + stream + etag + TAIL);

    var res = null;
    try {
      // 三个头缺一不可，且 authorization 必须全小写：官网网关对头名大小写敏感
      res = ku9.request(AUTH_URL, 'POST', {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.jxntv.cn',
        'Referer': 'https://www.jxntv.cn/',
        'User-Agent': UA,
        'authorization': sign,
        'etag': etag,
        'gpu': GPU
      }, '{"t":' + t + ',"stream":"' + stream + '","uuid":"' + UUID + '"}');
    } catch (e) {
      lastBody = String(e);
      continue;
    }

    lastCode = res ? res.code : '?';
    lastBody = res ? String(res.body || '') : '';
    if (!res || !res.body) continue;

    try {
      var o = JSON.parse(res.body);
      if (o && o.token) tok = o;
    } catch (e2) { /* 返回不是 JSON，落在下面的统一报错 */ }
  }

  if (!tok) {
    return {
      url: ch.name + ' 换票失败（code=' + lastCode + '）：' +
           lastBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 60)
    };
  }

  // ---- 拼播放地址（实测取流与分片均不需要额外请求头）----
  return {
    url: PLAY_HOST + stream + '?source=pc&t=' + tok.t + '&token=' + tok.token + '&uuid=' + UUID,
    headers: {
      'User-Agent': UA,
      'Referer': 'https://www.jxntv.cn/'
    }
  };
}
