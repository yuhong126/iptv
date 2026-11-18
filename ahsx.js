/*
 * 安徽广播电视台 / 安徽视讯 —— JS 直播源【v7 定版 · 2026-11-18 10:05】
 * 文件名固定 ahsx.js（不带后缀、不带数字），以后只改内容，直播源地址永不变更。
 *
 * ============ v7 相对 v6 的关键改动：主动清空 Referer ============
 * v6 已经确认：域名用 live、UA 送 ijkplayer，但老板实测 Media3/IJK/VLC 三个内核全黑。
 * 2026-11-18 10:00 用原始 HTTP 报文逐头排查，结论只有两条会让安徽 403：
 *
 *   ① User-Agent 不在白名单 → 403
 *        同时放行 ijkplayer 与 ExoPlayerLib* 的只有 live.ahsx.ahtv.cn
 *   ② Referer 非空 → 403（哪怕是它自己站的地址、ahtv.cn、scgc 都 403）
 *        UA=ijkplayer 无 Referer            → 200
 *        UA=ijkplayer Referer: (空)         → 200
 *        UA=ijkplayer Referer: -            → 200   ← 本版采用
 *        UA=ijkplayer Referer: http://...   → 403
 *        UA=ijkplayer Referer: about:blank  → 403
 *      Origin / Cookie / Accept-Encoding / Range / Cache-Control 全部无害（均 200）。
 *
 * 为什么 v6 会踩到 ②：反编译 mytv 2.2.0.219 的 a5f.smali 后确认，播放前会先拼一份
 * 「基础头」（base headers），来源是 APP 设置：
 *        jt0.l() -> Referer      jt0.k() -> Origin      jt0.j() -> Cookie
 *        jt0.m() -> User-Agent（为空则回落到 全局UA 设置 yr2.K1()）
 * 然后才与 JS 返回的 headers 合并（vq7.n = base 副本 + putAll(ours)，**JS 的赢**）。
 * 也就是说：只要 APP 里配过「全局 Referer」（很多人为了让四川/宁夏能播会去配），
 * 安徽就会带着这个 Referer 请求 → 必 403 → 三个内核一起黑屏。
 * JS 没法「删除」base 里的键，但可以**覆盖**它。
 * 所以本版显式回 `Referer: -`（非空、且实测 200，不会被 APP 的 trim 逻辑丢掉）。
 *
 * 探测顺序（谁先返回 #EXTM3U 用谁）：
 *     1) http://live.ahsx.ahtv.cn      首选：ijkplayer / ExoPlayerLib 全放行
 *     2) https://live.ahsx.ahtv.cn     同域名，证书正规（严格 TLS 校验 PASS）
 *     3) http://seclive.ahsx.ahtv.cn   兜底：仅 ijkplayer，live 单 IP 跨网不通时用
 *
 * 签名：txTime=70db6800 = 2030-01-01，APP 内写死的静态签名，不会过期，无需换签。
 */

/* 宿主探测：全部用「取值即真」判断，绝不直接写 ku9.xxx / mytv.xxx
 * （部分版本引擎会把未启用的桥接对象注入成 null，写 ku9.request 会直接抛异常，
 *   main 一抛异常 = 解析失败 = 黑屏。这是 v5 在某些包上整体播不了的隐患之一。）*/
function ahHas(o) {
  var t = typeof o;
  return (t !== 'undefined') && (o !== null) && (t === 'object' || t === 'function');
}
function ahCanReq(o) {
  try { return ahHas(o) && (typeof o.request === 'function'); } catch (e) { return false; }
}

// 真酷9：只有 ku9、没有 mytv；带 ku9 桥接的改版 mytv 两者都在 → 走 mytv 分支
// ★ 直接写 ku9 当参数会在「未声明」时抛 ReferenceError，所以先用 typeof 挡一层
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
    return {
      url: url,
      userAgent: 'ijkplayer',
      referer: '-',
      headers: { 'User-Agent': 'ijkplayer', 'Referer': '-' }
    };
  }

  // mytv（含带 ku9 桥接的改版）：JSON 字符串 + 多行 headers 字符串
  // ★ 两行缺一不可：
  //   User-Agent: ijkplayer  → 进 CDN 白名单
  //   Referer: -             → 覆盖 APP 里可能配置过的「全局 Referer」（非空必 403）
  return JSON.stringify({ url: url, headers: 'User-Agent: ijkplayer\nReferer: -' });
}

/* ---------------- 探测：选第一个真正返回 m3u8 的地址 ----------------
 * 宿主没有 mytv.request / ku9.request 时直接返回首选，交给播放器自己试。
 * 探测按同样的「UA + Referer: -」发，保证探测结果和真实播放条件一致，
 * 不会出现「探测 200 但播放 403」的假通过。
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
      body = ahPickBody(mytv.request(u, 'GET', ['User-Agent: ijkplayer', 'Referer: -'], ''));
    }
  } catch (e) {}
  if (!body) {
    try {
      if (ahCanReq(typeof ku9 === 'undefined' ? null : ku9)) {
        body = ahPickBody(ku9.request(u, 'GET', { 'User-Agent': 'ijkplayer', 'Referer': '-' }, null));
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
  // 探测全失败：仍然返回首选地址，别把「探测不通」变成「不返回地址」
  return list[0];
}
