/*
 * 看厦门（厦门广电）JS 直播源 —— mytv / 酷9 原生   v3
 * 逆向自「看厦门」App「看一厦」入口，官方 API（2026-11-19 实测）
 *
 * ★ v3 改动（对照 mytv 官方 JS 库 sh.js / sz.js 的写法）：
 *   - UA 统一用 "Mytv.Android"（= 播放器全局 UA），取 API 与返回播放器
 *     用【同一组 header】。作者 sh.js/sz.js 全部这么写——mytv 会把 JS
 *     返回的 UA 与全局 UA 对齐，用别的 UA 可能导致 header 传递/校验异常。
 *   - headers 数组 -> join('\n') 字符串返回（mytv 官方格式）。
 *
 * ★ 官方链路：
 *   1) API: https://mapi1.kxm.xmtv.cn/api/v1/channel.php?channel_id=<ID>
 *      旧 ID(57/58/59/138) 已失效；现用下表官方 ID。
 *   2) API 返回两个地址：
 *      [0].m3u8                      = master（相对路径，IJK 会拼错 -> -10000）
 *      [0].channel_stream[0].m3u8    = media 绝对 URL（带 _upt 签名）
 *      → 直接返回 media 绝对 URL，绕开 master 相对路径解析坑。
 *   3) _upt 签名会过期 → 每次点播现调 API，不写死。
 *   4) CDN 强制 Referer: https://www.xmtv.cn/（实测：裸/仅UA=403，Referer+任意UA=200）
 *
 * 用法: javascript://.../xmtv.js?id=xm1
 * 自测: javascript://.../xmtv.js?id=xm1&debug=1  （返回诊断 JSON，不播放）
 */

// ---------- 环境兼容层 ----------
var XM_IS_KU9 = (typeof ku9 !== 'undefined');
var XM_API = 'https://mapi1.kxm.xmtv.cn/api/v1/channel.php';
var XM_REFERER = 'https://www.xmtv.cn/';
var XM_UA = 'Mytv.Android';   // ★ v3: 与播放器全局 UA 一致（作者 sh.js/sz.js 通用写法）

// 取 API 与返回播放器共用同一组 header（作者模式）
var XM_HEADERS = [
  'Referer: ' + XM_REFERER,
  'User-Agent: ' + XM_UA
];

// 频道表：短码 -> 官方数字 ID（2026-11-19 实测）
var XM_CH = {
  xm1:   '16',  // 厦视一套
  xm2:   '17',  // 厦视二套
  xmws:  '84',  // 厦门卫视
  xmyd:  '52',  // 厦门电视台移动电视
  xmtv1: '16', xmtv2: '17', weishi: '84', yidong: '52'
};

function xmGetQuery(url, key) {
  try {
    if (XM_IS_KU9 && typeof ku9.getQuery === 'function') return ku9.getQuery(url, key);
  } catch (e) {}
  try {
    var re = new RegExp('(?:^|[?&])' + key + '=([^&]*)');
    var m = re.exec(url || '');
    return m ? decodeURIComponent(m[1]) : '';
  } catch (e) {}
  return '';
}

function xmRequest(url) {
  // 与返回播放器用同一组 header（XM_HEADERS）
  try {
    if (XM_IS_KU9 && typeof ku9.request === 'function') {
      var r = ku9.request(url, 'GET', XM_HEADERS);
      return { body: (r && r.body) || '', code: (r && r.code) || 0 };
    }
  } catch (e) {}
  try {
    if (typeof mytv !== 'undefined' && typeof mytv.get === 'function') {
      return { body: mytv.get(url, XM_HEADERS) || '', code: 200 };
    }
    if (typeof mytv !== 'undefined' && typeof mytv.request === 'function') {
      var mr = mytv.request(url, 'GET', XM_HEADERS, '');
      return { body: ((mr && mr.body) || '') + '', code: ((mr && mr.code) || 0) };
    }
    if (typeof mytv !== 'undefined' && typeof mytv.fetch === 'function') {
      return { body: mytv.fetch(url) || '', code: 200 };
    }
  } catch (e) {}
  return { body: '', code: 0 };
}

function xmUnescape(s) {
  return (s || '').indexOf('\\/') >= 0 ? s.replace(/\\\//g, '/') : (s || '');
}

// 返回 { url, via, apiHasStream, rawLen }
function xmParseM3u8(body) {
  var out = { url: '', via: '', apiHasStream: false, rawLen: (body || '').length };
  try {
    var j = JSON.parse(body);
    if (j && j.length && j[0]) {
      var c = j[0];
      if (c.channel_stream && c.channel_stream.length && c.channel_stream[0]) {
        out.apiHasStream = true;
        var media = xmUnescape(c.channel_stream[0].m3u8 || '');
        if (/^https?:\/\//.test(media)) {
          out.url = media; out.via = 'media'; return out;
        }
      }
      var top = xmUnescape(c.m3u8 || '');
      if (/^https?:\/\//.test(top)) { out.url = top; out.via = 'master'; return out; }
    }
  } catch (e) { out.parseErr = String(e); }
  try {
    var m = /"m3u8"\s*:\s*"(https?:[^"]+)"/.exec(body);
    if (m) { out.url = xmUnescape(m[1]); out.via = 'regex'; }
  } catch (e2) {}
  return out;
}

function main(item) {
  // ★ v3 关键修复：mytv 的 main(item) 参数是【查询字符串本身】
  //   （如 "id=xm1&debug=1"，见作者 sh.js/sz.js 的 parseItem(item)）
  //   酷9 才可能传 {url:"..."} 对象。v2 只读 item.url → 在 mytv 下永远为空 →
  //   所有频道都退化成默认 xm1、debug 也失效 → 表现为"厦门台都不能播"。
  var paramStr = '';
  if (typeof item === 'string') paramStr = item;
  else if (item && typeof item === 'object') paramStr = item.url || item.param || '';
  var code = xmGetQuery(paramStr, 'id') || 'xm1';
  var channelId = XM_CH[code] || (/^\d+$/.test(code) ? code : XM_CH.xm1);
  var isDebug = !!xmGetQuery(paramStr, 'debug');

  var api = XM_API + '?channel_id=' + channelId;
  var resp = xmRequest(api);
  var parsed = xmParseM3u8(resp.body);
  var m3u8 = parsed.url;
  var hdrStr = XM_HEADERS.join('\n');

  if (isDebug) {
    return JSON.stringify({
      debug: true,
      id: code, channelId: channelId, api: api,
      apiCode: resp.code, apiRawLen: parsed.rawLen,
      apiHasStream: parsed.apiHasStream, parseErr: parsed.parseErr || '',
      via: parsed.via, url: m3u8, headers: hdrStr,
      apiPrefix: (resp.body || '').slice(0, 120)
    });
  }

  if (XM_IS_KU9) {
    if (!m3u8) return { url: '', referer: XM_REFERER, userAgent: XM_UA };
    return { url: m3u8, referer: XM_REFERER, userAgent: XM_UA };
  }

  if (!m3u8) {
    return JSON.stringify({ error: 'API取流失败 code=' + resp.code + ' id=' + channelId + ' rawLen=' + parsed.rawLen });
  }
  return JSON.stringify({ url: m3u8, headers: hdrStr });
}
