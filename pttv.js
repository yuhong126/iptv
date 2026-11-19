function main(item) {
    // 获取URL中的id参数
    var id = ku9.getQuery(item.url, "id") || 'pttv1';
    
    // 频道映射表
    var n = {
        'pttv1': 4,   //莆田新闻综合
        'pttv2': 5,   //莆田2
        'ptxy': 6,    //莆田仙游
        'cctv1': 27,  //CCTV1综合
        'cctv13': 28  //CCTV13新闻
    };
    
    // 获取对应的频道ID
    var channelId = n[id] || n['pttv1'];
    
    // 构建请求URL
    var apiUrl = "https://mapi.ptbtv.com/api/v1/channel.php?channel_id=" + channelId;
    
    // 发送GET请求获取频道信息
    var response = ku9.get(apiUrl, null);
    
    // 解析JSON响应
    if (response) {
        try {
            var data = JSON.parse(response);
            if (data && data.length > 0 && data[0].m3u8) {
                // 返回播放地址
                return JSON.stringify({ 
                    url: data[0].m3u8 
                });
            }
        } catch (e) {
            // JSON解析错误处理
            return JSON.stringify({ 
                error: "解析响应数据失败: " + e.toString() 
            });
        }
    }
    
    // 如果获取失败，返回错误
    return JSON.stringify({ 
        error: "无法获取播放地址" 
    });
}
