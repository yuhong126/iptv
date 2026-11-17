/*
 * 四川网络广播电视台 JS 直播源（mytv / 酷9 原生）—— v3 APP 真实链路版
 * 逆向自 四川观察 APP com.sctv.scfocus v10.2.0（2026-11-17 从雷电模拟器 logcat 抓出）
 *
 * ★★★ v3 推翻 v1/v2 全部假设，改用 APP 自己的播放链路（这是真正能播的）：
 *   APP logcat 实测（点播经济频道）：
 *     AliFrameWork: java_SetDataSource_UrlSource(
 *       https://tvshowf.scgczm.com/live/sctv4.m3u8?auth_key=1794909562-1920204619462144002-0-xxx)
 *     player_config: referer = https://scgc.video.play/
 *
 *   关键发现（本机端到端验证 200，逐条确认）：
 *   1. 播放域名是 tvshowf.scgczm.com（v1/v2 用的 sub-tvshowf.scgczm.com 是废弃域名）
 *   2. Referer 必须是 https://scgc.video.play/（不是 www.sctv.com）
 *   3. Tengine CDN 有 UA 黑名单：浏览器 UA(Mozilla/...) 一律 403 且明确回 "denied by UA ACL = blacklist"；
 *      APP/播放器 UA（AliPlayer / ijkplayer 等）全部 200。⇒ 本脚本 headers 用 UA = AliPlayer
 *   4. auth_key 是 APP 格式（ts-userId-0-md5，阿里云 VOD 标准），由 APP 自己的接口换取：
 *      GET https://gw.scgchc.com/app/v1/anti/getLiveSecret
 *          ?streamName=/live/<频道>.m3u8&host=tvshowf.scgczm.com&txTime=<unix秒>
 *      Header: authorization: bearer <SCTV_TOKEN>  + referer: https://scgc.video.play/
 *      返回 {"rs":200,"data":{"secret":"auth_key=<ts>-<userId>-0-<md5>"}}
 *      注意：不能只带 bearer，必须带 txTime；sha256 那种（老 PHP）会 401
 *   5. m3u8 里的分片自带 auth_key，但是相对路径；mytv 官方规范要求文本里的分片用绝对 URL，
 *      故本脚本 fetch 原始 m3u8 → 每个分片绝对化（sctvAbs）→ 通过 m3u8 字段返回
 *
 * 用法: javascript://.../sctv.js?id=1016553
 *       ?id 为频道 id（见下方 CH 表），可选 &token=xxx 覆盖内置 token
 */

// ---------- 环境兼容层：同时支持酷9(ku9) 与 mytv ----------
var SCTV_IS_KU9 = (typeof ku9 !== 'undefined');

function sctvGetQuery(url, key) {
  try {
    if (SCTV_IS_KU9 && typeof ku9.getQuery === 'function') return ku9.getQuery(url, key);
  } catch (e) {}
  try {
    var u = new URL(url);
    return u.searchParams.get(key) || '';
  } catch (e) {}
  try {
    var re = new RegExp('(?:^|[?&])' + key + '=([^&]*)');
    var m = re.exec(url || '');
    return m ? decodeURIComponent(m[1]) : '';
  } catch (e) {}
  return '';
}

function sctvRequest(url, method, headers, body) {
  // headers: 对象 {k:v}；返回 {body:string, code:number}
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
    if (method === 'POST' && typeof mytv !== 'undefined' && typeof mytv.post === 'function') {
      return { body: mytv.post(url, hs, body || '') || '', code: 200 };
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

function sctvCacheGet(key) {
  try { if (SCTV_IS_KU9 && typeof ku9.getCache === 'function') return ku9.getCache(key) || ''; } catch (e) {}
  try { if (typeof mytv !== 'undefined' && typeof mytv.fileExists === 'function' && mytv.fileExists(key)) return mytv.readFile(key) || ''; } catch (e) {}
  return '';
}

function sctvCacheSet(key, val, ttlMs) {
  try { if (SCTV_IS_KU9 && typeof ku9.setCache === 'function') { ku9.setCache(key, val, ttlMs); return; } } catch (e) {}
  try { if (typeof mytv !== 'undefined' && typeof mytv.writeFile === 'function') mytv.writeFile(key, val); } catch (e) {}
}

function sctvUnix() {
  try { return Math.floor(Date.now() / 1000); } catch (e) {}
  return 0;
}

// 相对 URI 转绝对 URL（QuickJS 无 URL 对象，纯字符串实现）
function sctvAbs(base, ref) {
  ref = (ref || '').replace(/^\s+|\s+$/g, '');
  if (!ref) return ref;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(ref) || ref.indexOf('//') === 0) return ref;
  var m = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]+)(\/[^?#]*)?/.exec(base || '');
  if (!m) return ref;
  var root = m[1];
  var path = m[2] || '/';
  if (ref.charAt(0) === '/') return root + ref;
  var q = path.indexOf('?');
  if (q >= 0) path = path.substring(0, q);
  var slash = path.lastIndexOf('/');
  var dir = slash >= 0 ? path.substring(0, slash + 1) : '/';
  return root + dir + ref;
}

// 给 m3u8 每个媒体 URI 绝对化（分片本身已自带 auth_key，这里不再重复注入）
function sctvRewritePlaylist(text, baseUrl) {
  if (!text) return text;
  var lines = text.split('\n');
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.replace(/\r$/, '');
    if (!trimmed) { out.push(line); continue; }
    if (trimmed.charAt(0) === '#' && /^#EXT-X-(KEY|MAP)\b/.test(trimmed)) {
      line = line.replace(/URI="([^"]*)"/g, function (all, u) {
        return 'URI="' + sctvAbs(baseUrl, u) + '"';
      });
      out.push(line); continue;
    }
    if (trimmed.charAt(0) === '#') { out.push(line); continue; }
    out.push(sctvAbs(baseUrl, trimmed));
  }
  return out.join('\n');
}

