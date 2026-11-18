/*
 * 深圳网络广播电视台 JS 直播源（mytv / 酷9 原生）—— v1
 * 逆向自 www.sztv.com.cn 官网播放器（dianshi.shtml + pindao/LSDPlayer.js）2026-11-18
 *
 * ★ 解决 webview 方案的两大痛点：加载超时报错 + 不能全屏。
 *   改为原生 JS 直接返回带签名的 m3u8 URL，由播放器原生全屏播放。
 *
 * ★ 链路（每次播放 JS 现场生成，签名实时有效）：
 *   1. token = md5(nowSec + channelCode + "cutvLiveStream|Dream2017")
 *   2. GET https://hls-api.sztv.com.cn/getCutvHlsLiveKey
 *          ?t=<nowSec>&id=<channelCode>&token=<token>&at=1
 *      → 返回带引号的混淆串（如 "\"0gmZ==gN\""），经 sztvZ() 解码得 key（如 "fh46"）
 *   3. 流路径 = /<channelCode>/500/<key>.m3u8
 *      sign  = md5("ejow6p6p6hmrm9g96beh2knecdq5kyw9bp0zxyg7" + 流路径 + hexTime)
 *      其中 hexTime = (nowSec + 7200).toString(16)  ← 注意是未来 2 小时
 *      最终 URL = https://sztv-live.sztv.com.cn<流路径>?sign=<sign>&t=<hexTime>
 *   4. ★ CDN 校验 UA：只认浏览器系（Mozilla），AliPlayer/空 UA 一律 403（与四川相反）。
 *      用 mytv 标准 headers 字段把 UA 带给 m3u8 + 分片：
 *        JSON.stringify({ url: streamUrl, headers: 'User-Agent: Mozilla/5.0 ...' })
 *      ★★ 重要：不要用 url|User-Agent=... 内嵌写法！反编译确认 a5f$n 解析 JS 返回的
 *         url 时不做 | 拆分，直接 new URI(url)，带空格/竖线会构造失败 → 播放不了。
 *        |Header 提取只在 a5f$X() 的 WebView 视频提取路径生效，对 JS 源无效。
 *      ★ 分片转发：Media3 内核会把 headers 带到 .ts 分片；若电视端默认 IJK 不转发，
 *        需在「设置 → 视频播放器内核」切到 Media3（本源与安徽/河南/四川同机制）。
 *
 * ★ 实测校验（2026-11-18）：
 *   分片带 Mozilla UA → 200 / 2.4MB；带 AliPlayer UA → 403；无任何头 → 403；Referer 非必需。
 *   8 个频道 m3u8 全部 200 + #EXTM3U。
 *
 * 用法: javascript://.../sztv.js?id=7868
 *       ?id 见 CH 表（沿用原列表的频道 id）
 */

// ---------- 环境兼容 ----------
var SZT_IS_KU9 = (typeof ku9 !== 'undefined');
var SZT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
var SZT_SECRET = 'cutvLiveStream|Dream2017';
var SZT_SALT = 'ejow6p6p6hmrm9g96beh2knecdq5kyw9bp0zxyg7';
var SZT_SERVER = 'sztv-live.sztv.com.cn';
var SZT_KEYAPI = 'https://hls-api.sztv.com.cn/getCutvHlsLiveKey';

// 频道表：列表 id -> {n:名称, c:channelCode(info.json 的 p 码)}
// 前 5 个沿用老板现有 webview 列表的 id，其余为补全
var SZT_CH = {
  '7868': { n:'深圳都市', c:'ZwxzUXr' },
  '7880': { n:'深圳电视剧', c:'4azbkoY' },
  '7881': { n:'深圳少儿', c:'1SIQj6s' },
  '7869': { n:'深圳移动', c:'wDF6KJ3' },
  '7944': { n:'深圳国际', c:'sztvgjpd' },
  '7867': { n:'深圳卫视', c:'AxeFRth' },
  '24725': { n:'深圳卫视4K', c:'R77mK1v' },
  '7878': { n:'宜和购物', c:'BJ5u5k2' }
};

