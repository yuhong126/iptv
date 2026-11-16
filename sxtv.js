/* ============================================================
 * 山西台直播 · mytv / 酷9 通用 JS 源  (v2 - 自动对时 + 自动试错)
 *
 * 用法（一行一个台）：
 *   山西卫视,javascript://<本文件的在线地址>?id=0
 *
 * id 对照：
 *   0 山西卫视      1 黄河电视台     2 山西经济与科技
 *   3 山西影视      4 山西社会与法治  5 山西文体生活
 *
 * 原理：官网播放器把频道号按「日期」做一次字符轮转变换，每天换一组 key。
 *       本脚本在本地复现这套变换，把真地址直接交给播放器 —— 不换票、
 *       不需要任何请求头、不需要中转服务器。
 *
 * v2 修复：设备时钟不准（例如慢两天）会算出昨天的 key 导致 400。
 *       现在先取官网服务器时间；取不到就实际请求 m3u8 自动试前后几天，
 *       找到能出流的日期为止。
 * ============================================================ */

// 字符串反转，对应官网播放器的 x()
function sxRev(s) {
  return String(s).split('').reverse().join('');
}

// 按频道号 + 日期，算出当天的 7 位 key，对应官网播放器的 jt()
function sxKey(cid, dayMs) {
  var r, ch, d = 0, b = -1, g = 0;

  for (r = 0; r < cid.length; r++) {
    ch = cid.charCodeAt(r);
    d += ch;
    if (b != -1) g += b - ch;
    b = ch;
  }
  d += g;

  var l = d.toString(36);
  var p = dayMs.toString(36);
  var s = 0;
  for (r = 0; r < p.length; r++) s += p.charCodeAt(r);

  p = p.substr(5) + p.substr(0, 5);
  var c = Math.abs(s - d);

  p = sxRev(l) + p;
  var u = p.substr(0, 4);
  var h = p.substr(4);

  var f = new Date(dayMs + 28800000).getUTCDay() % 2;
  var v = [];
  for (r = 0; r < cid.length; r++) {
    if (r % 2 == f) {
      v.push(p.charAt(r % p.length));
    } else {
      var w = cid.charAt(r - 1);
      if (w) {
        var m = u.indexOf(w);
        v.push(m === -1 ? w : h.charAt(m));
      } else {
        v.push(u.charAt(r));
      }
    }
  }
  return (sxRev(c.toString(36)) + v.join('')).substr(0, cid.length);
}

/* ============================ 主入口 ============================ */
function main(item) {
  var CH = [
    { name: '山西卫视', cid: 'q8RVWgs', q: '1000' },
    { name: '黄河电视台', cid: 'lce1mC4', q: '800' },
    { name: '山西经济与科技', cid: '4j01KWX', q: '800' },
    { name: '山西影视', cid: 'Md571Kv', q: '800' },
    { name: '山西社会与法治', cid: 'p4y5do9', q: '500' },
    { name: '山西文体生活', cid: 'agmpyEk', q: '800' }
  ];

  var HOST = 'https://livehhhttps.sxrtv.com/lsdream/';
  var BJ = 28800000;   // 北京时间偏移
  var DAY = 86400000;

  var hasKu9 = (typeof ku9 !== 'undefined' && ku9);
  var canReq = hasKu9 && typeof ku9.request === 'function';

  // ---- 解析 id ----
  var key = '';
  if (item && item.id !== undefined && item.id !== null && String(item.id) !== '') {
    key = String(item.id);
  } else if (item && item.url && hasKu9 && typeof ku9.getQuery === 'function') {
    key = String(ku9.getQuery(item.url, 'id') || '');
  }

  var ch = null, i;
  var idx = parseInt(key, 10);
  if (!isNaN(idx) && idx >= 0 && idx < CH.length) ch = CH[idx];
  if (!ch && key) {
    for (i = 0; i < CH.length; i++) {
      if (CH[i].name === key || CH[i].cid === key) { ch = CH[i]; break; }
    }
  }
  if (!ch) ch = CH[0];

  // ---- 取服务器时间 ----
  // 必须选一个稳定返回 200 的地址：部分播放器引擎对 404/403 不返回 headers。
  var nowMs = null;
  if (canReq) {
    var probes = ['https://www.sxrtv.com/', 'https://www.sxrtv.com/tv/index.shtml'];
    for (i = 0; i < probes.length && nowMs === null; i++) {
      try {
        var probe = ku9.request(probes[i], 'GET', {});
        if (probe && probe.headers) {
          var hd = null, kk;
          for (kk in probe.headers) {
            if (String(kk).toLowerCase() === 'date') { hd = probe.headers[kk]; break; }
          }
          if (hd) {
            var ms = Date.parse(hd);
            if (!isNaN(ms)) nowMs = ms;
          }
        }
      } catch (e) { /* 换下一个探测地址 */ }
    }
  }
  var deviceNow = (new Date()).getTime();
  if (nowMs === null) nowMs = deviceNow;

  // 换算成「北京时间的当天 0 点」
  var serverDay = Math.floor((nowMs + BJ) / DAY) * DAY - BJ;
  var deviceDay = Math.floor((deviceNow + BJ) / DAY) * DAY - BJ;

  // ---- 候选日期：服务器日期优先，其次设备日期，再前后各试 3 天 ----
  var days = [];
  function addDay(ms) {
    for (var z = 0; z < days.length; z++) if (days[z] === ms) return;
    days.push(ms);
  }
  addDay(serverDay);
  addDay(deviceDay);
  for (i = 1; i <= 3; i++) {
    addDay(serverDay + i * DAY);
    addDay(serverDay - i * DAY);
    addDay(deviceDay + i * DAY);
    addDay(deviceDay - i * DAY);
  }

  function buildUrl(dayMs) {
    return HOST + ch.cid + '/' + ch.q + '/' + sxKey(ch.cid, dayMs) + '.m3u8';
  }
  function finish(u) {
    return { url: u, headers: { 'Referer': 'https://www.sxrtv.com/' } };
  }

  // ---- 实际请求验证：找到真正有分片的那个日期 ----
  // m3u8 只有 300 多字节，试几次代价很小；这样设备时钟错几天也能自动纠正。
  if (canReq) {
    for (i = 0; i < days.length; i++) {
      var u = buildUrl(days[i]);
      try {
        var res = ku9.request(u, 'GET', { 'Referer': 'https://www.sxrtv.com/' });
        if (res && res.code === 200 && res.body && String(res.body).indexOf('#EXTINF') >= 0) {
          return finish(u);
        }
      } catch (e2) { /* 网络抖动，继续试下一个日期 */ }
    }
  }

  // 兜底：验证机制不可用（例如引擎不支持请求 m3u8）时，返回服务器日期算出的地址
  return finish(buildUrl(serverDay));
}
