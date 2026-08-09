<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$userId = requireUserId();

$configPath = __DIR__ . '/google-config.php';
if (!file_exists($configPath)) {
    header('Location: /main.html?youtube=error');
    exit;
}

$config = require $configPath;

$state = (string)($_GET['state'] ?? '');
if (empty($_SESSION['google_oauth_state']) || $state !== $_SESSION['google_oauth_state']) {
    header('Location: /main.html?youtube=error');
    exit;
}
unset($_SESSION['google_oauth_state']);

$code = (string)($_GET['code'] ?? '');
if ($code === '') {
    header('Location: /main.html?youtube=denied');
    exit;
}

$ch = curl_init('https://oauth2.googleapis.com/token');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query([
        'grant_type' => 'authorization_code',
        'code' => $code,
        'client_id' => $config['client_id'],
        'client_secret' => $config['client_secret'],
        'redirect_uri' => $config['redirect_uri'],
    ], '', '&'),
    CURLOPT_RETURNTRANSFER => true,
]);
$response = curl_exec($ch);
curl_close($ch);
$tokenResponse = json_decode((string)$response, true);

if (!is_array($tokenResponse) || empty($tokenResponse['access_token'])) {
    header('Location: /main.html?youtube=error');
    exit;
}

$pdo = getPdo();
$expiresAt = date('Y-m-d H:i:s', time() + (int)($tokenResponse['expires_in'] ?? 3600));

$stmt = $pdo->prepare('
    INSERT INTO music_connections (user_id, provider, access_token, refresh_token, expires_at, created_at)
    VALUES (?, "youtube", ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
        access_token = VALUES(access_token),
        refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
        expires_at = VALUES(expires_at)
');
$stmt->execute([$userId, $tokenResponse['access_token'], $tokenResponse['refresh_token'] ?? null, $expiresAt]);

header('Location: /main.html?youtube=connected');
exit;
