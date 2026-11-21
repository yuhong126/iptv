/**
 * 海南网络广播电视台 JS 直播源 (hntv.js)
 * 用法：
 * 海南卫视,javascript://你的raw地址/hntv.js?id=19  (19为高清，3为标清)
 * 三沙卫视,javascript://你的raw地址/hntv.js?id=7
 * 海南新闻,javascript://你的raw地址/hntv.js?id=5
 * 海南经济,javascript://你的raw地址/hntv.js?id=4
 * 海南公共,javascript://你的raw地址/hntv.js?id=6
 * 海南文旅,javascript://你的raw地址/hntv.js?id=8
 * 海南少儿,javascript://你的raw地址/hntv.js?id=9
 */

function main(item) {
    // 1. 暴力防呆参数解析
    var rawStr = '';
    if (typeof item === 'string') rawStr = item;
    else if (item) {
        try { rawStr = JSON.stringify(item); } catch(e) { rawStr = String(item); }
    }

    var id = '19'; // 默认海南卫视高清
    var match = /[?&]id=([0-9]+)/.exec(rawStr);
    if (match && match[1]) {
        id = match[1];
    }

    // 2. 海南台官方接口
    var apiUrl = 'http://tv.hnntv.cn/m2o/channel/channel_info.php?channel_id=' + id;
    var headers = [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer: http://www.hnntv.cn/'
    ];

    try {
        // 3. 请求官方接口获取数据
        var response = mytv.get(apiUrl, headers);
        var liveStreamUrl = '';

        // 4. 提取 m3u8 地址
        // 接口返回的数据格式可能包含转义符，用正则强制抠出 m3u8 地址
        var pattern = /"m3u8"\s*:\s*"([^"]+)"/;
        var m = pattern.exec(response);
        
        if (m && m[1]) {
            // 去除可能存在的转义反斜杠
            liveStreamUrl = m[1].replace(/\\\//g, '/');
        }

        if (liveStreamUrl) {
            // 如果返回的是相对路径，补全 HTTP 头
            if (liveStreamUrl.indexOf('http') !== 0) {
                liveStreamUrl = 'http:' + liveStreamUrl;
            }

            // 5. 返回给 MYTV，附带请求需要的 Referer
            return JSON.stringify({ 
                url: liveStreamUrl, 
                headers: 'Referer: http://www.hnntv.cn/\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });
        } else {
            return JSON.stringify({ error: "接口未返回有效的m3u8地址，请检查ID是否正确" });
        }

    } catch (e) {
        return JSON.stringify({ error: "请求异常: " + e.message });
    }
}
