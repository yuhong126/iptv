/*
 * 云南电视台 JS 直播源 (yntv.js) - 最终修正版
 * 兼容 MYTV 可能传入的 lmgi / ynlm 等别名
 */
function main(item) {
    let rawStr = '';
    if (typeof item === 'string') { rawStr = item; }
    else if (item) { try { rawStr = JSON.stringify(item); } catch(e) { rawStr = String(item); } }

    // 暴力匹配 id
    let id = 'ynws';
    let matchId = /id=([a-zA-Z0-9_]+)/.exec(rawStr);
    if (matchId && matchId[1]) { id = matchId[1].toLowerCase(); }

    // ★ 修正后的频道映射表
    const chMap = {
        // 卫视频道
        'ynws': 'yntv1',
        // 都市频道
        'ynds': 'yntv2',
        // 娱乐频道 (YNTV-3)
        'ynyl': 'yntv3', 
        // 影视频道 (YNTV-4)
        'ynys': 'yntv4',
        // ★ 康旅频道实际是 YNTV-6，不是娱乐的 yntv3
        'ynkl': 'yntv6', 
        'yngg': 'yntv6', // 兼容旧名“公共频道”
        // ★ 澜湄国际：同时接受 lmgi 和 ynlm 两种输入
        'lmgi': 'yntv8', 
        'ynlm': 'yntv8'
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
