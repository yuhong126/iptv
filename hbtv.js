/**
 * 湖北台 直播源 v5 (极速修复版)
 * 仅保留官方现有 6 个频道，优化了 WebSocket 注册缓冲
 */

var DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
var REFERER = 'https://news.hbtv.com.cn/';
var SITE_ID = '10008';
var WS_URL  = 'wss://remote-wa.cjyun.org.cn/liveweb';
var WS_NAME = 'cjyun_hb';

// 严格对应你截图里的 6 个台
var HB_CH = {
  hbws: { n: '湖北卫视', id: 431 },
  hbjs: { n: '湖北经视', id: 432 },
  hbzh: { n: '湖北综合', id: 433 },
  hbys: { n: '湖北影视', id: 435 },
  hbjy: { n: '湖北教育', id: 437 },
  hbls: { n: '湖北垄上', id: 438 }
};

function hbWait(ms) { var t = Date.now(); while (Date.now() - t < ms) {} }

function hbGet(url, headersArr) {
  try {
    var res = mytv.request(url, 'GET', headersArr || [], '', true);
    if (res && typeof res === 'object') {
        var body = (typeof res.body === 'string') ? res.body : (res.body ? String(res.body) : '');
        var raw = res.headersText || (typeof res.headers === 'string' ? res.headers : '');
        return { body: body, raw: raw, code: res.code || 200 };
    }
    return { body: String(res || ''), raw: '', code: 200 };
  } catch (e) {
    return { body: '', raw: '', code: -1 };
  }
}

function hbCookie(raw, name) {
  if (!raw) return '';
  var m = new RegExp(name + '=([^;,\\s]+)').exec(raw);
  return m ? m[1] : '';
}

function main(item) {
  // 1. 绝对防呆的 ID 解析，防止 MYTV 吞参数
  var rawStr = (typeof item === 'string') ? item : (item && item.url ? item.url : JSON.stringify(item || {}));
  var id = 'hbws';
  if (rawStr.indexOf('hbjs') !== -1) id = 'hbjs';
  else if (rawStr.indexOf('hbzh') !== -1) id = 'hbzh';
  else if (rawStr.indexOf('hbys') !== -1) id = 'hbys';
  else if (rawStr.indexOf('hbjy') !== -1) id = 'hbjy';
  else if (rawStr.indexOf('hbls') !== -1) id = 'hbls';
  else if (rawStr.indexOf('hbws') !== -1) id = 'hbws';
  
  var ch = HB_CH[id];
  if (!ch) return JSON.stringify({ error: '未知频道: ' + id });
  var sid = ch.id;

  // 2. 获取流地址（这一步通常很快）
  var streamRes = hbGet('https://app.cjyun.org.cn/video/player/stream?stream_id=' + sid + '&site_id=' + SITE_ID, ['User-Agent: ' + DESKTOP_UA]);
  var streamUrl = '';
  if (streamRes.body) {
      try {
          var d = JSON.parse(streamRes.body);
          if (d && typeof d.stream === 'string') streamUrl = d.stream;
      } catch(e) {}
      if (!streamUrl) {
          var m = /"stream"\s*:\s*"([^"]+)"/.exec(streamRes.body);
          if (m) streamUrl = m[1].replace(/\\\//g, '/');
      }
  }
  if (!streamUrl) return JSON.stringify({ error: ch.n + ' 取流地址失败(可能已下线)' });

  // 3. 获取 Cookie
  var clientRes = hbGet('https://news.hbtv.com.cn/app/tv/' + sid, ['User-Agent: ' + DESKTOP_UA]);
  var cid = hbCookie(clientRes.raw, 'client-id') || hbCookie(clientRes.body, 'client-id');
  var look = hbCookie(clientRes.raw, 'aa-look') || hbCookie(clientRes.body, 'aa-look');
  var tok = hbCookie(clientRes.raw, 'client-token') || hbCookie(clientRes.body, 'client-token');

  // 4. WebSocket 注册 (必须有这个，否则 403)
  var wsOk = false;
  if (cid && look && tok && typeof mytv.websocket === 'function') {
    try {
      var api = mytv.websocket();
      if (api && typeof api.connect === 'function') {
        api.connect(WS_URL, ['Origin: https://news.hbtv.com.cn', 'User-Agent: ' + DESKTOP_UA], WS_NAME);
        var sock = null;
        // 最多等 1.5 秒完成握手
        for (var i = 0; i < 30; i++) {
          hbWait(50);
          try {
            sock = api.get(WS_NAME);
            if (sock && typeof sock.status === 'function' && sock.status() === 1) break;
            if (sock && typeof sock.status !== 'function') break;
          } catch (e) {}
        }
        
        if (sock) {
          var payload = '{"client_id":"' + cid + '","aa_look":"' + look + '","client_token":"' + tok + '"}';
          try { 
              sock.send(payload); 
              wsOk = true;
              // ★ 关键提速点：等待服务器把数据落库 (200ms)，避免拿不到 key
              hbWait(200); 
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  // 5. 换取最终带 extrakey 的地址
  var finalUrl = '';
  if (wsOk) {
      // 尝试 2 次，每次间隔 150ms
      for (var j = 0; j < 2; j++) {
          var leechRes = hbGet('https://news.hbtv.com.cn/ajax/get_cdn_leech?url=' + streamUrl + '&client-id=' + cid, ['User-Agent: ' + DESKTOP_UA]);
          if (leechRes.body) {
              try {
                  var d = JSON.parse(leechRes.body);
                  if (d && d.state && typeof d.data === 'string' && d.data) {
                      finalUrl = d.data;
                      break;
                  }
              } catch(e) {}
              var m = /"data"\s*:\s*"([^"]+)"/.exec(leechRes.body);
              if (m && m[1]) {
                  finalUrl = m[1].replace(/\\\//g, '/');
                  break;
              }
          }
          hbWait(150);
      }
  }

  if (finalUrl) {
    return JSON.stringify({ url: finalUrl, headers: 'Referer: ' + REFERER });
  }
  
  return JSON.stringify({ error: ch.n + '：获取 extrakey 失败' });
}
