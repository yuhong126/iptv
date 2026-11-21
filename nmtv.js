/**
 * 内蒙古网络广播电视台 JS 直播源 (nmtv.js)
 * 用法：
 * 内蒙古卫视,javascript://你的raw地址/nmtv.js?id=nmgws
 * 内蒙古蒙语卫视,javascript://你的raw地址/nmtv.js?id=nmgmyws
 * 内蒙古新闻综合,javascript://你的raw地址/nmtv.js?id=nmgxwzh
 * 内蒙古经济生活,javascript://你的raw地址/nmtv.js?id=nmgjjsh
 * 内蒙古少儿频道,javascript://你的raw地址/nmtv.js?id=nmgse
 * 内蒙古文体娱乐,javascript://你的raw地址/nmtv.js?id=nmgwtyl
 * 内蒙古农牧频道,javascript://你的raw地址/nmtv.js?id=nmgnm
 * 内蒙古蒙古语文化,javascript://你的raw地址/nmtv.js?id=nmgmgwh
 */

// 1. 防呆参数解析，兼容 MYTV 各种传参
function getChannelId(item) {
    var rawStr = '';
    if (typeof item === 'string') {
        rawStr = item;
    } else if (item) {
        try { rawStr = JSON.stringify(item); } catch(e) { rawStr = String(item); }
    }
    var match = /[?&]id=([a-zA-Z0-9_]+)/.exec(rawStr);
    return match ? match[1] : 'nmgws'; // 默认内蒙古卫视
}

// 2. 简洁高效的 XXTEA 加密/解密核心实现（兼容 mytv JS 引擎）
var XXTEA = (function() {
    var delta = 0x9E3779B9;
    function toUint32Array(str) {
        var arr = [], len = str.length;
        for (var i = 0; i < len; i++) arr[i >>> 2] |= (str.charCodeAt(i) & 0xff) << ((i % 4) * 8);
        return arr;
    }
    function toStr(arr) {
        var str = '', len = arr.length * 4;
        for (var i = 0; i < len; i++) {
            var c = (arr[i >>> 2] >>> ((i % 4) * 8)) & 0xff;
            if (c) str += String.fromCharCode(c);
        }
        return str;
    }
    function mx(sum, y, z, p, e, k) {
        return ((z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4)) ^ ((sum ^ y) + (k[p & 3 ^ e] ^ z));
    }
    function encrypt(v, k) {
        var n = v.length - 1;
        if (n < 1) return v;
        var z = v[n], y, sum = 0, e, p, q = Math.floor(6 + 52 / (n + 1));
        while (q-- > 0) {
            sum = (sum + delta) >>> 0;
            e = (sum >>> 2) & 3;
            for (p = 0; p < n; p++) {
                y = v[p + 1];
                z = v[p] = (v[p] + mx(sum, y, z, p, e, k)) >>> 0;
            }
            y = v[0];
            z = v[n] = (v[n] + mx(sum, y, z, n, e, k)) >>> 0;
        }
        return v;
    }
    function decrypt(v, k) {
        var n = v.length - 1;
        if (n < 1) return v;
        var z = v[n], y, sum = (Math.floor(6 + 52 / (n + 1)) * delta) >>> 0, e, p, q;
        while (sum !== 0) {
            e = (sum >>> 2) & 3;
            for (p = n; p > 0; p--) {
                z = v[p - 1];
                y = v[p] = (v[p] - mx(sum, y, z, p, e, k)) >>> 0;
            }
            z = v[n];
            y = v[0] = (v[0] - mx(sum, y, z, 0, e, k)) >>> 0;
            sum = (sum - delta) >>> 0;
        }
        return v;
    }
    return {
        encryptToString: function(str, key) {
            return toStr(encrypt(toUint32Array(str), toUint32Array(key)));
        },
        decryptToString: function(str, key) {
            return toStr(decrypt(toUint32Array(str), toUint32Array(key)));
        }
    };
})();

// 3. 主入口
function main(item) {
    var id = getChannelId(item);

    // 频道ID映射表 (对应官方 JSON 中的 ID)
    var channelMap = {
        'nmgws': 125,    // 内蒙古卫视
        'nmgmyws': 126,  // 内蒙古蒙古语卫视
        'nmgxwzh': 127,  // 内蒙古新闻综合
        'nmgjjsh': 128,  // 内蒙古经济生活
        'nmgse': 129,    // 内蒙古少儿频道
        'nmgwtyl': 130,  // 内蒙古文体娱乐
        'nmgnm': 131,    // 内蒙古农牧频道
        'nmgmgwh': 132   // 内蒙古蒙古语文化
    };

    var cid = channelMap[id];
    if (!cid) {
        return JSON.stringify({ error: '未知频道ID: ' + id });
    }

    // 4. 构建加密请求
    var key = '5b28bae827e651b3'; // 公开接口通信密钥
    var parms = { "size": 100, "type": 1 };
    var encryData = XXTEA.encryptToString(JSON.stringify(parms), key);
    var apiUrl = 'https://api-bt.nmtv.cn/broadcast/list';

    // 注意：mytv.request 的签名因版本而异，此处兼容标准 POST 形式
    var headers = [
        'Content-Type: application/json',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer: https://www.nmtv.cn/'
    ];

    try {
        // 发送 POST 请求并获取加密的响应体
        var res = mytv.request(apiUrl, 'POST', headers, encryData);
        var resBody = (res && res.body) ? res.body : (typeof res === 'string' ? res : '');
        
        if (!resBody) {
            return JSON.stringify({ error: 'API 请求返回为空' });
        }

        // 5. 解密响应并解析
        var decrypted = XXTEA.decryptToString(resBody, key);
        var obj = JSON.parse(decrypted);
        var dataList = obj.data || [];
        
        var liveStreamUrl = '';
        for (var i = 0; i < dataList.length; i++) {
            if (dataList[i].data && dataList[i].data.id == cid) {
                liveStreamUrl = dataList[i].data.streamUrl;
                break;
            }
        }

        if (!liveStreamUrl) {
            return JSON.stringify({ error: '未找到频道 ' + id + ' 的播放地址' });
        }

        // 6. 返回播放地址与请求头
        return JSON.stringify({
            url: liveStreamUrl,
            headers: 'Referer: https://www.nmtv.cn/\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });

    } catch (e) {
        return JSON.stringify({ error: '请求或解析异常: ' + e.message });
    }
}
