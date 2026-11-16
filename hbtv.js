/* ============================================================
 * 湖北台（长江云）直播 · mytv / 酷9 通用 JS 源
 *
 * ⚠️ 重要（2026-11-16 复核）：本源依赖的 client-id 注册是【短时效】的
 *    （约 5-6 分钟失效），必须靠 WebSocket 心跳持续保活；而 ku9 的 JS
 *    环境没有 WebSocket、无法发送握手后的WebSocket帧，故内置的 cid 会
 *    很快过期，本 JS 目前【无法稳定播放】。已验证：用刚注册的活跃 cid
 *    时 main() 完全正常（m3u8 200），但几分钟后即失效。
 *    => 湖北台不能用纯 JS 稳定实现，需服务端/浏览器保活方案。详见使用说明。
 *
 * 用法（一行一个台，id 见下方 CHANNELS）：
 *   湖北卫视,javascript://<本文件在线地址>?id=431
 *   湖北经视,javascript://<本文件在线地址>?id=432
 *   ...
 * 也支持直接传台名，如 ?id=湖北影视。
 *
 * 原理（逆向 news.hbtv.com.cn/app/tv 播放器）：
 *   1) 页面服务端渲染时把各频道的原始 m3u8（带 30 分钟 auth_key 签名）
 *      写进 HTML 的 Vue liveList/audioList 里。
 *   2) 直接请求该 m3u8 会被 CDN 拒绝：必须先用页面 Set-Cookie 的
 *      client-id 调 /ajax/get_cdn_leech 换取带 extrakey/aalook 的地址。
 *   3) get_cdn_leech 依赖一个"已注册"的 client-id——正常由网页通过
 *      WebSocket(wss://remote-wa.cjyun.org.cn/liveweb) 心跳注册。
 *      ku9 环境无 WebSocket，故本脚本内置若干个已注册并验证可用的
 *      client-id 轮询使用（注册与出口 IP 无关，仅播放需带正确 Referer）。
 *   4) 换到带 extrakey 的地址后返回，并附带 referer 让播放器带来源页。
 *   实测：m3u8 与 ts 分片都只需正确 Referer，无需 Cookie。
 * ============================================================ */

var HB_PAGE = 'https://news.hbtv.com.cn/app/tv/435';
var HB_LEECH = 'https://news.hbtv.com.cn/ajax/get_cdn_leech';
var HB_REFERER = 'https://news.hbtv.com.cn/app/tv/435';
var HB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

// 已通过 WebSocket 心跳注册并验证可用的 client-id（备用轮询）
var HB_CIDS = [
  '972e7202-7cbd-4cb5-a5d3-7b37e7b3fe8f',
  '824c28ef-4ba2-41b6-b336-1e8edc11d200',
  '9402f10b-77fb-4eff-bb79-91823e08cbb4',
  'ab57c2e1-642f-46b8-a356-bb3c4b14b43f',
  'f14046c3-ba13-4619-9a3b-bb2468eaf331'
];

// 可用频道：id -> { name, file(原始 m3u8 文件名特征) }
// 实测 200 的 6 个电视频道 + 5 个广播；404/已下线的不列入
var HB_CHANNELS = [
  { id: 431, name: '湖北卫视',   file: 'new-hbws.m3u8' },
  { id: 432, name: '湖北经视',   file: 'new-hbjs.m3u8' },
  { id: 433, name: '湖北综合',   file: 'new-hbzh.m3u8' },
  { id: 435, name: '湖北影视',   file: 'new-hbys.m3u8' },
  { id: 437, name: '湖北教育',   file: 'new-hbjy.m3u8' },
  { id: 438, name: '垄上频道',   file: 'new-hbls.m3u8' },
  { id: 187, name: '湖北之声',   file: 'new-hbzs1046.m3u8' },
  { id: 223, name: '经济广播',   file: 'new-hbjj998.m3u8' },
  { id: 417, name: '经典音乐',   file: 'new-jdyy1038.m3u8' },
  { id: 193, name: '楚天交通',   file: 'new-ctjt927.m3u8' },
  { id: 187, name: '湖北之声FM', file: 'new-hbzs1046.m3u8' }
];

