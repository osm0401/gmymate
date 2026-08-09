<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$userId = requireUserId();

$configPath = __DIR__ . '/spotify-config.php';
if (!file_exists($configPath)) {
    jsonResponse(500, ['error' => 'Spotify 연동이 아직 설정되지 않았어요.']);
}

$config = require $configPath;
$pdo = getPdo();

$stmt = $pdo->prepare('SELECT access_token, refresh_token, expires_at FROM music_connections WHERE user_id = ? AND provider = "spotify"');
$stmt->execute([$userId]);
$connection = $stmt->fetch();

if (!$connection) {
    jsonResponse(404, ['error' => 'Spotify가 연결되어 있지 않아요.']);
}

if (strtotime((string)$connection['expires_at']) > time() + 30) {
    jsonResponse(200, ['accessToken' => $connection['access_token']]);
}

$ch = curl_init('https://accounts.spotify.com/api/token');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query([
        'grant_type' => 'refresh_token',
        'refresh_token' => $connection['refresh_token'],
    ], '', '&'),
    CURLOPT_HTTPHEADER => [
        'Authorization: Basic ' . base64_encode($config['client_id'] . ':' . $config['client_secret']),
        'Content-Type: application/x-www-form-urlencoded',
    ],
    CURLOPT_RETURNTRANSFER => true,
]);
$response = curl_exec($ch);
curl_close($ch);
$data = json_decode((string)$response, true);

if (!is_array($data) || empty($data['access_token'])) {
    jsonResponse(502, ['error' => 'Spotify 토큰 갱신에 실패했어요.']);
}

$expiresAt = date('Y-m-d H:i:s', time() + (int)($data['expires_in'] ?? 3600));
$refreshToken = $data['refresh_token'] ?? $connection['refresh_token'];

$update = $pdo->prepare('UPDATE music_connections SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ? AND provider = "spotify"');
$update->execute([$data['access_token'], $refreshToken, $expiresAt, $userId]);

jsonResponse(200, ['accessToken' => $data['access_token']]);
