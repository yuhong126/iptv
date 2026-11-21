/* ============================================================
 * 海南网络广播电视台 (hnntv.cn) · mytv/酷9 原生 JS 直播源  v2
 *
 * 用法（一行一个台，id 用下面频道表里官网真实 id）：
 *   海南卫视,javascript://<本文件在线地址>?id=13
 *   三沙卫视,javascript://<本文件在线地址>?id=5
 *   海南自贸,javascript://<本文件在线地址>?id=1
 *   海南新闻,javascript://<本文件在线地址>?id=3
 *   海南社会与法,javascript://<本文件在线地址>?id=4
 *   海南文旅,javascript://<本文件在线地址>?id=6
 *   海南少儿,javascript://<本文件在线地址>?id=7
 *   (广播台见下方频道表，id=9/10/11/20/8)
 *
 * ===== v2 修掉原版 5 个致命错误（2026-11-21 官网实测）=====
 * 1) 接口域名 tv.hnntv.cn 已失效（DNS 都解析不了）→ 换成官网在用的
 *    https://ps.hnntv.cn/ps/livePlayUrl （PlayService）。
 * 2) 频道 id 全错：原注释 19/7/5/4/6/8/9 与官网对不上。官网真实：
 *    海南卫视=13、三沙=5、自贸=1、新闻=3、社会与法=4、文旅=6、少儿=7。
 *    原注释的 19 其实是「临时直播1」测试流，根本不是海南卫视高清。
 * 3) 官网明文 liveUrl 直接访问 403。必须走 PS 接口拿带 _upt 签名的地址：
 *    resultSet[0].url = ...m3u8?_upt=xxx（签名不足 1 天有效，故必须实时 JS）。
 * 4) mytv.get 返回对象是 Ku9 约定；原版 mytv 用 mytv.request（headers 传数组）。
 *    这里两套环境都兼容，返回格式按环境自动切换对象 / JSON 字符串。
 * 5) 带签名地址实测无需 Referer 即可 200，分片也能下（TS 200，2MB）。
 *
 * 实测：7 个电视频道全部 PS 取流 200 + 签名 m3u8 200 + TS 分片 200。
 * ============================================================ */

var HN_PS = 'https://ps.hnntv.cn/ps/livePlayUrl';
var HN_REFER = 'https://www.hnntv.cn/live.html';
var HN_HOME = 'https://www.hnntv.cn/';
var HN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

/* 频道表：id -> 官网 channelCode（2026-11-21 从 api/channel 实测核实） */
var HN_CH = {
  '13': { code: 'STHaiNan_channel_lywsgq', name: '海南卫视' },
  '5':  { code: 'STHaiNan_channel_ssws',   name: '三沙卫视' },
  '1':  { code: 'jjpd',                    name: '海南自贸' },
  '3':  { code: 'STHaiNan_channel_xwpd',   name: '海南新闻' },
  '4':  { code: 'ggpd',                    name: '海南社会与法' },
  '6':  { code: 'wlpd',                    name: '海南文旅' },
  '7':  { code: 'sepd',                    name: '海南少儿' },
  '9':  { code: 'STHaiNan_channel_xwgb',   name: '新闻广播' },
  '10': { code: 'STHaiNan_channel_jtgb',   name: '海南交通广播' },
  '11': { code: 'STHaiNan_channel_gjlydzs',name: '国际旅游岛之声' },
  '20': { code: 'STHaiNan_channel_csgb',   name: '音乐广播' },
  '8':  { code: 'STHaiNan_channel_msgb',   name: '民生广播' }
};
var HN_ALIAS = {
  '海南卫视': '13', '海南卫视高清': '13', '卫视': '13',
  '三沙卫视': '5', '三沙': '5',
  '海南自贸': '1', '自贸': '1',
  '海南新闻': '3', '新闻': '3',
  '海南社会与法': '4', '社会与法': '4', '海南经济': '4', '经济': '4',
  '海南公共': '6', '公共': '6', '海南文旅': '6', '文旅': '6',
  '海南少儿': '7', '少儿': '7',
  '新闻广播': '9', '交通广播': '10', '国际旅游岛之声': '11', '音乐广播': '20', '民生广播': '8'
};

