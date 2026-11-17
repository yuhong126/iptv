/*
 * 宁夏广播电视台 —— mytv-android 专用 JS 源
 * 生成日期: 2026-11-17
 *
 * ================== 这个源到底卡在哪 ==================
 * 地址格式: https://hls.ningxiahuangheyun.com/live/<流名>.m3u8
 *   nxws1M = 宁夏卫视   nxgg1M = 宁夏公共   nxjj1M = 宁夏经济
 *   nxwl1M = 宁夏文旅   nxse1M = 宁夏少儿
 *
 * 【防盗链只有一个条件：Referer 必须一字不差】
 *   Referer = https://api.chinaaudiovisual.cn/    → 302 → 200 可播
 *   Referer = https://api.chinaaudiovisual.cn     → 403  ← 少结尾斜杠就死
 *   Referer = http://api.chinaaudiovisual.cn/     → 403  ← http 也死
 *   Referer = 其他任何域名                          → 403
 *   不带 Referer                                   → 403（腾讯云 WAF 页）
 *   User-Agent 完全不校验，空 UA 也能过 → 不用管 UA
 *
 * ★ 老板反馈"播放不了"的真实原因就是这个尾斜杠：
 *   很多播放器 / HTTP 库会把 Referer 规范化（去掉末尾 /），
 *   一规范化就 403。所以必须用 headers 精确写死，不能靠客户端猜。
 *
 * 【302 说明】现在这个地址不再是 200 直出，而是 302 跳到
 *   /live/nxws1M/index.m3u8?session=<随机串>
 *   session 每次请求都重新签发、约 45 秒内仍有效，客户端自动跟随即可。
 *   注意：m3u8 里的分片是相对路径（index20094.ts），
 *   原始地址与跳转后地址的目录都是 /live/nxws1M/，
 *   所以两种 base 拼出来的分片 URL 完全一致 → 不存在路径解析风险。
 *   分片同样只校验 Referer，带上就 200（实测 930KB 标准 MPEG-TS，头 47 40）。
 *
 * ================== 用法 ==================
 * javascript://https://gh-proxy.com/https://raw.githubusercontent.com/yuhong126/iptv/refs/heads/main/nxtv_mytv.js?id=nxws1M
 *
 * 可选参数:
 *   &ref=<URL编码后的 Referer>   临时覆盖 Referer（排查用）
 *
 * 实测: 2026-11-17  5 台 m3u8 与首个分片均 200
 */
function main(item) {
  // ---- 1. 解析频道 id：mytv 传进来的是 "id=nxws1M" 这种查询串 ----
  var qs = (item === null || item === undefined) ? '' : String(item);
  var id = '';

  // mytv 内置 parseItems（个别版本没有），用 try 探测，避免 ReferenceError
  var pi = null;
  try { pi = parseItems; } catch (e0) { pi = null; }
  if (typeof pi === 'function') {
    try {
      var obj = pi(qs);
      if (obj && obj.id) id = String(obj.id);
    } catch (e) { /* 忽略，走正则 */ }
  }
  if (!id) {
    var m = /(?:^|[?&])id=([^&]*)/.exec(qs);
    if (m) {
      try { id = decodeURIComponent(m[1]); } catch (e2) { id = m[1]; }
    }
  }

  // ---- 2. 频道表 ----
  var CH = {
    'nxws1M': '宁夏卫视',
    'nxgg1M': '宁夏公共',
    'nxjj1M': '宁夏经济',
    'nxwl1M': '宁夏文旅',
    'nxse1M': '宁夏少儿'
  };
  var sn = CH[id] ? id : 'nxws1M';

  // ---- 3. 真实地址（服务端会 302 到 index.m3u8?session=xxx，客户端自动跟随）----
  var url = 'https://hls.ningxiahuangheyun.com/live/' + sn + '.m3u8';

  // ---- 4. Referer：结尾斜杠必须保留，绝不能规范化 ----
  var ref = 'https://api.chinaaudiovisual.cn/';
  var mo = /(?:^|[?&])ref=([^&]*)/.exec(qs);
  if (mo) {
    try { ref = decodeURIComponent(mo[1]); } catch (e3) { ref = mo[1]; }
  }

  // mytv 要求 headers 是字符串，多行用 \n
  var hdrs = ['Referer: ' + ref].join('\n');

  return JSON.stringify({
    url: url,
    headers: hdrs
  });
}
