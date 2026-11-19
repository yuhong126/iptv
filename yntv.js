/*
 * 云南电视台 JS 直播源 (yntv.js) - 修正版
 * 用法：
 * 云南卫视,javascript://你的raw地址/yntv.js?id=ynws
 * 云南都市,javascript://你的raw地址/yntv.js?id=ynds
 * 云南娱乐,javascript://你的raw地址/yntv.js?id=ynyl
 * 云南影视,javascript://你的raw地址/yntv.js?id=ynys
 * 澜湄国际,javascript://你的raw地址/yntv.js?id=ynlm
 */

function main(item) {
    let rawStr = '';
    if (typeof item === 'string') { rawStr = item; }
    else if (item) { try { rawStr = JSON.stringify(item); } catch(e) { rawStr = String(item); } }

    let id = 'ynws';
    let matchId = /id=([a-zA-Z0-9_]+)/.exec(rawStr);
    if (matchId && matchId[1]) { id = matchId[1]; }

    // ★ 修正：澜湄国际的内部代号是 'yntv8'
    const chMap = {
        'ynws': 'yntv1', // 卫视
        'ynds': 'yntv2', // 都市
        'ynyl': 'yntv3', // 娱乐
        'ynys': 'yntv4', // 影视
        'ynlm': 'yntv8'  // 澜湄国际
    };

    let chCode = chMap[id];
    if (!chCode) {
        return JSON.stringify({ error: "未知的频道ID: " + id });
    }

    let apiUrl = 'https://app.yntv.cn/index.php/api/live/live_url?channel=' + chCode;

    const headersArr = [
        'User-Agent: Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Referer: https://app.yntv.cn/'
    ];

    try {
        const response = mytv.get(apiUrl, headersArr);
        let liveStreamUrl = '';
        try {
            let json = JSON.parse(response);
            if (json && json.data && json.data.url) { liveStreamUrl = json.data.url; }
            else if (json && json.url) { liveStreamUrl = json.url; }
        } catch (e) {
            let match = /(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/.exec(response);
            if (match) { liveStreamUrl = match[1].replace(/\\\//g, '/'); }
        }

        if (!liveStreamUrl) {
            return JSON.stringify({ error: "API未返回有效地址 (" + chCode + ")", raw: response.substring(0, 100) });
        }

        let finalHeaders = 'Referer: https://app.yntv.cn/\nUser-Agent: Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

        return JSON.stringify({ url: liveStreamUrl, headers: finalHeaders });

    } catch (e) {
        return JSON.stringify({ error: "请求异常: " + e.message });
    }
}
