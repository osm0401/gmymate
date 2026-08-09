<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$userId = requireUserId();
$pdo = getPdo();

$stmt = $pdo->prepare('SELECT access_token, refresh_token, expires_at FROM music_connections WHERE user_id = ? AND provider = "youtube"');
$stmt->execute([$userId]);
$connection = $stmt->fetch();

if (!$connection) {
    jsonResponse(404, ['error' => 'YouTube가 연결되어 있지 않아요.']);
}

$accessToken = $connection['access_token'];

if (strtotime((string)$connection['expires_at']) <= time() + 30) {
    $configPath = __DIR__ . '/google-config.php';
    if (!file_exists($configPath)) {
        jsonResponse(500, ['error' => 'YouTube 로그인이 아직 설정되지 않았어요.']);
    }
    $config = require $configPath;

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'refresh_token',
            'refresh_token' => $connection['refresh_token'],
            'client_id' => $config['client_id'],
            'client_secret' => $config['client_secret'],
        ], '', '&'),
        CURLOPT_RETURNTRANSFER => true,
    ]);
    $refreshResponse = curl_exec($ch);
    curl_close($ch);
    $refreshData = json_decode((string)$refreshResponse, true);

    if (!is_array($refreshData) || empty($refreshData['access_token'])) {
        jsonResponse(502, ['error' => 'YouTube 토큰 갱신에 실패했어요.']);
    }

    $accessToken = $refreshData['access_token'];
    $expiresAt = date('Y-m-d H:i:s', time() + (int)($refreshData['expires_in'] ?? 3600));
    $update = $pdo->prepare('UPDATE music_connections SET access_token = ?, expires_at = ? WHERE user_id = ? AND provider = "youtube"');
    $update->execute([$accessToken, $expiresAt, $userId]);
}

// ISO 8601 duration ("PT1M45S") -> seconds, used to filter out Shorts
// (YouTube's Data API has no direct "exclude shorts" flag — duration <= 60s
// is the standard heuristic).
function iso8601DurationToSeconds(string $duration): int
{
    if (!preg_match('/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/', $duration, $matches)) {
        return 0;
    }

    $hours = (int)($matches[1] ?? 0);
    $minutes = (int)($matches[2] ?? 0);
    $seconds = (int)($matches[3] ?? 0);

    return $hours * 3600 + $minutes * 60 + $seconds;
}

$url = 'https://www.googleapis.com/youtube/v3/videos?' . http_build_query([
    'part' => 'snippet,contentDetails',
    'myRating' => 'like',
    'maxResults' => 25,
], '', '&');

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken],
    CURLOPT_RETURNTRANSFER => true,
]);
$response = curl_exec($ch);
$httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$data = json_decode((string)$response, true);

if ($httpStatus >= 400 || !is_array($data) || !isset($data['items'])) {
    $message = $data['error']['message'] ?? 'YouTube 좋아요 목록을 가져오지 못했어요.';
    jsonResponse(502, ['error' => $message]);
}

$items = [];
foreach ($data['items'] as $item) {
    $duration = iso8601DurationToSeconds($item['contentDetails']['duration'] ?? '');

    if ($duration <= 60) {
        continue;
    }

    $items[] = [
        'videoId' => $item['id'] ?? '',
        'title' => $item['snippet']['title'] ?? '',
        'channel' => $item['snippet']['channelTitle'] ?? '',
    ];
}

jsonResponse(200, ['items' => $items]);
