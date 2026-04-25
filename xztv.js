function main(item) {
    // 西藏TV
    const id = item.id || '0'; // 默认第一个频道
   
    const apiUrl = "http://api.vtibet.cn/xizangmobileinf/rest/xz/cardgroups";
    const postData = 'json=%7B%22cardgroups%22%3A%22LIVECAST%22%2C%22paging%22%3A%7B%22page_no%22%3A%221%22%2C%22page_size%22%3A%22100%22%7D%2C%22version%22%3A%221.0.0%22%7D';
   
    const apiRes = ku9.request(apiUrl, 'POST', {
        'Referer': 'http://api.vtibet.cn/',
        'Content-Type': 'application/x-www-form-urlencoded'
    }, postData);
   
    if (apiRes.code !== 200) {
        return { url: '获取频道列表失败...' };
    }
   
    try {
        const data = JSON.parse(apiRes.body);
        const cardIndex = parseInt(id);
        
        // 检查数据结构是否存在
        if (!data?.cardgroups?.[1]?.cards?.[cardIndex]?.video?.url_hd) {
            // 尝试其他可能的索引
            if (data?.cardgroups?.[0]?.cards?.[cardIndex]?.video?.url_hd) {
                const playUrl = data.cardgroups[0].cards[cardIndex].video.url_hd;
                return {
                    url: playUrl,
                    headers: {
                        'Access-Control-Allow-Origin': '*'
                    }
                };
            }
            return { url: '频道地址获取失败...' };
        }
        
        const playUrl = data.cardgroups[1].cards[cardIndex].video.url_hd;
        
        return {
            url: playUrl,
            headers: {
                'Access-Control-Allow-Origin': '*'
            }
        };
        
    } catch (error) {
        return { url: '解析数据时出错...' };
    }
}