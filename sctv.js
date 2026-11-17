/*
 * 四川网络广播电视台 JS 直播源（mytv / 酷9 原生）—— 逐分片鉴权版 v2
 * 源页面: https://www.sctv.com/channelLive/1016553
 *
 * ★ v2 改动：官网给每个 .ts 分片单独注入 auth_key（自定义 loader）。
 *   v1 只在 m3u8 地址带 key，真机上可能出现"m3u8 能开、分片 403"。
 *   v2 改为：JS 内部 fetch 原始 m3u8 文本 -> 给每个分片 URL 注入 auth_key
 *   -> 通过 mytv/酷9 的 m3u8 字段把改写后的播放列表直接交给播放器。
 *
 * 原理（严格复刻官网播放逻辑）:
 *   1) 电视流 CDN 开启 Tengine 防盗链，裸 m3u8 / 分片一律 403；
 *   2) 用 access_token 调 gw.scgchc.com/exp/v1/anti/user/getLiveSecret
 *      换取一次性 auth_key（有效期 3600s）；
 *   3) 官网 hls.js 自定义 loader：对 m3u8 与每个 .ts 分片都 set('auth_key', key)；
 *   4) 广播流（bdshowf.scgczm.com）无需鉴权，可直接播放。
 *
 * access_token 有效期见 JWT exp（当前约到 2026-11-30）。
 * 过期后重新登录 www.sctv.com，控制台执行：
 *   JSON.parse(localStorage.getItem('scgc_userAccountInfo')).access_token
 * 把结果替换 SCTV_TOKEN，或用 ?token=xxx 临时覆盖。
 *
 * 用法: javascript://https://raw.githubusercontent.com/<用户>/<仓库>/main/sctv.js?id=1016553
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
  // 返回 {body: string, code: number}
  try {
    if (SCTV_IS_KU9 && typeof ku9.request === 'function') {
      var r = ku9.request(url, method || 'GET', headers || {});
      return { body: (r && r.body) || '', code: (r && r.code) || 0 };
    }
  } catch (e) {}
  try {
    var hs = [];
    if (headers) for (var k in headers) hs.push(k + ': ' + headers[k]);
    if (typeof mytv.request === 'function') {
      var mr = mytv.request(url, method || 'GET', hs, body || '');
      return { body: (mr && mr.body) || '', code: (mr && mr.code) || 0 };
    }
    if (method === 'POST' && typeof mytv.post === 'function') {
      return { body: mytv.post(url, hs, body || '') || '', code: 200 };
    }
    if (typeof mytv.get === 'function') {
      return { body: mytv.get(url, hs) || '', code: 200 };
    }
    if (typeof mytv.fetch === 'function') {
      return { body: mytv.fetch(url) || '', code: 200 };
    }
  } catch (e) {}
  return { body: '', code: 0 };
}

function sctvCacheGet(key) {
  try { if (SCTV_IS_KU9 && typeof ku9.getCache === 'function') return ku9.getCache(key) || ''; } catch (e) {}
  try { if (typeof mytv.fileExists === 'function' && mytv.fileExists(key)) return mytv.readFile(key) || ''; } catch (e) {}
  return '';
}

function sctvCacheSet(key, val, ttlMs) {
  try { if (SCTV_IS_KU9 && typeof ku9.setCache === 'function') { ku9.setCache(key, val, ttlMs); return; } } catch (e) {}
  try { if (typeof mytv.writeFile === 'function') mytv.writeFile(key, val); } catch (e) {}
}

function main(item) {
  var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0';
  var REFERER = 'https://www.sctv.com/';

  var SCTV_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiU0VSVklDRV9TQ0dDLURFTU8iXSwidXNlcl9pZCI6MTkyMDIwNDYxOTQ2MjE0NDAwMiwic2NvcGUiOlsiYWxsIl0sImV4cCI6MTc5NjA0MTIzMSwiYXV0aG9yaXRpZXMiOlsiUk9MRV9BUFBfQ0xJRU5UX1VTRVIiXSwianRpIjoiMGIxYTg2ODUtMGJkNy00ODlhLTg5MDQtMmQxNzFhMDkyZmVmIiwiY2xpZW50X2lkIjoiU0VSVklDRV9TQ0dDLUFQUCJ9.bmjt3W7XKKMcWt56bVw76YI6o4H368XvrOt8y5kDnGTKTsFYpaMTlaV9U3puugTghC0a465p8x5S7BPu__JaBcoohMqw25-iXNrH1ticoXHJwOwatu3TCJd5rhl83-znX46R__b26LrNiLdhLd3PFm2yLmj0UxiZwo7KYCWyumR0Zfbaf_E_23Pa3CzSRrba0wV4hhKedXo8aNufSH7u7kFvWa4mis5gVvP-ViiERVRFhIG6-EGqhDDBXNUSXgO4_RbQiMJZshX3YgNcbgB4eAbZLhk46tqekGHQRqSgPI_Z-rCuy9GzIr2LPoi_5jvCG0WuKpVfHuu18_88Kqz1yg';

  // 频道表: id -> {n:名称, u:m3u8, h:host, p:path, radio:广播免鉴权}
  var CH = {
    '1016553':             { n:'四川卫视',       u:'https://sub-tvshowf.scgczm.com/live/sctv1.m3u8',  h:'sub-tvshowf.scgczm.com',  p:'/live/sctv1.m3u8' },
    '1844567123037646849': { n:'新闻频道',       u:'https://sub-tvshowf.scgczm.com/live/sctv4.m3u8',  h:'sub-tvshowf.scgczm.com',  p:'/live/sctv4.m3u8' },
    '1016554':             { n:'经济频道',       u:'https://sub-tvshowf.scgczm.com/live/sctv2.m3u8',  h:'sub-tvshowf.scgczm.com',  p:'/live/sctv2.m3u8' },
    '1016555':             { n:'文旅体育',       u:'https://sub-tvshowf.scgczm.com/live/sctv3.m3u8',  h:'sub-tvshowf.scgczm.com',  p:'/live/sctv3.m3u8' },
    '1016557':             { n:'影视文艺',       u:'https://sub-tvshowf.scgczm.com/live/sctv5.m3u8',  h:'sub-tvshowf.scgczm.com',  p:'/live/sctv5.m3u8' },
    '1016558':             { n:'妇女儿童',       u:'https://sub-tvshowf.scgczm.com/live/sctv7.m3u8',  h:'sub-tvshowf.scgczm.com',  p:'/live/sctv7.m3u8' },
    '1016559':             { n:'星空购物',       u:'https://sub-tvshowf.scgczm.com/live/sctv6.m3u8',  h:'sub-tvshowf.scgczm.com',  p:'/live/sctv6.m3u8' },
    '1016560':             { n:'四川乡村',       u:'https://sub-tvshowf.scgczm.com/live/sctv9.m3u8',  h:'sub-tvshowf.scgczm.com',  p:'/live/sctv9.m3u8' },
    '1016561':             { n:'康巴卫视',       u:'https://sub-tvshowf.scgczm.com/live/kangba.m3u8', h:'sub-tvshowf.scgczm.com',  p:'/live/kangba.m3u8' },
    '1970689144638746626': { n:'四川卫视4K',     u:'https://sub-hmmslivef.scgczm.com/live/4ksctv1.m3u8', h:'sub-hmmslivef.scgczm.com', p:'/live/4ksctv1.m3u8' },
    '1025920':             { n:'四川综合广播',   u:'https://bdshowf.scgczm.com/scapp/sc_ts03.m3u8', h:'bdshowf.scgczm.com', p:'/scapp/sc_ts03.m3u8', radio:1 },
    '1025913':             { n:'四川新闻广播',   u:'https://bdshowf.scgczm.com/scapp/sc_ts08.m3u8', h:'bdshowf.scgczm.com', p:'/scapp/sc_ts08.m3u8', radio:1 },
    '1025919':             { n:'四川交通广播',   u:'https://bdshowf.scgczm.com/scapp/sc_ts06.m3u8', h:'bdshowf.scgczm.com', p:'/scapp/sc_ts06.m3u8', radio:1 },
    '1025914':             { n:'民族频率',       u:'https://bdshowf.scgczm.com/scapp/sc_ts09.m3u8', h:'bdshowf.scgczm.com', p:'/scapp/sc_ts09.m3u8', radio:1 },
    '1025917':             { n:'城市之音',       u:'https://bdshowf.scgczm.com/scapp/sc_ts01.m3u8', h:'bdshowf.scgczm.com', p:'/scapp/sc_ts01.m3u8', radio:1 },
    '1025918':             { n:'岷江音乐',       u:'https://bdshowf.scgczm.com/scapp/sc_ts04.m3u8', h:'bdshowf.scgczm.com', p:'/scapp/sc_ts04.m3u8', radio:1 }
  };

  var urlArg = (item && item.url) || (typeof item === 'string' ? item : '') || '';
  var id = sctvGetQuery(urlArg, 'id') || '1016553';
  var ch = CH[id];
  var retHeaders = SCTV_IS_KU9 ? {} : ('Referer: ' + REFERER + '\nUser-Agent: ' + UA);

  if (!ch) {
    return SCTV_IS_KU9
      ? { url:'', referer:REFERER, userAgent:UA }
      : JSON.stringify({ url:'', headers:retHeaders });
  }

  var token = sctvGetQuery(urlArg, 'token') || SCTV_TOKEN;

  // 广播：免鉴权直连
  if (ch.radio) {
    return SCTV_IS_KU9
      ? { url: ch.u, referer: REFERER, userAgent: UA }
      : JSON.stringify({ url: ch.u, headers: retHeaders });
  }

  // 电视 1) 取 auth_key（缓存 50 分钟）
  var cacheKey = 'sctv_auth_' + ch.p;
  var key = sctvCacheGet(cacheKey);
  if (!key) {
    var api = 'https://gw.scgchc.com/exp/v1/anti/user/getLiveSecret'
            + '?streamName=' + encodeURIComponent(ch.p)
            + '&host=' + encodeURIComponent(ch.h);
    var res = sctvRequest(api, 'GET', {
      'authorization': 'bearer ' + token,
      'User-Agent': UA,
      'referer': REFERER,
      'Accept': 'application/json, text/plain, */*'
    });
    var body = res.body || '';
    if (body) {
      try {
        var j = typeof body === 'string' ? JSON.parse(body) : body;
        if (j && j.rs === 200 && j.data && j.data.auth_key) {
          key = j.data.auth_key;
          var ttl = (j.data.expires_in ? j.data.expires_in - 600 : 3000) * 1000;
          if (ttl < 60000) ttl = 3000000;
          sctvCacheSet(cacheKey, key, ttl);
        }
      } catch (e) {}
    }
  }

  // 带 key 的 m3u8 地址（兜底用）
  var keyedUrl = key
    ? (ch.u + (ch.u.indexOf('?') >= 0 ? '&' : '?') + 'auth_key=' + key)
    : ch.u;

  // 电视 2) fetch 原始 m3u8 文本，逐行给分片注入 auth_key
  var playlist = '';
  var m3uRes = sctvRequest(keyedUrl, 'GET', {
    'User-Agent': UA,
    'referer': REFERER,
    'Accept': 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*'
  });
  playlist = m3uRes.body || '';

  // 判断是否为真正的 m3u8 文本（而非 403 的 HTML 错误页）
  if (playlist.indexOf('#EXTM3U') >= 0) {
    var rewritten = sctvRewritePlaylist(playlist, key, ch.u);
    // 通过 m3u8 字段把改写后的播放列表直接交给播放器
    // 分片已全部绝对化并带 auth_key，不依赖播放器回环服务按相对路径解析
    if (SCTV_IS_KU9) {
      return { url: keyedUrl, m3u8: rewritten, referer: REFERER, userAgent: UA };
    }
    return JSON.stringify({ m3u8: rewritten, headers: retHeaders, url: keyedUrl });
  }

  // 兜底：拿不到 m3u8 文本（如本机出口被 ACL 挡），退回带 key 的 URL
  if (SCTV_IS_KU9) {
    return { url: keyedUrl, referer: REFERER, userAgent: UA };
  }
  return JSON.stringify({ url: keyedUrl, headers: retHeaders });
}

