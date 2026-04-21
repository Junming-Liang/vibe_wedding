<?php
/**
 * 请柬留言桥接：部署到 WordPress「站点根目录」（与 wp-config.php 同级），不要放在 /invite-2026/ 内，
 * 否则易被 try_files 回退成 index.html，POST 仍 405。
 *
 * 浏览器请求：https://你的域名/invite-2026-messages-bridge.php
 * 由 PHP curl 转发到本机 Node（invite_messages_api）。
 *
 * 环境变量（php-fpm 池 / Apache SetEnv）：
 *   INVITE_MSG_UPSTREAM — Node 根地址，默认 http://127.0.0.1:3840
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$upstream = rtrim(getenv('INVITE_MSG_UPSTREAM') ?: 'http://127.0.0.1:3840', '/');

function client_ip(): string
{
    $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if (is_string($xff) && $xff !== '') {
        $first = trim(explode(',', $xff)[0]);
        if ($first !== '') {
            return substr($first, 0, 64);
        }
    }
    $ra = $_SERVER['REMOTE_ADDR'] ?? '';
    return is_string($ra) ? substr($ra, 0, 64) : '';
}

function curl_upstream(string $method, string $url, ?string $body = null): void
{
    $ch = curl_init($url);
    if ($ch === false) {
        http_response_code(502);
        echo json_encode(['error' => '无法初始化转发'], JSON_UNESCAPED_UNICODE);
        return;
    }

    $headers = ['X-Forwarded-For: ' . client_ip()];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => $headers,
    ];
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = $body;
        $headers[] = 'Content-Type: application/json';
        $opts[CURLOPT_HTTPHEADER] = $headers;
    }
    curl_setopt_array($ch, $opts);

    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($resp === false || $code === 0) {
        http_response_code(502);
        echo json_encode(
            [
                'error' => '留言服务不可达：本机 Node（invite_messages_api）未响应。请 systemctl 启动服务或先在该目录执行 npm run start。',
                'detail' => $err,
                'upstream' => $url,
            ],
            JSON_UNESCAPED_UNICODE
        );
        return;
    }

    http_response_code($code > 0 ? $code : 502);
    echo $resp;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';
    if ($action !== 'public') {
        http_response_code(400);
        echo json_encode(['error' => '缺少或无效的 action'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    curl_upstream('GET', $upstream . '/api/messages/public', null);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    if (!is_string($raw)) {
        http_response_code(400);
        echo json_encode(['error' => '无效请求体'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (strlen($raw) > 16384) {
        http_response_code(413);
        echo json_encode(['error' => '请求体过大'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    curl_upstream('POST', $upstream . '/api/messages', $raw);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed'], JSON_UNESCAPED_UNICODE);