// 从页面 HTML 里提取所有 live21 的 m3u8 原始地址
function hbExtractStreams(html) {
  var out = [];
  var re = /https:\/\/live21-cjy\.hbtv\.com\.cn\/[^"\s]+?\.m3u8[^"\s]*/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    if (out.indexOf(m[0]) < 0) out.push(m[0]);
  }
  return out;
}

function main(item) {
  if (typeof ku9 === 'undefined' || !ku9 || typeof ku9.request !== 'function') {
    return { url: '当前播放器不支持 JS 源（缺少 ku9.request），请升级到新版 mytv' };
  }

  // ---- 解析 id ----
  var key = '';
  if (item && item.id !== undefined && item.id !== null && String(item.id) !== '') {
    key = String(item.id);
  } else if (item && item.url && typeof ku9.getQuery === 'function') {
    key = String(ku9.getQuery(item.url, 'id') || '');
  }

  var ch = null, i;
  var numKey = parseInt(key, 10);
  if (!isNaN(numKey)) {
    for (i = 0; i < HB_CHANNELS.length; i++) {
      if (HB_CHANNELS[i].id === numKey) { ch = HB_CHANNELS[i]; break; }
    }
  }
  if (!ch && key) {
    for (i = 0; i < HB_CHANNELS.length; i++) {
      if (HB_CHANNELS[i].name === key || key.indexOf(HB_CHANNELS[i].name) >= 0 ||
          HB_CHANNELS[i].name.indexOf(key) >= 0) { ch = HB_CHANNELS[i]; break; }
    }
  }
  if (!ch) ch = HB_CHANNELS[0]; // 默认湖北卫视

  var headers = { 'User-Agent': HB_UA, 'Referer': HB_REFERER };

  // ---- 1) 取页面，提取该频道原始 stream ----
  var html = '';
  try {
    var pr = ku9.request(HB_PAGE, 'GET', headers, null);
    if (pr && pr.body) html = String(pr.body);
  } catch (e) { html = ''; }

  if (!html || html.indexOf('.m3u8') < 0) {
    return { url: '湖北台页面获取失败，请稍后重试', referer: HB_REFERER };
  }

  var streams = hbExtractStreams(html);
  var orig = null;
  for (i = 0; i < streams.length; i++) {
    if (streams[i].indexOf(ch.file) >= 0) { orig = streams[i]; break; }
  }
  if (!orig) {
    return { url: '湖北台未找到频道 ' + ch.name + ' 的流', referer: HB_REFERER };
  }

  // ---- 2) 用已注册 cid 调 get_cdn_leech 换带 extrakey 的地址 ----
  var leechUrl = HB_LEECH + '?url=' + encodeURIComponent(orig) + '&client-id=';
  var leechHeaders = {
    'User-Agent': HB_UA,
    'Referer': HB_REFERER,
    'X-Requested-With': 'XMLHttpRequest'
  };
  for (i = 0; i < HB_CIDS.length; i++) {
    var real = '';
    try {
      var lr = ku9.request(leechUrl + HB_CIDS[i], 'GET', leechHeaders, null);
      if (lr && lr.body) {
        var j = JSON.parse(lr.body);
        if (j && j.state && j.data) real = String(j.data).replace(/\\\//g, '/');
      }
    } catch (e2) { real = ''; }
    if (real && real.indexOf('extrakey=') > 0 && real.indexOf('.m3u8') > 0) {
      // 返回地址 + referer（播放器拉 m3u8 与分片都需带来源页）
      return { url: real, referer: 'https://news.hbtv.com.cn/', userAgent: HB_UA };
    }
  }

  return { url: '湖北台 ' + ch.name + ' 取流失败（leech 未成功）', referer: HB_REFERER };
}
