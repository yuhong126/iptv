/* ============================================================
 * 吉林台（吉祥新闻网 / 吉林广播电视台）直播源 · mytv / 酷9 通用 JS 源
 *
 * 用法（一行一个台）：
 *   吉林卫视,javascript://<本文件在线地址>?id=1531
 *   都市频道,javascript://<本文件在线地址>?id=1532
 *   ...
 *
 * id 对照（官网 /broadcast/list 的真实频道 id）：
 *   1531 吉林卫视   1532 都市频道   1534 生活频道   1535 影视频道
 *   1536 乡村频道   1538 综艺·文化频道
 *   812402 长春综合   812373 吉林新闻综合   812374 四平新闻综合
 *   812376 辽源新闻综合   812379 通化新闻综合   812383 白山新闻综合
 *   812380 白城新闻综合   812382 松原新闻综合   812244 延边卫视
 *   也可用 0~14 的序号代替 id。
 *
 * 原理：官网接口 clientapi.jlntv.cn/broadcast/list 返回 XXTEA 加密的
 *       频道列表，含真实 m3u8（腾讯云 txSecret 签名，有时效）。本脚本
 *       在客户端实时解密并取出对应频道的播放地址，因此不会过期。
 *       密钥 / 算法与官网前端一致：XXTEA, key=5b28bae827e651b3。
 * ============================================================ */


// ---- base64 兜底（不依赖 window.atob/btoa）----
var JL_B64C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function jlB64decode(str) {
  str = String(str).replace(/[^A-Za-z0-9+/=]/g, '');
  var out = '';
  for (var i = 0; i < str.length; i += 4) {
    var e1 = JL_B64C.indexOf(str.charAt(i));
    var e2 = str.charAt(i+1) === '=' ? -2 : JL_B64C.indexOf(str.charAt(i+1));
    var e3 = str.charAt(i+2) === '=' ? -2 : JL_B64C.indexOf(str.charAt(i+2));
    var e4 = str.charAt(i+3) === '=' ? -2 : JL_B64C.indexOf(str.charAt(i+3));
    out += String.fromCharCode((e1 << 2) | ((e2 & 63) >> 4));
    if (e3 !== -2) out += String.fromCharCode(((e2 & 15) << 4) | ((e3 & 63) >> 2));
    if (e4 !== -2) out += String.fromCharCode(((e3 & 3) << 6) | (e4 & 63));
  }
  return out;
}
function jlB64encode(bin) {
  var out = '';
  for (var i = 0; i < bin.length; i += 3) {
    var c1 = bin.charCodeAt(i);
    var c2 = i+1 < bin.length ? bin.charCodeAt(i+1) : 0;
    var c3 = i+2 < bin.length ? bin.charCodeAt(i+2) : 0;
    out += JL_B64C.charAt(c1 >> 2);
    out += JL_B64C.charAt(((c1 & 3) << 4) | (c2 >> 4));
    out += i+1 < bin.length ? JL_B64C.charAt(((c2 & 15) << 2) | (c3 >> 6)) : '=';
    out += i+2 < bin.length ? JL_B64C.charAt(c3 & 63) : '=';
  }
  return out;
}
var JL_ATOB = (typeof atob === 'function') ? atob :
              (typeof window !== 'undefined' && window.atob) ? window.atob.bind(window) : jlB64decode;
var JL_BTOA = (typeof btoa === 'function') ? btoa :
              (typeof window !== 'undefined' && window.btoa) ? window.btoa.bind(window) : jlB64encode;

