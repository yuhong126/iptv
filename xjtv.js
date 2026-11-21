/* ============================================================
 * 新疆广播电视台 / 丝路视听 (xjtvs.com.cn) · mytv 直播源  [修复版]
 * 基于 mytv 官方 xj.js，修复官网 2026-11 签名协议升级导致的
 * 「签名Token已失效 / 播放不了」。
 *
 * 用法：
 *   新疆卫视,javascript://<本文件地址>?id=xjws
 *   新疆维语新闻,javascript://<本文件地址>?id=xjwyzh
 *   新疆哈语新闻,javascript://<本文件地址>?id=xjhyzh
 *   新疆综艺,javascript://<本文件地址>?id=xjzy
 *   新疆维语影视,javascript://<本文件地址>?id=xjwyys
 *   新疆体育健康,javascript://<本文件地址>?id=xjtyjk
 *   新疆少儿,javascript://<本文件地址>?id=xjse
 *
 * 修复点：官网新增 PoW(x/ts/hash) 参数 + token/guid 变形签名；
 * 盐值表换成官网 xjtvs 前端当前在用的一套（60 组，含今日）。
 * 5 个在播频道实测 m3u8+TS 200（综艺/维语影视官网自身停播）。
 * ============================================================ */

var XJ_API = 'https://slstapi.xjtvs.com.cn/';
var XJ_PATH = 'api/TVLiveV100/TVChannelList';
var XJ_REFER = 'https://www.xjtvs.com.cn/';
var XJ_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var XJ_HEADERS = ['User-Agent: ' + XJ_UA, 'Referer: ' + XJ_REFER, 'Origin: https://www.xjtvs.com.cn'];

/* 官网频道 id（与作者版一致）*/
var XJ_CH = { xjws:1, xjwyzh:3, xjhyzh:4, xjzy:16, xjwyys:17, xjtyjk:21, xjse:23 };

/* RSA 公钥模数（官网与作者版相同）*/
var XJ_RSA_N = '93f5c257ac8165333db25963657ab9ff69fd74c1a4b6a7013e84c5d45f378ceef162b7550d5179f4013d9175eccb5d3d3f6dcaf4fd0f6889a69be059f7e798536538afa92283aeafbd22792e79083a96fcfe0fec4d64491aee2287aa4511077058d8f862e050887458d5ac868e230889c9ab580f42657fdab6937c8ec0c408ee224736b791efb9ceb702254827ac2001cfa3c7fd26916e1f30469a863248d07801e261daba7ab22f2325a17fdacb34e2b64d8147414d493b6b4159060beaa0b5eaa97043c9110116d0a66201037ecb9d460251d03803ace70df9a40c4422f66827723ca3e7dd553d6a5fd91ca72e4dd22600c214f1d51acc0e36533a949396d7';
var XJ_RSA_E = 65537n;

