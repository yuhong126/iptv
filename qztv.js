function main(item) {
    // 1. 极其粗暴且稳定的 ID 解析方式
    // 不管 MYTV 传进来的是什么，直接转成字符串进行正则匹配
    let urlStr = '';
    if (typeof item === 'string') {
        urlStr = item;
    } else if (item && item.url) {
        urlStr = item.url;
    } else if (item) {
        urlStr = JSON.stringify(item); // 兜底，防止把对象传进来
    }

    // 全局搜索 id=
    let id = 'qzzh'; // 默认
    let idMatch = /[?&]id=([a-zA-Z0-9_]+)/.exec(urlStr);
    if (idMatch && idMatch[1]) {
        id = idMatch[1];
    }

    // 2. 频道映射表
    const n = {
        'qzzh': 'wq95wqbDnMKyd8KiwqzChnt0w5nChcKowoHCoQ/stream_name/news.html',
        'qzmny': 'wq95wqbDnMKyd8KiwqzChnt0w5nChcKofcKh/stream_name/mny.html'
    };

    const mediaId = n[id];
    if (!mediaId) {
        return JSON.stringify({ error: "未知的频道ID: " + id });
    }

    const apiUrl = 'https://control-center.qztv.cn/index/Medias/index/media_id/' + mediaId;

    const headersArr = [
        'Referer: https://control-center.qztv.cn/',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
    ];

    try {
        const response = mytv.get(apiUrl, headersArr);

        // 提取 m3u8 地址
        const pattern = /urls\s*=\s*"([^"]+)"/;
        const match = response.match(pattern);

        if (!match || !match[1]) {
            return JSON.stringify({ error: "接口未返回直播地址，请检查接口" });
        }

        let liveStreamUrl = match[1];

        // 播放器的请求头
        let finalHeaders = 'Referer: ' + apiUrl + '\nUser-Agent: Mozilla/5.0 (Linux; Android 10; HMA-AL00 Build/HUAWEIHMA-AL00) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.93 Mobile Safari/537.36';

        return JSON.stringify({ 
            url: liveStreamUrl,
            headers: finalHeaders
        });

    } catch (e) {
        return JSON.stringify({ error: "请求失败：" + e.message });
    }
}
