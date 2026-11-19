/*
 * 看厦门（厦门广电）JS 直播源 —— mytv / 酷9 原生   v6
 * v6：退回 mytv 标准 headers 字段（v5 的 url|Referer 内嵌会让 new URI 失败 → 2004）
 * 用法: javascript://.../xmtv.js?id=xm1   自测: ...id=xm1&debug=1
 */
var XM_IS_KU9 = (typeof ku9 !== 'undefined');
var XM_API = 'https://mapi1.kxm.xmtv.cn/api/v1/channel.php';
var XM_REFERER = 'https://www.xmtv.cn/';
var XM_UA = 'Mytv.Android';
var XM_CH = {
  xm1: '16', xm2: '17', xmws: '84', xmyd: '52',
  xmtv1: '16', xmtv2: '17', weishi: '84', yidong: '52'
};
function xmGetQuery(s, key) {
  try { if (XM_IS_KU9 && typeof ku9.getQuery === 'function') return ku9.getQuery(s, key); } catch (e) {}
  try {
    var re = new RegExp('(?:^|[?&])' + key + '=([^&]*)');
    var m = re.exec(s || '');
    return m ? decodeURIComponent(m[1]) : '';
  } catch (e) {}
  return '';
}
function xmGet(url) {
  var hs = ['Referer: ' + XM_REFERER, 'User-Agent: ' + XM_UA];
  try { if (XM_IS_KU9 && typeof ku9.get === 'function') return (ku9.get(url, hs) || '') + ''; } catch (e) {}
  try {
    if (typeof mytv !== 'undefined' && typeof mytv.request === 'function') {
      var r = mytv.request(url, 'GET', hs, '');
      return ((r && r.body) || '') + '';
    }
    if (typeof mytv !== 'undefined' && typeof mytv.get === 'function') return (mytv.get(url, hs) || '') + '';
    if (typeof mytv !== 'undefined' && typeof mytv.fetch === 'function') return (mytv.fetch(url) || '') + '';
  } catch (e) {}
  return '';
}
function xmHeaders() {
  return 'Referer: ' + XM_REFERER + '\nUser-Agent: ' + XM_UA;
}
function xmUnescape(s) { return (s || '').replace(/\\\//g, '/'); }
function xmParse(body) {
  var out = { url: '', via: '', rawLen: (body || '').length };
  try {
    var j = JSON.parse(body);
    if (j && j.length && j[0]) {
      var c = j[0];
      if (c.channel_stream && c.channel_stream.length && c.channel_stream[0]) {
        var media = xmUnescape(c.channel_stream[0].m3u8 || '');
        if (/^https?:\/\//.test(media)) { out.url = media; out.via = 'media'; return out; }
      }
      var top = xmUnescape(c.m3u8 || '');
      if (/^https?:\/\//.test(top)) { out.url = top; out.via = 'master'; return out; }
    }
  } catch (e) { out.parseErr = String(e); }
  var m = /"m3u8"\s*:\s*"(https?:[^"]+)"/.exec(body || '');
  if (m) { out.url = xmUnescape(m[1]); out.via = 'regex'; }
  return out;
}
function main(item) {
  var paramStr = '';
  if (typeof item === 'string') paramStr = item;
  else if (item && typeof item === 'object') paramStr = item.url || item.param || '';
  var code = xmGetQuery(paramStr, 'id') || 'xm1';
  var channelId = XM_CH[code] || (/^\d+$/.test(code) ? code : XM_CH.xm1);
  var isDebug = !!xmGetQuery(paramStr, 'debug');
  var api = XM_API + '?channel_id=' + channelId;
  var body = xmGet(api);
  var parsed = xmParse(body);
  var media = parsed.url;
  var hdrStr = xmHeaders();
  if (XM_IS_KU9) {
    if (!media) return { url: '', referer: XM_REFERER, userAgent: XM_UA, error: 'API取流失败 id=' + channelId };
    return { url: media, referer: XM_REFERER, userAgent: XM_UA };
  }
  if (!media) {
    var err = { error: 'API取流失败 id=' + channelId + ' rawLen=' + parsed.rawLen };
    if (isDebug) { err.debug = true; err.id = code; err.channelId = channelId; err.api = api; err.apiPrefix = (body || '').slice(0, 160); }
    return JSON.stringify(err);
  }
  if (isDebug) {
    return JSON.stringify({
      debug: true, id: code, channelId: channelId, api: api,
      via: parsed.via, media: media, headers: hdrStr,
      apiPrefix: (body || '').slice(0, 120)
    });
  }
  return JSON.stringify({ url: media, headers: hdrStr });
}
