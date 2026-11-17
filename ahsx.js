/*
 * 安徽广播电视台 / 安徽视讯 —— JS 直播源【通用版】
 * 新文件名 ahsx_u.js（换名避开 gh-proxy 同名缓存粘滞）
 *
 * ============ 为什么要有这个通用版（2026-11-17 兼容性问题） ============
 * 现象：同一个源列表，在 4 个 mytv/酷9 版本里表现不一致：
 *   改版 v5（WebView江苏江西修正版）：四川能播，安徽/河南不能播
 *   未改版原版                    ：安徽/河南能播，四川不能播
 *   另有 2 个版本                 ：全部能播
 *
 * 根因：三个 JS 用了三种互不兼容的「方言」：
 *   安徽(旧 ahsx.js) = 纯 mytv：item 当字符串、返回 JSON 字符串
 *   河南(hntv.js)    = 纯酷9 ：依赖 ku9.request / item.id、返回对象
 *   四川(sctv4.js)   = 双兼容：运行时探测宿主，两种都要满足
 * 只要某个客户端版本的引擎细节与「那一种方言」不符，就解析失败。
 *
 * 本版照抄四川 sctv4.js 已验证过的「双环境兼容」模型：
 *   1) 运行时探测宿主，而不是写死某一种引擎
 *   2) item 三种形态都兼容：纯字符串 "id=xxx" / 对象 .id / 对象 .params.id
 *   3) 返回值按宿主选：酷9→对象；mytv(含带 ku9 桥接的改版)→JSON 字符串
 *      —— mytv 引擎的 normalizeMainResult 对「对象」和「JSON 字符串」都接受，
 *         但返回 JSON 字符串在所有已测版本上都 100% 正确，故优先。
 *
 * 源本身：腾讯云 CDN，UA 白名单只放行含小写 ijkplayer / ExoPlayerLib，
 *         AliPlayer 与浏览器 UA 一律 403（2026-11-16/17 多次实测）。
 *         txTime=70db6800(2030-01-01) 是 APP 内写死静态签名，零网络请求。
 */

// 真酷9：只有 ku9、没有 mytv；带 ku9 桥接的改版 mytv 两者都在 → 走 mytv 分支
var AH_IS_KU9 = (typeof ku9 !== 'undefined') && (typeof mytv === 'undefined');

// item 三种形态统一取 id
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
  // id -> {流名, txSecret}
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

  var id = ahGetId(item);
  var ch = CH[id] || CH['ahwssx'];

  // http 域名放行 ijkplayer + ExoPlayerLib（https seclive 只放行 ijkplayer，且本机不通）
  var url = 'http://live.ahsx.ahtv.cn/live/' + ch.s + '.m3u8'
          + '?txSecret=' + ch.k + '&txTime=70db6800';

  // 酷9：对象 + 双套 UA 通道（userAgent 字段 + headers 对象）
  if (AH_IS_KU9) {
    return { url: url, userAgent: 'ijkplayer', headers: { 'User-Agent': 'ijkplayer' } };
  }

  // mytv（含带 ku9 桥接的改版 v5）：JSON 字符串 + 多行 headers 字符串
  return JSON.stringify({ url: url, headers: 'User-Agent: ijkplayer' });
}
