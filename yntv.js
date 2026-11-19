/**
 * 云南电视台（云视网官方源）JS 脚本
 * 用法: javascript://你的raw地址/yntv.js?id=ynws
 * 频道 id 参考: ynws(云南卫视), ynds(云南都市), ynyl(云南娱乐), yngg(云南公共), yngj(云南国际), ynse(云南少儿)
 */

var YNTV_REFERER = 'https://www.yntv.cn/live.html';
var YNTV_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// 频道名称映射（根据论坛信息整理）
var YN_CH = {
  'ynws': 'yunnanweishi',
  'ynds': 'yunnandushi',
  'ynyl': 'yunnanyule',
  'yngg': 'yunnangonggong',
  'yngj': 'yunnanguoji',
  'ynse': 'yunnanshaoer'
};

function ynGetId(item) {
  var raw = '';
  if (typeof item === 'string') raw = item;
  else if (item && item.id) raw = String(item.id);
  else if (item && item.url) raw = String(item.url);
  var m = /[?&]id=([^&#]+)/.exec(raw);
  return m ? decodeURIComponent(m[1]).toLowerCase() : 'ynws'; // 默认云南卫视
}

function main(item) {
  var id = ynGetId(item);
  var chName = YN_CH[id];
  if (!chName) {
    return JSON.stringify({ error: '未知频道: ' + id });
  }

  // 1. 请求签名接口
  var apiUrl = 'https://api.yntv.ynradio.com/index/jmd/getRq?name=' + chName;
  var apiHeaders = [
    'Referer: ' + YNTV_REFERER,
    'User-Agent: ' + YNTV_UA
  ];

  var secretData;
  try {
    var apiRes = mytv.get(apiUrl, apiHeaders);
    secretData = JSON.parse(apiRes);
  } catch (e) {
    return JSON.stringify({ error: '获取签名失败: ' + e.message });
  }

  if (!secretData || !secretData.url || !secretData.string || !secretData.time) {
    return JSON.stringify({ error: '签名接口返回数据不完整', raw: secretData });
  }

  // 2. 拼接最终地址
  var finalUrl = 'https://tvlive.yntv.cn' + secretData.url
               + '?wsSecret=' + secretData.string
               + '&wsTime=' + secretData.time;

  // 3. 返回给 mytv，附带必需的 Referer
  return JSON.stringify({
    url: finalUrl,
    headers: 'Referer: ' + YNTV_REFERER + '\nUser-Agent: ' + YNTV_UA
  });
}
