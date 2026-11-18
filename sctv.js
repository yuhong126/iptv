/*
 * 四川网络广播电视台 JS 直播源（mytv / 酷9 原生）—— v5 电视端通用版
 * 逆向自 四川观察 APP com.sctv.scfocus v10.2.0（2026-11-17 雷电模拟器 logcat / DEX）
 *
 * ★★★ v5 关键突破（2026-11-18）：解决电视端 IJK 内核播不了四川 ★★★
 *   根因：四川 CDN(Tengine) 双重校验——
 *     ① 必须带 Referer: https://scgc.video.play/（否则 denied by Referer ACL）
 *     ② UA 不能是 Mozilla 浏览器系（否则 denied by UA ACL = blacklist）
 *   而 IJK/LJK 内核拉 .ts 分片时不转发 JS headers（只有 Media3 会转发），
 *   所以手机切 Media3 能播、电视端 IJK 403。
 *
 *   v5 正解：利用 mytv 内置「在链接中提取 Header」机制（默认开启，开关
 *   videoPlayerExtractHeaderFromLink=true，设置项 ui_player_view_extract_header_from_link），
 *   把 Header 直接内嵌进 URL：  <视频URL>|Referer=...|User-Agent=...
 *   mytv 的统一解析入口 a5f$X() 会把 | 后面按正则 ([^=]+)=... 拆成请求头，
 *   ★ 该 header map 在 m3u8 与每个 .ts 分片请求上都会带上，且与播放器内核无关
 *   （IJK su5 / Media3 x0f / VLC 都走 a5f$X）→ 电视端不用切内核、不用装组件即可播。
 *
 *   ★ 实测校验矩阵（2026-11-18，带 auth_key）：
 *      m3u8/分片  AliPlayer + Referer -> 200
 *      m3u8/分片  无 Referer          -> 403 (denied by Referer ACL)
 *      m3u8/分片  Mozilla + Referer   -> 403 (denied by UA ACL = blacklist)
 *      m3u8/分片  空UA + Referer      -> 200
 *   ★ Referer 白名单只认 scgc.video.play（http/https 均可），URL 参数 &referer= 无效。
 *
 * 用法: javascript://.../sctv.js?id=1016553
 *       ?id 为频道 id（见 CH 表），可选 &token=xxx 覆盖内置 token
 *
 * 兼容：mytv 返回 JSON 字符串（url 内嵌 header）；酷9 返回对象 {url,referer,userAgent}。
 */

// ---------- 环境兼容层 ----------
var SCTV_IS_KU9 = (typeof ku9 !== 'undefined');
var SCTV_UA = 'AliPlayer';                       // 非浏览器 UA，绕开 Tengine UA 黑名单
var SCTV_REFERER = 'https://scgc.video.play/';   // APP 真实 Referer（白名单内）
var SCTV_HOST = 'tvshowf.scgczm.com';
var SCTV_API = 'https://gw.scgchc.com/app/v1/anti/getLiveSecret';

function sctvGetQuery(url, key) {
  try {
    if (SCTV_IS_KU9 && typeof ku9.getQuery === 'function') return ku9.getQuery(url, key);
  } catch (e) {}
  try {
    var re = new RegExp('(?:^|[?&])' + key + '=([^&]*)');
    var m = re.exec(url || '');
    return m ? decodeURIComponent(m[1]) : '';
  } catch (e) {}
  return '';
}

function sctvRequest(url, method, headers, body) {
  try {
    if (SCTV_IS_KU9 && typeof ku9.request === 'function') {
      var r = ku9.request(url, method || 'GET', headers || {});
      return { body: (r && r.body) || '', code: (r && r.code) || 0 };
    }
  } catch (e) {}
  try {
    var hs = [];
    if (headers) for (var k in headers) hs.push(k + ': ' + headers[k]);
    if (typeof mytv !== 'undefined' && typeof mytv.request === 'function') {
      var mr = mytv.request(url, method || 'GET', hs, body || '');
      return { body: ((mr && mr.body) || '') + '', code: ((mr && mr.code) || 0) };
    }
    if (typeof mytv !== 'undefined' && typeof mytv.get === 'function') {
      return { body: mytv.get(url, hs) || '', code: 200 };
    }
    if (typeof mytv !== 'undefined' && typeof mytv.fetch === 'function') {
      return { body: mytv.fetch(url) || '', code: 200 };
    }
  } catch (e) {}
  return { body: '', code: 0 };
}

function sctvUnix() {
  try { return Math.floor(Date.now() / 1000); } catch (e) {}
  return 0;
}

// 把 Header 内嵌进 URL（mytv「在链接中提取 Header」机制，| 分隔）
// 值里若含 | 或 " 用引号包裹；本源的值都不含，保持简单。
function sctvEmbed(url, referer, ua) {
  return url + '|Referer=' + referer + '|User-Agent=' + ua;
}

