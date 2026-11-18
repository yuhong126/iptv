/*
 * 看厦门（厦门广电）JS 直播源 —— mytv / 酷9 原生
 * 逆向自「看厦门」App「看一厦」入口，官方 API（2026-11-18 实测）
 *
 * ★ 官方链路（App 本身就这么播）：
 *   1) 调官方 API 拿最新 m3u8：
 *      https://mapi1.kxm.xmtv.cn/api/v1/channel.php?channel_id=<数字ID>
 *      注：2024 年网上流传的旧 ID(57/58/59/138) 已全部失效返回 []；
 *          现用官方真实 ID（见下表），已实测可用。
 *   2) ★★ 关键（v2 修复 -10000）：API 返回两个地址——
 *      [0].m3u8                      = 顶层 master，内容是 playlist.m3u8?_upt=签名
 *                                      里面用【相对路径】指向二级 media
 *      [0].channel_stream[0].m3u8     = 二级 media 的【绝对 URL】（也带 _upt 签名）
 *      IJK 内核解析"带 query 的 master + 相对路径"时会把 query 拼进路径 →
 *        错误请求 .../xmtjs1/?_upt=签名ytkTnG/live.m3u8 → 404 → -10000
 *      （手机系统播放器/VLC 标准解析没问题，所以手机能播、电视盒子 IJK 不能播）
 *      → v2 直接返回 channel_stream[0].m3u8（media 绝对 URL），绕开相对路径解析
 *   3) _upt 签名（8位hex + now+7200 时间戳）会过期 → 每次点播现调 API，不能写死
 *   4) 整条链路【 CDN 强制 Referer 】：
 *        必须带 Referer: https://www.xmtv.cn/（含 www.xmtv.cn 即可，写法宽松）
 *        裸 / 仅 UA / 旧Referer(kxmapp...) / m.xmtv.cn 全部 403；UA 任意不影响
 *      → headers 带 Referer 即可，IJK / Media3 / 酷9 通吃
 *
 * 用法: javascript://.../xmtv.js?id=xm1
 *       id 见下方 CH 表；也可直接用数字 id（如 id=16）
 *
 * 兼容：mytv 返回 JSON 字符串（url + headers）；酷9 返回对象 {url, referer, userAgent}
 */

// ---------- 环境兼容层 ----------
var XM_IS_KU9 = (typeof ku9 !== 'undefined');
var XM_API = 'https://mapi1.kxm.xmtv.cn/api/v1/channel.php';
var XM_REFERER = 'https://www.xmtv.cn/';
var XM_UA = 'Mozilla/5.0 (Windows NT 6.1; WOW64)';

// 频道表：短码 -> 官方数字 ID（2026-11-18 实测）
var XM_CH = {
  xm1:   '16',  // 厦视一套
  xm2:   '17',  // 厦视二套
  xmws:  '84',  // 厦门卫视
  xmyd:  '52',  // 厦门电视台移动电视
  // 别名
  xmtv1: '16',
  xmtv2: '17',
  weishi: '84',
  yidong: '52'
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
  // 多环境 fallback：ku9.request -> mytv.request -> mytv.get -> mytv.fetch
  var h = [ 'Referer: ' + XM_REFERER, 'User-Agent: ' + XM_UA ];
  try {
    if (XM_IS_KU9 && typeof ku9.request === 'function') {
      var r = ku9.request(url, 'GET', {});
      return { body: (r && r.body) || '', code: (r && r.code) || 0 };
    }
  } catch (e) {}
  try {
    if (typeof mytv !== 'undefined' && typeof mytv.request === 'function') {
      var mr = mytv.request(url, 'GET', h, '');
      return { body: ((mr && mr.body) || '') + '', code: ((mr && mr.code) || 0) };
    }
    if (typeof mytv !== 'undefined' && typeof mytv.get === 'function') {
      return { body: mytv.get(url, h) || '', code: 200 };
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

// v2：优先取二级 media 绝对 URL（绕开 IJK 解析 master 相对路径的坑）
// 返回 { url: 最终播放地址, via: 'media'|'master' }
function xmParseM3u8(body) {
  try {
    var j = JSON.parse(body);
    if (j && j.length && j[0]) {
      var c = j[0];
      // 首选 channel_stream[0].m3u8（media 绝对 URL）
      if (c.channel_stream && c.channel_stream.length && c.channel_stream[0]) {
        var media = xmUnescape(c.channel_stream[0].m3u8 || '');
        if (media.indexOf('http') === 0 && /^https?:\/\//.test(media)) {
          return { url: media, via: 'media' };
        }
      }
      // 回退顶层 master
      var top = xmUnescape(c.m3u8 || '');
      if (top.indexOf('http') === 0) return { url: top, via: 'master' };
    }
  } catch (e) {}
  // 退化：正则抓第一个 m3u8 字段
  try {
    var m = /"m3u8"\s*:\s*"(https?:[^"]+)"/.exec(body);
    if (m) return { url: xmUnescape(m[1]), via: 'regex' };
  } catch (e2) {}
  return { url: '', via: '' };
}

function main(item) {
  var urlArg = (item && item.url) || '';
  var code = xmGetQuery(urlArg, 'id') || 'xm1';
  var channelId = XM_CH[code] || (/^\d+$/.test(code) ? code : XM_CH.xm1);

  var api = XM_API + '?channel_id=' + channelId;
  var resp = xmRequest(api);
  var parsed = xmParseM3u8(resp.body);
  var m3u8 = parsed.url;

  if (XM_IS_KU9) {
    if (!m3u8) return { url: '', referer: '', userAgent: '' };
    return { url: m3u8, referer: XM_REFERER, userAgent: XM_UA };
  }

  if (!m3u8) {
    return JSON.stringify({ error: 'API取流失败 code=' + resp.code + ' id=' + channelId });
  }
  // CDN 强制 Referer；UA 任意（给个浏览器 UA 更保险）
  return JSON.stringify({ url: m3u8, headers: 'Referer: ' + XM_REFERER + '\nUser-Agent: ' + XM_UA });
}
