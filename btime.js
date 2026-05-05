/*
# -*- coding: utf-8 -*-
# @Author  : Doubebly
# @Time    : 2026/4/4 18:03
# @file    : btime.js
 */
// let ku9 = {
//     md5 : function (){}
// }

function main(item) {

    // 填写你抓包到的usid
    let usid = "6b79f49eae0d11e79869421735925e22";
    let uri = item.url;
    let pid = ku9.getQuery(uri, "id");
    let r = {
        'url': '',
        'headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
            'Referer': 'https://www.btime.com/',
            'Origin': 'https://www.btime.com',
        },
        'player': 3
    };
    let cacheKey = 'btime_' + pid;
    let cachePlayUrl = ku9.getCache(cacheKey);
    if (cachePlayUrl !== null) {
        r.url = cachePlayUrl;
        return r
    }
    let t = Math.round(new Date().getTime() / 1000).toString();
    let t2 = Math.round(new Date().getTime()).toString();
    let s = ku9.md5(`${pid}151${t}TtJSg@2g*$K4PjUH`);
    let sign = s.slice(0, 8);
    let url = `https://pc.api.btime.com/video/play?from=pc&id=${pid}&type_id=151&timestamp=${t}&sign=${sign}&_=${t2}`
    let headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        'Referer': 'https://www.btime.com/',
        'Origin': 'https://www.btime.com',
        "Cookie": `usid=${usid}; lf=1`
    };
    let res = ku9.get(url, headers);
    console.log(res);
    let jsonData = JSON.parse(res);
    let stream_url = jsonData['data']['video_stream'][0]['stream_url'];
    // let stream_url = jsonData.data.video_stream[0].stream_url;
    if (!stream_url.startsWith('http')) {
        stream_url = ku9.decodeBase64(ku9.decodeBase64(stream_url.split('').reverse().join('')));
    }
    // 缓存30分钟
    ku9.setCache(cacheKey, stream_url, 60000 * 30);
    r.url = stream_url;
    return r
}
