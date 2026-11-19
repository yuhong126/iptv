/*
 * 云南电视台 JS 直播源 (yntv.js)
 * 用法：
 * 云南卫视,javascript://你的raw地址/yntv.js?id=ynws
 * 云南都市,javascript://你的raw地址/yntv.js?id=ynds
 * 云南娱乐,javascript://你的raw地址/yntv.js?id=ynyl
 * 云南影视,javascript://你的raw地址/yntv.js?id=ynys
 */

function main(item) {
    // 1. 暴力兼容解析 ID
    let rawStr = '';
    if (typeof item === 'string') {
        rawStr = item;
    } else if (item) {
        try { rawStr = JSON.stringify(item); } catch(e) { rawStr = String(item); }
    }

    let id = 'ynws'; // 默认云南卫视
    let matchId = /id=([a-zA-Z0-9_]+)/.exec(rawStr);
    if (matchId && matchId[1]) {
        id = matchId[1];
    }

    // 2. 云视网移动端真实频道代号映射
    const chMap = {
        'ynws': 'yntv1', // 卫视
        'ynds': 'yntv2', // 都市
        'ynyl': 'yntv3', // 娱乐
        'ynys': 'yntv4'  // 影视
    };

    let chCode = chMap[id] || 'yntv1';
    
    // 3. 移动端 API 接口
    // 这套接口直接返回带动态时间戳签名的真实 m3u8 地址
    let apiUrl = 'https://app.yntv.cn/index.php/api/live/live_url?channel=' + chCode;

    // 4. 伪装成手机端请求 API（非常关键，网页端 UA 会报错）
    const headersArr = [
        'User-Agent: Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Referer: https://app.yntv.cn/'
    ];

    try {
        // 5. 请求接口
        const response = mytv.get(apiUrl, headersArr);
        
        // 6. 提取 m3u8 地址（兼容 JSON 返回和直接文本返回）
        let liveStreamUrl = '';
        try {
            let json = JSON.parse(response);
            if (json && json.data && json.data.url) {
                liveStreamUrl = json.data.url;
            } else if (json && json.url) {
                liveStreamUrl = json.url;
            }
        } catch (e) {
            // JSON 解析失败，用正则硬抠 http 链接
            let match = /(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/.exec(response);
            if (match) {
                liveStreamUrl = match[1].replace(/\\\//g, '/');
            }
        }

        if (!liveStreamUrl) {
            return JSON.stringify({ error: "API未返回有效地址，可能接口已更换", raw: response.substring(0, 100) });
        }

        // 7. 播放器请求分片时的 Headers
        // 必须带上移动端 Referer，否则 CDN 会 403
        let finalHeaders = 'Referer: https://app.yntv.cn/\nUser-Agent: Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

        return JSON.stringify({ 
            url: liveStreamUrl,
            headers: finalHeaders
        });

    } catch (e) {
        return JSON.stringify({ error: "请求异常: " + e.message });
    }
}
