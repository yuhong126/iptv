/*
 * 看厦门（厦门广电）JS 直播源 —— mytv / 酷9 原生   v5
 * v5：Referer/UA 内嵌进 URL（四川 sctv.js v5 已验证，全内核生效）
 * 用法: ...xmtv.js?id=xm1  自测: ...id=xm1&debug=1
 */
var XM_IS_KU9 = (typeof ku9 !== 'undefined');
var XM_API = 'https://mapi1.kxm.xmtv.cn/api/v1/channel.php';
var XM_REFERER = 'https://www.xmtv.cn/';
var XM_UA = 'Mytv.Android';
var XM_HEADERS = [ 'Referer: ' + XM_REFERER, 'User-Agent: ' + XM_UA ];
var XM_PIPE = '|Referer=' + XM_REFERER + '|User-Agent=' + XM_UA;
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
  try { if (XM_IS_KU9 && typeof ku9.get === 'function') return (ku9.get(url, XM_HEADERS) || '') + ''; } catch (e) {}
  try {
    if (typeof mytv !== 'undefined' && typeof mytv.get === 'function') return (mytv.get(url, XM_HEADERS) || '') + '';
    if (typeof mytv !== 'undefined' && typeof mytv.request === 'function') {
      var r = mytv.request(url, 'GET', XM_HEADERS, '');
      return ((r && r.body) || '') + '';
    }
    if (typeof mytv !== 'undefined' && typeof mytv.fetch === 'function') return (mytv.fetch(url) || '') + '';
  } catch (e) {}
  return '';
}
function xmUnescape(s) { return (s || '').replace(/\\\//g, '/'); }
function xmMediaUrl(body) {
  try {
    var j = JSON.parse(body);
    if (j && j.length && j[0]) {
      var c = j[0];
      if (c.channel_stream && c.channel_stream.length && c.channel_stream[0]) {
        var media = xmUnescape(c.channel_stream[0].m3u8 || '');
        if (/^https?:\/\//.test(media)) return media;
      }
      var top = xmUnescape(c.m3u8 || '');
      if (/^https?:\/\//.test(top)) return top;
    }
  } catch (e) {}
  var m = /"m3u8"\s*:\s*"(https?:[^"]+)"/.exec(body || '');
  return m ? xmUnescape(m[1]) : '';
}
function main(item) {
  var paramStr = '';
  if (typeof item === 'string') paramStr = item;
  else if (item && typeof item === 'object') paramStr = item.url || item.param || '';
  var code = xmGetQuery(paramStr, 'id') || 'xm1';
  var channelId = XM_CH[code] || (/^\d+$/.test(code) ? code : XM_CH.xm1);
  var isDebug = !!xmGetQuery(paramStr, 'debug');
  var hdrStr = XM_HEADERS.join('\n');
  var api = XM_API + '?channel_id=' + channelId;
  var apiBody = xmGet(api);
  var media = xmMediaUrl(apiBody);
  if (!media) {
    var err = { error: 'API取流失败 id=' + channelId + ' rawLen=' + (apiBody || '').length };
    if (isDebug) { err.debug = true; err.id = code; err.channelId = channelId; err.api = api; err.apiPrefix = (apiBody || '').slice(0, 160); }
    return JSON.stringify(err);
  }
  var playUrl = media + XM_PIPE;
  if (XM_IS_KU9) return { url: media, referer: XM_REFERER, userAgent: XM_UA };
  if (isDebug) {
    return JSON.stringify({ debug: true, id: code, channelId: channelId, api: api, media: media, playUrl: playUrl, headers: hdrStr, apiPrefix: (apiBody || '').slice(0, 120) });
  }
  return JSON.stringify({ url: playUrl, headers: hdrStr });
}
