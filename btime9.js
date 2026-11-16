/* ============================================================
 * 北京台(BRTV)直播 · mytv / 酷9 原生 JS 源  (v9 —— 游客 usid + IPv4 直连)
 *
 * 用法（一行一个台），id 用英文码或官网 32 位 pid：
 *   北京卫视,javascript://<本文件在线地址>?id=bjws
 *   北京财经,javascript://<本文件在线地址>?id=bjcj
 *   北京卡酷少儿,javascript://<本文件在线地址>?id=bjkk
 *   ...（详见下方 CHANNELS）
 *
 * ===== v9 修复 v8 真机 line:null 的两个致命问题 =====
 * 1) v8 用了 pc.api.btime.com 原域名 —— 该域名 AAAA 是【电信 IPv6】，
 *    移动网用户优先连电信 IPv6 会挂死(脚本无返回=line:null)。v9 改回
 *    直连移动 IPv4 111.32.153.124/.126 + Host 头(沿用曾验证的 v6 方案)。
 * 2) v8 每次先 GET 官网首页试图自动刷新 usid —— 真机上这次请求也会挂死。
 *    v9 去掉该步，直接用内置游客 usid，支持 ?usid= 手动覆盖。
 *
 * 【核心原理】别人 PHP 源(Doubebly)的逻辑：
 *   sign = md5(pid + "151" + 秒级时间戳 + "TtJSg@2g*$K4PjUH") 取前 8 位
 *   接口返回 video_stream[0].stream_url = base64(base64(真m3u8反转))
 *   关键：必须【完整浏览器 UA】+【游客 usid Cookie】才能拿到 brtv-play 可播线路；
 *        短 UA 只能拿到 hsplay-360(CDN 403)；完整UA+无usid → 401。
 *   usid 不是登录态，是官网游客标识，不绑 IP/会话，约 2 个月有效。
 * ============================================================ */

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
var SECRET = 'TtJSg@2g*$K4PjUH';
var HOME = 'https://www.btime.com/';
// 内置游客 usid（2026-11-16 采集，约 2 个月有效；失效用 ?usid= 覆盖）
var DEFAULT_USID = 'a38f8f4bf91f57ce52175657ca4aeac0';

var CHANNELS = {
  bjws:   '573ib1kp5nk92irinpumbo9krlb', // 北京卫视
  bjws4k: '5755n511tbk8flo40l4c71l0sdf', // 北京卫视4K超高清
  bjwy:   '54db6gi5vfj8r8q1e6r89imd64s', // 北京文艺
  bjjs:   '53bn9rlalq08lmb8nf8iadoph0b', // 北京纪实科教
  bjys:   '50mqo8t4n4e8gtarqr3orj9l93v', // 北京影视
  bjcj:   '50e335k9dq488lb7jo44olp71f5', // 北京财经
  bjty:   '54hv0f3pq079d4oiil2k12dkvsc', // 北京体育休闲
  bjsh:   '50j015rjrei9vmp3h8upblr41jf', // 北京生活
  bjxw:   '53gpt1ephlp86eor6ahtkg5b2hf', // 北京新闻
  bjkk:   '55skfjq618b9kcq9tfjr5qllb7r'  // 北京卡酷少儿
};

/* ---- MD5：优先用 ku9.md5，缺失则用内置纯 JS 实现（复用江西台已验证版本）---- */
function btMd5(s) {
  if (typeof ku9 !== 'undefined' && ku9 && typeof ku9.md5 === 'function') {
    try { return ku9.md5(s); } catch (e) { /* 落到内置 */ }
  }
  return btMd5Impl(s);
}
var BT_K = [
  0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
  0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
  0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
  0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
  0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
  0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
  0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
  0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391
];
var BT_S = [
  7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
  5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
  4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
  6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21
];
function btUtf8(s) {
  var o='',i,c,c2,u; s=String(s);
  for(i=0;i<s.length;i++){c=s.charCodeAt(i);
    if(c<0x80)o+=String.fromCharCode(c);
    else if(c<0x800)o+=String.fromCharCode(0xc0|(c>>6),0x80|(c&63));
    else if(c<0xd800||c>=0xe000)o+=String.fromCharCode(0xe0|((c>>12)&15),0x80|((c>>6)&63),0x80|(c&63));
    else{i++;c2=s.charCodeAt(i);u=0x10000+((c&0x3ff)<<10)+(c2&0x3ff);o+=String.fromCharCode(0xf0|((u>>18)&7),0x80|((u>>12)&63),0x80|((u>>6)&63),0x80|(u&63));}
  } return o;
}
function btHexLE(n){var s='',i,b;for(i=0;i<4;i++){b=(n>>>(i*8))&255;s+=(b<16?'0':'')+b.toString(16);}return s;}
function btMd5Impl(text) {
  var s=btUtf8(text), n=s.length, i, blk;
  var blocks=Math.ceil((n+9)/64), total=blocks*16, w=[];
  for(i=0;i<total;i++)w[i]=0;
  for(i=0;i<n;i++)w[i>>2]|=s.charCodeAt(i)<<((i%4)*8);
  w[n>>2]|=0x80<<((n%4)*8);
  var bitLen=n*8;
  w[total-2]=bitLen&0xffffffff;
  w[total-1]=Math.floor(bitLen/4294967296);
  var a0=1732584193,b0=-271733879,c0=-1732584194,d0=271733878;
  var a,b,c,d,f,g,tmp,sum,k,t;
  for(k=0;k<total;k+=16){
    a=a0;b=b0;c=c0;d=d0;
    for(i=0;i<64;i++){
      if(i<16){f=(b&c)|(~b&d);g=i;}
      else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16;}
      else if(i<48){f=b^c^d;g=(3*i+5)%16;}
      else{f=c^(b|~d);g=(7*i)%16;}
      tmp=d;d=c;c=b;
      sum=(a+f+BT_K[i]+w[k+g])|0;
      t=BT_S[i];
      b=(b+((sum<<t)|(sum>>>(32-t))))|0;
      a=tmp;
    }
    a0=(a0+a)|0;b0=(b0+b)|0;c0=(c0+c)|0;d0=(d0+d)|0;
  }
  return btHexLE(a0)+btHexLE(b0)+btHexLE(c0)+btHexLE(d0);
}

