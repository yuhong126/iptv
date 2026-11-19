/*
 * 云南电视台 纯 JS 完美重写版 (yntv.js)
 * 用法：
 * 云南卫视,javascript://.../yntv.js?id=ynws
 * 云南都市,javascript://.../yntv.js?id=ynds
 * 康旅频道,javascript://.../yntv.js?id=ynkl
 * 澜湄国际,javascript://.../yntv.js?id=lmgi
 */

var YNTV_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
var YNTV_REFERER = 'https://www.yntv.cn/';
var YNTV_API = 'https://yntv-api.yntv.cn/index/jmd/getPb';
var YNTV_HOST = 'tvlive.yntv.cn';

function main(item) {
    // 1. 解析 ID
    var raw = (item && item.url) ? item.url : (typeof item === 'string' ? item : '');
    var m = /[?&]id=([a-zA-Z0-9_]+)/.exec(raw);
    var id = m ? m[1].toLowerCase() : 'ynws';
    
    var chMap = {
        'ynws': 'yunnanweishi', // 卫视
        'ynds': 'yunnandushi',  // 都市
        'ynkl': 'yunnangonggong',// 康旅
        'lmgi': 'yunnanguoji',  // 澜湄 (兼容官方APP现在的叫法)
        'ynlm': 'yunnanguoji'   
    };
    var channel = chMap[id] || 'yunnanweishi';

    // 2. 请求鉴权接口
    var apiUrl = YNTV_API + '?name=' + encodeURIComponent(channel) + '&_=' + new Date().getTime();
    var reqHeaders = [
        'Host: yntv-api.yntv.cn',
        'Accept: application/json, text/javascript, */*; q=0.01',
        'User-Agent: ' + YNTV_UA,
        'Origin: https://www.yntv.cn',
        'Referer: ' + YNTV_REFERER
    ];

    var bodyText = '';
    var cookieStr = '';

    try {
        // 使用 mytv.request 以获取可能存在的 Cookie
        if (typeof mytv.request === 'function') {
            var res = mytv.request(apiUrl, 'GET', reqHeaders, '');
            if (res) {
                bodyText = (res.body || res) + '';
                if (res.headers) {
                    var hStr = typeof res.headers === 'string' ? res.headers : JSON.stringify(res.headers);
                    var matchCk = /set-cookie:\s*([^;\r\n]+)/i.exec(hStr);
                    if (matchCk) cookieStr = matchCk[1];
                }
            }
        } else {
            bodyText = mytv.get(apiUrl, reqHeaders) + '';
        }
    } catch (e) {
        return JSON.stringify({ error: '请求 API 失败: ' + e.message });
    }

    // 3. 解析 wsSecret 和 wsTime
    var json = null;
    try {
        json = JSON.parse(bodyText);
    } catch (e) {
        var mStr = /"string"\s*:\s*"([^"]+)"/.exec(bodyText);
        var mTime = /"time"\s*:\s*"([^"]+)"/.exec(bodyText);
        if (mStr && mTime) { json = { string: mStr[1], time: mTime[1] }; }
    }

    if (!json || !json.string || !json.time) {
        return JSON.stringify({ error: '获取鉴权失败', raw: bodyText.substring(0, 100) });
    }

    var wsSecret = json.string;
    var wsTime = json.time;
    
    // 4. 拼接原版 M3U8 地址
    var originM3u8 = 'https://' + YNTV_HOST + '/live/' + channel + '/chunks.m3u8?wsSecret=' + encodeURIComponent(wsSecret) + '&wsTime=' + encodeURIComponent(wsTime);

    // 5. 准备请求 M3U8 的头
    var m3u8Headers = [
        'Host: ' + YNTV_HOST,
        'User-Agent: ' + YNTV_UA,
        'Referer: ' + YNTV_REFERER
    ];
    if (cookieStr) m3u8Headers.push('Cookie: ' + cookieStr);

    // 6. 纯 JS 模拟 PHP 代理：去拉取 m3u8 文本，重写 TS 路径
    try {
        var m3u8Text = mytv.get(originM3u8, m3u8Headers);
        
        if (m3u8Text && m3u8Text.indexOf('#EXTM3U') !== -1) {
            var lines = m3u8Text.split('\n');
            var newLines = [];
            var baseUrl = 'https://' + YNTV_HOST + '/live/' + channel + '/';

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                // 如果不是空行也不是标签，说明是 ts 分片
                if (line && line.indexOf('#') !== 0) {
                    var tsUrl = line;
                    // 相对路径转绝对
                    if (tsUrl.indexOf('http') !== 0) {
                        tsUrl = baseUrl + tsUrl.replace(/^\//, '');
                    }
                    // 强行拼上签名（对应 PHP 里的 $fullTsUrl）
                    if (tsUrl.indexOf('wsSecret=') === -1) {
                        tsUrl += (tsUrl.indexOf('?') === -1 ? '?' : '&') + 'wsSecret=' + encodeURIComponent(wsSecret) + '&wsTime=' + encodeURIComponent(wsTime);
                    }
                    newLines.push(tsUrl);
                } else {
                    newLines.push(lines[i]);
                }
            }
            var finalM3u8Text = newLines.join('\n');

            // 7. 将重写后的 M3U8 文本打包成 Data URI 交给播放器（兼容最强，无需分片代理）
            var base64M3u8 = btoa(unescape(encodeURIComponent(finalM3u8Text)));
            var dataUri = 'data:application/vnd.apple.mpegurl;base64,' + base64M3u8;
            
            return JSON.stringify({ url: dataUri });
        }
    } catch (e) {
        // 如果拉取失败，则退回原地址，由播放器自己尝试
    }

    // 兜底返回
    return JSON.stringify({
        url: originM3u8,
        headers: m3u8Headers.join('\n')
    });
}