function main(item) {
  var SCTV_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiU0VSVklDRV9TQ0dDLURFTU8iXSwidXNlcl9pZCI6MTkyMDIwNDYxOTQ2MjE0NDAwMiwic2NvcGUiOlsiYWxsIl0sImV4cCI6MTc5NjA0MTIzMSwiYXV0aG9yaXRpZXMiOlsiUk9MRV9BUFBfQ0xJRU5UX1VTRVIiXSwianRpIjoiMGIxYTg2ODUtMGJkNy00ODlhLTg5MDQtMmQxNzFhMDkyZmVmIiwiY2xpZW50X2lkIjoiU0VSVklDRV9TQ0dDLUFQUCJ9.bmjt3W7XKKMcWt56bVw76YI6o4H368XvrOt8y5kDnGTKTsFYpaMTlaV9U3puugTghC0a465p8x5S7BPu__JaBcoohMqw25-iXNrH1ticoXHJwOwatu3TCJd5rhl83-znX46R__b26LrNiLdhLd3PFm2yLmj0UxiZwo7KYCWyumR0Zfbaf_E_23Pa3CzSRrba0wV4hhKedXo8aNufSH7u7kFvWa4mis5gVvP-ViiERVRFhIG6-EGqhDDBXNUSXgO4_RbQiMJZshX3YgNcbgB4eAbZLhk46tqekGHQRqSgPI_Z-rCuy9GzIr2LPoi_5jvCG0WuKpVfHuu18_88Kqz1yg';

  // 频道表: id -> {n:名称, s:streamName}  电视 streamName 已逐个验证 m3u8=200
  // radio=1 为广播，免鉴权直连（bdshowf.scgczm.com，已验证 200、无校验）
  var CH = {
    '1016553':             { n:'四川卫视',     s:'sctv1' },
    '1016554':             { n:'经济频道',     s:'sctv2' },
    '1016555':             { n:'文旅体育',     s:'sctv3' },
    '1844567123037646849': { n:'新闻频道',     s:'sctv4' },
    '1016557':             { n:'影视文艺',     s:'sctv5' },
    '1016559':             { n:'星空购物',     s:'sctv6' },
    '1016558':             { n:'妇女儿童',     s:'sctv7' },
    '1016560':             { n:'四川乡村',     s:'sctv9' },
    '1016561':             { n:'康巴卫视',     s:'kangba' },
    '1025920':             { n:'四川综合广播', r:'sc_ts03', radio:1 },
    '1025913':             { n:'四川新闻广播', r:'sc_ts08', radio:1 },
    '1025919':             { n:'四川交通广播', r:'sc_ts06', radio:1 },
    '1025914':             { n:'民族频率',     r:'sc_ts09', radio:1 },
    '1025917':             { n:'城市之音',     r:'sc_ts01', radio:1 },
    '1025918':             { n:'岷江音乐',     r:'sc_ts04', radio:1 }
  };

  var urlArg = (item && item.url) || (typeof item === 'string' ? item : '') || '';
  var id = sctvGetQuery(urlArg, 'id') || '1016553';
  var ch = CH[id];

  if (!ch) {
    return SCTV_IS_KU9
      ? { url:'', referer:SCTV_REFERER, userAgent:SCTV_UA, error:'未知频道 id: ' + id }
      : JSON.stringify({ url:'', error:'未知频道 id: ' + id });
  }

  var token = sctvGetQuery(urlArg, 'token') || SCTV_TOKEN;

  // 广播：免鉴权直连（bdshowf 完全不校验 UA/Referer，但内嵌也无害，双保险）
  if (ch.radio) {
    var rurl = 'https://bdshowf.scgczm.com/scapp/' + ch.r + '.m3u8';
    if (SCTV_IS_KU9) return { url: rurl, referer: SCTV_REFERER, userAgent: SCTV_UA };
    return JSON.stringify({ url: sctvEmbed(rurl, SCTV_REFERER, SCTV_UA) });
  }

  var stream = '/live/' + ch.s + '.m3u8';
  var playUrl = 'https://' + SCTV_HOST + stream;

  // 实时换取 auth_key（mytv 直播列表每几秒重跑 main，不缓存，保证 key 新鲜）
  var secret = '';
  var api = SCTV_API + '?streamName=' + encodeURIComponent(stream)
          + '&host=' + encodeURIComponent(SCTV_HOST)
          + '&txTime=' + sctvUnix();
  var res = sctvRequest(api, 'GET', {
    'authorization': 'bearer ' + token,
    'referer': SCTV_REFERER,
    'User-Agent': SCTV_UA,
    'Accept': 'application/json, text/plain, */*'
  });
  var body = res.body || '';
  if (body) {
    try {
      var j = (typeof body === 'string') ? JSON.parse(body) : body;
      if (j && Number(j.rs) === 200 && j.data && j.data.secret) { secret = j.data.secret; }
    } catch (e) {}
  }

  var keyedUrl = secret
    ? (playUrl + (playUrl.indexOf('?') >= 0 ? '&' : '?') + secret)
    : playUrl;

  // ★ v5 核心：Header 内嵌进 URL，绕开内核对 headers 字段的转发差异。
  //   mytv 统一解析 a5f$X() 默认开启「在链接中提取 Header」，把 | 后按 key=value
  //   拆成请求头，m3u8 与每个分片都会带上；IJK/Media3/VLC 全部适用。
  if (SCTV_IS_KU9) {
    // 酷9 用独立字段，不走 mytv 的 | 解析
    return { url: keyedUrl, referer: SCTV_REFERER, userAgent: SCTV_UA };
  }
  var finalUrl = sctvEmbed(keyedUrl, SCTV_REFERER, SCTV_UA);
  return JSON.stringify({ url: finalUrl });
}