var JLXX={};
(function(t){var e=!0;try{String.fromCharCode.apply(String,new Uint8Array([1,2]))}catch{e=!1,Object.defineProperty(Array.prototype,"subarray",{value:Array.prototype.slice})}var n=2654435769;function r(S,j){var k=S.length,N=k<<2;if(j){var A=S[k-1];if(N-=4,A<N-3||A>N)return null;N=A}for(var P=new Uint8Array(N),I=0;I<N;++I)P[I]=S[I>>2]>>((I&3)<<3);return P}function a(S,j){var k=S.length,N=k>>2;(k&3)!==0&&++N;var A;j?(A=new Uint32Array(N+1),A[N]=k):A=new Uint32Array(N);for(var P=0;P<k;++P)A[P>>2]|=S[P]<<((P&3)<<3);return A}function i(S){return S&4294967295}function o(S,j,k,N,A,P){return(k>>>5^j<<2)+(j>>>3^k<<4)^(S^j)+(P[N&3^A]^k)}function l(S){if(S.length<16){var j=new Uint8Array(16);j.set(S),S=j}return S}function u(S,j){var k=S.length,N=k-1,A,P,I,w,O,x;for(P=S[N],I=0,x=Math.floor(6+52/k)|0;x>0;--x){for(I=i(I+n),w=I>>>2&3,O=0;O<N;++O)A=S[O+1],P=S[O]=i(S[O]+o(I,A,P,O,w,j));A=S[0],P=S[N]=i(S[N]+o(I,A,P,N,w,j))}return S}function s(S,j){var k=S.length,N=k-1,A,P,I,w,O,x;for(A=S[0],x=Math.floor(6+52/k),I=i(x*n);I!==0;I=i(I-n)){for(w=I>>>2&3,O=N;O>0;--O)P=S[O-1],A=S[O]=i(S[O]-o(I,A,P,O,w,j));P=S[N],A=S[0]=i(S[0]-o(I,A,P,0,w,j))}return S}function c(S){for(var j=S.length,k=new Uint8Array(j*3),N=0,A=0;A<j;A++){var P=S.charCodeAt(A);if(P<128)k[N++]=P;else if(P<2048)k[N++]=192|P>>6,k[N++]=128|P&63;else if(P<55296||P>57343)k[N++]=224|P>>12,k[N++]=128|P>>6&63,k[N++]=128|P&63;else{if(A+1<j){var I=S.charCodeAt(A+1);if(P<56320&&56320<=I&&I<=57343){var w=((P&1023)<<10|I&1023)+65536;k[N++]=240|w>>18,k[N++]=128|w>>12&63,k[N++]=128|w>>6&63,k[N++]=128|w&63,A++;continue}}throw new Error("Malformed string")}}return k.subarray(0,N)}function f(S,j){for(var k=new Array(j),N=0,A=0,P=S.length;N<j&&A<P;N++){var I=S[A++];switch(I>>4){case 0:case 1:case 2:case 3:case 4:case 5:case 6:case 7:k[N]=I;break;case 12:case 13:if(A<P)k[N]=(I&31)<<6|S[A++]&63;else throw new Error("Unfinished UTF-8 octet sequence");break;case 14:if(A+1<P)k[N]=(I&15)<<12|(S[A++]&63)<<6|S[A++]&63;else throw new Error("Unfinished UTF-8 octet sequence");break;case 15:if(A+2<P){var w=((I&7)<<18|(S[A++]&63)<<12|(S[A++]&63)<<6|S[A++]&63)-65536;if(0<=w&&w<=1048575)k[N++]=w>>10&1023|55296,k[N]=w&1023|56320;else throw new Error("Character outside valid Unicode range: 0x"+w.toString(16))}else throw new Error("Unfinished UTF-8 octet sequence");break;default:throw new Error("Bad UTF-8 encoding 0x"+I.toString(16))}}return N<j&&(k.length=N),String.fromCharCode.apply(String,k)}function d(S,j){for(var k=[],N=new Array(32768),A=0,P=0,I=S.length;A<j&&P<I;A++){var w=S[P++];switch(w>>4){case 0:case 1:case 2:case 3:case 4:case 5:case 6:case 7:N[A]=w;break;case 12:case 13:if(P<I)N[A]=(w&31)<<6|S[P++]&63;else throw new Error("Unfinished UTF-8 octet sequence");break;case 14:if(P+1<I)N[A]=(w&15)<<12|(S[P++]&63)<<6|S[P++]&63;else throw new Error("Unfinished UTF-8 octet sequence");break;case 15:if(P+2<I){var O=((w&7)<<18|(S[P++]&63)<<12|(S[P++]&63)<<6|S[P++]&63)-65536;if(0<=O&&O<=1048575)N[A++]=O>>10&1023|55296,N[A]=O&1023|56320;else throw new Error("Character outside valid Unicode range: 0x"+O.toString(16))}else throw new Error("Unfinished UTF-8 octet sequence");break;default:throw new Error("Bad UTF-8 encoding 0x"+w.toString(16))}if(A>=32767-1){var x=A+1;N.length=x,k.push(String.fromCharCode.apply(String,N)),j-=x,A=-1}}return A>0&&(N.length=A,k.push(String.fromCharCode.apply(String,N))),k.join("")}function v(S){if(!S)return"\u5BC6\u94A5\u9519\u8BEF";var j=S.length;return j===0?"":j<32767?f(S,j):d(S,j)}function p(S){for(var j=S.length,k=new Array(S.length),N=0;N<j;++N)k[N]=S[N];return k}function h(S){var j=S.length;if(j===0)return"";var k=e?S:p(S);if(j<65535)return String.fromCharCode.apply(String,k);for(var N=j&32767,A=j>>15,P=new Array(N?A+1:A),I=0;I<A;++I)P[I]=String.fromCharCode.apply(String,k.subarray(I<<15,I+1<<15));return N&&(P[A]=String.fromCharCode.apply(String,k.subarray(A<<15,j))),P.join("")}function m(S){for(var j=JL_ATOB(S),k=j.length,N=new Uint8Array(k),A=0;A<k;A++)N[A]=j.charCodeAt(A);return N}function y(S,j){return typeof S=="string"&&(S=c(S)),typeof j=="string"&&(j=c(j)),S==null||S.length===0?S:r(u(a(S,!0),a(l(j),!1)),!1)}function C(S,j){return JL_BTOA(h(y(S,j)))}function _(S,j){return typeof S=="string"&&(S=m(S)),typeof j=="string"&&(j=c(j)),S==null||S.length===0?S:r(s(a(S,!1),a(l(j),!1)),!0)}function D(S,j){return v(_(S,j))}t.XXTEA=Object.create(null,{toBytes:{value:c},toString:{value:v},encrypt:{value:y},encryptToString:{value:C},decrypt:{value:_},decryptToString:{value:D}})})(typeof JLXX!=="undefined"?JLXX:(JLXX={}))

