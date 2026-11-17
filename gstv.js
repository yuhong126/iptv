/*
 * 甘肃网络广播电视台 JS 直播源（mytv / 酷9 原生）—— v1
 * 逆向自「视听甘肃」APP com.hoge.android.gstv（2026-11-17 从雷电模拟器 logcat + H5 接口抓出）
 *
 * ★ 链路（本机端到端实测 9/9 频道 m3u8 + 分片全 200）：
 *   APP 播放地址： https://live.gstv.com.cn/live/<流名>.m3u8 （天翼云 openresty）
 *   - 无鉴权、无 auth_key、无 Referer 校验；任何 UA（含浏览器）都能拉，Access-Control-Allow-Origin: *
 *   - 分片为相对路径且自带 ctyun 参数，播放器按 m3u8 基址自动解析
 *   - 频道表来自 APP 接口：POST https://app-api.gstv.com.cn/gs/av/tv/channels
 *       header: customerId:4 / deviceId:<任意> / storeId:83
 *     广播表：POST /gs/av/radio/channels（同样 header）
 *
 * ★ 设计：默认用内置流名表直接返回（零网络请求，最稳；四川的教训是少即是多）。
 *   万一 APP 换了流名导致失效，可加 &refresh=1 走动态接口实时取（需 mytv.request 支持）。
 *
 * 用法: javascript://.../gstv.js?id=gstv1
 *       id 见下方 CH 表；可选 &refresh=1 强制走接口刷新
 */

// ---------- 环境兼容层：同时支持酷9(ku9) 与 mytv ----------
var GSTV_IS_KU9 = (typeof ku9 !== 'undefined');

function gstvGetQuery(url, key) {
  try {
    if (GSTV_IS_KU9 && typeof ku9.getQuery === 'function') return ku9.getQuery(url, key);
  } catch (e) {}
  try {
    var re = new RegExp('(?:^|[?&])' + key + '=([^&]*)');
    var m = re.exec(url || '');
    return m ? decodeURIComponent(m[1]) : '';
  } catch (e) {}
  return '';
}

function gstvRequest(url, method, headers, body) {
  try {
    if (GSTV_IS_KU9 && typeof ku9.request === 'function') {
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

// ---------- 频道表（id -> {n:名称, s:流名, t:类型 tv/radio}） ----------
// 全部来自 APP 接口 /gs/av/{tv,radio}/channels，2026-11-17 实测有效
var GSTV_CH = {
  'gstv1': { n:'甘肃卫视',     s:'oxfhvoy', t:'tv' },
  'gstv2': { n:'文化影视',     s:'lg2va3a', t:'tv' },
  'gstv3': { n:'移动电视',     s:'j6od116', t:'tv' },
  'gstv4': { n:'少儿频道',     s:'456r6be', t:'tv' },
  'gstv5': { n:'科教频道',     s:'8lr1gvm', t:'tv' },
  'gstv6': { n:'公共应急',     s:'c6gljof', t:'tv' },
  'gstv7': { n:'交通广播',     s:'onmmubx', t:'radio' },
  'gstv8': { n:'农村广播',     s:'aqbtkox', t:'radio' },
  'gstv9': { n:'新闻综合广播', s:'audeer3', t:'radio' }
};

var GSTV_HOST   = 'https://live.gstv.com.cn';
var GSTV_API    = 'https://app-api.gstv.com.cn';
var GSTV_UA     = 'Mozilla/5.0 (Linux; Android 12)';  // 甘肃不校验 UA，用常规值即可
var GSTV_REFER  = 'https://h5.gstv.com.cn/';

function main(item) {
  // mytv: item 是 "id=xxx" 查询字符串；酷9: item 是 {url:'...', id:'xxx'} 对象
  var urlArg = (typeof item === 'string') ? item : (item && item.url) || '';
  var id = gstvGetQuery(urlArg, 'id');
  if (!id && item && typeof item === 'object' && item.id) id = item.id + '';
  var refresh = gstvGetQuery(urlArg, 'refresh');

  if (!GSTV_CH[id]) id = 'gstv1';  // 未知 id 兜底为甘肃卫视
  var ch = GSTV_CH[id];
  var stream = ch.s;
  var name = ch.n;

  // 可选：动态刷新流名（内置表失效时用 &refresh=1）
  if (refresh === '1' && ch) {
    var api = GSTV_API + (ch.t === 'radio' ? '/gs/av/radio/channels' : '/gs/av/tv/channels');
    try {
      var res = gstvRequest(api, 'POST', {
        'customerId': '4', 'deviceId': '1588888', 'storeId': '83',
        'content-type': 'application/json'
      }, '{}');
      if (res.body) {
        var j = (typeof res.body === 'string') ? JSON.parse(res.body) : res.body;
        if (j && j.code === '200' && j.data && j.data.channels) {
          var arr = j.data.channels;
          // 用名称匹配（channelId 与我们的 id 不同，名称稳定）
          for (var i = 0; i < arr.length; i++) {
            if (arr[i].name === name && arr[i].liveUrl) {
              var m = /\/live\/([a-zA-Z0-9_]+)\.m3u8/.exec(arr[i].liveUrl);
              if (m) stream = m[1];
              break;
            }
          }
        }
      }
    } catch (e) {}
  }

  var playUrl = GSTV_HOST + '/live/' + stream + '.m3u8';
  var headers = 'User-Agent: ' + GSTV_UA + '\nReferer: ' + GSTV_REFER;

  // 酷9 返回对象；mytv 返回 JSON 字符串
  if (GSTV_IS_KU9) {
    return { url: playUrl, referer: GSTV_REFER, userAgent: GSTV_UA };
  }
  return JSON.stringify({ url: playUrl, headers: headers });
}
