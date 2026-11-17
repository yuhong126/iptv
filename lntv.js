/**
 * 辽宁台（北斗融媒 / 辽宁省台）JS 直播源 —— mytv 专用
 * 生成日期：2026-11-17
 *
 * 原理：
 *   北斗融媒 HLS 走 Tengine Referer ACL，必须带「当前有效 Referer」+ 阿里云 auth_key 短签名。
 *   Referer 由官方 getOauth 接口动态轮换（约 15 小时一次），响应是 RSA 加密的，
 *   用客户端内置 RSA 私钥解密得到 refer / pullKey；auth_key = md5(path-exp-0-0-pullKey)。
 *   本 JS 复刻整条链路：调 getOauth -> RSA 解密(BigInt) -> 调 getPlayableUrl -> MD5 签名 -> 返回带 Referer 的地址。
 *
 * 列表行写法：
 *   辽宁卫视,javascript://https://gh-proxy.com/https://raw.githubusercontent.com/yuhong126/iptv/refs/heads/main/lntv.js?id=lnws
 * 可用 id： lnws lnds lnys lnjy lnsh lnty lnbf jtlc
 */

// ---------- 频道表：id -> [官方 domainId, 官方 streamName, 台名] ----------
var CHANNELS = {
  lnws: ['c077b260424404846285cba1e1759280', 'lntv', '辽宁卫视'],
  lnds: ['10d3de0d03c62e85a1a281bbde8b6952', 'dspd', '辽宁都市'],
  lnys: ['918510749a0f319ec12ff695b1c95230', 'yspd', '辽宁影视剧'],
  lnjy: ['854e7044de9fef5163ae36fabb72de56', 'qspd', '辽宁教育青少'],
  lnsh: ['078ce87dcf5384d51e4655cb962fda18', 'shpd', '辽宁生活'],
  lnty: ['e0bb9a7fd9afa954658bc50d0681cd49', 'typd', '辽宁体育休闲'],
  lnbf: ['8e95535378bd3e5f7494bc23ab1cb117', 'bfpd', '辽宁北方'],
  jtlc: ['7e29bde4f41ca08642b7fc3ce4eb1ae4', 'jtlc', '家庭理财']
};

var API_HOST = 'bdrm.bdy.lnyun.com.cn';
var STREAM_HOST = 'bdrmtvzb.lnyun.com.cn';
var UA = 'okhttp/4.12.0';
var RSA_BLOCK = 256; // 2048-bit

// 客户端内置 RSA 私钥（非用户私钥，仅解官方下发的配置；来自北斗融媒 APP 内置材料）
var RSA_N_HEX =
  'a66823899664e1b830a7a09587e38e4966d8a7921c22c2baa674afce6d8a01f2c30f5668cb0e76c428e24f8acf7d62760141c44dd9c184bce2' +
  '0c56e7872e99a123817d99b85f25c6619e5446ad0725a3136d3c4636c6620aec53c532581755030a89f129a66e3862c716abcaebc0c90c117' +
  '37238b292c3657025626065602171601aa43adee42d3c276c4f8542b7086ba9a7e3a620cca7b476943b3fb27f6e044e9e1ceb84012dc4b67f' +
  '02e2f640457faf2cf6b56ce8cacadef0a3fc035b1550168450a8476ad474cfd3c4cc13dfd44b7fc54f7416c7d83efcb3b8431b20a8d8c2da25' +
  '0bcdf086acab10a5732b81d510e90932c04156b4ce0b85e13497f3b967';
var RSA_D_HEX =
  '309c3e395c8216bff0129fa1dec2d61752205aff1f11f67180db9859c47ceaa9c85a6c230ba22b868cece35088e1374882807c4043aab8c4568' +
  '24546b8222045c6b1f68757a90fc75e4fda8d94d100291dad2cccd4066ab0872dc76eb7f604e2f10aafb4bb85fa19bccfbe1a7678e8220adc' +
  'ff1259f3ee796ce3b6d3b2f97c7b0116fce3877b14994f1ee91a5a55df17604c84329e2a276367892a544c0ba6ea377513270a77ed0ae982d' +
  '03bb38ff0cb606dd31861e6318a1971a01069f74bb897d43c2c1275fd373f792104af81ac2946d7db5572646cd10911c9ffaec6ab3cebfbc0' +
  'a8221b6b59167e2b68b99ff2e1ccffb7509ea6c46167bccf5178ac80bd';

