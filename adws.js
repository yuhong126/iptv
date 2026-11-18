/*
 * 安多卫视 / 青海藏语网络广播电视台 JS 直播源（mytv / 酷9 原生）
 * 逆向自 青海藏语网络广播电视台官网 qhtb.cn/zy/onlin/（2026-11-18）
 *
 * ★ 官方链路（网页本身就这么播）：
 *   1) 调 API 拿最新签名 m3u8：
 *      https://mapi.qhbtv.com.cn/cloudlive-manage-mapi/api/topic/detail
 *        ?app_secret=069486993db4acc22c846557c8880d9a&tenant_id=0&id=<频道ID>
 *      → data.topic_camera[0].streams[0].hls = m3u8 地址
 *   2) 该 m3u8 带 timestamp + encrypt 动态签名（timestamp=now+7200，服务端现算，每次都不同）
 *      → 必须每次点播现调 API，不能写死 URL（写死的约2小时后 403）
 *   3) m3u8 与分片均自带签名，CDN 不挑 UA / Referer（空UA、curl默认都 200）
 *      → headers 留空即可，IJK / Media3 / 酷9 通吃
 *
 * 用法: javascript://.../adws.js?id=anduo
 *       id 见下方 CH 表；可选 &id=<数字ID> 直接指定 topic id
 *
 * 兼容：mytv 返回 JSON 字符串（url + headers）；酷9 返回对象 {url}。
 */

// ---------- 环境兼容层 ----------
var AD_IS_KU9 = (typeof ku9 !== 'undefined');
var AD_API = 'https://mapi.qhbtv.com.cn/cloudlive-manage-mapi/api/topic/detail';
var AD_SECRET = '069486993db4acc22c846557c8880d9a';

// 频道表：短码 -> 官方 topic id
var AD_CH = {
  anduo:  '824587377543962624',  // ཨ་མདོ་བརྙན་འཕྲིན། 安多卫视（青海藏语电视）
  adws:   '824587377543962624',  // 同上别名
  qhzy:   '824587553121722368',  // མཚོ་སྔོན་བོད་སྐད་རྒྱང་སྒྲོག 青海藏语广播
  qhzygb: '824587553121722368'   // 同上别名
};

function adGetQuery(url, key) {
  try {
    if (AD_IS_KU9 && typeof ku9.getQuery === 'function') return ku9.getQuery(url, key);
  } catch (e) {}
  try {
    var re = new RegExp('(?:^|[?&])' + key + '=([^&]*)');
    var m = re.exec(url || '');
    return m ? decodeURIComponent(m[1]) : '';
  } catch (e) {}
  return '';
}

function adRequest(url) {
  // 多环境 fallback：ku9.request -> mytv.request -> mytv.get -> mytv.fetch
  try {
    if (AD_IS_KU9 && typeof ku9.request === 'function') {
      var r = ku9.request(url, 'GET', {});
      return { body: (r && r.body) || '', code: (r && r.code) || 0 };
    }
  } catch (e) {}
  try {
    if (typeof mytv !== 'undefined' && typeof mytv.request === 'function') {
      var mr = mytv.request(url, 'GET', [], '');
      return { body: ((mr && mr.body) || '') + '', code: ((mr && mr.code) || 0) };
    }
    if (typeof mytv !== 'undefined' && typeof mytv.get === 'function') {
      return { body: mytv.get(url, []) || '', code: 200 };
    }
    if (typeof mytv !== 'undefined' && typeof mytv.fetch === 'function') {
      return { body: mytv.fetch(url) || '', code: 200 };
    }
  } catch (e) {}
  return { body: '', code: 0 };
}

// 从 API 响应里抠出 hls（兼容转义 \/ 与正常 /）
function adParseHls(body) {
  try {
    var j = JSON.parse(body);
    var cams = j.topic_camera || [];
    if (!cams.length || !cams[0].streams || !cams[0].streams.length) return '';
    var hls = cams[0].streams[0].hls || '';
    if (hls.indexOf('\\/') >= 0) hls = hls.replace(/\\\//g, '/');
    return hls;
  } catch (e) {
    // 退化：正则直接抓 hls 字段
    try {
      var m = /"hls"\s*:\s*"([^"]+)"/.exec(body);
      if (m) return m[1].replace(/\\\//g, '/');
    } catch (e2) {}
  }
  return '';
}

function main(item) {
  var urlArg = (item && item.url) || '';
  var code = adGetQuery(urlArg, 'id') || 'anduo';
  var topicId = AD_CH[code] || (/^\d+$/.test(code) ? code : AD_CH.anduo);

  var api = AD_API + '?app_secret=' + AD_SECRET + '&tenant_id=0&id=' + topicId;
  var resp = adRequest(api);
  var hls = adParseHls(resp.body);

  if (AD_IS_KU9) {
    // 酷9：直接返回对象
    if (!hls) return { url: '', referer: '', userAgent: '' };
    return { url: hls, referer: '', userAgent: '' };
  }

  // mytv：返回 JSON 字符串。CDN 不挑 header，headers 留空。
  if (!hls) {
    return JSON.stringify({ error: 'API取流失败 code=' + resp.code + ' id=' + topicId });
  }
  return JSON.stringify({ url: hls, headers: '' });
}
