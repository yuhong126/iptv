/*
 * 安徽广播电视台 / 安徽视讯（mytv / 酷9 原生 JS 源）
 * 实测日期: 2026-11-16
 *
 * ================== 关键结论（逆向过程） ==================
 * 1) 安徽台直播走腾讯云 CDN（MC_VCLOUD_LIVE），域名 live.ahsx.ahtv.cn / seclive.ahsx.ahtv.cn
 * 2) CDN 有两道校验：
 *      a. 播放鉴权：txSecret = MD5(key + StreamName + txTime)，txTime 十六进制
 *      b. User-Agent 白名单：只放行 "ijkplayer"（APP 内置 ijkplayer 播放器）
 *     → UA 不是 ijkplayer 时，即使签名正确也一律 403；分片请求同样校验 UA。
 * 3) 本文件内置的是 txTime=70db6800（= 2030-01-01）的长期签名，
 *    实测 13 个台 m3u8 与 .ts 分片均可 200 播放（分片头为 MPEG-TS）。
 * 4) 因此本源不需要请求任何接口、不需要登录、不需要 token，
 *    只需返回 { url, userAgent: 'ijkplayer' }。
 *
 * ================== 注意 ==================
 * - userAgent 必须是 ijkplayer，客户端须支持返回 userAgent 并把其应用到
 *   m3u8 与分片请求（北京台/江西台同款要求）。若客户端忽略 userAgent，
 *   会全部 403 —— 这是唯一硬要求。
 * - 签名 txTime 到 2030-01-01，理论上长期有效；若哪天全台 403，
 *   说明台方更换了 CDN 鉴权 key，需要重新取一套签名。
 * - 宿州新闻综合（szxw）签名正常但源站连接超时，暂时不可用，保留位置。
 *
 * 用法: javascript://https://raw.githubusercontent.com/<你>/<仓库>/main/ahsx.js?id=ahwssx
 */
function main(item) {
  // 客户端要求 ijkplayer，否则 CDN 直接 403
  var UA = 'ijkplayer';

  // txTime 十六进制 = 2030-01-01，长期有效
  var TXTIME = '70db6800';
  var HOST = 'http://live.ahsx.ahtv.cn/live/';

  // 频道表: id -> { n:名称, s:流名, k:txSecret }
  var CH = {
    // ---- 省级频道 ----
    'ahwssx': { n: '安徽卫视',     s: 'ahwssx', k: '5d9bb423b14e850c07d2ead6ec1e6e86' },
    'jjshtv': { n: '安徽经济生活', s: 'jjshtv', k: '90c3f69a99577ab3a7e05e13f9fcab9d' },
    'ystv':   { n: '安徽影视',     s: 'ystv',   k: '6a973e72be86a0ae7cccfc75bb4d537b' },
    'zytytv': { n: '安徽综艺体育', s: 'zytytv', k: 'a23d35a0b79adea92db0aa1cb5f18b06' },
    'ggtv':   { n: '安徽公共',     s: 'ggtv',   k: 'bf6e5dfcccfb9bc5ee1513eec0cd2307' },
    'nykjtv': { n: '安徽农业科教', s: 'nykjtv', k: '403760067744a1645bbf79a63bf4c2fd' },
    'gjtv':   { n: '安徽国际',     s: 'gjtv',   k: '67176b04f5762569f28b4e59423cf3f9' },
    // ---- 地市频道 ----
    'aqpd':   { n: '安庆新闻综合', s: 'aqpd',   k: '3135baf2090ac893fb82b6ff9f114d36' },
    'bbtv':   { n: '蚌埠新闻',     s: 'bbtv',   k: '0384cc59bc1a07e9497b6fd89a31213a' },
    'hbxw':   { n: '淮北新闻综合', s: 'hbxw',   k: '04e60ecff2e5f8539fc57ce370ae70ff' },
    'latv':   { n: '六安综合',     s: 'latv',   k: 'aca9fac261a345932aae830fad64970c' },
    'szxw':   { n: '宿州新闻综合', s: 'szxw',   k: 'c40b436dae8b8a81d72d444256ebd8d1' },
    'whxw':   { n: '芜湖新闻综合', s: 'whxw',   k: '5a28c409c52749559bad424e84226e61' },
    'xctv':   { n: '宣城综合',     s: 'xctv',   k: 'e0dd62ab8bf4bba4a6e1e0ed53639019' }
  };

  var id = item.id || ku9.getQuery(item.url, 'id') || 'ahwssx';
  var ch = CH[id];
  if (!ch) ch = CH['ahwssx'];

  var url = HOST + ch.s + '.m3u8?txSecret=' + ch.k + '&txTime=' + TXTIME;

  // 关键：必须带 ijkplayer，否则 CDN 403（m3u8 与分片同校验）
  return {
    url: url,
    userAgent: UA
  };
}
