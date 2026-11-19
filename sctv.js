/*
 * 四川网络广播电视台 JS 直播源 (sctv.js) - 稳定优化版
 * 用法: javascript://你的raw地址/sctv.js?id=1016553
 * 
 * ★ 重要：如果你的 MYTV 播不出来，请务必在设置中将播放器内核切换为 Media3！
 * 四川 CDN 双重校验(Referer + 黑名单 UA)，IJK 默认不转发分片 headers，会导致 403。
 */

var SCTV_UA = 'AliPlayer';                       // 必须是非浏览器 UA，绕开黑名单
var SCTV_REFERER = 'https://scgc.video.play/';   // APP 真实 Referer，白名单
var SCTV_HOST = 'tvshowf.scgczm.com';
var SCTV_API = 'https://gw.scgchc.com/app/v1/anti/getLiveSecret';

// 频道表
var SCTV_CH = {
  '1016553': { n: '四川卫视', s: 'sctv1' },
  '1016554': { n: '经济频道', s: 'sctv2' },
  '1016555': { n: '文旅体育', s: 'sctv3' },
  '1844567123037646849': { n: '新闻频道', s: 'sctv4' },
  '1016557': { n: '影视文艺', s: 'sctv5' },
  '1016559': { n: '星空购物', s: 'sctv6' },
  '1016558': { n: '妇女儿童', s: 'sctv7' },
  '1016560': { n: '四川乡村', s: 'sctv9' },
  '1016561': { n: '康巴卫视', s: 'kangba' },
  // 广播（免鉴权，可直接播放）
  '1025920': { n: '四川综合广播', r: 'sc_ts03', radio: 1 },
  '1025913': { n: '四川新闻广播', r: 'sc_ts08', radio: 1 },
  '1025919': { n: '四川交通广播', r: 'sc_ts06', radio: 1 },
  '1025914': { n: '民族频率', r: 'sc_ts09', radio: 1 },
  '1025917': { n: '城市之音', r: 'sc_ts01', radio: 1 },
  '1025918': { n: '岷江音乐', r: 'sc_ts04', radio: 1 }
};

function sctvGetQuery(url, key) {
  var re = new RegExp('(?:^|[?&])' + key + '=([^&]*)');
  var m = re.exec(url || '');
  return m ? decodeURIComponent(m[1]) : '';
}

function main(item) {
  // 建议：如果过几天突然不能看了，大概率是下面这个 token 过期了，需要重新抓包
  var SCTV_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiU0VSVklDRV9TQ0dDLURFTU8iXSwidXNlcl9pZCI6MTkyMDIwNDYxOTQ2MjE0NDAwMiwic2NvcGUiOlsiYWxsIl0sImV4cCI6MTc5NjA0MTIzMSwiYXV0aG9yaXRpZXMiOlsiUk9MRV9BUFBfQ0xJRU5UX1VTRVIiXSwianRpIjoiMGIxYTg2ODUtMGJkNy00ODlhLTg5MDQtMmQxNzFhMDkyZmVmIiwiY2xpZW50X2lkIjoiU0VSVklDRV9TQ0dDLUFQUCJ9.bmjt3W7XKKMcWt56bVw76YI6o4H368XvrOt8y5kDnGTKTsFYpaMTlaV9U3puugTghC0a465p8x5S7BPu__JaBcoohMqw25-iXNrH1ticoXHJwOwatu3TCJd5rhl83-znX46R__b26LrNiLdhLd3PFm2yLmj0UxiZwo7KYCWyumR0Zfbaf_E_23Pa3CzSRrba0wV4hhKedXo8aNufSH7u7kFvWa4mis5gVvP-ViiERVRFhIG6-EGqhDDBXNUSXgO4_RbQiMJZshX3YgNcbgB4eAbZLhk46tqekGHQRqSgPI_Z-rCuy9GzIr2LPoi_5jvCG0WuKpVfHuu18_88Kqz1yg';

  var urlArg = (item && item.url) || (typeof item === 'string' ? item : '') || '';
  var id = sctvGetQuery(urlArg, 'id') || '1016553'; // 默认四川卫视
  var ch = SCTV_CH[id];

  if (!ch) {
    return JSON.stringify({ error: '未知频道 id: ' + id });
  }

  // 请求头：K:V 换行格式
  var headersStr = 'Referer: ' + SCTV_REFERER + '\nUser-Agent: ' + SCTV_UA;

  // 1. 广播处理（直连即可）
  if (ch.radio) {
    var rurl = 'https://bdshowf.scgczm.com/scapp/' + ch.r + '.m3u8';
    return JSON.stringify({ url: rurl, headers: headersStr });
  }

  // 2. 电视处理（需要换取 auth_key）
  var stream = '/live/' + ch.s + '.m3u8';
  var playUrl = 'https://' + SCTV_HOST + stream;
  var token = sctvGetQuery(urlArg, 'token') || SCTV_TOKEN;
  
  // 获取当前时间戳
  var timestamp = Math.floor(Date.now() / 1000);
  var apiUrl = SCTV_API + '?streamName=' + encodeURIComponent(stream)
             + '&host=' + encodeURIComponent(SCTV_HOST)
             + '&txTime=' + timestamp;

  var secret = '';
  try {
    // 请求鉴权接口
    var apiHeaders = [
      'authorization: bearer ' + token,
      'referer: ' + SCTV_REFERER,
      'User-Agent: ' + SCTV_UA,
      'Accept: application/json, text/plain, */*'
    ];
    var resBody = mytv.get(apiUrl, apiHeaders);
    
    // 解析返回的 JSON
    var j = JSON.parse(resBody);
    if (j && Number(j.rs) === 200 && j.data && j.data.secret) {
      secret = j.data.secret;
    } else {
      // 如果这里报错，大概率是 token 过期了，请重新抓包
      console.log("四川台鉴权失败 API返回: " + resBody);
    }
  } catch (e) {
    console.log("四川台请求异常: " + e.message);
  }

  // 拼接最终地址
  var finalUrl = secret 
    ? (playUrl + (playUrl.indexOf('?') >= 0 ? '&' : '?') + secret)
    : playUrl;

  return JSON.stringify({ 
    url: finalUrl, 
    headers: headersStr 
  });
}
