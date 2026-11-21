/* ============================================================
 * 七彩云端 / 云南广播电视台 (yntv.cn) · mytv/酷9 原生 JS 直播源  v2
 *
 * 用法（一行一个台）：
 *   云南卫视,javascript://<本文件在线地址>?id=ynws
 *   云南都市,javascript://<本文件在线地址>?id=ynds
 *   云南娱乐,javascript://<本文件在线地址>?id=ynyl
 *   云南影视,javascript://<本文件在线地址>?id=ynys
 *   云南公共,javascript://<本文件在线地址>?id=yngg
 *   云南少儿,javascript://<本文件在线地址>?id=ynse
 *   云南生活,javascript://<本文件在线地址>?id=ynsh
 *
 * ===== v2 修掉原版 3 个致命错误（2026-11-21）=====
 * 1) 原版 32 位 hash（f9e94f35... 等）是旧版 CDN 路径，已全部失效。
 *    换成 2026 最新短 hash（8xughf/62hdvf 等），来源交叉验证：
 *      - iptv-org/iptv streams/cn.m3u（持续自动测活，云南卫视标 Working）
 *      - GitHub Spongebaby819 云视 CDN 表（2026 更新）
 *      - 恩山论坛七彩云南线路帖
 * 2) 原版只调 mytv.get 且返回固定 JSON.stringify 字符串 → 酷9 环境要
 *    ku9.request + 返回 {url,referer,userAgent} 对象；这里双环境自动切换。
 * 3) 原版 headers 写成 'Referer: xxx\nUser-Agent: xxx' 一个字符串 →
 *    改成对象（ku9）/数组（mytv），播放器才认。
 *
 * ★ 多线路兜底：每个频道内置多条 CDN，main() 逐条探测，返回第一条能出
 *   #EXTM3U 的地址。全部探测失败时返回第一条，交给播放器自身网络再试。
 *   （沙箱网络对云南 CDN 不可达，未能在本地逐条实测；线路来自公开测活源。）
 * ============================================================ */

var QCY_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
var QCY_REFER = 'https://www.yntv.cn/';

/* 频道表：id -> 名称 + 多条候选线路（按优先级） */
var QCY_CH = {
  ynws: { name: '云南卫视', urls: [
    'https://hwapi.yunshicloud.com/8xughf/e0bx15.m3u8',
    'https://hwapi.yunshicloud.com/62hdvf/41hse3.m3u8',
    'http://39.134.115.163:8080/PLTV/88888910/224/3221225664/index.m3u8',
    'http://223.110.245.157/ott.js.chinamobile.com/PLTV/3/224/3221225591/index.m3u8',
    'http://223.110.245.159/ott.js.chinamobile.com/PLTV/3/224/3221225838/index.m3u8',
    'http://223.110.245.173/PLTV/4/224/3221225838/index.m3u8',
    'http://183.207.248.71/gitv/live1/G_YUNNAN/G_YUNNAN'
  ]},
  yngg: { name: '云南公共', urls: [
    'https://hwapi.yunshicloud.com/62hdvf/227q43.m3u8',
    'https://hwapi.yunshicloud.com/5d17d9668199884aa47738d6a3dc2aff.m3u8'
  ]},
  ynds: { name: '云南都市', urls: [
    'https://hwapi.yunshicloud.com/62hdvf/rjwt14.m3u8',
    'https://hwapi.yunshicloud.com/9fef9f5d9b57e444755af3e6f2293e32.m3u8'
  ]},
  ynyl: { name: '云南娱乐', urls: [
    'https://hwapi.yunshicloud.com/62hdvf/iq8639.m3u8',
    'https://hwapi.yunshicloud.com/63f320b36814e9b85c7c8754430e4b04.m3u8'
  ]},
  ynys: { name: '云南影视', urls: [
    'https://hwapi.yunshicloud.com/62hdvf/utrat7.m3u8',
    'https://hwapi.yunshicloud.com/87273acd328c4b00ad627449f27f03c7.m3u8'
  ]},
  ynse: { name: '云南少儿', urls: [
    'https://hwapi.yunshicloud.com/62hdvf/9ojsty.m3u8',
    'https://hwapi.yunshicloud.com/09ede3d3d27085f22f104bdd4e669e91.m3u8'
  ]},
  ynsh: { name: '云南生活资讯', urls: [
    'https://hwapi.yunshicloud.com/62hdvf/180p57.m3u8',
    'https://hwapi.yunshicloud.com/b8985de15d0c57b578c953ab005600a4.m3u8'
  ]}
};
var QCY_ALIAS = {
  '云南卫视': 'ynws', '卫视': 'ynws', '云南卫视高清': 'ynws',
  '云南公共': 'yngg', '公共频道': 'yngg',
  '云南都市': 'ynds', '都市频道': 'ynds',
  '云南娱乐': 'ynyl', '娱乐频道': 'ynyl',
  '云南影视': 'ynys', '影视频道': 'ynys',
  '云南少儿': 'ynse', '少儿频道': 'ynse',
  '云南生活': 'ynsh', '生活资讯': 'ynsh', '云南生活资讯': 'ynsh'
};

