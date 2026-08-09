<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

requireUserId();

$configPath = __DIR__ . '/google-config.php';
if (!file_exists($configPath)) {
    header('Location: /main.html?youtube=error');
    exit;
}

$config = require $configPath;
$state = bin2hex(random_bytes(16));
$_SESSION['google_oauth_state'] = $state;

$params = http_build_query([
    'response_type' => 'code',
    'client_id' => $config['client_id'],
    'redirect_uri' => $config['redirect_uri'],
    'scope' => 'https://www.googleapis.com/auth/youtube.readonly',
    'access_type' => 'offline',
    'prompt' => 'consent',
    'state' => $state,
], '', '&');

header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $params);
exit;
