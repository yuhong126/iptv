/*
 * 看厦门 JS 源 v7（自检版）：正常播放=v6；&debug=1 实测全链路 HTTP code
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
function xmReq(url) {
  var hs = ['Referer: ' + XM_REFERER, 'User-Agent: ' + XM_UA];
  try {
    if (typeof mytv !== 'undefined' && typeof mytv.request === 'function') {
      var r = mytv.request(url, 'GET', hs, '');
      return { body: ((r && r.body) || '') + '', code: (r && r.code) || 0, via: 'request' };
    }
    if (typeof mytv !== 'undefined' && typeof mytv.get === 'function') {
      var b = (mytv.get(url, hs) || '') + '';
      var code = 0;
      if (b.indexOf('#EXTM3U') >= 0 || b.indexOf('"id"') >= 0) code = 200;
      else if (b.indexOf('forbid') >= 0 || b.indexOf('.ts') >= 0) code = 200;
      return { body: b, code: code, via: 'get' };
    }
    if (typeof mytv !== 'undefined' && typeof mytv.fetch === 'function') {
      return { body: mytv.fetch(url) || '', code: 0, via: 'fetch' };
    }
  } catch (e) { return { body: '', code: -1, via: 'ERR:' + String(e) }; }
  return { body: '', code: -2, via: 'none' };
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
  var r = xmReq(api);
  var parsed = xmParse(r.body);
  var media = parsed.url;
  var hdrStr = xmHeaders();

  if (XM_IS_KU9) {
    if (!media) return { url: '', referer: XM_REFERER, userAgent: XM_UA, error: 'API取流失败 id=' + channelId };
    return { url: media, referer: XM_REFERER, userAgent: XM_UA };
  }

  if (!media) {
    var err = { error: 'API取流失败 id=' + channelId + ' apiCode=' + r.code + ' rawLen=' + parsed.rawLen + ' via=' + r.via };
    if (isDebug) { err.debug = true; err.id = code; err.channelId = channelId; err.api = api; err.apiPrefix = (r.body || '').slice(0, 160); }
    return JSON.stringify(err);
  }

  if (isDebug) {
    var mr = xmReq(media);
    var m3u8Code = mr.code;
    var segCode = -9, segInfo = 'no-seg';
    var segM = /(?:^|\/)([^\/\s]+\.ts)/.exec(mr.body || '');
    if (segM) {
      var host = (media.match(/^https?:\/\/[^/]+/) || [''])[0];
      var segPathM = /(\/[^\s"']+\.ts)/.exec(mr.body || '');
      var segUrl = segPathM ? (host + segPathM[1]) : (host + '/' + segM[1]);
      var sr = xmReq(segUrl);
      segCode = sr.code;
      segInfo = segUrl + ' len=' + (sr.body || '').length;
    }
    return JSON.stringify({
      debug: true, id: code, channelId: channelId,
      api: api, apiCode: r.code, apiVia: r.via, rawLen: parsed.rawLen,
      via: parsed.via, media: media, headers: hdrStr,
      m3u8Code: m3u8Code, m3u8Head: (mr.body || '').slice(0, 40),
      segCode: segCode, segInfo: segInfo
    });
  }

  return JSON.stringify({ url: media, headers: hdrStr });
}
