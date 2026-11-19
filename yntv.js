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
    // 1. 绝对暴力的 ID 解析，把整个 item 转成字符串来找特征词
    var rawStr = '';
    if (typeof item === 'string') { 
        rawStr = item; 
    } else if (item) { 
        try { rawStr = JSON.stringify(item); } catch(e) { rawStr = String(item); } 
    }

    var id = 'ynws'; // 默认卫视
    // 只要字符串里包含以下字符，强制认定频道
    if (rawStr.indexOf('ynkl') !== -1) { id = 'ynkl'; }
    else if (rawStr.indexOf('ynds') !== -1) { id = 'ynds'; }
    else if (rawStr.indexOf('lmgi') !== -1 || rawStr.indexOf('ynlm') !== -1) { id = 'lmgi'; }
    else if (rawStr.indexOf('ynws') !== -1) { id = 'ynws'; }
    
    // 2. 映射官方代号
    var chMap = {
        'ynws': 'yunnanweishi', 
        'ynds': 'yunnandushi',  
        'ynkl': 'yunnangonggong',
        'lmgi': 'yunnanguoji'  
    };
    var channel = chMap[id] || 'yunnanweishi';

    // 3. 请求鉴权接口
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

    // 4. 解析 wsSecret 和 wsTime
    var json = null;
    try {
        json = JSON.parse(bodyText);
    } catch (e) {
        var mStr = /"string"\s*:\s*"([^"]+)"/.exec(bodyText);
        var mTime = /"time"\s*:\s*"([^"]+)"/.exec(bodyText);
        if (mStr && mTime) { json = { string: mStr[1], time: mTime[1] }; }
    }

    if (!json || !json.string || !json.time) {
        return JSON.stringify({ error: '获取鉴权失败 (' + channel + ')', raw: bodyText.substring(0, 100) });
    }

    var wsSecret = json.string;
    var wsTime = json.time;
    
    // 5. 拼接原版 M3U8 地址
    var originM3u8 = 'https://' + YNTV_HOST + '/live/' + channel + '/chunks.m3u8?wsSecret=' + encodeURIComponent(wsSecret) + '&wsTime=' + encodeURIComponent(wsTime);

    var m3u8Headers = [
        'Host: ' + YNTV_HOST,
        'User-Agent: ' + YNTV_UA,
        'Referer: ' + YNTV_REFERER
    ];
    if (cookieStr) m3u8Headers.push('Cookie: ' + cookieStr);

    // 6. 拉取 M3U8 文本并重写 TS 路径
    try {
        var m3u8Text = mytv.get(originM3u8, m3u8Headers);
        
        if (m3u8Text && m3u8Text.indexOf('#EXTM3U') !== -1) {
            var lines = m3u8Text.split('\n');
            var newLines = [];
            var baseUrl = 'https://' + YNTV_HOST + '/live/' + channel + '/';

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line && line.indexOf('#') !== 0) {
                    var tsUrl = line;
                    if (tsUrl.indexOf('http') !== 0) {
                        tsUrl = baseUrl + tsUrl.replace(/^\//, '');
                    }
                    if (tsUrl.indexOf('wsSecret=') === -1) {
                        tsUrl += (tsUrl.indexOf('?') === -1 ? '?' : '&') + 'wsSecret=' + encodeURIComponent(wsSecret) + '&wsTime=' + encodeURIComponent(wsTime);
                    }
                    newLines.push(tsUrl);
                } else {
                    newLines.push(lines[i]);
                }
            }
            var finalM3u8Text = newLines.join('\n');

            // 7. 兼容性转码并返回 Data URI
            try {
                if (typeof btoa !== 'undefined') {
                    var base64M3u8 = btoa(unescape(encodeURIComponent(finalM3u8Text)));
                    return JSON.stringify({ url: 'data:application/vnd.apple.mpegurl;base64,' + base64M3u8 });
                }
            } catch (err) {}
            
            // 如果内核不支持 base64 转码，退回原地址兜底
            return JSON.stringify({ url: originM3u8, headers: m3u8Headers.join('\n') });
        }
    } catch (e) {}

    // 兜底
    return JSON.stringify({ url: originM3u8, headers: m3u8Headers.join('\n') });
}
