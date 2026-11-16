/* 北京台诊断脚本 —— 只用来定位问题，测完换回正式 btime.js
 * 用法：把源里的 btime.js 临时改成 btime-diag.js，测一次看报错文字
 */
function main(item) {
  var uri = (item && item.url) ? String(item.url) : '';
  var pid = (item && item.id !== undefined && item.id !== null && String(item.id) !== '')
    ? String(item.id)
    : ((typeof ku9 !== 'undefined' && ku9 && typeof ku9.getQuery === 'function')
        ? String(ku9.getQuery(uri, 'id') || '') : '');

  // 把关键信息拼成一段可读文字，作为 url 返回 —— 播放器报错会显示它
  function show(tag, v) { return tag + '=' + String(v).replace(/[?&#\s]/g, '_').substring(0, 120); }

  if (!pid) return 'DIAG|' + show('noid', uri) + '|item=' + JSON.stringify(item).substring(0, 80);

  var ts = Math.floor((new Date()).getTime() / 1000);
  var api = 'https://pc.api.btime.com/video/play?from=pc&id=' + pid +
            '&type_id=151&timestamp=' + ts + '&sign=x&guid=x';

  var r1 = 'NOCALL', r2 = 'NOCALL';
  try {
    var a = ku9.request(api, 'GET', { 'User-Agent': 'Mozilla/5.0' });
    r1 = 'code' + (a ? a.code : 'x') + ':' + (a && a.body ? String(a.body).substring(0, 60) : 'EMPTY');
  } catch (e1) { r1 = 'ERR:' + String(e1).substring(0, 30); }
  try {
    var b = ku9.get(api, { 'User-Agent': 'Mozilla/5.0' });
    r2 = b ? String(b).substring(0, 60) : 'EMPTY';
  } catch (e2) { r2 = 'ERR:' + String(e2).substring(0, 30); }

  return 'DIAG|pid=' + pid + '|REQ[' + r1 + ']|GET[' + r2 + ']';
}
