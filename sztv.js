/*
 * 深圳网络广播电视台 JS 直播源（mytv / 酷9 原生）—— v6 修复版
 * 逆向自 www.sztv.com.cn 官网播放器 2026-11-18
 *
 * ★★★ v5 → v6 决定性修复（2026-11-18 晚）：
 *   真机实测矩阵（sztv-live.sztv.com.cn）：
 *     m3u8 主请求：带不带 Referer 都 200；
 *     .ts 分片：只要带 Referer（任何写法）就 403，只有纯 UA(Mozilla/5.0) 才 200。
 *   → v4/v5 的 headers 里同时写了 Referer + User-Agent，Referer 杀死分片 → IJK -10000。
 *   → v6 删除 Referer，headers 只保留 User-Agent: Mozilla/5.0。
 *   ★ 同时必须清空 mytv 全局UA/自定义headers（全局 Referer 也会杀分片；全局 Mozilla UA 会害死四川源）。
 *
 * ★ 链路：
 *   path = /<code>/500/<key>.m3u8
 *   URL  = https://sztv-live.sztv.com.cn<path>?sign=&t=  （sign CDN 不校验，保留兼容）
 *   headers 只带 'User-Agent: Mozilla/5.0'（分片唯一硬性要求，绝不能带 Referer）
 *
 * 用法: javascript://.../sztv.js?id=7868
 *       ?id 为频道 id（见 SZT_CH）；加 &debug=1 进真机自测（测m3u8+分片）
 *
 * 兼容：mytv 返回 JSON 字符串 {url,headers}；酷9 返回对象 {url,referer,userAgent}。
 */

// ---------- 环境兼容 ----------
var SZT_IS_KU9 = (typeof ku9 !== 'undefined');
var SZT_UA = 'Mozilla/5.0';                       // CDN 分片硬性要求：必须以此开头
var SZT_SALT = 'ejow6p6p6hmrm9g96beh2knecdq5kyw9bp0zxyg7';
var SZT_SERVER = 'sztv-live.sztv.com.cn';

// code = 官网播放频道码；key = 官网 key 接口返回值（固定）
var SZT_CH = {
  '7868': { n:'深圳都市', c:'ZwxzUXr', k:'p3ujwsz' },
  '7880': { n:'深圳电视剧', c:'4azbkoY', k:'s5rhasb' },
  '7881': { n:'深圳少儿', c:'1SIQj6s', k:'s9rdSsQ' },
  '7869': { n:'深圳移动', c:'wDF6KJ3', k:'g73gDs6' },
  '7944': { n:'深圳国际', c:'sztvgjpd', k:'o17pzsvm' },
  '7867': { n:'深圳卫视', c:'AxeFRth', k:'c67hwsF' },
  '24725': { n:'深圳卫视4K', c:'R77mK1v', k:'g93e7sm' },
  '7878': { n:'宜和购物', c:'BJ5u5k2', k:'n8weJsu' }
};

// ---------- MD5：优先宿主内置，回退纯 JS ----------
function sztvMd5(str) {
  try {
    if (!SZT_IS_KU9 && typeof mytv !== 'undefined' && typeof mytv.md5 === 'function') {
      var h = mytv.md5(str);
      if (h && (h + '').length === 32) return (h + '').toLowerCase();
    }
  } catch (e) {}
  return sztvMd5js(str);
}