/* 官网盐值表 [日期, random_string, random_number]，2026-10-20 ~ 2026-12-18 */
var XJ_SALT = [
['2026-10-20','ZUpQd5v2wpzrJTPfXlOUZJ8RM4AdEVK6qzxx9ttEbmngsvZ3',11],
['2026-10-21','UJLGgK0wJanqnkDPgsSHxB9JEYbi8rbZ6HNpe3JSLaH5o460',18],
['2026-10-22','gRicTBG4eRYjwYvXC7PfH5RlToFZIvEtW56oPKOtYms6zGnl',11],
['2026-10-23','lsTeVBYqgO6Yrxu9BC9ELW20QihIRpjvlKhEErwZAAJv8Sr4',15],
['2026-10-24','n0XTqMgUcbCVuTuIzUGO5MI7Y5eT7D1MDOR9VYw71wYtNIP5',28],
['2026-10-25','akqt922t333TsCw4NuRyxcAPPDymRUIazLnnyIh8r9akDS31',4],
['2026-10-26','EuqIcfHLAxFCL2pdkCfu1fhwWZqsYIktXMSpQA3ltAiSsam1',21],
['2026-10-27','R76TXiQ0GU0t9Zg1gWRs8GnK8LRTSTVUK41El51Op8Mv1D0l',17],
['2026-10-28','mqfVRL5f49fWQvRG4hMJnxloCEv4CkCEGX44WomDIWC7UqmK',21],
['2026-10-29','2KuhMmc1e1KUH7CuaiBwKjTfIjDJ0v51YujGAZcUXNN2fQol',19],
['2026-10-30','gNgT7Kx9eAXFnt1oyFm8XPdBvz1rjkTA3RR2OpgJKnnsAWuk',3],
['2026-10-31','ib0kFh6Nht6jFviD5S4wuzpbvpJg7slzXK7rrIgHQMt0q8mU',10],
['2026-11-01','NLxqgRpeACUmLUeXAbfDCVBbF4YTzmAh3uhoBMF4D2gkbTUH',14],
['2026-11-02','6wNGhl86AiJVUqs0xKXAiIvNC6Mf1BFig9AgxebYY3BmLnZl',1],
['2026-11-03','zbl8uWLSpcpGdo7GjfDzZsJxHTFEPNM5dqDbmQWaYBjs2VXH',20],
['2026-11-04','ralGlnwkX8q0uP2xp8qUYeqbOlrPZ0vZwmOMmWVZOb0XEfnw',2],
['2026-11-05','WvK1qBNU9R4ZV7NNmhi6ixU2BBd3ZLFkEJmoQ5nduLPpvZCY',4],
['2026-11-06','eo5LEHNhbYk66ncf5waswxI5EUtTimhDu4vMjDOxpqcWKmaj',19],
['2026-11-07','rXr4AmZDpCeAmqrzIAqfRyVWlodeRwP68kgdWS7493PI79ra',24],
['2026-11-08','LZLDNTAc5SkYYctJ791LJpb4tNfJZoVALfHDJP9mdzKU8NGr',17],
['2026-11-09','9fTQlftxcjtqK2k6LdtqVXws0oprmERPLJIqHdPOVjD34GGr',26],
['2026-11-10','4W3pE2NkTQnppwzZFlIoYRrxTBWyQB9R270ySE1clf5vfANu',7],
['2026-11-11','X2Cgr8Q22uKN9LdoSxUdTbjGzoSc1Zr13bQxr3nKbUSKbfvf',1],
['2026-11-12','Vm9dNqmmCHROaeX8QJCeW4caxERFppwWTTcFootGQIUugNVq',13],
['2026-11-13','oGQzwLTqc3nrieLYYDcyljHrCuClQ11Gn7UFXh6XmVVrmM81',23],
['2026-11-14','e57uQjDRhCnK4ZhyWf107pJ4EUlXoPTsonbO7MYgG6q9msel',20],
['2026-11-15','l0DRAc0QbIZo52SVZclPGOGVk9Ln36Rja9QzuDnuIApzbePf',2],
['2026-11-16','ZKCNPBewB9KAImYaXcTXQ0El6qZnqYo04GTRUmSpBKBOh2EW',20],
['2026-11-17','t4Q9OJgMI2aHKTVLNQK0TQikpwSZYxyofmMHjrxrUhWQeLaT',3],
['2026-11-18','hcNBpoYkYpmkLHwmvz3ooY71hyKD2xrfSgKiPqUdVQ34SaCp',14],
['2026-11-19','4rbAkiAIjUSbbF3AmU0jDfaki4ACRobsFYsRBNuajOMpI1Tx',11],
['2026-11-20','xr9pJcfeZd8tieMvMVhUtSH8holhCI03tecxC1ru57noQZpv',16],
['2026-11-21','oYzyM2yZZwTk4wK3yYqrJIRiTzQQIRu7Dwjluc0AnKUiieOX',30],
['2026-11-22','yGDwvCgUajdqVI6nD0q095AddnNyuNpi7vsLZP0pAXHVONQe',11],
['2026-11-23','IvHH5wyYIo01YGHMv1PTkC3aZDyFytjKlRXZJRVDbQNET73n',5],
['2026-11-24','tx3ptorDqrOT7HPV5stBiKXQuPmuO9myAYlBuySmyxxZJoNj',1],
['2026-11-25','hNzaF6wFrL0DxcBevsEKFEOAZ52jcHdhy67nYPHFW97So4qC',3],
['2026-11-26','12C1dz596Rcornl8e2HkqHnLv6esalZfTablFvQHdvVYZYQy',24],
['2026-11-27','iw6gRHADkOoWiWqK2vXN3b6pghRrTx8WHiofOFUYWIc3rJwo',17],
['2026-11-28','RBCkNo9E98XZYrCzBYF4VZyojQdEDTO5rvUfgCn1mZ8V1SVy',29],
['2026-11-29','sQYsBTI9G4eZj3Lt10lZOOK9a7Wg30ECKKKsFKBbAdZwT07U',3],
['2026-11-30','kzVJV0LlSLXIJXFAgGdgEV5FbbUjyyAXfasiPprtxIdWky2e',22],
['2026-12-01','pJ7cYRbQi3pofxS7o7I8bv8W0R2ohMnXKmkNDarjcnyLSqho',26],
['2026-12-02','Rype1Hs2oCIj3hqGMZLj9R63UUgH3234ZZMCIx5BWYFKHDGI',17],
['2026-12-03','olhoU7GCLJDvpCoglRvI6FV52MW6YsKJ0HkNQVtWoImolK00',27],
['2026-12-04','P41UjeCBd0EBFKcSNzVTOKGzc49UJdwls1WuSRFDMKijoulZ',8],
['2026-12-05','JQcumI8fnG9dCk16vaUY0xfR2P2Q2Gei9bb72bTZLiEMSae8',22],
['2026-12-06','M7Lk4akMwBEkKQXfirAPYCstJiW0HfGcArtC8ete2UhFggvo',14],
['2026-12-07','EwHrGmXYry3IC0Ad0rfwmYqEXNfzvXhJL40qITb9A5c76Jjf',12],
['2026-12-08','F2IwTeTAwfpIqXvxJOvHMTrRmSZrfNhVIhgA4FrHHn4DzppU',25],
['2026-12-09','Unwz4F590OuBd4jVOxRS9JHF63QiMzK71h069zu7674xClNx',6],
['2026-12-10','QLbm7WBwdWFCFwrVnhYRGw7LwXvXU6gSjA4w1IgwXmeeMyqY',25],
['2026-12-11','6c1TnKfvJZa9zkGzmBBf6LxoRJ4eCTOIpsPDn5xkpI680PSk',21],
['2026-12-12','PLodh63pcNw0evefQl9BKd1DOW54rgbaHsOhjUyGEtxQUj7m',11],
['2026-12-13','qb0BvMiiWnn2dMRHl25TB6WYesxyDKCZDxpwSgBjm6PCBDdB',11],
['2026-12-14','3BkWcINUwNBJXaw4pLzj1yhlJNB91NRoGRlFg53l5ACARb8c',8],
['2026-12-15','RXPkWWVqDrbdtQ5L2Ws5PC1k3N19oRcWf8LTEDt1xfi1zii3',16],
['2026-12-16','92VXJNaE503Ej4eENvLmEIqK2jQHocA1mGREynUd5cV1ZZ6O',22],
['2026-12-17','a3hU2lxNqsy9G0IWW3tfDnYXueumZS2VjLpYsBfRsq79i0S2',24],
['2026-12-18','IfVapMfI0Zpilh2iITBvFAr07FGVVZLFq51RVl2PZR9TpGMP',29]
];

