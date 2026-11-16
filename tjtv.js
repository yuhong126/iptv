/* ============================================================
 * 万视达 / 天津IPTV 直播源 · mytv / 酷9 通用 JS 源
 *
 * 背景：万视达 App（com.whizen.iptv.activity）用了网易易盾加固，
 *       接口无法静态逆向；其频道本质是「天津移动 IPTV 组播」，
 *       没有公开的 m3u8 官网接口。本脚本内置多条候选线路，
 *       真机上自动探测哪条能通就用哪条。
 *
 * 用法（一行一个台）：
 *   天津卫视,javascript://<本文件在线地址>?id=0
 *
 * id 对照：
 *   0 天津卫视    1 天津新闻   2 天津文艺   3 天津影视
 *   4 天津都市    5 天津体育   6 天津科教   7 天津少儿
 *   8 天津购物    9 天津IPTV
 *
 * 探测策略：
 *   1) 天津卫视有第三方 m3u8 候选 —— 先用 ku9.request 探测，
 *      返回 #EXTM3U 的那条直接用。
 *   2) 其余地方台只有组播 —— 组播是无限流，不能 GET 探测
 *      （会挂死，参考北京台教训），直接返回组播代理地址交给播放器。
 * ============================================================ */

var TJ_UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
var TJ_REF = 'https://www.wisetv.com.cn/';

// 组播代理：把天津移动内网组播 225.1.1.x 转成 http 流
// 本机（非天津移动网）测这些代理 502，但真机在移动网内可能可通
var MCAST_HOSTS = [
  'http://60.26.63.238:8000/udp/',
  'http://117.13.117.212:4022/udp/'
];

// 每个频道的组播地址（225.1.1.x:5002）
var CH = [
  { id: 0,  name: '天津卫视',  mc: '',                 m3u8: [
      'http://39.134.115.163:8080/PLTV/88888910/224/3221225698/index.m3u8',
      'http://115.149.139.141:10001/tsfile/live/1036_1.m3u8',
      'http://222.173.108.238:352/tsfile/live/0135_1.m3u8?key=txiptv&playlive=1&authid=0',
      'http://bztv.tvbus.cc:8081/cdnlive/tjws.m3u8',
      'https://stream1.freetv.fun/c38103fa730bdc04dcfb532eda5212f459715542248468a180c58faf27e07c68.m3u8'
  ]},
  { id: 1,  name: '天津新闻',  mc: '225.1.1.130:5002' },
  { id: 2,  name: '天津文艺',  mc: '225.1.1.131:5002' },
  { id: 3,  name: '天津影视',  mc: '225.1.1.149:5002' },
  { id: 4,  name: '天津都市',  mc: '225.1.1.128:5002' },
  { id: 5,  name: '天津体育',  mc: '225.1.1.122:5002' },
  { id: 6,  name: '天津科教',  mc: '225.1.1.129:5002' },
  { id: 7,  name: '天津少儿',  mc: '225.1.1.125:5002' },
  { id: 8,  name: '天津购物',  mc: '225.1.1.151:5002' },
  { id: 9,  name: '天津IPTV',  mc: '225.1.2.123:5002' }
];

function tjGetId(item) {
  var k = '';
  if (item && item.id !== undefined && item.id !== null && String(item.id) !== '') {
    k = String(item.id);
  } else if (typeof ku9 !== 'undefined' && ku9.getQuery && item && item.url) {
    k = String(ku9.getQuery(item.url, 'id') || '');
  }
  if (/^\d+$/.test(k)) {
    var n = parseInt(k, 10);
    return (n >= 0 && n < CH.length) ? n : 0;
  }
  for (var i = 0; i < CH.length; i++) {
    if (CH[i].name === k) return i;
  }
  return 0;
}

function main(item) {
  var idx = tjGetId(item);
  var ch = CH[idx];
  var hasReq = (typeof ku9 !== 'undefined' && typeof ku9.request === 'function');

  // ---- 有 m3u8 候选的频道：逐个探测，取第一条真正返回 EXTINF 的 ----
  if (ch.m3u8 && ch.m3u8.length && hasReq) {
    for (var i = 0; i < ch.m3u8.length; i++) {
      var u = ch.m3u8[i];
      try {
        var res = ku9.request(u, 'GET', {
          'User-Agent': TJ_UA,
          'Referer': TJ_REF
        }, null);
        var body = res && res.body ? String(res.body) : '';
        if (res && (res.code === 200 || res.code === '200') &&
            (body.indexOf('#EXTM3U') >= 0 || body.indexOf('#EXTINF') >= 0)) {
          return { url: u, headers: { 'User-Agent': TJ_UA, 'Referer': TJ_REF } };
        }
      } catch (e) { /* 单条失败，试下一条 */ }
    }
  }

  // ---- 组播频道：直接返回组播代理地址（不 GET 探测，避免无限流挂死）----
  if (ch.mc) {
    var mcUrl = MCAST_HOSTS[0] + ch.mc;
    return { url: mcUrl, headers: { 'User-Agent': TJ_UA } };
  }

  return { url: ch.name + '：所有线路均不可用（第三方源失效，且该台无组播地址）' };
}