// ---------- base64 ----------
var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64ToBytes(s) {
  s = String(s).replace(/=+$/, '').replace(/[^A-Za-z0-9+/]/g, '');
  var out = [], buf = 0, bits = 0, i;
  for (i = 0; i < s.length; i++) {
    buf = (buf << 6) | B64.indexOf(s.charAt(i)); bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 0xff); }
  }
  return out;
}
function b64Encode(str) {
  var bytes = [], i;
  for (i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xff);
  var out = '', j;
  for (j = 0; j < bytes.length; j += 3) {
    var n = (bytes[j] << 16) | ((bytes[j + 1] || 0) << 8) | (bytes[j + 2] || 0);
    out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63);
    out += (j + 1 < bytes.length) ? B64.charAt((n >> 6) & 63) : '=';
    out += (j + 2 < bytes.length) ? B64.charAt(n & 63) : '=';
  }
  return out;
}
function bytesToUtf8(arr) {
  var s = '', i; for (i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
}

// ---------- BigInt RSA 解密 ----------
function modPow(base, exp, mod) {
  var r = 1n; base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) r = (r * base) % mod;
    base = (base * base) % mod; exp >>= 1n;
  }
  return r;
}
function bytesToBigInt(bytes) {
  var h = '', i;
  for (i = 0; i < bytes.length; i++) { var b = bytes[i].toString(16); if (b.length < 2) b = '0' + b; h += b; }
  return BigInt('0x' + h);
}
function rsaDecrypt(b64) {
  var enc = b64ToBytes(b64);
  if (enc.length !== RSA_BLOCK) return null;
  var N = BigInt('0x' + RSA_N_HEX), D = BigInt('0x' + RSA_D_HEX);
  var m = modPow(bytesToBigInt(enc), D, N);
  var hex = m.toString(16);
  // 关键：PKCS#1 块以 00 02 开头，前导 0 字节会被 BigInt 丢弃，必须左补零到整块长度
  while (hex.length < RSA_BLOCK * 2) hex = '0' + hex;
  var out = [], i;
  for (i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
  if (out[0] !== 0 || out[1] !== 2) return null;
  var sep = -1; for (i = 2; i < out.length; i++) { if (out[i] === 0) { sep = i; break; } }
  if (sep < 10) return null;
  return bytesToUtf8(out.slice(sep + 1));
}

// ---------- sign(version=6) ----------
function oauthSign(channelId, seconds) {
  var rand = function (a, b) { return a + Math.floor(Math.random() * (b - a)); };
  var digit = rand(0, 10), a = rand(1, 3), b = rand(a + 1, 5), c = rand(b + 1, 7), d = rand(c + 1, 10);
  var text = '', last = 0, pos = [a, b, c, d], i;
  for (i = 0; i < pos.length; i++) { text += channelId.slice(last, pos[i]) + digit; last = pos[i]; }
  text += channelId.slice(last);
  var sha = CryptoJS.SHA256(text).toString();
  var digest = CryptoJS.MD5(sha + seconds).toString().toUpperCase();
  return b64Encode('' + digit + a + b + c + d + seconds) + digest;
}

// ---------- 网络 ----------
function apiGet(path, referer) {
  var resp = mytv.request('https://' + API_HOST + path, 'GET', [
    'User-Agent: ' + UA,
    'Referer: https://' + API_HOST,
    'Accept: application/json'
  ], null);
  return JSON.parse(resp.body);
}
function apiOauth(domainId, seconds) {
  var sign = oauthSign(domainId, seconds);
  var url = 'https://' + API_HOST + '/cloud/apis/live/api/domain/getOauth?domainId=' + domainId + '&version=6&sign=' + sign;
  var resp = mytv.request(url, 'POST', [
    'User-Agent: ' + UA,
    'Referer: https://' + API_HOST,
    'Content-Type: application/x-www-form-urlencoded',
    'Accept: application/json'
  ], '');
  return JSON.parse(resp.body);
}

// ---------- 主逻辑 ----------
function main(paramstr) {
  try {
    var params = (typeof parseItems === 'function') ? parseItems(paramstr) : (function (s) {
      var o = {}, p = String(s || '').split('&'), i;
      for (i = 0; i < p.length; i++) { var kv = p[i].split('='); if (kv[0]) o[kv[0]] = decodeURIComponent(kv[1] || ''); }
      return o;
    })(paramstr);
    var id = params.id || 'lnws';
    var ch = CHANNELS[id];
    if (!ch) return JSON.stringify({ error: '未知频道 id: ' + id });

    var domainId = ch[0], streamName = ch[1], name = ch[2];
    var seconds = Math.floor(Date.now() / 1000);

    // 1) 鉴权
    var auth = apiOauth(domainId, seconds);
    if (Number(auth.code) !== 200) return JSON.stringify({ error: 'getOauth失败: ' + (auth.msg || auth.code) });
    var data = typeof auth.data === 'string' ? JSON.parse(auth.data) : auth.data;

    // 2) RSA 解密 refer / pullKey
    var referRaw = rsaDecrypt(data.refer);
    var pullKey = rsaDecrypt(data.pullKey);
    if (!referRaw || !pullKey) return JSON.stringify({ error: 'RSA解密失败' });
    var referer = /^https?:\/\//.test(referRaw) ? referRaw : ('http://' + referRaw);

    // 3) 取当前可播 m3u8（live 用 HLS；replay 用回看地址）
    var play = apiGet('/cloud/apis/live/api/program/getPlayableUrl?domainId=' + domainId, referer);
    var raw = '';
    if (Number(play.code) === 200 && play.data) {
      if (play.data.playableType === 'live') {
        try {
          var pu = JSON.parse(play.data.playableUrl);
          raw = pu.m3u8 || '';
        } catch (e) { raw = ''; }
      } else {
        raw = play.data.playableUrl || ''; // replay 回看 URL
      }
    }
    if (!raw) return JSON.stringify({ error: '当前无直播/回看地址(' + (play.data ? play.data.playableType : play.code) + ')' });

    // 4) 生成 auth_key（30分钟）—— 纯字符串处理，不依赖 new URL（部分 mytv QuickJS 未暴露）
    var exp = seconds + 1800;
    var path = raw.split('?')[0];                 // 如 https://bdrmtvzb.lnyun.com.cn/bdrm/dspd.m3u8
    var pathOnly = path.replace(/^https?:\/\/[^/]+/, '') || '/'; // 取 /bdrm/xxx.m3u8 做签名 path
    var digest = CryptoJS.MD5(pathOnly + '-' + exp + '-0-0-' + pullKey).toString();
    var sep = raw.indexOf('?') >= 0 ? '&' : '?';
    var finalUrl = raw + sep + 'auth_key=' + exp + '-0-0-' + digest;

    return JSON.stringify({
      url: finalUrl,
      headers: 'Referer: ' + referer
    });
  } catch (e) {
    return JSON.stringify({ error: '异常: ' + (e && e.message ? e.message : e) });
  }
}