/* 北京日期 YYYY-MM-DD */
function xjDate(){
  var d = new Date(Date.now() + 8*3600*1000);
  var m = d.getUTCMonth()+1, day = d.getUTCDate();
  return d.getUTCFullYear()+'-'+(m<10?'0':'')+m+'-'+(day<10?'0':'')+day;
}
/* 按日期取盐值：命中当天；否则取 <= 今天的最近一条；再否则取第一条 */
function xjGetSalt(){
  var date = xjDate(), pick = XJ_SALT[0];
  for (var i=0;i<XJ_SALT.length;i++){
    if (XJ_SALT[i][0] === date) return XJ_SALT[i];
    if (XJ_SALT[i][0] <= date) pick = XJ_SALT[i];
  }
  return pick;
}
/* token = random_string 去掉第 num 位 */
function xjToken(saltRow){
  var s = saltRow[1], n = saltRow[2];
  return s.substring(0,n) + s.substring(n+1);
}
/* BigInt 模幂 */
function xjModPow(b,e,m){
  var r=1n; b%=m;
  while(e>0n){ if(e&1n) r=r*b%m; b=b*b%m; e>>=1n; }
  return r;
}
/* RSA PKCS#1 v1.5 加密 -> base64（与官网/作者版一致）*/
function xjRsaB64(text){
  var bytes=[];
  for(var i=0;i<text.length;i++) bytes.push(text.charCodeAt(i)&255);
  var KEYLEN=XJ_RSA_N.length/2;  // 256
  var buf=[0,2];  // PKCS#1 v1.5 类型块
  var need=KEYLEN-bytes.length-3;
  for(var j=0;j<need;j++) buf.push(Math.floor(Math.random()*254)+1);
  buf.push(0);    // 分隔符
  for(var k=0;k<bytes.length;k++) buf.push(bytes[k]);
  var x=0n; for(var q=0;q<buf.length;q++) x=(x<<8n)|BigInt(buf[q]);
  var c=xjModPow(x,XJ_RSA_E,BigInt('0x'+XJ_RSA_N));
  var KEYLEN=XJ_RSA_N.length/2;  // 256 字节 = 2048 位
  var out=new Array(KEYLEN).fill(0);
  for(var t=KEYLEN-1;t>=0;t--){ out[t]=Number(c&255n); c>>=8n; }
  var B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', s='';
  for(var p=0;p<out.length;p+=3){
    var a=out[p], b2=p+1<out.length?out[p+1]:0, c2=p+2<out.length?out[p+2]:0;
    s+=B64.charAt(a>>2)+B64.charAt(((a&3)<<4)|(b2>>4))+
       (p+1<out.length?B64.charAt(((b2&15)<<2)|(c2>>6)):'=')+
       (p+2<out.length?B64.charAt(c2&63):'=');
  }
  return s;
}
/* PoW: 找 x 使 SHA256(ts+x) 前 3 个 hex=0 */
function xjPow(ts){
  var x=0, h='';
  do { h=CryptoJS.SHA256(''+ts+x).toString(); x++; }
  while (h.substring(0,3)!=='000');
  return { x:x-1, hash:h };
}
/* 生成签名后的频道列表 URL */
function xjSignedUrl(cb){
  var salt=xjGetSalt(), token=xjToken(salt), num=salt[2];
  var guid=Date.now().toString(36)+'-'+Math.random().toString(36).substring(2,9);
  var f=guid.substring(0,8)+'y'+guid.substring(9);
  var powTs=Date.now(), pw=xjPow(powTs);
  var url0=XJ_API+'api/Func/Timestamp?json=true';
  var r0=mytv.get(url0, XJ_HEADERS);
  var stamp;
  try { stamp=JSON.parse(r0).data; } catch(e){ stamp=''+Date.now(); }
  var md5str=token+(num>=15?f:'')+stamp+XJ_PATH;
  var md5=CryptoJS.MD5(md5str).toString();
  var sign=encodeURIComponent(md5+xjRsaB64(token));
  var url=XJ_API+XJ_PATH+'?type=1&x='+pw.x+'&ts='+powTs+'&hash='+pw.hash+
          '&stamp='+stamp+'&guid='+guid+'&sign='+sign+'&json=true';
  cb(url);
}

