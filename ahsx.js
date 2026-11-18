/*
 * 安徽广播电视台 / 安徽视讯 —— JS 直播源【v6 定版 · 2026-11-18 09:35】
 * 文件名固定 ahsx.js（不带后缀、不带数字），以后只改内容，直播源地址永不变更。
 *
 * ================== v6 改了什么（关键，别再改回去） ==================
 * 现象：同样的 JS，河南 hntv.js 能播，四川 sctv.js 能播，唯独安徽一直播不了。
 *
 * 2026-11-18 用 4 域名 × 9 种 UA 全矩阵复测，锁死两条铁律：
 *
 *   ① 域名必须用 live.ahsx.ahtv.cn，不能用 seclive.ahsx.ahtv.cn
 *      http://live.ahsx.ahtv.cn    ijkplayer=200  ExoPlayerLib*=200  okhttp=403  Lavf=403  VLC=403
 *      https://live.ahsx.ahtv.cn   ijkplayer=200  ExoPlayerLib*=200  okhttp=403  Lavf=403  VLC=403
 *      http://seclive.ahsx.ahtv.cn ijkplayer=200  ExoPlayerLib*=403  okhttp=403  Lavf=403  VLC=403
 *      https://seclive.ahsx.ahtv.cn 全部失败（DNSPod 自签 CA，Android 严格校验握手失败）
 *      → live 是唯一「同时放行 ijkplayer 与 ExoPlayerLib」的域名，覆盖面最大。
 *
 *   ② 绝对不能带 Referer
 *      ijkplayer + Referer: https://xxx  →  403
 *      ijkplayer 无 Referer              →  200
 *      所以返回的 headers 里只能有 User-Agent 一项。
 *
 * 为什么 v5 播不了：v5 把 seclive 当首选（因为它有 4 条 CDN 线路），
 * 而 seclive 只认 ijkplayer 一个 UA。只要播放器没有老老实实带上我们给的 UA
 * （Media3/ExoPlayer 内核默认 UA 是 ExoPlayerLib/…、IJK 原生默认是 Lavf/…），
 * seclive 就 403，黑屏。而 live 对 ExoPlayerLib 也放行，容错面直接翻倍。
 * 这也解释了为什么「原始版本能播安徽」——原始版本用的就是 live。
 *
 * 结论（按优先级探测，谁先返回 #EXTM3U 就用谁）：
 *     1) http://live.ahsx.ahtv.cn      ← 首选，原始可播版本同款，兼容面最大
 *     2) https://live.ahsx.ahtv.cn     ← 同域名，证书正规（严格 TLS 校验 PASS）
 *     3) http://seclive.ahsx.ahtv.cn   ← 兜底：live 单 IP 跨网不通时用（只认 ijkplayer）
 *
 * 签名：txTime=70db6800 = 2030-01-01 00:00:00，APP 内写死的静态签名，
 *       txSecret 每台固定，不会过期，无需网络换签。
 */

/* 宿主探测：全部用「取值即真」判断，绝不直接写 ku9.xxx / mytv.xxx
 * （部分版本的引擎会把未启用的桥接对象注入成 null，写 ku9.request 会直接抛异常，
 *   main 一抛异常 = 解析失败 = 黑屏。这是 v5 在某些包上整体播不了的隐患之一。）*/
function ahHas(o) {
  var t = typeof o;
  return (t !== 'undefined') && (o !== null) && (t === 'object' || t === 'function');
}
function ahCanReq(o) {
  try { return ahHas(o) && (typeof o.request === 'function'); } catch (e) { return false; }
}

// 真酷9：只有 ku9、没有 mytv；带 ku9 桥接的改版 mytv 两者都在 → 走 mytv 分支
// ★ 注意：直接写 ku9 当参数会在「未声明」时抛 ReferenceError，所以先用 typeof 挡一层
var AH_IS_KU9 = ahHas(typeof ku9 === 'undefined' ? null : ku9) &&
                !ahHas(typeof mytv === 'undefined' ? null : mytv);

// item 三种形态统一取 id（纯字符串 / 对象 .id / 对象 .params.id）
function ahGetId(item) {
  var id = '';
  try { if (item && typeof item === 'object' && item.id) id = String(item.id); } catch (e) {}
  try { if (!id && item && item.params && item.params.id) id = String(item.params.id); } catch (e) {}
  if (!id) {
    var s = '';
    try { s = String(item == null ? '' : item); } catch (e) { s = ''; }
    var m = /(?:^|[?&])id=([^&]*)/.exec(s);
    if (m) { try { id = decodeURIComponent(m[1]); } catch (e2) { id = m[1]; } }
  }
  return id;
}

