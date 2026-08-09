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

$query = trim((string)($_GET['q'] ?? ''));
if ($query === '') {
    jsonResponse(400, ['error' => '검색어를 입력해주세요.']);
}

$url = 'https://api.spotify.com/v1/search?' . http_build_query([
    'q' => $query,
    'type' => 'track',
    // ponytail: this app currently sits under Spotify's restricted/dev-mode
    // quota, which rejects `limit` above 10 with a generic "Invalid limit"
    // error — raise this once the app gets extended API access approved.
    'limit' => 10,
], '', '&');

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $connection['access_token']],
    CURLOPT_RETURNTRANSFER => true,
]);
$response = curl_exec($ch);
$httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$data = json_decode((string)$response, true);

if ($httpStatus >= 400 || !is_array($data) || !isset($data['tracks'])) {
    $message = $data['error']['message'] ?? 'Spotify 검색에 실패했어요.';
    jsonResponse(502, ['error' => "Spotify 오류($httpStatus): $message", 'debugUrl' => $url]);
}

$items = array_map(static function ($track) {
    return [
        'id' => $track['id'],
        'title' => $track['name'],
        'artist' => implode(', ', array_map(static fn ($artist) => $artist['name'], $track['artists'] ?? [])),
        'uri' => $track['uri'],
    ];
}, $data['tracks']['items'] ?? []);

jsonResponse(200, ['items' => $items]);