var JL_KEY = '5b28bae827e651b3';
var JL_API = 'https://clientapi.jlntv.cn/broadcast/list?page=1&size=10000&type=1';
var JL_UA  = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

// 频道顺序（序号 -> 频道id），供用序号调用时对照
var JL_IDS = [1531,1532,1534,1535,1536,1538,812402,812373,812374,812376,812379,812383,812380,812382,812244];

function jlGetKey(item) {
  var k = '';
  if (item && item.id !== undefined && item.id !== null && String(item.id) !== '') {
    k = String(item.id);
  } else if (typeof ku9 !== 'undefined' && ku9.getQuery && item && item.url) {
    k = String(ku9.getQuery(item.url, 'id') || '');
  }
  return k;
}

function jlMatch(list, key) {
  var i;
  // 先按频道 id 精确匹配
  for (i = 0; i < list.length; i++) {
    if (String(list[i].id) === key) return list[i];
  }
  // 再按标题匹配
  for (i = 0; i < list.length; i++) {
    if (list[i].title === key) return list[i];
  }
  // 纯数字当序号
  if (/^\d+$/.test(key)) {
    var n = parseInt(key, 10);
    if (n >= 0 && n < list.length) return list[n];
  }
  return null;
}

function main(item) {
  var key = jlGetKey(item);
  if (typeof ku9 === 'undefined' || typeof ku9.request !== 'function') {
    return { url: '当前播放器不支持 JS 源（缺少 ku9.request），请升级到新版 mytv' };
  }
  if (!JLXX || !JLXX.XXTEA) {
    return { url: '解密模块未就绪' };
  }

  var res = null;
  try {
    res = ku9.request(JL_API, 'GET', {
      'User-Agent': JL_UA,
      'Client-Type': 'web',
      'accept': 'iapplication/json, text/plain, */*,image/webp',
      'Content-Type': 'application/json',
      'Origin': 'https://www.jlntv.cn',
      'Referer': 'https://www.jlntv.cn/'
    }, null);
  } catch (e) {
    return { url: '请求吉林接口失败：' + String(e).substring(0, 60) };
  }
  if (!res || !res.body) return { url: '吉林接口返回为空' };

  var plain = '';
  try {
    var body = res.body;
    if (typeof body !== 'string') body = String(body == null ? '' : body);
    body = body.trim();
    // 官网响应可能是: "密文" 或 {"code":0,"data":"密文",...}
    if (body.charAt(0) === '{') {
      try {
        var wrap = JSON.parse(body);
        if (wrap && wrap.data && typeof wrap.data === 'string') body = wrap.data;
      } catch (e0) {}
    } else if (body.charAt(0) === '"') {
      try { body = JSON.parse(body); } catch (e2) {}
    }
    plain = JLXX.XXTEA.decryptToString(body, JL_KEY);
  } catch (e3) {
    return { url: '解密失败：' + String(e3).substring(0, 60) };
  }

  var j;
  try { j = JSON.parse(plain); } catch (e4) {
    return { url: '解析频道列表失败：' + plain.substring(0, 60) };
  }
  var list = j && j.data;
  if (!list || !list.length) return { url: '频道列表为空' };

  var ch = jlMatch(list, key) || list[0];
  var url = ch.data && ch.data.streamUrl ? ch.data.streamUrl : '';
  if (!url) return { url: ch.title + ' 无播放地址' };

  return {
    url: url,
    headers: {
      'User-Agent': JL_UA,
      'Referer': 'https://www.jlntv.cn/'
    }
  };
}
