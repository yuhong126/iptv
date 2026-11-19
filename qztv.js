function main(item) {
    // 彻底解决参数获取问题：不管你传的是对象还是长字符串，我全转成字符串来找！
    let rawStr = '';
    if (typeof item === 'string') {
        rawStr = item;
    } else if (item) {
        // 如果 item 是个对象，把所有属性拼起来找
        try {
            rawStr = JSON.stringify(item);
        } catch(e) {
            rawStr = String(item);
        }
    }

    // 暴力全局正则：只要字符串里有 id=qzmny 或者 id=qzzh，就能抓出来
    let id = 'qzzh'; // 默认新闻综合
    let matchId = /id=([a-zA-Z0-9_]+)/.exec(rawStr);
    if (matchId && matchId[1]) {
        id = matchId[1];
    }

    // 如果发现没匹配到，但是字符串里直接包含了 qzmny 这个词，也强行纠正
    if (rawStr.indexOf('qzmny') > -1 && rawStr.indexOf('id=qzmny') === -1) {
        id = 'qzmny';
    }

    // 频道映射表（新闻综合 & 闽南语）
    const n = {
        'qzzh': 'wq95wqbDnMKyd8KiwqzChnt0w5nChcKowoHCoQ/stream_name/news.html',
        'qzmny': 'wq95wqbDnMKyd8KiwqzChnt0w5nChcKofcKh/stream_name/mny.html'
    };

    const mediaId = n[id];
    if (!mediaId) {
        return JSON.stringify({ error: "未知频道ID: " + id });
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
            return JSON.stringify({ error: "接口未返回直播地址" });
        }

        let liveStreamUrl = match[1];
        let finalHeaders = 'Referer: ' + apiUrl + '\nUser-Agent: Mozilla/5.0 (Linux; Android 10; HMA-AL00 Build/HUAWEIHMA-AL00) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.93 Mobile Safari/537.36';

        return JSON.stringify({ 
            url: liveStreamUrl,
            headers: finalHeaders
        });
    } catch (e) {
        return JSON.stringify({ error: "请求失败：" + e.message });
    }
}
