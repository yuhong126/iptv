/*
 * 深圳网络广播电视台 JS 直播源（mytv / 酷9 原生）—— v3 诊断版
 * 逆向自 www.sztv.com.cn 官网播放器（dianshi.shtml + pindao/LSDPlayer.js）2026-11-18
 *
 * ★ v3 改动（2026-11-18 17:20）：
 *   1. 加 ?debug=1 诊断模式——把每一步执行结果编码进 error 回报，定位真机卡点。
 *   2. UA 用最短可用值 'Mozilla/5.0'（实测 m3u8+分片都 200；避免长 UA 潜在解析差异）。
 *   3. key 接口返回体完整容错（string / object.body / 带引号）。
 *   4. MD5 优先用 mytv 内置 md5（若可用），回退纯 JS。
 *
 * ★ 链路（每次播放 JS 现场生成，签名实时有效）：
 *   1. token = md5(nowSec + channelCode + "cutvLiveStream|Dream2017")
 *   2. GET https://hls-api.sztv.com.cn/getCutvHlsLiveKey?t=&id=&token=&at=1
 *      → 带引号混淆串，经 sztvZ() 解码得 key
 *   3. path = /<code>/500/<key>.m3u8
 *      sign = md5(salt + path + hexTime)，hexTime=(nowSec+7200).toString(16)
 *      URL = https://sztv-live.sztv.com.cn<path>?sign=&t=
 *   4. ★ CDN 强校验：m3u8 + 每个分片都必须带浏览器 UA（Mozilla），否则 403。
 *      用标准 headers 字段带 'User-Agent: Mozilla/5.0'。
 *
 * 用法: javascript://.../sztv.js?id=7868
 *       加 &debug=1 进入诊断模式（error 字段回报每一步状态）
 */

// ---------- 环境兼容 ----------
var SZT_IS_KU9 = (typeof ku9 !== 'undefined');
var SZT_UA = 'Mozilla/5.0';                       // 最短浏览器 UA（实测够用）
var SZT_SECRET = 'cutvLiveStream|Dream2017';
var SZT_SALT = 'ejow6p6p6hmrm9g96beh2knecdq5kyw9bp0zxyg7';
var SZT_SERVER = 'sztv-live.sztv.com.cn';
var SZT_KEYAPI = 'https://hls-api.sztv.com.cn/getCutvHlsLiveKey';

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

// 诊断缓冲
var SZT_DBG = [];
function sztvD(s) { try { SZT_DBG.push(s); } catch (e) {} }
function sztvDump() { return SZT_DBG.join(' | '); }

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

// ---------- Base64 解码 + Z() ----------
function sztvB64decode(a) {
  var chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', out='', i=0;
  a=a.replace(/[^A-Za-z0-9+/=]/g,'');
  while(i<a.length){
    var e1=chars.indexOf(a.charAt(i++)),e2=chars.indexOf(a.charAt(i++)),e3=chars.indexOf(a.charAt(i++)),e4=chars.indexOf(a.charAt(i++));
    out+=String.fromCharCode((e1<<2)|(e2>>4));
    if(e3!==-1)out+=String.fromCharCode(((e2&15)<<4)|(e3>>2));
    if(e4!==-1)out+=String.fromCharCode(((e3&3)<<6)|e4);
  }
  return out;
}
function sztvZ(a){
  var b=a.length-Math.floor(a.length/2);
  a=a.substr(b)+a.substr(0,b);
  return sztvB64decode(a.split('').reverse().join(''));
}

// ---------- 网络请求：完整容错 ----------
function sztvRaw(url) {
  for (var attempt=0; attempt<3; attempt++) {
    try {
      if (SZT_IS_KU9 && typeof ku9.request==='function') {
        var r=ku9.request(url,'GET',{});
        if (r && r.body) return r.body+'';
      } else if (typeof mytv!=='undefined') {
        if (typeof mytv.request==='function') {
          var mr=mytv.request(url,'GET',[],'',true);
          if (mr!==null && mr!==undefined) {
            if (typeof mr==='string') { if(mr) return mr; }
            else if (typeof mr.body==='string' && mr.body) return mr.body;
            else if (mr.body!==null && mr.body!==undefined && (mr.body+'')!=='') return mr.body+'';
          }
        }
        if (typeof mytv.get==='function'){var g=mytv.get(url,[]);if(g)return g+'';}
        if (typeof mytv.fetch==='function'){var f=mytv.fetch(url);if(f)return f+'';}
      }
    } catch(e){ sztvD('reqErr'+attempt+':'+e.message); }
  }
  return '';
}

function sztvGetQuery(url,key){
  try{if(SZT_IS_KU9&&typeof ku9.getQuery==='function')return ku9.getQuery(url,key);}catch(e){}
  try{var m=new RegExp('(?:^|[?&])'+key+'=([^&]*)').exec(url||'');return m?decodeURIComponent(m[1]):'';}catch(e2){}
  return '';
}

function sztvErr(msg, dbg, isKu9){
  var text = msg + (dbg ? ' 【'+(dbg==='1'?sztvDump():dbg)+'】' : '');
  return isKu9 ? {url:'',error:text} : JSON.stringify({url:'',error:text});
}

function main(item){
  SZT_DBG=[];
  var urlArg=(item&&item.url)||(typeof item==='string'?item:'')||'';
  var dbg=sztvGetQuery(urlArg,'debug');
  var id=sztvGetQuery(urlArg,'id')||'7868';
  sztvD('id='+id);
  var ch=SZT_CH[id];
  if(!ch) return sztvErr('未知频道:'+id, dbg, SZT_IS_KU9);

  var nowSec=Math.floor(Date.now()/1000);
  var token=sztvMd5(''+nowSec+ch.c+SZT_SECRET);
  sztvD('md5='+token.slice(0,8));
  var api=SZT_KEYAPI+'?t='+nowSec+'&id='+ch.c+'&token='+token+'&at=1';
  var raw=sztvRaw(api);
  sztvD('rawLen='+(raw?raw.length:0));
  if(!raw) return sztvErr(ch.n+':key接口空', dbg, SZT_IS_KU9);

  var enc=(raw+'').replace(/^[\s"']+|[\s"']+$/g,'');
  var key='';
  try{key=sztvZ(enc);}catch(e){sztvD('Zerr:'+e.message);}
  sztvD('key='+key);
  if(!key) return sztvErr(ch.n+':key解码失败', dbg, SZT_IS_KU9);

  var path='/'+ch.c+'/500/'+key+'.m3u8';
  var hexTime=(nowSec+7200).toString(16);
  var sign=sztvMd5(SZT_SALT+path+hexTime);
  var streamUrl='https://'+SZT_SERVER+path+'?sign='+sign+'&t='+hexTime;
  sztvD('urlOK');

  // debug 模式：把完整链路状态塞进 error 回报（即使成功），便于真机定位
  if(dbg==='1') return JSON.stringify({url:'',error:'DBG '+sztvDump()+' | URL='+streamUrl});

  if(SZT_IS_KU9) return {url:streamUrl,referer:'https://www.sztv.com.cn/',userAgent:SZT_UA};
  // headers 与四川同结构（Referer + UA），避免宿主对单行 headers 的特殊处理
  return JSON.stringify({url:streamUrl,headers:'Referer: https://www.sztv.com.cn/\nUser-Agent: '+SZT_UA});
}
