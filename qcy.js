/**
 * 七彩云端（云南广播电视台）JS 直播源
 * 用法参考：
 * 云南卫视,javascript://你的raw地址/qcy.js?id=ynws
 * 云南都市,javascript://你的raw地址/qcy.js?id=ynds
 * 云南娱乐,javascript://你的raw地址/qcy.js?id=ynyl
 * 云南影视,javascript://你的raw地址/qcy.js?id=ynys
 * 云南公共,javascript://你的raw地址/qcy.js?id=yngg
 * 云南少儿,javascript://你的raw地址/qcy.js?id=ynse
 * 云南生活,javascript://你的raw地址/qcy.js?id=ynsh
 */

function main(item) {
    // 1. 防呆参数解析，兼容 MYTV 各种传参方式
    var rawStr = '';
    if (typeof item === 'string') {
        rawStr = item;
    } else if (item) {
        try { rawStr = JSON.stringify(item); } catch(e) { rawStr = String(item); }
    }

    var id = 'ynws'; // 默认云南卫视
    var match = /[?&]id=([a-zA-Z0-9_]+)/.exec(rawStr);
    if (match && match[1]) {
        id = match[1];
    }

    // 2. 频道映射表（来源于七彩云端官方底层配置）
    var channelMap = {
        'ynws': { hash: 'f9e94f35c75119ce9d1b1b010cc3129f', name: '云南卫视' },
        'yngg': { hash: '5d17d9668199884aa47738d6a3dc2aff', name: '公共频道' },
        'ynds': { hash: '9fef9f5d9b57e444755af3e6f2293e32', name: '都市频道' },
        'ynyl': { hash: '63f320b36814e9b85c7c8754430e4b04', name: '娱乐频道' },
        'ynys': { hash: '87273acd328c4b00ad627449f27f03c7', name: '影视频道' },
        'ynsh': { hash: 'b8985de15d0c57b578c953ab005600a4', name: '生活资讯' },
        'ynse': { hash: '09ede3d3d27085f22f104bdd4e669e91', name: '少儿频道' }
    };

    var channel = channelMap[id];
    if (!channel) {
        return JSON.stringify({ error: '未知频道ID: ' + id });
    }

    // 3. 构建官方 CDN 请求地址
    var apiUrl = 'https://hwapi.yunshicloud.com/' + channel.hash + '.m3u8';

    // 4. 统一请求头（伪装成网页端/APP访问）
    var headers = [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer: https://www.yntv.cn/'
    ];

    try {
        // 5. 发起请求验证连通性并尝试获取实际播放地址
        var res = mytv.get(apiUrl, headers);
        
        // 虽然返回的是 m3u8 文本，但我们只需要把带 Referer 的最终地址交给播放器
        // 如果接口有重定向，直接使用原地址播放器也会自动跟随
        if (res && res.indexOf('#EXTM3U') !== -1) {
            return JSON.stringify({ 
                url: apiUrl, 
                headers: 'Referer: https://www.yntv.cn/\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
            });
        } else {
            return JSON.stringify({ 
                url: apiUrl, 
                headers: 'Referer: https://www.yntv.cn/\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                // 提示：如果播放器内置内核要求校验，带上 headers 即可
            });
        }
    } catch (e) {
        return JSON.stringify({ 
            url: apiUrl, 
            headers: 'Referer: https://www.yntv.cn/\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            error: 'JS请求异常，直接返回地址由播放器接管: ' + e.message 
        });
    }
}
