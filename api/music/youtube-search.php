<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

requireUserId();

$configPath = __DIR__ . '/youtube-config.php';
if (!file_exists($configPath)) {
    jsonResponse(500, ['error' => 'YouTube 검색이 아직 설정되지 않았어요.']);
}

$config = require $configPath;
$query = trim((string)($_GET['q'] ?? ''));

if ($query === '') {
    jsonResponse(400, ['error' => '검색어를 입력해주세요.']);
}

function youtubeGet(string $url): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode((string)$response, true);

    if ($response === false || $httpStatus >= 400 || !is_array($data)) {
        $message = $data['error']['message'] ?? ($curlError ?: 'YouTube 요청에 실패했어요.');
        jsonResponse(502, ['error' => "YouTube 오류($httpStatus): $message"]);
    }

    return $data;
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

$searchUrl = 'https://www.googleapis.com/youtube/v3/search?' . http_build_query([
    'part' => 'snippet',
    'type' => 'video',
    'videoCategoryId' => '10',
    'maxResults' => 25,
    'q' => $query,
    'key' => $config['api_key'],
], '', '&');

$searchData = youtubeGet($searchUrl);
$searchItems = $searchData['items'] ?? [];
$videoIds = array_values(array_filter(array_map(static fn ($item) => $item['id']['videoId'] ?? '', $searchItems)));

$durations = [];
if ($videoIds !== []) {
    $detailsUrl = 'https://www.googleapis.com/youtube/v3/videos?' . http_build_query([
        'part' => 'contentDetails',
        'id' => implode(',', $videoIds),
        'key' => $config['api_key'],
    ], '', '&');
    $detailsData = youtubeGet($detailsUrl);

    foreach ($detailsData['items'] ?? [] as $detail) {
        $durations[$detail['id']] = iso8601DurationToSeconds($detail['contentDetails']['duration'] ?? '');
    }
}

$items = [];
foreach ($searchItems as $item) {
    $videoId = $item['id']['videoId'] ?? '';

    // Shorts run 60s or under — skip them, keep everything else.
    if (($durations[$videoId] ?? 999) <= 60) {
        continue;
    }

    $items[] = [
        'videoId' => $videoId,
        'title' => $item['snippet']['title'] ?? '',
        'channel' => $item['snippet']['channelTitle'] ?? '',
        'thumbnail' => $item['snippet']['thumbnails']['default']['url'] ?? '',
    ];

    if (count($items) >= 15) {
        break;
    }
}

jsonResponse(200, ['items' => $items]);
