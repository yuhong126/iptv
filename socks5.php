<?php
/**
 * SOCKS5 / HTTP Proxy + M3U8 Rewrite
 */

set_time_limit(0);
ini_set('memory_limit', '128M');

$proxy = $_GET['ip'] ?? '';
$url   = $_GET['u'] ?? '';

if (!$proxy || !$url) {
    http_response_code(400);
    exit('Missing ip or u');
}

// 解析代理
if (strpos($proxy, '://') === false) {
    $proxy = 'socks5://' . $proxy;
}
$proxyParts = parse_url($proxy);
$proxyHost  = $proxyParts['host'];
$proxyPort  = $proxyParts['port'] ?? ($proxyParts['scheme'] === 'socks5' ? 1080 : 8080);
$proxyType  = $proxyParts['scheme'];

// 目标 URL
$targetUrl = $url;

// 判断是否为 m3u8
$isM3u8 = preg_match('/\.m3u8(\?.*)?$/i', $targetUrl);

// cURL
$ch = curl_init($targetUrl);

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => false,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
    CURLOPT_HEADER => false,
]);

// 代理设置
if ($proxyType === 'socks5') {
    curl_setopt($ch, CURLOPT_PROXY, "$proxyHost:$proxyPort");
    curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_SOCKS5);
} else {
    curl_setopt($ch, CURLOPT_PROXY, "$proxyHost:$proxyPort");
    curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_HTTP);
}

// 流式输出
if ($isM3u8) {
    header('Content-Type: application/vnd.apple.mpegurl');
    header('Cache-Control: no-cache');

    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $data) use ($targetUrl) {
        echo rewriteM3u8($data, $targetUrl);
        flush();
        return strlen($data);
    });
} else {
    // ts / key / 普通资源
    header('Content-Type: application/octet-stream');

    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $data) {
        echo $data;
        flush();
        return strlen($data);
    });
}

curl_exec($ch);
curl_close($ch);

/**
 * 重写 m3u8 中的 URL
 */
function rewriteM3u8($content, $baseUrl)
{
    $base = dirname($baseUrl) . '/';

    return preg_replace_callback(
        '/^(?!#)(.+)$/m',
        function ($m) use ($base, $baseUrl) {
            $line = trim($m[1]);
            if (!$line) return $m[0];

            // 已经是完整 URL
            if (preg_match('/^https?:\/\//i', $line)) {
                return buildProxyUrl($line);
            }

            // 相对路径
            $absolute = resolveUrl($base, $line);
            return buildProxyUrl($absolute);
        },
        $content
    );
}

/**
 * 拼接当前代理访问地址
 */
function buildProxyUrl($url)
{
    $self = (isset($_SERVER['HTTPS']) ? 'https://' : 'http://') .
            $_SERVER['HTTP_HOST'] .
            $_SERVER['SCRIPT_NAME'];

    return $self . '?ip=' . urlencode($_GET['ip']) . '&u=' . urlencode($url);
}

/**
 * 解析相对 URL
 */
function resolveUrl($base, $rel)
{
    if (parse_url($rel, PHP_URL_SCHEME)) {
        return $rel;
    }
    if (substr($rel, 0, 1) === '/') {
        $parts = parse_url($base);
        return $parts['scheme'] . '://' . $parts['host'] . ':' . ($parts['port'] ?? 80) . $rel;
    }
    return rtrim($base, '/') . '/' . ltrim($rel, '/');
}