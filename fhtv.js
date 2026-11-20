/*
 * 凤凰卫视 JS 直播源 (fhtv.js) - 防呆版
 * 用法：
 * 凤凰中文,javascript://你的raw地址/fhtv.js?id=cn
 * 凤凰资讯,javascript://你的raw地址/fhtv.js?id=info
 * 凤凰香港,javascript://你的raw地址/fhtv.js?id=hk
 */

function main(item) {
    // 1. 绝对暴力解析 ID，防止 MYTV 吞参数
    var rawStr = '';
    if (typeof item === 'string') {
        rawStr = item;
    } else if (item) {
        try { rawStr = JSON.stringify(item); } catch(e) { rawStr = String(item); }
    }

    var type = 'info'; // 默认资讯台
    // 只要字符串里包含这些特征词，强行纠正
    if (rawStr.indexOf('id=cn') !== -1 || rawStr.indexOf('type=cn') !== -1) {
        type = 'cn';
    } else if (rawStr.indexOf('id=hk') !== -1 || rawStr.indexOf('type=hk') !== -1) {
        type = 'hk';
    } else if (rawStr.indexOf('id=info') !== -1 || rawStr.indexOf('type=info') !== -1) {
        type = 'info';
    }

    // 2. 频道 ID 映射
    var channelMap = {
        'info': 'f7f48462-9b13-485b-8101-7b54716411ec', // 资讯台
        'cn':   '7c96b084-60e1-40a9-89c5-682b994fb680', // 中文台（修正了原代码中与资讯台重复的问题）
        'hk':   '15e02d92-1698-416c-af2f-3e9a872b4d78'  // 香港台
    };
    
    var liveId = channelMap[type];

    // 3. 请求接口
    var apiUrl = 'https://m.fengshows.com/api/v3/hub/live/auth-url?live_id=' + liveId + '&live_qa=HD';
    var headers = [
        'Referer: https://m.fengshows.com/',
        'User-Agent: Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36'
    ];

    try {
        var resp = mytv.get(apiUrl, headers);
        var json = JSON.parse(resp);
        
        // 提取视频地址
        var liveUrl = json.data && json.data.live_url ? json.data.live_url : '';
        
        if (liveUrl) {
            // 如果是相对路径，拼上域名（偶尔接口会返回相对路径）
            if (liveUrl.indexOf('http') !== 0) {
                liveUrl = 'https://m.fengshows.com' + liveUrl;
            }
            
            return JSON.stringify({ 
                url: liveUrl,
                headers: 'Referer: https://m.fengshows.com/\nUser-Agent: Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36'
            });
        } else {
            return JSON.stringify({ error: 'API未返回live_url (' + type + ')' });
        }
    } catch (e) {
        return JSON.stringify({ error: '请求或解析失败: ' + e.message });
    }
}
