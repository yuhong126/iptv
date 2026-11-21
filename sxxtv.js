/**
 * 陕西电视台 JS 直播源 (sxtv.js)
 * 用法：
 * 陕西卫视,javascript://你的raw地址/sxtv.js?id=sxws
 * 陕西卫视(备用),javascript://你的raw地址/sxtv.js?id=sxws2
 * 陕西卫视(移动),javascript://你的raw地址/sxtv.js?id=sxyd
 */

function main(item) {
    // 1. 稳健防呆参数解析
    var rawStr = '';
    if (typeof item === 'string') rawStr = item;
    else if (item) {
        try { rawStr = JSON.stringify(item); } catch(e) { rawStr = String(item); }
    }

    var id = 'sxws'; // 默认陕西卫视官方源
    var match = /[?&]id=([a-zA-Z0-9_]+)/.exec(rawStr);
    if (match && match[1]) id = match[1];

    // 2. 频道映射表（优先使用官方CDN直出源）
    var channelMap = {
        // 官方CDN直出源，最稳定[reference:0][reference:1]
        'sxws': 'http://stream.snrtv.com/sxbc-star-tBRUZ8.m3u8',
        
        // 咪咕备用源
        'sxws2': 'http://ss.baihuan.online:35455/mgtv/738910838.m3u8',
        
        // 陕西移动易视腾源，可能受网络限制
        'sxyd': 'http://zteres.sn.chinamobile.com:6060/000000001000/6000000001000029752/1.m3u8?channel-id=wasusyt&Contentid=6000000001000029752&livemode=1&stbId=m'
    };

    var streamUrl = channelMap[id];
    if (!streamUrl) {
        return JSON.stringify({ error: '未知频道ID: ' + id });
    }

    // 3. 统一请求头（伪装成网页访问，官方CDN通常对UA和Referer无硬性要求，但带上更稳妥）
    var headers = 'Referer: https://www.snrtv.com/\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

    return JSON.stringify({
        url: streamUrl,
        headers: headers
    });
}
