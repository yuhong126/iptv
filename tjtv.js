/* ============================================================
 * 天津台 · 动态签名 JS 源（mytv / 酷9 通用）
 *
 * 用法（一行一个台）：
 *   天津新闻,javascript://https://gh-proxy.com/https://raw.githubusercontent.com/yuhong126/iptv/refs/heads/main/tjtv.js?id=tjxw
 *
 * ★ 使用前提：必须先在下方 TJ_CFG 里填入 CDN 的签名 KEY。
 *   当前 KEY 为空，脚本会返回明确提示而不是静默黑屏。
 *
 * ---- 原理（已实测确认，2026-11-18）----
 * 万视达的天津台直播走腾讯云 CDN，播放地址形如：
 *   http://live-tx.wisetv.com.cn/TJIPTV/TJXWHD2.m3u8
 *       ?txSecret=<md5>&txTime=<hex>&GUID=<32位>&wisetvauth=1
 *
 * 腾讯云 CDN 的防盗链公式：
 *   txSecret = MD5(KEY + StreamName + txTime)     ← txTime 为小写十六进制
 *   StreamName 是 URL 路径（含 .m3u8，含前导斜杠）
 *
 * 只要拿到 KEY，就能在任意时刻自己算出新的 txTime/txSecret，
 * 从而做到「永不过期」——这正是本脚本要做的事。
 *
 * ---- 已排除的路径（避免重复劳动）----
 *   × 裸地址（去掉全部签名）        -> 403
 *   × 仅保留 GUID + wisetvauth      -> 403
 *   × 换一个同长度的 GUID            -> 403
 *   × https 替代 http               -> 403
 *   × KEY 弱口令爆破（400+ 组合）    -> 未命中
 *   × 从 APK 明文里捞 KEY（649 个 hex + 43145 个 ASCII 候选）-> 未命中
 *     （万视达用网易易盾加固，业务 dex 整体加密在 assets/nedata.db，
 *       KEY 只能靠运行时脱壳拿到）
 *   × api.wisetv.com.cn 直接调用     -> 全部返回 4001「缺少授权认证信息」
 *     （论坛情报：万视达对关键 URL 做了加密，只接受密文路径）
 * ============================================================ */

// ▼▼▼ 拿到 KEY 后填在这里（腾讯云 CDN 控制台的「鉴权 Key」）▼▼▼
var TJ_CFG = {
  KEY: '',                    // 例如 'a1b2c3d4e5f6...'（32 位）
  GUID: '',                   // 抓包得到的任一有效 GUID（32 位 hex），留空则用内置默认
  HOST: 'live-tx.wisetv.com.cn',
  UA: 'ijkplayer'
};

// 内置一组抓包样本里的 GUID（若服务端校验账号绑定，需替换成自己的）
var TJ_DEFAULT_GUID = '07978f852d0499ce415a6fd799e4dc7b';

// 频道表：id -> CDN 上的流名称
var TJ_CH = {
  tjxw:   { n: '天津新闻', s: '/TJIPTV/TJXWHD2.m3u8' },
  tjwy:   { n: '天津文艺', s: '/TJIPTV/TJWYHD2.m3u8' },
  tjkj:   { n: '天津科教', s: '/TJIPTV/TJKJHD2.m3u8' },
  tjty:   { n: '天津体育', s: '/TJIPTV/TJTYHD2.m3u8' },
  tjds:   { n: '天津都市', s: '/TJIPTV/TJDSHD2.m3u8' }
};

