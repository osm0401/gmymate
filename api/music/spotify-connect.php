<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

requireUserId();

$configPath = __DIR__ . '/spotify-config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo 'Spotify 연동이 아직 설정되지 않았어요.';
    exit;
}

$config = require $configPath;
$state = bin2hex(random_bytes(16));
$_SESSION['spotify_oauth_state'] = $state;

$scopes = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';

$params = http_build_query([
    'response_type' => 'code',
    'client_id' => $config['client_id'],
    'scope' => $scopes,
    'redirect_uri' => $config['redirect_uri'],
    'state' => $state,
], '', '&');

header('Location: https://accounts.spotify.com/authorize?' . $params);
exit;