// 相对 URI 转绝对 URL（QuickJS 无 URL 对象，纯字符串实现）
// base 形如 https://sub-tvshowf.scgczm.com/live/sctv4.m3u8
function sctvAbs(base, ref) {
  ref = (ref || '').replace(/^\s+|\s+$/g, '');
  if (!ref) return ref;
  // 已是绝对地址
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(ref) || ref.indexOf('//') === 0) return ref;
  var m = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]+)(\/[^?#]*)?/.exec(base || '');
  if (!m) return ref;
  var root = m[1];            // https://host[:port]
  var path = m[2] || '/';     // /live/sctv4.m3u8
  if (ref.charAt(0) === '/') return root + ref;              // 根相对
  var q = path.indexOf('?');
  if (q >= 0) path = path.substring(0, q);
  var slash = path.lastIndexOf('/');
  var dir = slash >= 0 ? path.substring(0, slash + 1) : '/'; // /live/
  return root + dir + ref;                                    // 目录相对
}

// 给 URI 追加 auth_key（避免重复注入）
function sctvAddKey(uri, key) {
  if (!key) return uri;
  if (uri.indexOf('auth_key=') >= 0) return uri;
  return uri + (uri.indexOf('?') >= 0 ? '&' : '?') + 'auth_key=' + key;
}

// 给 m3u8 每个媒体 URI 注入 auth_key 并绝对化（复刻官网自定义 loader + 满足 mytv 文本规范）
function sctvRewritePlaylist(text, key, baseUrl) {
  if (!text) return text;
  var lines = text.split('\n');
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.replace(/\r$/, '');
    if (!trimmed) { out.push(line); continue; }

    // #EXT-X-KEY / #EXT-X-MAP 的 URI="..." 也要绝对化 + 带 key
    if (trimmed.charAt(0) === '#' && /^#EXT-X-(KEY|MAP)\b/.test(trimmed)) {
      line = line.replace(/URI="([^"]*)"/g, function (all, u) {
        return 'URI="' + sctvAddKey(sctvAbs(baseUrl, u), key) + '"';
      });
      out.push(line);
      continue;
    }
    // 其它注释行：保留
    if (trimmed.charAt(0) === '#') { out.push(line); continue; }

    // 媒体 URI（.ts 分片、子 m3u8）：先绝对化，再补 auth_key
    out.push(sctvAddKey(sctvAbs(baseUrl, trimmed), key));
  }
  return out.join('\n');
}
