/*
 * 安徽广播电视台 / 安徽视讯 —— mytv-android 专用 JS 源
 * 生成日期: 2026-11-16
 *
 * ================== 为什么要有这个文件 ==================
 * mytv-android 的 JS 接口和酷9 不是一套，混用必然播不了：
 *
 *   项目        | 酷9                          | mytv-android
 *   ------------|------------------------------|------------------------------
 *   main 参数   | 对象 {url, id, name}         | 查询字符串 "id=ahwssx"
 *   取参数      | ku9.getQuery(item.url,'id')  | parseItems(item).id / 正则
 *   返回值      | 对象 {url, userAgent}        | JSON 字符串 {"url":..,"headers":..}
 *   请求头      | headers: {'User-Agent': ..}  | headers: 'User-Agent: ijkplayer'
 *                                              （字符串，多行用 \n）
 *   网络请求    | ku9.request / get            | mytv.request / get / post / fetch
 *   MD5         | ku9.md5                      | CryptoJS.MD5(..).toString()
 *
 * 本文件严格按 mytv 规范写，不引用任何 ku9.* —— 在 mytv 上可直接运行。
 * 酷9 请用同目录的 ahsx.js（两者接口不通用）。
 *
 * ================== 源本身的关键结论 ==================
 * 1) 安徽台直播走腾讯云 CDN，两个域名：
 *      http://live.ahsx.ahtv.cn      放行 UA 含 ijkplayer 或 ExoPlayerLib（区分大小写）
 *      https://seclive.ahsx.ahtv.cn  只放行 UA 含 ijkplayer
 *    Chrome / VLC / okhttp / Lavf / stagefright / 空 UA 一律 403
 * 2) m3u8 与 .ts 分片是同一套 UA 校验，headers 没带到分片就黑屏。
 *    所以下面把 User-Agent 放在 headers 里返回，mytv 会应用到列表和分片。
 * 3) txTime=70db6800（= 2030-01-01）是 APP 内写死的静态签名，不需要登录、
 *    不需要 token、不需要请求任何接口。若某天全台 403，说明台方换了 key。
 * 4) 宿州 szxw 签名正常但源站连不上，已剔除。
 *
 * 用法: javascript://https://gh-proxy.com/https://raw.githubusercontent.com/<你>/<仓库>/main/ahsx_mytv.js?id=ahwssx
 * 实测: 2026-11-16 13 台 m3u8 与首个分片均 200
 */
function main(item) {
  // ---- 1. 解析频道 id：mytv 传进来的是 "id=ahwssx" 这种查询串 ----
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

  // ---- 2. 频道表: id -> { 流名, txSecret } ----
  var CH = {
    'ahwssx': { s: 'ahwssx', k: '5d9bb423b14e850c07d2ead6ec1e6e86' },
    'jjshtv': { s: 'jjshtv', k: '90c3f69a99577ab3a7e05e13f9fcab9d' },
    'ystv':   { s: 'ystv',   k: '6a973e72be86a0ae7cccfc75bb4d537b' },
    'zytytv': { s: 'zytytv', k: 'a23d35a0b79adea92db0aa1cb5f18b06' },
    'ggtv':   { s: 'ggtv',   k: 'bf6e5dfcccfb9bc5ee1513eec0cd2307' },
    'nykjtv': { s: 'nykjtv', k: '403760067744a1645bbf79a63bf4c2fd' },
    'gjtv':   { s: 'gjtv',   k: '67176b04f5762569f28b4e59423cf3f9' },
    'aqpd':   { s: 'aqpd',   k: '3135baf2090ac893fb82b6ff9f114d36' },
    'bbtv':   { s: 'bbtv',   k: '0384cc59bc1a07e9497b6fd89a31213a' },
    'hbxw':   { s: 'hbxw',   k: '04e60ecff2e5f8539fc57ce370ae70ff' },
    'latv':   { s: 'latv',   k: 'aca9fac261a345932aae830fad64970c' },
    'whxw':   { s: 'whxw',   k: '5a28c409c52749559bad424e84226e61' },
    'xctv':   { s: 'xctv',   k: 'e0dd62ab8bf4bba4a6e1e0ed53639019' }
  };

  var ch = CH[id];
  if (!ch) ch = CH['ahwssx'];

  // ---- 3. 拼真实地址 ----
  var url = 'http://live.ahsx.ahtv.cn/live/' + ch.s + '.m3u8'
          + '?txSecret=' + ch.k + '&txTime=70db6800';

  // ---- 4. 返回：mytv 要求 JSON 字符串，headers 是字符串 ----
  // 关键：User-Agent 必须在 headers 里，否则 CDN 对 m3u8 和分片都回 403
  var hdrs = ['User-Agent: ijkplayer'].join('\n');

  return JSON.stringify({
    url: url,
    headers: hdrs
  });
}