function sztvMd5js(str) {
  function R(l,n){return (l<<n)|(l>>>(32-n));}
  function A(x,y){var x8=x&0x80000000,y8=y&0x80000000,x4=x&0x40000000,y4=y&0x40000000,r=(x&0x3fffffff)+(y&0x3fffffff);if(x4&y4)return r^0x80000000^x8^y8;if(x4|y4){if(r&0x40000000)return r^0xc0000000^x8^y8;return r^0x40000000^x8^y8;}return r^x8^y8;}
  function F(x,y,z){return (x&y)|((~x)&z);} function G(x,y,z){return (x&z)|(y&(~z));}
  function H(x,y,z){return (x^y^z);} function I(x,y,z){return (y^(x|(~z)));}
  function FF(a,b,c,d,x,s,ac){return A(R(A(A(a,F(b,c,d)),A(x,ac)),s),b);}
  function GG(a,b,c,d,x,s,ac){return A(R(A(A(a,G(b,c,d)),A(x,ac)),s),b);}
  function HH(a,b,c,d,x,s,ac){return A(R(A(A(a,H(b,c,d)),A(x,ac)),s),b);}
  function II(a,b,c,d,x,s,ac){return A(R(A(A(a,I(b,c,d)),A(x,ac)),s),b);}
  function W(s){var n=s.length,t=n+8,k=(t-t%64)/64,w=(k+1)*16,a=[],bp=0,bc=0,cv,p;while(bc<n){cv=(bc-bc%4)/4;bp=(bc%4)*8;a[cv]=(a[cv]|((s.charCodeAt(bc)&0xff)<<bp));bc++;}cv=(bc-bc%4)/4;bp=(bc%4)*8;a[cv]=a[cv]|(0x80<<bp);a[w-2]=n<<3;a[w-1]=n>>>29;return a;}
  function X(v){var o='',b,i;for(i=0;i<=3;i++){b=(v>>>(i*8))&255;o+=('0'+b.toString(16)).slice(-2);}return o;}
  var x=W(str),a=0x67452301,b=0xefcdab89,c=0x98badcfe,d=0x10325476,aa,bb,cc,dd,k;
  for(k=0;k<x.length;k+=16){
    aa=a;bb=b;cc=c;dd=d;
    a=FF(a,b,c,d,x[k+0],7,0xD76AA478);d=FF(d,a,b,c,x[k+1],12,0xE8C7B756);c=FF(c,d,a,b,x[k+2],17,0x242070DB);b=FF(b,c,d,a,x[k+3],22,0xC1BDCEEE);
    a=FF(a,b,c,d,x[k+4],7,0xF57C0FAF);d=FF(d,a,b,c,x[k+5],12,0x4787C62A);c=FF(c,d,a,b,x[k+6],17,0xA8304613);b=FF(b,c,d,a,x[k+7],22,0xFD469501);
    a=FF(a,b,c,d,x[k+8],7,0x698098D8);d=FF(d,a,b,c,x[k+9],12,0x8B44F7AF);c=FF(c,d,a,b,x[k+10],17,0xFFFF5BB1);b=FF(b,c,d,a,x[k+11],22,0x895CD7BE);
    a=FF(a,b,c,d,x[k+12],7,0x6B901122);d=FF(d,a,b,c,x[k+13],12,0xFD987193);c=FF(c,d,a,b,x[k+14],17,0xA679438E);b=FF(b,c,d,a,x[k+15],22,0x49B40821);
    a=GG(a,b,c,d,x[k+1],5,0xF61E2562);d=GG(d,a,b,c,x[k+6],9,0xC040B340);c=GG(c,d,a,b,x[k+11],14,0x265E5A51);b=GG(b,c,d,a,x[k+0],20,0xE9B6C7AA);
    a=GG(a,b,c,d,x[k+5],5,0xD62F105D);d=GG(d,a,b,c,x[k+10],9,0x02441453);c=GG(c,d,a,b,x[k+15],14,0xD8A1E681);b=GG(b,c,d,a,x[k+4],20,0xE7D3FBC8);
    a=GG(a,b,c,d,x[k+9],5,0x21E1CDE6);d=GG(d,a,b,c,x[k+14],9,0xC33707D6);c=GG(c,d,a,b,x[k+3],14,0xF4D50D87);b=GG(b,c,d,a,x[k+8],20,0x455A14ED);
    a=GG(a,b,c,d,x[k+13],5,0xA9E3E905);d=GG(d,a,b,c,x[k+2],9,0xFCEFA3F8);c=GG(c,d,a,b,x[k+7],14,0x676F02D9);b=GG(b,c,d,a,x[k+12],20,0x8D2A4C8A);
    a=HH(a,b,c,d,x[k+5],4,0xFFFA3942);d=HH(d,a,b,c,x[k+8],11,0x8771F681);c=HH(c,d,a,b,x[k+11],16,0x6D9D6122);b=HH(b,c,d,a,x[k+14],23,0xFDE5380C);
    a=HH(a,b,c,d,x[k+1],4,0xA4BEEA44);d=HH(d,a,b,c,x[k+4],11,0x4BDECFA9);c=HH(c,d,a,b,x[k+7],16,0xF6BB4B60);b=HH(b,c,d,a,x[k+10],23,0xBEBFBC70);
    a=HH(a,b,c,d,x[k+13],4,0x289B7EC6);d=HH(d,a,b,c,x[k+0],11,0xEAA127FA);c=HH(c,d,a,b,x[k+3],16,0xD4EF3085);b=HH(b,c,d,a,x[k+6],23,0x04881D05);
    a=HH(a,b,c,d,x[k+9],4,0xD9D4D039);d=HH(d,a,b,c,x[k+12],11,0xE6DB99E5);c=HH(c,d,a,b,x[k+15],16,0x1FA27CF8);b=HH(b,c,d,a,x[k+2],23,0xC4AC5665);
    a=II(a,b,c,d,x[k+0],6,0xF4292244);d=II(d,a,b,c,x[k+7],10,0x432AFF97);c=II(c,d,a,b,x[k+14],15,0xAB9423A7);b=II(b,c,d,a,x[k+5],21,0xFC93A039);
    a=II(a,b,c,d,x[k+12],6,0x655B59C3);d=II(d,a,b,c,x[k+3],10,0x8F0CCC92);c=II(c,d,a,b,x[k+10],15,0xFFEFF47D);b=II(b,c,d,a,x[k+1],21,0x85845DD1);
    a=II(a,b,c,d,x[k+8],6,0x6FA87E4F);d=II(d,a,b,c,x[k+15],10,0xFE2CE6E0);c=II(c,d,a,b,x[k+6],15,0xA3014314);b=II(b,c,d,a,x[k+13],21,0x4E0811A1);
    a=II(a,b,c,d,x[k+4],6,0xF7537E82);d=II(d,a,b,c,x[k+11],10,0xBD3AF235);c=II(c,d,a,b,x[k+2],15,0x2AD7D2BB);b=II(b,c,d,a,x[k+9],21,0xEB86D391);
    a=A(a,aa);b=A(b,bb);c=A(c,cc);d=A(d,dd);
  }
  return (X(a)+X(b)+X(c)+X(d)).toLowerCase();
}

