function main(item) {
    // 1. 兼容 MYTV 的参数获取方式
    let url = (item && item.url) ? item.url : (typeof item === 'string' ? item : '');
    let idMatch = /[?&]id=([^&#]+)/.exec(url);
    let id = idMatch ? idMatch[1] : 'qzzh'; 

    // 2. 频道映射表
    const n = {
        'qzzh': 'wq95wqbDnMKyd8KiwqzChnt0w5nChcKowoHCoQ/stream_name/news.html',
        'qzmny': 'wq95wqbDnMKyd8KiwqzChnt0w5nChcKofcKh/stream_name/mny.html'
    };

    const mediaId = n[id] || n['qzzh'];
    // 注意：你原代码用 control-center，这是对的，它负责下发真实地址
    const apiUrl = 'https://control-center.qztv.cn/index/Medias/index/media_id/' + mediaId;
    
    // 请求网页用的头
    const headersArr = [
        'Referer: https://control-center.qztv.cn/',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
    ];

    try {
        // 3. 改用 mytv.get 请求
        const response = mytv.get(apiUrl, headersArr);
        
        // 4. 正则提取 m3u8 地址
        const pattern = /urls\s*=\s*"([^"]+)"/;
        const match = response.match(pattern);
        
        if (!match || !match[1]) {
            return JSON.stringify({ error: "未找到直播地址，请检查接口是否变化" });
        }

        let liveStreamUrl = match[1];
        
        // 5. 关键修复：返回给播放器的 Header 必须是字符串，且绝对不能带 Host
        // 分片请求时必须带 Referer，UA 也要伪装成手机端
        let finalHeaders = 'Referer: ' + apiUrl + '\nUser-Agent: Mozilla/5.0 (Linux; Android 10; HMA-AL00 Build/HUAWEIHMA-AL00) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.93 Mobile Safari/537.36';

        return JSON.stringify({ 
            url: liveStreamUrl,
            headers: finalHeaders
        });
        
    } catch (e) {
        return JSON.stringify({ error: "请求失败：" + e.message });
    }
}