function main(item) {
  var UA = 'AliPlayer';                       // ★ 关键：APP/播放器 UA，绕开 Tengine UA 黑名单
  var REFERER = 'https://scgc.video.play/';   // ★ APP 真实 Referer
  var HOST = 'tvshowf.scgczm.com';            // ★ APP 真实播放域名
  var API = 'https://gw.scgchc.com/app/v1/anti/getLiveSecret'; // ★ APP 鉴权接口

  var SCTV_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiU0VSVklDRV9TQ0dDLURFTU8iXSwidXNlcl9pZCI6MTkyMDIwNDYxOTQ2MjE0NDAwMiwic2NvcGUiOlsiYWxsIl0sImV4cCI6MTc5NjA0MTIzMSwiYXV0aG9yaXRpZXMiOlsiUk9MRV9BUFBfQ0xJRU5UX1VTRVIiXSwianRpIjoiMGIxYTg2ODUtMGJkNy00ODlhLTg5MDQtMmQxNzFhMDkyZmVmIiwiY2xpZW50X2lkIjoiU0VSVklDRV9TQ0dDLUFQUCJ9.bmjt3W7XKKMcWt56bVw76YI6o4H368XvrOt8y5kDnGTKTsFYpaMTlaV9U3puugTghC0a465p8x5S7BPu__JaBcoohMqw25-iXNrH1ticoXHJwOwatu3TCJd5rhl83-znX46R__b26LrNiLdhLd3PFm2yLmj0UxiZwo7KYCWyumR0Zfbaf_E_23Pa3CzSRrba0wV4hhKedXo8aNufSH7u7kFvWa4mis5gVvP-ViiERVRFhIG6-EGqhDDBXNUSXgO4_RbQiMJZshX3YgNcbgB4eAbZLhk46tqekGHQRqSgPI_Z-rCuy9GzIr2LPoi_5jvCG0WuKpVfHuu18_88Kqz1yg';

  // 频道表: id -> {n:名称, s:streamName}  电视 streamName 已逐个验证 m3u8=200
  // radio=1 为广播，免鉴权直连（bdshowf.scgczm.com，已验证 200）
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
  var retHeaders = SCTV_IS_KU9 ? {} : ('User-Agent: ' + UA + '\nReferer: ' + REFERER);

  if (!ch) {
    return SCTV_IS_KU9
      ? { url:'', referer:REFERER, userAgent:UA }
      : JSON.stringify({ url:'', headers:retHeaders, error:'未知频道 id: ' + id });
  }

  var token = sctvGetQuery(urlArg, 'token') || SCTV_TOKEN;

  // 广播：免鉴权直连（APP 链路下同样 200）
  if (ch.radio) {
    var rurl = 'https://bdshowf.scgczm.com/scapp/' + ch.r + '.m3u8';
    if (SCTV_IS_KU9) return { url: rurl, referer: REFERER, userAgent: UA };
    return JSON.stringify({ url: rurl, headers: retHeaders });
  }

  var stream = '/live/' + ch.s + '.m3u8';
  var playUrl = 'https://' + HOST + stream;

  // 1) APP 接口换取 auth_key（缓存 50 分钟）
  var cacheKey = 'sctv3_auth_' + ch.s;
  var secret = sctvCacheGet(cacheKey);
  if (!secret) {
    var api = API + '?streamName=' + encodeURIComponent(stream)
            + '&host=' + encodeURIComponent(HOST)
            + '&txTime=' + sctvUnix();
    var res = sctvRequest(api, 'GET', {
      'authorization': 'bearer ' + token,
      'referer': REFERER,
      'User-Agent': UA,
      'Accept': 'application/json, text/plain, */*'
    });
    var body = res.body || '';
    if (body) {
      try {
        var j = (typeof body === 'string') ? JSON.parse(body) : body;
        if (j && Number(j.rs) === 200 && j.data && j.data.secret) {
          secret = j.data.secret;                       // 形如 "auth_key=<ts>-<uid>-0-<md5>"
          sctvCacheSet(cacheKey, secret, 3000000);
        }
      } catch (e) {}
    }
  }

  var keyedUrl = secret
    ? (playUrl + (playUrl.indexOf('?') >= 0 ? '&' : '?') + secret)
    : playUrl;

  // 2) fetch 原始 m3u8 文本 → 分片绝对化 → m3u8 字段返回
  var m3uRes = sctvRequest(keyedUrl, 'GET', {
    'User-Agent': UA,
    'referer': REFERER,
    'Accept': 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*'
  });
  var playlist = (m3uRes.body || '') + '';

  if (playlist.indexOf('#EXTM3U') >= 0) {
    var rewritten = sctvRewritePlaylist(playlist, playUrl);
    if (SCTV_IS_KU9) {
      return { url: keyedUrl, m3u8: rewritten, referer: REFERER, userAgent: UA };
    }
    return JSON.stringify({ m3u8: rewritten, headers: retHeaders, url: keyedUrl });
  }

  // 兜底：拿不到文本（网络异常）则直接返回带 key 的 url
  if (SCTV_IS_KU9) {
    return { url: keyedUrl, referer: REFERER, userAgent: UA };
  }
  return JSON.stringify({ url: keyedUrl, headers: retHeaders });
}