function sztvGetQuery(url,key){
  try{if(SZT_IS_KU9&&typeof ku9.getQuery==='function')return ku9.getQuery(url,key);}catch(e){}
  try{var m=new RegExp('(?:^|[?&])'+key+'=([^&]*)').exec(url||'');return m?decodeURIComponent(m[1]):'';}catch(e2){}
  return '';
}

// 真机 HTTP 请求（诊断用）：只带 UA，绝不带 Referer
function sztvRequest(url) {
  var hs = ['User-Agent: ' + SZT_UA];
  try {
    if (SZT_IS_KU9 && typeof ku9.request === 'function') {
      var r = ku9.request(url, 'GET', {'User-Agent': SZT_UA});
      return { code: (r && r.code) || 0, body: ((r && r.body) || '') + '' };
    }
  } catch (e) {}
  try {
    if (typeof mytv !== 'undefined') {
      if (typeof mytv.request === 'function') {
        var mr = mytv.request(url, 'GET', hs, '', true);
        var code = 0;
        try { if (mr && mr.code !== undefined) code = mr.code | 0; } catch (e2) {}
        return { code: code, body: ((mr && mr.body) || '') + '' };
      }
      if (typeof mytv.get === 'function') {
        var g = mytv.get(url, hs);
        return { code: g ? 200 : 0, body: (g || '') + '' };
      }
    }
  } catch (e3) {}
  return { code: -1, body: '' };
}

function main(item){
  var urlArg=(item&&item.url)||(typeof item==='string'?item:'')||'';
  var id=sztvGetQuery(urlArg,'id')||'7868';
  var debug=sztvGetQuery(urlArg,'debug')==='1';
  var ch=SZT_CH[id];
  if(!ch) return SZT_IS_KU9 ? {url:'',error:'未知频道:'+id} : JSON.stringify({url:'',error:'未知频道:'+id});

  var path='/'+ch.c+'/500/'+ch.k+'.m3u8';
  var hexTime=(Math.floor(Date.now()/1000)+7200).toString(16);
  var sign=sztvMd5(SZT_SALT+path+hexTime);
  var streamUrl='https://'+SZT_SERVER+path+'?sign='+sign+'&t='+hexTime;

  // ---- 真机自测：实测 m3u8 + 分片，两阶段都只带 UA（定位 -10000）----
  if (debug) {
    var res = sztvRequest(streamUrl);
    var body = res.body || '';
    var hasM3u8 = body.indexOf('#EXTM3U') >= 0;
    var segLine = '', lines = body.split(/\r?\n/);
    for (var i=0;i<lines.length;i++){ var L=lines[i].trim(); if(L && L.charAt(0)!=='#'){ segLine=L; break; } }
    var segCode = 'n/a', segLen = 0, segAbs = '';
    if (segLine) {
      if (segLine.indexOf('http')===0) segAbs = segLine;
      else {
        var slash = streamUrl.lastIndexOf('/');
        segAbs = streamUrl.substring(0, slash+1) + segLine;
      }
      var sres = sztvRequest(segAbs);
      segCode = sres.code; segLen = (sres.body||'').length;
    }
    var head = body.length > 50 ? body.substring(0, 50) : body;
    var msg = 'DBG id=' + id
            + ' | m3u8=' + res.code + '/' + hasM3u8
            + ' | seg=' + segCode + '/' + segLen
            + ' | head=' + head
            + ' | url=' + streamUrl;
    if (SZT_IS_KU9) return { url:'', error: msg };
    return JSON.stringify({ url:'', error: msg });
  }

  // ★ v6 关键修复：headers 只带 UA，绝不带 Referer（Referer 会让分片 403）
  if(SZT_IS_KU9) return {url:streamUrl,userAgent:SZT_UA};
  return JSON.stringify({url:streamUrl,headers:'User-Agent: '+SZT_UA});
}
