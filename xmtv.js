function main(item) {
    var code = 'xm1'; // 默认
    if (item && item.id) {
        code = item.id;
    } else if (item && item.url) {
        // 从 url 参数里提取 id
        var m = /[?&]id=([^&]+)/.exec(item.url);
        if (m) code = m[1];
    }

    // 频道 ID 映射（请根据最新情况核对，这里沿用你原来的，但建议测试）
    var XM_CH = {
        xm1: '16', xm2: '17', xmws: '84', xmyd: '52',
        xmtv1: '16', xmtv2: '17', weishi: '84', yidong: '52'
    };
    var channelId = XM_CH[code] || (/^\d+$/.test(code) ? code : '16');

    var api = 'https://mapi1.kxm.xmtv.cn/api/v1/channel.php?channel_id=' + channelId;
    var headers = {
        'Referer': 'https://www.xmtv.cn/',
        'User-Agent': 'Mytv.Android'
    };

    // 尝试用 MYTV 环境或酷9环境请求 API
    var body = '';
    try {
        if (typeof ku9 !== 'undefined' && ku9.get) {
            body = ku9.get(api, ['Referer: https://www.xmtv.cn/', 'User-Agent: Mytv.Android']);
        } else if (typeof mytv !== 'undefined' && mytv.request) {
            var resp = mytv.request(api, 'GET', ['Referer: https://www.xmtv.cn/', 'User-Agent: Mytv.Android'], '');
            // mytv.request 的返回结构未知，尝试取 body 或字符串化
            body = (resp && resp.body) ? resp.body : (resp + '');
        }
    } catch (e) {
        return JSON.stringify({ error: '请求API失败: ' + e.message });
    }

    if (!body) return JSON.stringify({ error: 'API返回为空' });

    // 解析 m3u8 地址
    var mediaUrl = '';
    try {
        var json = JSON.parse(body);
        if (json && json[0] && json[0].channel_stream && json[0].channel_stream[0]) {
            mediaUrl = (json[0].channel_stream[0].m3u8 || '').replace(/\\\//g, '/');
        }
    } catch (e) {
        // JSON 解析失败，正则兜底
        var match = /"m3u8"\s*:\s*"(https?:[^"]+)"/.exec(body);
        if (match) mediaUrl = match[1].replace(/\\\//g, '/');
    }

    if (!mediaUrl) return JSON.stringify({ error: '未找到m3u8地址', raw: body.slice(0, 200) });

    // 直接返回 URL 和 headers 对象给 MYTV
    return JSON.stringify({
        url: mediaUrl,
        headers: headers
    });
}
