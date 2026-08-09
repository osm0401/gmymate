<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$userId = requireUserId();

$configPath = __DIR__ . '/spotify-config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo 'Spotify 연동이 아직 설정되지 않았어요.';
    exit;
}

$config = require $configPath;

$state = (string)($_GET['state'] ?? '');
if (empty($_SESSION['spotify_oauth_state']) || $state !== $_SESSION['spotify_oauth_state']) {
    http_response_code(400);
    echo '잘못된 로그인 요청이에요.';
    exit;
}
unset($_SESSION['spotify_oauth_state']);

$code = (string)($_GET['code'] ?? '');
if ($code === '') {
    header('Location: /main.html?spotify=denied');
    exit;
}

function spotifyPostForm(string $url, array $fields, string $clientId, string $clientSecret): ?array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($fields, '', '&'),
        CURLOPT_HTTPHEADER => [
            'Authorization: Basic ' . base64_encode("$clientId:$clientSecret"),
            'Content-Type: application/x-www-form-urlencoded',
        ],
        CURLOPT_RETURNTRANSFER => true,
    ]);
    $response = curl_exec($ch);
    curl_close($ch);

    if ($response === false) {
        return null;
    }

    $data = json_decode($response, true);
    return is_array($data) ? $data : null;
}

$tokenResponse = spotifyPostForm('https://accounts.spotify.com/api/token', [
    'grant_type' => 'authorization_code',
    'code' => $code,
    'redirect_uri' => $config['redirect_uri'],
], $config['client_id'], $config['client_secret']);

if (!$tokenResponse || empty($tokenResponse['access_token'])) {
    header('Location: /main.html?spotify=error');
    exit;
}

$pdo = getPdo();
$expiresAt = date('Y-m-d H:i:s', time() + (int)($tokenResponse['expires_in'] ?? 3600));

$stmt = $pdo->prepare('
    INSERT INTO music_connections (user_id, provider, access_token, refresh_token, expires_at, created_at)
    VALUES (?, "spotify", ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), refresh_token = VALUES(refresh_token), expires_at = VALUES(expires_at)
');
$stmt->execute([$userId, $tokenResponse['access_token'], $tokenResponse['refresh_token'] ?? null, $expiresAt]);

header('Location: /main.html?spotify=connected');
exit;
