/*
 * 四川网络广播电视台 JS 直播源（mytv / 酷9 原生）
 * 源页面: https://www.sctv.com/channelLive/1016553
 *
 * 原理（严格复刻官网播放逻辑）:
 *   1) 电视流 CDN 开启 Tengine 防盗链，裸 m3u8 一律 403；
 *   2) 官网用 access_token 调 gw.scgchc.com/exp/v1/anti/user/getLiveSecret
 *      换取一次性 auth_key（有效期 3600s），再拼到 m3u8 问号参数后播放；
 *   3) 广播流（bdshowf.scgczm.com）无需鉴权，可直接播放。
 *
 * access_token 写在下方 SCTV_TOKEN，有效期见 JWT exp（当前约到 2026-11-30）。
 * 过期后重新登录 www.sctv.com，从浏览器控制台执行：
 *   JSON.parse(localStorage.getItem('scgc_userAccountInfo')).access_token
 * 把结果替换 SCTV_TOKEN 即可。也可用 ?token=xxx 临时覆盖。
 *
 * 用法: javascript://https://raw.githubusercontent.com/<用户>/<仓库>/main/sctv.js?id=1016553
 */
function main(item) {
  var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0';
  var REFERER = 'https://www.sctv.com/';

  // 有效期至 2026-11-30（JWT exp=1796041231），过期请按上方说明更新
  var SCTV_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiU0VSVklDRV9TQ0dDLURFTU8iXSwidXNlcl9pZCI6MTkyMDIwNDYxOTQ2MjE0NDAwMiwic2NvcGUiOlsiYWxsIl0sImV4cCI6MTc5NjA0MTIzMSwiYXV0aG9yaXRpZXMiOlsiUk9MRV9BUFBfQ0xJRU5UX1VTRVIiXSwianRpIjoiMGIxYTg2ODUtMGJkNy00ODlhLTg5MDQtMmQxNzFhMDkyZmVmIiwiY2xpZW50X2lkIjoiU0VSVklDRV9TQ0dDLUFQUCJ9.bmjt3W7XKKMcWt56bVw76YI6o4H368XvrOt8y5kDnGTKTsFYpaMTlaV9U3puugTghC0a465p8x5S7BPu__JaBcoohMqw25-iXNrH1ticoXHJwOwatu3TCJd5rhl83-znX46R__b26LrNiLdhLd3PFm2yLmj0UxiZwo7KYCWyumR0Zfbaf_E_23Pa3CzSRrba0wV4hhKedXo8aNufSH7u7kFvWa4mis5gVvP-ViiERVRFhIG6-EGqhDDBXNUSXgO4_RbQiMJZshX3YgNcbgB4eAbZLhk46tqekGHQRqSgPI_Z-rCuy9GzIr2LPoi_5jvCG0WuKpVfHuu18_88Kqz1yg';

  // 频道表: id -> {n:名称, u:m3u8, h:host, p:path, radio:是否广播免鉴权}
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

  var id = item.id || ku9.getQuery(item.url, 'id') || '1016553';
  var ch = CH[id];
  if (!ch) return { url:'', referer:REFERER, userAgent:UA };

  // 临时 token 覆盖（便于 token 过期时不改文件）
  var token = ku9.getQuery(item.url, 'token') || SCTV_TOKEN;

  // 广播：无需鉴权，直接播放
  if (ch.radio) {
    return { url: ch.u, referer: REFERER, userAgent: UA };
  }

  // 电视：换取 auth_key（优先读缓存，TTL 50 分钟；票据有效期 3600s）
  var cacheKey = 'sctv_auth_' + ch.p;
  var key = ku9.getCache(cacheKey) || '';
  if (!key) {
    var api = 'https://gw.scgchc.com/exp/v1/anti/user/getLiveSecret'
            + '?streamName=' + encodeURIComponent(ch.p)
            + '&host=' + encodeURIComponent(ch.h);
    var res = ku9.request(api, 'GET', {
      'Authorization': 'bearer ' + token,
      'User-Agent': UA,
      'Referer': REFERER,
      'Accept': 'application/json, text/plain, */*'
    });
    var body = (res && res.body) || '';
    if (body) {
      try {
        var j = typeof body === 'string' ? JSON.parse(body) : body;
        if (j && j.rs === 200 && j.data && j.data.auth_key) {
          key = j.data.auth_key;
          var ttl = (j.data.expires_in ? j.data.expires_in - 600 : 3000) * 1000;
          if (ttl < 60000) ttl = 3000000;
          ku9.setCache(cacheKey, key, ttl);
        }
      } catch (e) { /* 解析失败则不用 key */ }
    }
  }

  // 拼 auth_key 到 m3u8（官网做法：URL.searchParams.set('auth_key', key)）
  var url = key ? (ch.u + (ch.u.indexOf('?') >= 0 ? '&' : '?') + 'auth_key=' + key) : ch.u;
  return { url: url, referer: REFERER, userAgent: UA };
}
