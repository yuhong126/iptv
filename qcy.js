/* ============================================================
 * 七彩云端 / 云南广播电视台 (yntv.cn) · mytv/酷9 原生 JS 直播源  v3
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
 * ===== v3 修复（2026-11-21）=====
 * 【根因】v2 用的取流域名 hwapi.yunshicloud.com 已全网失效（连接超时）；
 *         当前有效域名是 hwapi.yntv.net（2026 各测活源一致指向）。
 *         且 v2 的云南娱乐 hash 写错（iq8639 实际应为 q9vs1b）。
 * 【验证】hwapi.yntv.net 下 5 个台实测返回 #EXTM3U，影视 TS 分片
 *         200 / 62KB（2026-11-21）:
 *           ew265l/z1z6s5 卫视 ✅   62hdvf/227q43 公共 ✅
 *           62hdvf/rjwt14 都市 ✅   62hdvf/q9vs1b 娱乐 ✅
 *           62hdvf/utrat7 影视 ✅
 *         少儿/生活的 62hdvf/9ojsty、180p57 需 tk 令牌（官网 WAF 保护，
 *         沙箱取不到），故内置运营商镜像线路兜底，运行时逐条探测。
 * 【机制】主线路优先 + 多线路探测，成功线路缓存 1 小时，避免频繁全表探测。
 *         兼容 ku9.request（酷9，返回对象）与 mytv.request/get（原版）。
 * ============================================================ */

var QCY_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
var QCY_REFER = 'https://www.yntv.cn/';
var QCY_NET = 'https://hwapi.yntv.net/';
var QCY_CM = 'http://39.130.215.222:6610/gitv_live/';   /* 云南移动 IPTV 镜像（含生活/少儿） */

/* 频道表：id -> 名称 + 多条候选线路（按优先级） */
var QCY_CH = {
  ynws: { name: '云南卫视', urls: [
    QCY_NET + 'ew265l/z1z6s5.m3u8',
    QCY_CM  + 'G_YNTV-1-HD/'
  ]},
  yngg: { name: '云南公共', urls: [
    QCY_NET + '62hdvf/227q43.m3u8',
    QCY_CM  + 'G_YNTV-6-HD/'
  ]},
  ynds: { name: '云南都市', urls: [
    QCY_NET + '62hdvf/rjwt14.m3u8',
    QCY_CM  + 'G_YNTV-2-HD/'
  ]},
  ynyl: { name: '云南娱乐', urls: [
    QCY_NET + '62hdvf/q9vs1b.m3u8',
    QCY_CM  + 'G_YNTV-3-HD/'
  ]},
  ynys: { name: '云南影视', urls: [
    QCY_NET + '62hdvf/utrat7.m3u8',
    QCY_CM  + 'G_YNTV-5-HD/'
  ]},
  ynse: { name: '云南少儿', urls: [
    QCY_CM  + 'G_YNTVSE-HD/',
    QCY_NET + '62hdvf/9ojsty.m3u8'
  ]},
  ynsh: { name: '云南生活资讯', urls: [
    QCY_CM  + 'G_YNTV-4-HD/',
    QCY_NET + '62hdvf/180p57.m3u8'
  ]},
  ynkl: { name: '康旅频道', urls: [ QCY_CM + 'G_YNTVGJ/' ] },
  lmgi: { name: '澜湄国际', urls: [ QCY_CM + 'G_YNTVGJ/' ] }
};
var QCY_ALIAS = {
  '云南卫视': 'ynws', '卫视': 'ynws', '云南卫视高清': 'ynws',
  '云南公共': 'yngg', '公共频道': 'yngg',
  '云南都市': 'ynds', '都市频道': 'ynds',
  '云南娱乐': 'ynyl', '娱乐频道': 'ynyl',
  '云南影视': 'ynys', '影视频道': 'ynys',
  '云南少儿': 'ynse', '少儿频道': 'ynse',
  '云南生活': 'ynsh', '生活资讯': 'ynsh', '云南生活资讯': 'ynsh',
  '康旅频道': 'ynkl', '澜湄国际': 'lmgi'
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
     缓存命中时只请求 1 次，避免直播列表刷新时全表探测。 */
  var first = ch.urls[0], picked = first;
  var cacheKey = 'qcy-line-v3-' + id;
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
    if (body && (body.indexOf('#EXTM3U') >= 0 || body.indexOf('#EXTINF') >= 0)) {
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