// ---------- 纯 JS MD5（经典实现，不依赖宿主 API）----------
function sztvMd5(str) {
  function md5_RotateLeft(lValue, iShiftBits) { return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits)); }
  function md5_AddUnsigned(lX, lY) {
    var lX4 = lX & 0x40000000, lY4 = lY & 0x40000000;
    var lX8 = lX & 0x80000000, lY8 = lY & 0x80000000;
    var lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xC0000000 ^ lX8 ^ lY8;
      return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    }
    return lResult ^ lX8 ^ lY8;
  }
  function md5_F(x,y,z){return (x&y)|((~x)&z);}
  function md5_G(x,y,z){return (x&z)|(y&(~z));}
  function md5_H(x,y,z){return (x^y^z);}
  function md5_I(x,y,z){return (y^(x|(~z)));}
  function md5_FF(a,b,c,d,x,s,ac){return md5_AddUnsigned(md5_RotateLeft(md5_AddUnsigned(md5_AddUnsigned(a,md5_F(b,c,d)),md5_AddUnsigned(x,ac)),s),b);}
  function md5_GG(a,b,c,d,x,s,ac){return md5_AddUnsigned(md5_RotateLeft(md5_AddUnsigned(md5_AddUnsigned(a,md5_G(b,c,d)),md5_AddUnsigned(x,ac)),s),b);}
  function md5_HH(a,b,c,d,x,s,ac){return md5_AddUnsigned(md5_RotateLeft(md5_AddUnsigned(md5_AddUnsigned(a,md5_H(b,c,d)),md5_AddUnsigned(x,ac)),s),b);}
  function md5_II(a,b,c,d,x,s,ac){return md5_AddUnsigned(md5_RotateLeft(md5_AddUnsigned(md5_AddUnsigned(a,md5_I(b,c,d)),md5_AddUnsigned(x,ac)),s),b);}
  function md5_ConvertToWordArray(s) {
    var lWordCount, lMessageLength = s.length, lNumberOfWords_temp1 = lMessageLength + 8;
    var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    var lWordArray = [], lBytePosition = 0, lByteCount = 0, lWordValue, lByteValue;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (s.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  function md5_WordToHex(lValue) {
    var out='', lByte;
    for (var i=0;i<=3;i++) { lByte=(lValue>>>(i*8))&255; out+=('0'+lByte.toString(16)).slice(-2); }
    return out;
  }
  var x = md5_ConvertToWordArray(str);
  var a=0x67452301,b=0xEFCDAB89,c=0x98BADCFE,d=0x10325476, aa,bb,cc,dd;
  for (var k=0;k<x.length;k+=16) {
    aa=a;bb=b;cc=c;dd=d;
    a=md5_FF(a,b,c,d,x[k+0],7,0xD76AA478);d=md5_FF(d,a,b,c,x[k+1],12,0xE8C7B756);c=md5_FF(c,d,a,b,x[k+2],17,0x242070DB);b=md5_FF(b,c,d,a,x[k+3],22,0xC1BDCEEE);
    a=md5_FF(a,b,c,d,x[k+4],7,0xF57C0FAF);d=md5_FF(d,a,b,c,x[k+5],12,0x4787C62A);c=md5_FF(c,d,a,b,x[k+6],17,0xA8304613);b=md5_FF(b,c,d,a,x[k+7],22,0xFD469501);
    a=md5_FF(a,b,c,d,x[k+8],7,0x698098D8);d=md5_FF(d,a,b,c,x[k+9],12,0x8B44F7AF);c=md5_FF(c,d,a,b,x[k+10],17,0xFFFF5BB1);b=md5_FF(b,c,d,a,x[k+11],22,0x895CD7BE);
    a=md5_FF(a,b,c,d,x[k+12],7,0x6B901122);d=md5_FF(d,a,b,c,x[k+13],12,0xFD987193);c=md5_FF(c,d,a,b,x[k+14],17,0xA679438E);b=md5_FF(b,c,d,a,x[k+15],22,0x49B40821);
    a=md5_GG(a,b,c,d,x[k+1],5,0xF61E2562);d=md5_GG(d,a,b,c,x[k+6],9,0xC040B340);c=md5_GG(c,d,a,b,x[k+11],14,0x265E5A51);b=md5_GG(b,c,d,a,x[k+0],20,0xE9B6C7AA);
    a=md5_GG(a,b,c,d,x[k+5],5,0xD62F105D);d=md5_GG(d,a,b,c,x[k+10],9,0x02441453);c=md5_GG(c,d,a,b,x[k+15],14,0xD8A1E681);b=md5_GG(b,c,d,a,x[k+4],20,0xE7D3FBC8);
    a=md5_GG(a,b,c,d,x[k+9],5,0x21E1CDE6);d=md5_GG(d,a,b,c,x[k+14],9,0xC33707D6);c=md5_GG(c,d,a,b,x[k+3],14,0xF4D50D87);b=md5_GG(b,c,d,a,x[k+8],20,0x455A14ED);
    a=md5_GG(a,b,c,d,x[k+13],5,0xA9E3E905);d=md5_GG(d,a,b,c,x[k+2],9,0xFCEFA3F8);c=md5_GG(c,d,a,b,x[k+7],14,0x676F02D9);b=md5_GG(b,c,d,a,x[k+12],20,0x8D2A4C8A);
    a=md5_HH(a,b,c,d,x[k+5],4,0xFFFA3942);d=md5_HH(d,a,b,c,x[k+8],11,0x8771F681);c=md5_HH(c,d,a,b,x[k+11],16,0x6D9D6122);b=md5_HH(b,c,d,a,x[k+14],23,0xFDE5380C);
    a=md5_HH(a,b,c,d,x[k+1],4,0xA4BEEA44);d=md5_HH(d,a,b,c,x[k+4],11,0x4BDECFA9);c=md5_HH(c,d,a,b,x[k+7],16,0xF6BB4B60);b=md5_HH(b,c,d,a,x[k+10],23,0xBEBFBC70);
    a=md5_HH(a,b,c,d,x[k+13],4,0x289B7EC6);d=md5_HH(d,a,b,c,x[k+0],11,0xEAA127FA);c=md5_HH(c,d,a,b,x[k+3],16,0xD4EF3085);b=md5_HH(b,c,d,a,x[k+6],23,0x04881D05);
    a=md5_HH(a,b,c,d,x[k+9],4,0xD9D4D039);d=md5_HH(d,a,b,c,x[k+12],11,0xE6DB99E5);c=md5_HH(c,d,a,b,x[k+15],16,0x1FA27CF8);b=md5_HH(b,c,d,a,x[k+2],23,0xC4AC5665);
    a=md5_II(a,b,c,d,x[k+0],6,0xF4292244);d=md5_II(d,a,b,c,x[k+7],10,0x432AFF97);c=md5_II(c,d,a,b,x[k+14],15,0xAB9423A7);b=md5_II(b,c,d,a,x[k+5],21,0xFC93A039);
    a=md5_II(a,b,c,d,x[k+12],6,0x655B59C3);d=md5_II(d,a,b,c,x[k+3],10,0x8F0CCC92);c=md5_II(c,d,a,b,x[k+10],15,0xFFEFF47D);b=md5_II(b,c,d,a,x[k+1],21,0x85845DD1);
    a=md5_II(a,b,c,d,x[k+8],6,0x6FA87E4F);d=md5_II(d,a,b,c,x[k+15],10,0xFE2CE6E0);c=md5_II(c,d,a,b,x[k+6],15,0xA3014314);b=md5_II(b,c,d,a,x[k+13],21,0x4E0811A1);
    a=md5_II(a,b,c,d,x[k+4],6,0xF7537E82);d=md5_II(d,a,b,c,x[k+11],10,0xBD3AF235);c=md5_II(c,d,a,b,x[k+2],15,0x2AD7D2BB);b=md5_II(b,c,d,a,x[k+9],21,0xEB86D391);
    a=md5_AddUnsigned(a,aa);b=md5_AddUnsigned(b,bb);c=md5_AddUnsigned(c,cc);d=md5_AddUnsigned(d,dd);
  }
  return (md5_WordToHex(a)+md5_WordToHex(b)+md5_WordToHex(c)+md5_WordToHex(d)).toLowerCase();
}

// ---------- 纯 JS Base64 解码 ----------
function sztvB64decode(a) {
  var chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', out='', i=0;
  a = a.replace(/[^A-Za-z0-9+/=]/g,'');
  while (i<a.length) {
    var e1=chars.indexOf(a.charAt(i++)), e2=chars.indexOf(a.charAt(i++));
    var e3=chars.indexOf(a.charAt(i++)), e4=chars.indexOf(a.charAt(i++));
    var c1=(e1<<2)|(e2>>4);
    out += String.fromCharCode(c1);
    if (e3!==-1) { var c2=((e2&15)<<4)|(e3>>2); out+=String.fromCharCode(c2); }
    if (e4!==-1) { var c3=((e3&3)<<6)|e4; out+=String.fromCharCode(c3); }
  }
  return out;
}

// 复刻 LSDPlayer 的 Z()：旋转 + 反转 + Base64 解码
function sztvZ(a) {
  var b = a.length - Math.floor(a.length/2);
  a = a.substr(b) + a.substr(0,b);
  return sztvB64decode(a.split('').reverse().join(''));
}

function sztvGet(url) {
  // 最多重试 2 次（深圳 key 接口偶发超时，mytv 内核无自动重试）
  for (var attempt = 0; attempt < 2; attempt++) {
    try {
      if (SZT_IS_KU9 && typeof ku9.request === 'function') {
        var r = ku9.request(url, 'GET', {});
        if (r && r.body) return r.body + '';
      } else {
        if (typeof mytv !== 'undefined' && typeof mytv.request === 'function') {
          var mr = mytv.request(url, 'GET', [], '', true);
          if (mr && mr.body !== undefined && mr.body !== null && (mr.body + '') !== '') return mr.body + '';
        }
        if (typeof mytv !== 'undefined' && typeof mytv.get === 'function') {
          var g = mytv.get(url, []); if (g) return g + '';
        }
        if (typeof mytv !== 'undefined' && typeof mytv.fetch === 'function') {
          var f = mytv.fetch(url); if (f) return f + '';
        }
      }
    } catch (e) {}
  }
  return '';
}

function sztvGetQuery(url, key) {
  try {
    if (SZT_IS_KU9 && typeof ku9.getQuery === 'function') return ku9.getQuery(url, key);
  } catch (e) {}
  try {
    var m = new RegExp('(?:^|[?&])' + key + '=([^&]*)').exec(url || '');
    return m ? decodeURIComponent(m[1]) : '';
  } catch (e2) {}
  return '';
}

function main(item) {
  var urlArg = (item && item.url) || (typeof item === 'string' ? item : '') || '';
  var id = sztvGetQuery(urlArg, 'id') || '7868';
  var ch = SZT_CH[id];
  if (!ch) {
    return SZT_IS_KU9 ? { url:'', error:'未知频道 id: '+id } : JSON.stringify({ url:'', error:'未知频道 id: '+id });
  }

  var nowSec = Math.floor(Date.now()/1000);
  var token = sztvMd5('' + nowSec + ch.c + SZT_SECRET);
  var api = SZT_KEYAPI + '?t=' + nowSec + '&id=' + ch.c + '&token=' + token + '&at=1';
  var raw = sztvGet(api);
  if (!raw) {
    return SZT_IS_KU9 ? { url:'', error:ch.n+' 取密钥失败' } : JSON.stringify({ url:'', error:ch.n+' 取密钥失败' });
  }
  // 去引号/空白后 Z 解码
  var enc = (raw+'').replace(/^[\s"']+|[\s"']+$/g, '');
  var key = '';
  try { key = sztvZ(enc); } catch (e) {}
  if (!key) {
    return SZT_IS_KU9 ? { url:'', error:ch.n+' 密钥解码失败' } : JSON.stringify({ url:'', error:ch.n+' 密钥解码失败' });
  }

  var path = '/' + ch.c + '/500/' + key + '.m3u8';
  var hexTime = (nowSec + 7200).toString(16);
  var sign = sztvMd5(SZT_SALT + path + hexTime);
  var streamUrl = 'https://' + SZT_SERVER + path + '?sign=' + sign + '&t=' + hexTime;

  if (SZT_IS_KU9) {
    return { url: streamUrl, userAgent: SZT_UA };
  }
  // ★ mytv：用标准 headers 字段带浏览器 UA（深圳 CDN 只认 Mozilla）
  //   不要用 url|User-Agent= 内嵌——JS 源的 url 不走 WebView 的 |Header 解析，会变成畸形 URL
  return JSON.stringify({ url: streamUrl, headers: 'User-Agent: ' + SZT_UA });
}
