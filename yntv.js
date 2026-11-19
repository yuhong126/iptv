/**
 * 云南电视台（云视网 live.html 官方源）JS 脚本
 * 用法: javascript://你的raw地址/yntv.js?id=ynws
 * 
 * 频道列表：
 * ynws - 云南卫视
 * ynds - 云南都市
 * klpd - 康旅频道
 * lm gj - 澜湄国际
 */

var YN_REFERER = 'https://www.yntv.cn/live.html';
var YN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// 频道映射表（匹配网页端的内部ID）
var YN_CH = {
  'ynws':  { name: '云南卫视', code: 'ynws' },
  'ynds':  { name: '云南都市', code: 'ynds' },
  'klpd':  { name: '康旅频道', code: 'klpd' },
  'lmgj':  { name: '澜湄国际', code: 'lmgj' } 
};

function ynGetId(item) {
  var raw = '';
  if (typeof item === 'string') raw = item;
  else if (item && item.id) raw = String(item.id);
  else if (item && item.url) raw = String(item.url);
  var m = /[?&]id=([^&#]+)/.exec(raw);
  return m ? decodeURIComponent(m[1]).toLowerCase() : 'ynws';
}

function main(item) {
  var id = ynGetId(item);
  var isDebug = false;
  
  // 解析参数
  var rawStr = (item && item.url) || (typeof item === 'string' ? item : '') || '';
  if (/[?&]debug=1/.test(rawStr)) isDebug = true;

  var ch = YN_CH[id];
  if (!ch) {
    return JSON.stringify({ error: '未知频道代码: ' + id + '，请检查ID' });
  }

  // 云视网的接口，通常返回一个 JSON
  var apiUrl = 'https://www.yntv.cn/api/live/get_live_url?code=' + ch.code;
  
  try {
    var res = mytv.get(apiUrl, ['Referer: ' + YN_REFERER, 'User-Agent: ' + YN_UA]);
    var data = JSON.parse(res);
    
    // 接口通常返回 { code: 200, data: { url: "xxx" } } 或直接返回 url
    var liveUrl = '';
    if (data && data.data && data.data.url) {
      liveUrl = data.data.url;
    } else if (data && data.url) {
      liveUrl = data.url;
    } else if (typeof data === 'string' && data.indexOf('http') === 0) {
      liveUrl = data;
    }

    if (liveUrl) {
      return JSON.stringify({
        url: liveUrl,
        headers: 'Referer: ' + YN_REFERER + '\nUser-Agent: ' + YN_UA
      });
    } else {
      if (isDebug) {
        return JSON.stringify({ error: '接口未返回URL', rawData: data });
      }
      return JSON.stringify({ error: '获取直播地址失败，请加 debug=1 查看详情' });
    }
  } catch (e) {
    if (isDebug) {
      return JSON.stringify({ error: '请求接口异常', message: e.message });
    }
    return JSON.stringify({ error: '网络请求或解析失败' });
  }
}
