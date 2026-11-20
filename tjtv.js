/* ============================================================
 * 天津台（万视达 / 天津移动IPTV）直播源 · mytv / 酷9 原生 JS 源  v2
 *
 * 【为什么必须配 helper】
 *   万视达 App 取流接口的 para 参数是网易易盾 native 加密（setPara），
 *   纯 JS 算不出来；CDN 鉴权 KEY 也在服务端，无法离线复现。
 *   所以改成「让 App 自己算」：本机跑一个 helper，通过 adb 让设备里的
 *   万视达（桥接版）完成签名取流，JS 只负责转发。
 *
 *   链路：电视里的 mytv ──HTTP──> PC 上的 helper ──adb──> 桥接版App ──> 服务端
 *
 * 【运行前提】
 *   1. PC 上跑起 helper：node tj_helper.js
 *   2. 桥接版 App 已装在连着 adb 的设备上，且首次启动点过「同意」隐私协议
 *      （不点同意 = 不上报设备 token = 取流必失败）
 *   3. 电视与 PC 同一局域网；**必须跑一次 allow_firewall.bat（管理员）放行 8099**
 *      Windows 默认拒绝一切入站，且当前网络若是「公用」会额外拦一层。
 *
 * 【用法】h= 填 PC 的局域网地址（IP:端口）
 *   天津卫视,javascript://<本文件在线地址>?id=11&h=192.168.1.14:8099
 *   天津新闻,javascript://<本文件在线地址>?id=12&h=192.168.1.14:8099
 *   天津文艺,javascript://<本文件在线地址>?id=13&h=192.168.1.14:8099
 *   天津影视,javascript://<本文件在线地址>?id=14&h=192.168.1.14:8099
 *   天津都市,javascript://<本文件在线地址>?id=15&h=192.168.1.14:8099
 *   天津体育,javascript://<本文件在线地址>?id=16&h=192.168.1.14:8099
 *   天津教育,javascript://<本文件在线地址>?id=17&h=192.168.1.14:8099
 *   三佳购物,javascript://<本文件在线地址>?id=21&h=192.168.1.14:8099
 *
 *   ⚠ 漏了 &h= 时会退回内置候选地址（192.168.1.14 / 127.0.0.1）。
 *     127.0.0.1 在电视上指的是电视自己，必然连不上 —— 所以务必写 h=。
 *
 *   id 也可以直接写频道名（?id=天津卫视）或 32 位频道 ID。
 *
 * 【重要】不要给播放器塞自定义 UA！
 *   网宿系线路（wsSecret）的 wsHlsSession 绑定 User-Agent：
 *   建会话与取列表的 UA 不一致就 403（实测 okhttp UA 直接 403）。
 *   本脚本刻意【不返回 userAgent / headers】，让播放器全程用默认 UA；
 *   helper 只返回主播放列表（master），由播放器自行跟 #EXT-X-STREAM-INF
 *   到 media 列表 —— 与万视达 App 自身行为完全一致。
 * ============================================================ */

/* helper 地址候选（按顺序试）。
 * 正常情况下用 &h=<PC内网IP>:8099 显式指定；
 * 没给 h 时就按下面这个列表兜底（2026-11-20 本机实测 IP）。 */
var TJ_DEF_HOSTS = ['192.168.1.14:8099', '127.0.0.1:8099'];

var TJ_CH = {
  '11': '30001110000000000000000000000698', // 天津卫视
  '12': '30001110000000000000000000000699', // 天津新闻
  '13': '30001110000000000000000000000700', // 天津文艺
  '14': '30001110000000000000000000000701', // 天津影视
  '15': '30001110000000000000000000000702', // 天津都市
  '16': '30001110000000000000000000000692', // 天津体育
  '17': '30001110000000000000000000000693', // 天津教育
  '21': '30001110000000000000000000000697'  // 三佳购物
};

var TJ_NAME = {
  '天津卫视': '11', '天津新闻': '12', '天津文艺': '13', '天津影视': '14',
  '天津都市': '15', '天津体育': '16', '天津教育': '17', '天津科教': '17',
  '三佳购物': '21', '天津购物': '21'
};

function tjQuery(item, name) {
  try {
    if (typeof ku9 !== 'undefined' && ku9 && typeof ku9.getQuery === 'function' && item && item.url) {
      var v = ku9.getQuery(item.url, name);
      if (v !== undefined && v !== null && String(v) !== '') return String(v);
    }
  } catch (e) { /* 落到自解析 */ }
  var u = (item && item.url) ? String(item.url) : '';
  var m = u.match(new RegExp('[?&]' + name + '=([^&#]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

function tjBody(resp) {
  if (!resp) return '';
  if (typeof resp === 'string') return resp;
  if (typeof resp.body === 'string') return resp.body;
  if (typeof resp.text === 'string') return resp.text;
  if (resp.body !== undefined && resp.body !== null) return String(resp.body);
  return '';
}

function main(item) {
  if (typeof ku9 === 'undefined' || !ku9 || typeof ku9.request !== 'function') {
    return { url: '当前播放器不支持 JS 源（缺少 ku9.request），请升级新版 mytv' };
  }

  // ---- 解析参数 ----
  var key = tjQuery(item, 'id');
  if (!key && item && item.id !== undefined && item.id !== null) key = String(item.id);
  key = String(key || '').trim();

  var givenHost = (tjQuery(item, 'h') || tjQuery(item, 'host') || '')
    .replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  // 显式给了 h 就只认它；没给则按候选列表依次试
  var hosts = givenHost ? [givenHost] : TJ_DEF_HOSTS;

  // id 支持：序号 / 中文名 / 32 位频道 ID
  var cid = '';
  if (TJ_CH[key]) {
    cid = TJ_CH[key];
  } else if (TJ_NAME[key]) {
    cid = TJ_CH[TJ_NAME[key]];
  } else if (/^\d{20,40}$/.test(key)) {
    cid = key;
  } else {
    for (var nm in TJ_NAME) {
      if (nm.indexOf(key) >= 0 || key.indexOf(nm) >= 0) { cid = TJ_CH[TJ_NAME[nm]]; break; }
    }
  }
  if (!cid) cid = TJ_CH['11']; // 兜底天津卫视

  // ---- 请求 helper（候选地址依次试） ----
  var body = '', err = '', triedHost = '';
  for (var hi = 0; hi < hosts.length; hi++) {
    triedHost = hosts[hi];
    var api = 'http://' + triedHost + '/get?id=' + encodeURIComponent(cid);
    var resp = null;
    try {
      resp = ku9.request(api, 'GET', { 'Accept': 'text/plain' }, null);
    } catch (e) {
      err = String(e && e.message ? e.message : e);
      continue;
    }
    body = tjBody(resp).replace(/^\s+|\s+$/g, '');
    if (body) break;
  }

  if (!body) {
    return {
      url: '天津台取流失败：连不上 helper（' + triedHost + '）' +
           (err ? ' ' + err : '') +
           '。请确认：1) PC 上 node tj_helper.js 在跑；2) PC 防火墙已放行 8099（跑 allow_firewall.bat）；' +
           '3) 行尾加了 &h=<PC内网IP>:8099'
    };
  }
  if (body.indexOf('ERR') === 0) {
    return { url: '天津台取流失败：' + body.replace(/^ERR:?\s*/, '') };
  }
  if (body.indexOf('http') !== 0) {
    return { url: '取流返回异常：' + body.substring(0, 60) };
  }

  // 刻意不返回 userAgent / headers，见文件头「重要」说明
  return { url: body };
}
