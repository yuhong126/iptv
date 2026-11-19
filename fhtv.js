function main(item) {
    // 1. 解析参数，兼容 mytv 可能传入的格式
    var params = {};
    var input = (typeof item === 'string') ? item : (item && item.url ? item.url : '');
    var query = input.split('?')[1] || '';
    query.split('&').forEach(function(pair) {
        var kv = pair.split('=');
        if (kv[0]) params[kv[0]] = kv[1];
    });

    // 2. 频道 ID 映射（来自你原代码）
    var channelMap = {
        'info': 'f7f48462-9b13-485b-8101-7b54716411ec', // 资讯台
        'cn':   'f7f48462-9b13-485b-8101-7b54716411ec', // 中文台 (注意：原代码这里似乎写重复了，请核对)
        'hk':   '15e02d92-1698-416c-af2f-3e9a872b4d78'  // 香港台
    };
    
    // 默认用资讯台
    var type = params.type || 'info';
    var liveId = channelMap[type] || channelMap['info'];

    // 3. 直接请求 auth-url 接口（无需 token）
    var apiUrl = 'https://m.fengshows.com/api/v3/hub/live/auth-url?live_id=' + liveId + '&live_qa=HD';
    var headers = [
        'Referer: https://m.fengshows.com/',
        'User-Agent: Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36'
    ];

    try {
        var resp = mytv.get(apiUrl, headers);
        var json = JSON.parse(resp);
        var liveUrl = json.data && json.data.live_url;
        
        if (liveUrl) {
            // 成功拿到地址，直接返回给 mytv 播放
            return JSON.stringify({ url: liveUrl });
        } else {
            return JSON.stringify({ error: 'API未返回live_url', raw: resp.slice(0, 200) });
        }
    } catch (e) {
        return JSON.stringify({ error: '请求或解析失败: ' + e.message });
    }
}
