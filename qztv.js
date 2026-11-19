/**
 * 泉州广播电视台 JS 直播源
 * 用法：
 * 泉州新闻综合,javascript://你的raw地址/qztv.js?id=qzxwzh
 * 泉州闽南语,javascript://你的raw地址/qztv.js?id=qzmny
 */

var REFERER = 'https://www.qztv.cn/';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function main(item) {
    var id = item.id || 'qzxwzh';
    if (item.url) {
        var m = /[?&]id=([^&#]+)/.exec(item.url);
        if (m) id = m[1];
    }

    // 频道参数配置
    var CH = {
        'qzxwzh': { mediaId: 'wq95wqbDnMKyd8KiwqzChnt0w5nChcKowoHCoQ', streamName: 'news' },
        'qzmny':  { mediaId: 'wq95wqbDnMKyd8KiwqzChnt0w5nChcKofcKh', streamName: 'mny' }
    };

    var ch = CH[id];
    if (!ch) {
        return JSON.stringify({ error: '未知频道ID: ' + id });
    }

    // 核心思路：直接去请求播放器的底层 JS 文件，里面包含真实的流地址
    var jsUrl = 'https://www.qztv.cn/index/Medias/js/player.js?media_id=' + ch.mediaId + '&stream_name=' + ch.streamName;
    var headers = ['Referer: ' + REFERER, 'User-Agent: ' + UA];
    var finalUrl = '';

    try {
        var jsContent = mytv.get(jsUrl, headers);
        
        // 在返回的 JS 代码中寻找 m3u8 地址
        // 常见的格式是 urls = "http://xxx.m3u8" 或者 stream_url: "http://xxx.m3u8"
        var match = /(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/.exec(jsContent);
        
        if (match && match[1]) {
            finalUrl = match[1].replace(/\\\//g, '/');
        }
    } catch (e) {}

    // 如果没抓到，使用官网标准的 HLS 请求兜底尝试
    if (!finalUrl) {
        finalUrl = 'https://lmt.qztv.cn/live/' + ch.streamName + '/index.m3u8';
    }

    // 返回带 Headers 的对象
    return JSON.stringify({
        url: finalUrl,
        headers: 'Referer: ' + REFERER + '\nUser-Agent: ' + UA
    });
}
