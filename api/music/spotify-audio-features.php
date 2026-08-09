<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$userId = requireUserId();
$pdo = getPdo();

$stmt = $pdo->prepare('SELECT access_token FROM music_connections WHERE user_id = ? AND provider = "spotify"');
$stmt->execute([$userId]);
$connection = $stmt->fetch();

if (!$connection) {
    jsonResponse(404, ['error' => 'Spotify가 연결되어 있지 않아요.']);
}

$trackId = trim((string)($_GET['id'] ?? ''));
if ($trackId === '') {
    jsonResponse(400, ['error' => '트랙 id가 필요해요.']);
}

$ch = curl_init('https://api.spotify.com/v1/audio-features/' . urlencode($trackId));
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $connection['access_token']],
    CURLOPT_RETURNTRANSFER => true,
]);
$response = curl_exec($ch);
curl_close($ch);
$data = json_decode((string)$response, true);

jsonResponse(200, [
    'bpm' => isset($data['tempo']) ? (int)round((float)$data['tempo']) : null,
    'energy' => $data['energy'] ?? null,
]);