/* ---------------- 内嵌 MD5（QuickJS 无 crypto，必须自带） ---------------- */
function tjMd5(str) {
  function rl(x, c) { return (x << c) | (x >>> (32 - c)); }
  function ad(a, b) { return (a + b) & 0xFFFFFFFF; }
  var s = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
           5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
           4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
           6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  var K = [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
           0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
           0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
           0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
           0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
           0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
           0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
           0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391];

  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) { bytes.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
    else if (c < 0xD800 || c >= 0xE000) { bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
    else {
      i++;
      var c2 = str.charCodeAt(i);
      var cp = 0x10000 + (((c & 0x3FF) << 10) | (c2 & 0x3FF));
      bytes.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
    }
  }
  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  var lenLo = bitLen & 0xFFFFFFFF, lenHi = Math.floor(bitLen / 0x100000000);
  bytes.push(lenLo & 0xFF, (lenLo >>> 8) & 0xFF, (lenLo >>> 16) & 0xFF, (lenLo >>> 24) & 0xFF);
  bytes.push(lenHi & 0xFF, (lenHi >>> 8) & 0xFF, (lenHi >>> 16) & 0xFF, (lenHi >>> 24) & 0xFF);

  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (var off = 0; off < bytes.length; off += 64) {
    var M = [];
    for (var j = 0; j < 16; j++) {
      M[j] = bytes[off + j * 4] | (bytes[off + j * 4 + 1] << 8) |
             (bytes[off + j * 4 + 2] << 16) | (bytes[off + j * 4 + 3] << 24);
    }
    var A = a0, B = b0, C = c0, D = d0;
    for (var k = 0; k < 64; k++) {
      var F, g;
      if (k < 16) { F = (B & C) | (~B & D); g = k; }
      else if (k < 32) { F = (D & B) | (~D & C); g = (5 * k + 1) % 16; }
      else if (k < 48) { F = B ^ C ^ D; g = (3 * k + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * k) % 16; }
      F = ad(ad(ad(F, A), K[k]), M[g]);
      A = D; D = C; C = B;
      B = ad(B, rl(F, s[k]));
    }
    a0 = ad(a0, A); b0 = ad(b0, B); c0 = ad(c0, C); d0 = ad(d0, D);
  }
  function hexLE(x) {
    var o = '';
    for (var i = 0; i < 4; i++) {
      var b = (x >>> (i * 8)) & 0xFF;
      o += (b < 16 ? '0' : '') + b.toString(16);
    }
    return o;
  }
  return hexLE(a0) + hexLE(b0) + hexLE(c0) + hexLE(d0);
}

/* ---------------- 取 id（三种宿主环境都兼容） ---------------- */
function tjGetId(item) {
  var k = '';
  if (item && item.id !== undefined && item.id !== null && String(item.id) !== '') {
    k = String(item.id);
  } else if (typeof mytv !== 'undefined' && mytv.getQuery && item && item.url) {
    k = String(mytv.getQuery(item.url, 'id') || '');
  } else if (typeof ku9 !== 'undefined' && ku9.getQuery && item && item.url) {
    k = String(ku9.getQuery(item.url, 'id') || '');
  }
  return TJ_CH[k] ? k : 'tjxw';
}

/* ---------------- 主入口 ---------------- */
function main(item) {
  var isKu9 = (typeof ku9 !== 'undefined' && typeof ku9.request === 'function' &&
               typeof mytv === 'undefined');

  var id = tjGetId(item);
  var ch = TJ_CH[id];

  if (!TJ_CFG.KEY) {
    var msg = '天津台：缺少 CDN 签名 KEY（见文件内 TJ_CFG.KEY），需先从万视达 APP 脱壳取得';
    return isKu9 ? { url: msg } : JSON.stringify({ url: '', error: msg });
  }

  // txTime = 当前时间 + 有效期（秒），转小写 16 进制
  var now = Math.floor(new Date().getTime() / 1000);
  var txTime = (now + 86400 * 30).toString(16);
  var txSecret = tjMd5(TJ_CFG.KEY + ch.s + txTime);

  var guid = TJ_CFG.GUID || TJ_DEFAULT_GUID;
  var url = 'http://' + TJ_CFG.HOST + ch.s +
            '?txSecret=' + txSecret +
            '&txTime=' + txTime +
            '&GUID=' + guid +
            '&wisetvauth=1';

  var hs = 'User-Agent: ' + TJ_CFG.UA;
  if (isKu9) {
    return { url: url, userAgent: TJ_CFG.UA, headers: { 'User-Agent': TJ_CFG.UA } };
  }
  return JSON.stringify({ url: url, headers: hs });
}
