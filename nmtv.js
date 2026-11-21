/**
 * 内蒙古广播电视台 JS 直播源 (nmtv.js) - 修复版
 * 用法：
 * 内蒙古卫视,javascript://你的raw地址/nmtv.js?id=nmgws
 * 内蒙古蒙语卫视,javascript://你的raw地址/nmtv.js?id=nmgmy
 * 内蒙古新闻综合,javascript://你的raw地址/nmtv.js?id=nmgxw
 * 内蒙古经济生活,javascript://你的raw地址/nmtv.js?id=nmgjj
 * 内蒙古少儿频道,javascript://你的raw地址/nmtv.js?id=nmgse
 * 内蒙古文体娱乐,javascript://你的raw地址/nmtv.js?id=nmgwt
 * 内蒙古农牧频道,javascript://你的raw地址/nmtv.js?id=nmgNM
 */

function main(item) {
    // 1. 暴力防呆参数解析，防止 MYTV 吞参数
    var rawStr = '';
    if (typeof item === 'string') {
        rawStr = item;
    } else if (item) {
        try { rawStr = JSON.stringify(item); } catch(e) { rawStr = String(item); }
    }

    var id = 'nmgws'; // 默认内蒙古卫视
    var match = /[?&]id=([a-zA-Z0-9_]+)/.exec(rawStr);
    if (match && match[1]) {
        id = match[1];
    }

    // 2. 频道映射表
    // 优先使用 play1-qk 备用节点（此节点对公网兼容性较好）
    var channelMap = {
        'nmgws': 'http://play1-qk.nmtv.cn/2323general.m3u8', // 内蒙古卫视 (4M 1080)
        'nmgmy': 'http://play1-qk.nmtv.cn/2322general.m3u8', // 蒙语卫视 (推测ID)
        'nmgxw': 'http://play1-qk.nmtv.cn/2324general.m3u8', // 新闻综合 (推测ID)
        'nmgjj': 'http://play1-qk.nmtv.cn/2325general.m3u8', // 经济生活 (推测ID)
        'nmgse': 'http://play1-qk.nmtv.cn/2326general.m3u8', // 少儿频道 (推测ID)
        'nmgwt': 'http://play1-qk.nmtv.cn/2327general.m3u8', // 文体娱乐 (推测ID)
        'nmgNM': 'http://play1-qk.nmtv.cn/2328general.m3u8'  // 农牧频道 (推测ID)
    };

    var streamUrl = channelMap[id];
    if (!streamUrl) {
        return JSON.stringify({ error: '未知频道ID: ' + id });
    }

    // 3. 返回地址和请求头
    // 官方 CDN 校验 Referer，必须携带，否则可能 403 或黑屏
    var headers = 'Referer: https://www.nmtv.cn/\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

    return JSON.stringify({
        url: streamUrl,
        headers: headers
    });
}
