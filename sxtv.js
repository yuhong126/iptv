/* ============================================================
 * 山西台直播 · mytv / 酷9 通用 JS 源
 *
 * 用法（一行一个台）：
 *   山西卫视,javascript://<本文件的在线地址>?id=0
 *
 * id 对照：
 *   0 山西卫视      1 黄河电视台     2 山西经济与科技
 *   3 山西影视      4 山西社会与法治  5 山西文体生活
 *
 * 原理：官网播放器把地址里的频道号按「日期」做一次字符轮转变换，
 *       每天换一组 key（同一个台明天就变）。本脚本在本地把这套变换算出来，
 *       直接把真地址交给播放器 —— 不需要换票、不需要任何请求头、不需要中转。
 * ============================================================ */

// 字符串反转，对应官网播放器的 x()
function sxRev(s) {
  return String(s).split('').reverse().join('');
}

// 按频道号 + 当天日期，算出当天的 7 位 key，对应官网播放器的 jt()
function sxKey(cid, dayMs) {
  var r, ch, d = 0, b = -1, g = 0;

  // 频道号字符码之和，再加上相邻字符码差的和
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

  p = p.substr(5) + p.substr(0, 5);        // 前 5 位移到末尾
  var c = Math.abs(s - d);

  p = sxRev(l) + p;
  var u = p.substr(0, 4);
  var h = p.substr(4);

  // 星期几决定奇偶位怎么取
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
  // 频道表：cid 是官网频道号，q 是该台的清晰度目录
  var CH = [
    { name: '山西卫视', cid: 'q8RVWgs', q: '1000' },
    { name: '黄河电视台', cid: 'lce1mC4', q: '800' },
    { name: '山西经济与科技', cid: '4j01KWX', q: '800' },
    { name: '山西影视', cid: 'Md571Kv', q: '800' },
    { name: '山西社会与法治', cid: 'p4y5do9', q: '500' },
    { name: '山西文体生活', cid: 'agmpyEk', q: '800' }
  ];

  var HOST = 'https://livehhhttps.sxrtv.com/lsdream/';
  var BJ = 28800000; // 北京时间偏移，key 按北京日期算，跟设备时区无关

  // ---- 解析 id ----
  var hasKu9 = (typeof ku9 !== 'undefined' && ku9);
  var key = '', i;
  if (item && item.id !== undefined && item.id !== null && String(item.id) !== '') {
    key = String(item.id);
  } else if (item && item.url && hasKu9 && typeof ku9.getQuery === 'function') {
    key = String(ku9.getQuery(item.url, 'id') || '');
  }

  var ch = null;
  var idx = parseInt(key, 10);
  if (!isNaN(idx) && idx >= 0 && idx < CH.length) ch = CH[idx];
  if (!ch && key) {
    for (i = 0; i < CH.length; i++) {
      if (CH[i].name === key || CH[i].cid === key) { ch = CH[i]; break; }
    }
  }
  if (!ch) ch = CH[0];

  // ---- 取服务器时间（避免设备时钟不准导致算错日期的 key）----
  var nowMs = null;
  if (hasKu9 && typeof ku9.request === 'function') {
    try {
      var probe = ku9.request(HOST, 'GET', {});
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
    } catch (e) { /* 取不到就用设备时间 */ }
  }
  if (nowMs === null) nowMs = (new Date()).getTime();

  // 换算成「北京时间的当天 0 点」
  var dayMs = Math.floor((nowMs + BJ) / 86400000) * 86400000 - BJ;

  // ---- 拼地址 ----
  var daily = sxKey(ch.cid, dayMs);
  return {
    url: HOST + ch.cid + '/' + ch.q + '/' + daily + '.m3u8',
    headers: {
      'Referer': 'https://www.sxrtv.com/'
    }
  };
}