/* 环境判断：酷9/新版 mytv 有 ku9；原版 mytv 只有 mytv.request */
var HN_KU9 = (typeof ku9 !== 'undefined') && ku9 && (typeof ku9.request === 'function');

function hnReq(url) {
  var headersObj = { 'Referer': HN_REFER, 'Origin': HN_HOME, 'User-Agent': HN_UA, 'Accept': '*/*' };
  var headersArr = ['Referer: ' + HN_REFER, 'Origin: ' + HN_HOME, 'User-Agent: ' + HN_UA];
  var resp = null, body = '';
  if (HN_KU9) {
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
  }
  return body;
}

function hnFail(msg) {
  return HN_KU9 ? { url: msg } : JSON.stringify({ url: '', error: msg });
}

function main(item) {
  /* 1) 参数解析：兼容字符串 / 对象 / url 查询三种形态 */
  var raw = '';
  if (typeof item === 'string') raw = item;
  else if (item && typeof item === 'object') {
    if (item.url) raw = String(item.url);
    else if (item.id !== undefined && item.id !== null) raw = 'id=' + item.id;
    else { try { raw = JSON.stringify(item); } catch (e) { raw = ''; } }
  }
  var id = '';
  var m = /[?&]id=([^&#]+)/.exec(raw);
  if (m && m[1]) id = decodeURIComponent(m[1]);
  if (!id) {
    var mi = /(?:^|[,{"]?id["']?\s*[:=]\s*["']?)([0-9]+)/.exec(raw);
    if (mi && mi[1]) id = mi[1];
  }
  if (!id && item && item.id !== undefined && item.id !== null) id = String(item.id);
  /* 没有显式 id 时，把整串当 key（中文别名 / 英文 channelCode / 裸数字） */
  if (!id && raw) { var clean = raw.replace(/^\s+|\s+$/g, ''); if (clean) id = clean; }
  if (HN_ALIAS[id]) id = HN_ALIAS[id];
  if (!id) id = '13';

  var ch = HN_CH[id];
  if (!ch) {
    /* 也允许直接写 channelCode */
    for (var kk in HN_CH) { if (HN_CH[kk].code === id) { ch = HN_CH[kk]; id = kk; break; } }
  }
  if (!ch) return hnFail('未知海南频道 id=' + id + '，请用频道表里的真实 id');

  /* 2) 调官网 PS 接口取带 _upt 签名的直播地址 */
  var api = HN_PS + '?appCode=&token=&channelCode=' + encodeURIComponent(ch.code);
  var body = hnReq(api);
  if (!body) return hnFail('海南取流失败：接口无响应（' + ch.name + '）');

  var obj = null;
  try { obj = JSON.parse(body); } catch (e) { obj = null; }
  if (!obj) {
    /* 有些环境 body 带 BOM/空白，再清洗一次 */
    try { obj = JSON.parse(body.replace(/^\s+|\s+$/g, '')); } catch (e2) { obj = null; }
  }
  if (!obj || !(obj.businessCode === 200 || obj.businessCode === '00000')) {
    return hnFail('海南取流失败：接口返回异常（' + ch.name + '）' + body.slice(0, 80));
  }
  var url = '';
  if (obj.resultSet && obj.resultSet.length > 0 && obj.resultSet[0].url) {
    url = String(obj.resultSet[0].url);
  }
  if (url.indexOf('http') !== 0) return hnFail('海南取流失败：无有效播放地址（' + ch.name + '）');

  /* 3) 签名地址实测无需 Referer，仍回传以兼容挑剔的播放器/HLS 代理 */
  if (HN_KU9) {
    return { url: url, referer: HN_HOME, userAgent: HN_UA };
  }
  return JSON.stringify({ url: url, referer: HN_HOME, userAgent: HN_UA });
}