function main(item) {
  // id -> {流名, txSecret}   13 个频道，与 wltv.txt 中的 id 一一对应
  var CH = {
    'ahwssx': { s: 'ahwssx', k: '5d9bb423b14e850c07d2ead6ec1e6e86' }, // 安徽卫视
    'jjshtv': { s: 'jjshtv', k: '90c3f69a99577ab3a7e05e13f9fcab9d' }, // 安徽经济生活
    'ystv':   { s: 'ystv',   k: '6a973e72be86a0ae7cccfc75bb4d537b' }, // 安徽影视
    'zytytv': { s: 'zytytv', k: 'a23d35a0b79adea92db0aa1cb5f18b06' }, // 安徽综艺体育
    'ggtv':   { s: 'ggtv',   k: 'bf6e5dfcccfb9bc5ee1513eec0cd2307' }, // 安徽公共
    'nykjtv': { s: 'nykjtv', k: '403760067744a1645bbf79a63bf4c2fd' }, // 安徽农业科教
    'gjtv':   { s: 'gjtv',   k: '67176b04f5762569f28b4e59423cf3f9' }, // 安徽国际
    'aqpd':   { s: 'aqpd',   k: '3135baf2090ac893fb82b6ff9f114d36' }, // 安庆新闻综合
    'bbtv':   { s: 'bbtv',   k: '0384cc59bc1a07e9497b6fd89a31213a' }, // 蚌埠新闻
    'hbxw':   { s: 'hbxw',   k: '04e60ecff2e5f8539fc57ce370ae70ff' }, // 淮北新闻综合
    'latv':   { s: 'latv',   k: 'aca9fac261a345932aae830fad64970c' }, // 六安综合
    'whxw':   { s: 'whxw',   k: '5a28c409c52749559bad424e84226e61' }, // 芜湖新闻综合
    'xctv':   { s: 'xctv',   k: 'e0dd62ab8bf4bba4a6e1e0ed53639019' }  // 宣城综合
  };

  var id = ahGetId(item);
  var ch = CH[id] || CH['ahwssx'];

  var qs = '?txSecret=' + ch.k + '&txTime=70db6800';
  var path = '/live/' + ch.s + '.m3u8' + qs;

  // ★ 探测顺序 = 兼容面从大到小（见文件头矩阵）
  var AH_HOSTS = [
    'http://live.ahsx.ahtv.cn' + path,     // 首选：ijkplayer / ExoPlayerLib 全放行
    'https://live.ahsx.ahtv.cn' + path,    // 同域名 https（正规证书）
    'http://seclive.ahsx.ahtv.cn' + path   // 兜底：仅 ijkplayer，live 跨网不通时用
  ];
  var url = ahPick(AH_HOSTS);

  // 酷9：对象 + 两套 UA 通道（userAgent 字段 + headers 对象）
  if (AH_IS_KU9) {
    return { url: url, userAgent: 'ijkplayer', headers: { 'User-Agent': 'ijkplayer' } };
  }

  // mytv（含带 ku9 桥接的改版）：JSON 字符串 + 多行 headers 字符串
  // ★ headers 只给 User-Agent，加 Referer 必定 403
  return JSON.stringify({ url: url, headers: 'User-Agent: ijkplayer' });
}

/* ---------------- 探测：选第一个真正返回 m3u8 的地址 ----------------
 * 宿主没有 mytv.request / ku9.request 时直接返回首选，交给播放器自己试，
 * 不额外增加失败面。探测只为避开「live 在你那条宽带不通」这种情况。
 */
function ahPickBody(r) {
  if (r === null || r === undefined) return '';
  if (typeof r === 'string') return r;
  try {
    if (r.body !== undefined && r.body !== null) return String(r.body);
    if (r.data !== undefined && r.data !== null) {
      return (typeof r.data === 'string') ? r.data : JSON.stringify(r.data);
    }
    if (r.content !== undefined && r.content !== null) return String(r.content);
    if (r.text !== undefined && r.text !== null) return String(r.text);
  } catch (e) {}
  return '';
}

function ahFetch(u) {
  var body = '';
  try {
    if (ahCanReq(typeof mytv === 'undefined' ? null : mytv)) {
      body = ahPickBody(mytv.request(u, 'GET', ['User-Agent: ijkplayer'], ''));
    }
  } catch (e) {}
  if (!body) {
    try {
      if (ahCanReq(typeof ku9 === 'undefined' ? null : ku9)) {
        body = ahPickBody(ku9.request(u, 'GET', { 'User-Agent': 'ijkplayer' }, null));
      }
    } catch (e2) {}
  }
  return body;
}

function ahPick(list) {
  var canReq = false;
  try {
    canReq = ahCanReq(typeof mytv === 'undefined' ? null : mytv) ||
             ahCanReq(typeof ku9 === 'undefined' ? null : ku9);
  } catch (e) { canReq = false; }
  if (!canReq) return list[0];
  for (var i = 0; i < list.length; i++) {
    var b = ahFetch(list[i]);
    if (b && b.indexOf('#EXTM3U') >= 0) return list[i];
  }
  // 探测全失败：仍然返回首选（http 版 live），别把「探测不通」变成「不返回地址」
  return list[0];
}