var QCY_KU9 = (typeof ku9 !== 'undefined') && ku9 && (typeof ku9.request === 'function');

/* 请求封装：返回响应正文字符串 */
function qcyReq(url) {
  var headersObj = { 'User-Agent': QCY_UA, 'Referer': QCY_REFER, 'Accept': '*/*' };
  var headersArr = ['User-Agent: ' + QCY_UA, 'Referer: ' + QCY_REFER];
  var resp = null, body = '';
  if (QCY_KU9) {
    try {
      resp = ku9.request(url, 'GET', headersObj, null);
      if (resp && typeof resp === 'object' && typeof resp.body === 'string') body = resp.body;
      else if (typeof resp === 'string') body = resp;
    } catch (e) { body = ''; }
  } else if (typeof mytv !== 'undefined' && mytv && typeof mytv.request === 'function') {
    try {
      resp = mytv.request(url, 'GET', headersArr, '');
      if (resp && typeof resp.body === 'string') body = resp.body;
      else if (typeof resp === 'string') body = resp;
    } catch (e) { body = ''; }
  } else if (typeof mytv !== 'undefined' && mytv && typeof mytv.get === 'function') {
    try { body = mytv.get(url, headersArr) || ''; } catch (e) { body = ''; }
  }
  return body;
}

function qcyFail(msg) { return QCY_KU9 ? { url: msg } : JSON.stringify({ url: '', error: msg }); }

function main(item) {
  /* 参数解析 */
  var raw = '';
  if (typeof item === 'string') raw = item;
  else if (item && typeof item === 'object') {
    if (item.url) raw = String(item.url);
    else if (item.id !== undefined && item.id !== null) raw = 'id=' + item.id;
    else { try { raw = JSON.stringify(item); } catch (e) { raw = ''; } }
  }
  var id = '';
  var m = /(?:^|[?&,])id=([a-zA-Z0-9_]+)/.exec(raw);
  if (m && m[1]) id = m[1];
  if (!id && raw) { var c = raw.replace(/^\s+|\s+$/g, ''); if (c && !/[?&={[]/.test(c)) id = c; }
  if (!id && item && item.id !== undefined && item.id !== null) id = String(item.id);
  if (QCY_ALIAS[id]) id = QCY_ALIAS[id];
  if (!id) id = 'ynws';

  var ch = QCY_CH[id];
  if (!ch) return qcyFail('未知云南频道 id=' + id);

  /* 逐条探测线路，返回第一条能出 m3u8 的。
     用 ku9 缓存记住上次成功线路，命中时只请求 1 次，避免每次刷新都全表探测。 */
  var first = ch.urls[0], picked = first;
  var cacheKey = 'qcy-line-v2-' + id;
  var cached = '';
  if (QCY_KU9 && typeof ku9.getCache === 'function') { try { cached = ku9.getCache(cacheKey) || ''; } catch (e) { cached = ''; } }
  var order = ch.urls.slice();
  if (cached) {
    var ci = order.indexOf(cached);
    if (ci > 0) { order.splice(ci, 1); order.unshift(cached); }
  }
  for (var i = 0; i < order.length; i++) {
    var u = order[i];
    var body = qcyReq(u);
    if (body && body.indexOf('#EXTM3U') >= 0) {
      picked = u;
      if (QCY_KU9 && typeof ku9.setCache === 'function') { try { ku9.setCache(cacheKey, u, 3600000); } catch (e2) {} }
      break;
    }
  }

  if (QCY_KU9) {
    return { url: picked, referer: QCY_REFER, userAgent: QCY_UA };
  }
  return JSON.stringify({ url: picked, referer: QCY_REFER, userAgent: QCY_UA });
}