function main(item){
  var raw='';
  if(typeof item==='string') raw=item;
  else if(item&&typeof item==='object'){
    if(item.url) raw=String(item.url);
    else if(item.id!==undefined&&item.id!==null) raw='id='+item.id;
  }
  var id='';
  var m=/(?:^|[?&,])id=([a-zA-Z0-9_]+)/.exec(raw);
  if(m&&m[1]) id=m[1];
  if(!id&&raw) id=raw.replace(/^\s+|\s+$/g,'');
  if(!id) id='xjws';
  var alias={'卫视':'xjws','新疆卫视':'xjws','维语':'xjwyzh','哈语':'xjhyzh','综艺':'xjzy','影视':'xjwyys','体育':'xjtyjk','少儿':'xjse'};
  if(alias[id]) id=alias[id];
  var chId=XJ_CH[id];
  if(!chId) return JSON.stringify({error:'未知频道 id='+id});

  var result={error:'获取中'};
  xjSignedUrl(function(url){
    try{
      var body=mytv.get(url, XJ_HEADERS);
      var j=JSON.parse(body);
      var playUrl='';
      var list=(j&&j.data)||[];
      for(var i=0;i<list.length;i++){
        if(list[i].Id===chId && list[i].PlayStreamUrl){ playUrl=list[i].PlayStreamUrl; break; }
      }
      if(playUrl){ result={url:playUrl, referer:XJ_REFER, userAgent:XJ_UA}; }
      else { result={error:'未取到播放地址(频道可能停播)'}; }
    }catch(e){ result={error:'获取失败:'+(e.message||e)}; }
  });
  // xjSignedUrl 内 mytv.get 为同步，result 已在回调中赋值
  return JSON.stringify(result);
}