/* ---- 纯 JS 双层 base64 解码 ---- */
function b64decode(s) {
  var ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var out = '', buf = 0, bits = 0, i, c;
  s = String(s).replace(/[^A-Za-z0-9+/=]/g, '');
  for (i = 0; i < s.length; i++) {
    if (s.charAt(i) === '=') break;
    c = ABC.indexOf(s.charAt(i));
    if (c < 0) break;
    buf = (buf << 6) | c; bits += 6;
    if (bits >= 8) { bits -= 8; out += String.fromCharCode((buf >> bits) & 0xFF); }
  }
  return out;
}

function main(item) {
  if (typeof ku9 === 'undefined' || !ku9 || typeof ku9.request !== 'function') {
    return { url: '当前播放器不支持 JS 源（缺少 ku9.request），请升级到新版 mytv' };
  }
  var uri = (item && item.url) ? item.url : '';
  function q(n) { try { return (typeof ku9.getQuery === 'function') ? ku9.getQuery(uri, n) : ''; } catch (e) { return ''; } }
  var key = q('id') || ((item && item.id !== undefined && item.id !== null) ? String(item.id) : '');
  var overrideUsid = q('usid');
  var pid = CHANNELS[key] || (/^[0-9a-z]{20,40}$/.test(key) ? key : CHANNELS.bjws);
  var usid = (/^[0-9a-f]{32}$/.test(overrideUsid) ? overrideUsid : DEFAULT_USID);

  var ts = Math.floor((new Date()).getTime() / 1000);
  var t2 = (new Date()).getTime();

  // 端点：直连移动 IPv4 + Host 头，绕开电信 IPv6 挂死；末尾保留域名兜底
  var endpoints = [
    'https://111.32.153.124',
    'https://111.32.153.126',
    'https://pc.api.btime.com.'
  ];
  var headers = {
    'Host': 'pc.api.btime.com',
    'User-Agent': UA,
    'Referer': HOME,
    'Cookie': 'usid=' + usid + '; lf=1;',
    'Accept': '*/*'
  };

  var body = '', last = '';
  for (var ep = 0; ep < endpoints.length && !body; ep++) {
    for (var attempt = 0; attempt < 2 && !body; attempt++) {
      var useTs = ts - attempt;
      var useSign = btMd5(pid + '151' + useTs + SECRET).slice(0, 8);
      var useUrl = endpoints[ep] + '/video/play?from=pc&id=' + pid + '&type_id=151&timestamp=' + useTs + '&sign=' + useSign + '&_=' + t2;
      // 域名兜底项不需要 Host 头，用其自身
      var h = {}; for (var kk in headers) h[kk] = headers[kk];
      if (endpoints[ep].indexOf('pc.api.btime.com') >= 0) delete h['Host'];
      var resp = null;
      try { resp = ku9.request(useUrl, 'GET', h, null); }
      catch (e) { last = String(e); continue; }
      if (!resp || !resp.body) continue;
      last = String(resp.body);
      if (last.indexOf('"errno"') < 0) continue;
      var j = null;
      try { j = JSON.parse(last.replace(/^jQuery[^(]*\(/, '').replace(/\)\s*;?\s*$/, '')); } catch (e2) { continue; }
      if (j && j.errno === 0 && j.data && j.data.video_stream && j.data.video_stream[0] && j.data.video_stream[0].stream_url) {
        body = j.data.video_stream[0].stream_url;
      }
    }
  }

  if (!body) return { url: '北京台取流失败: ' + last.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').substring(0, 60) };

  var stream = String(body);
  if (stream.indexOf('http') !== 0) {
    try { stream = stream.split('').reverse().join(''); stream = b64decode(b64decode(stream)); }
    catch (e3) { return { url: '流地址解码失败' }; }
  }
  if (stream.indexOf('http') !== 0) return { url: '解码结果异常' };

  return {
    url: stream,
    referer: HOME,
    userAgent: UA,
    headers: { 'Referer': HOME, 'User-Agent': UA, 'Origin': 'https://www.btime.com' }
  };
}
