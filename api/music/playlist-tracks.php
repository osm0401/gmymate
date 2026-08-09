<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$userId = requireUserId();
$pdo = getPdo();
$method = $_SERVER['REQUEST_METHOD'];

function ownsPlaylist(PDO $pdo, int $playlistId, int $userId): bool
{
    $stmt = $pdo->prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?');
    $stmt->execute([$playlistId, $userId]);
    return (bool)$stmt->fetch();
}

function moveTrack(PDO $pdo, int $userId, int $trackId, string $direction): void
{
    $stmt = $pdo->prepare('
        SELECT playlist_tracks.playlist_id, playlist_tracks.position
        FROM playlist_tracks
        INNER JOIN playlists ON playlists.id = playlist_tracks.playlist_id
        WHERE playlist_tracks.id = ? AND playlists.user_id = ?
    ');
    $stmt->execute([$trackId, $userId]);
    $current = $stmt->fetch();

    if (!$current) {
        return;
    }

    $comparator = $direction === 'up' ? '<' : '>';
    $order = $direction === 'up' ? 'DESC' : 'ASC';

    $neighborStmt = $pdo->prepare("
        SELECT id, position FROM playlist_tracks
        WHERE playlist_id = ? AND position $comparator ?
        ORDER BY position $order
        LIMIT 1
    ");
    $neighborStmt->execute([$current['playlist_id'], $current['position']]);
    $neighbor = $neighborStmt->fetch();

    if (!$neighbor) {
        return;
    }

    $pdo->prepare('UPDATE playlist_tracks SET position = ? WHERE id = ?')->execute([$neighbor['position'], $trackId]);
    $pdo->prepare('UPDATE playlist_tracks SET position = ? WHERE id = ?')->execute([$current['position'], $neighbor['id']]);
}

if ($method === 'POST') {
    $body = readJsonBody();
    $playlistId = (int)($body['playlistId'] ?? 0);

    if (!ownsPlaylist($pdo, $playlistId, $userId)) {
        jsonResponse(404, ['error' => '플레이리스트를 찾을 수 없어요.']);
    }

    $provider = (string)($body['provider'] ?? '');
    if (!in_array($provider, ['spotify', 'apple', 'youtube'], true)) {
        jsonResponse(400, ['error' => '알 수 없는 음악 서비스예요.']);
    }

    $trackRef = trim((string)($body['trackRef'] ?? ''));
    $title = trim((string)($body['title'] ?? ''));

    if ($trackRef === '' || $title === '') {
        jsonResponse(400, ['error' => '곡 정보가 올바르지 않아요.']);
    }

    $artist = trim((string)($body['artist'] ?? '')) ?: null;
    $bpm = isset($body['bpm']) && $body['bpm'] !== '' ? (int)$body['bpm'] : null;
    $genre = trim((string)($body['genre'] ?? '')) ?: null;

    $posStmt = $pdo->prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM playlist_tracks WHERE playlist_id = ?');
    $posStmt->execute([$playlistId]);
    $position = (int)$posStmt->fetch()['next_position'];

    $stmt = $pdo->prepare('INSERT INTO playlist_tracks (playlist_id, provider, track_ref, title, artist, bpm, genre, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$playlistId, $provider, $trackRef, $title, $artist, $bpm, $genre, $position]);

    jsonResponse(201, ['id' => (int)$pdo->lastInsertId()]);
}

if ($method === 'PATCH') {
    $body = readJsonBody();
    $trackId = (int)($body['id'] ?? 0);

    if (isset($body['direction'])) {
        moveTrack($pdo, $userId, $trackId, $body['direction'] === 'up' ? 'up' : 'down');
        jsonResponse(200, []);
    }

    $volume = max(0, min(100, (int)($body['volume'] ?? 100)));

    $stmt = $pdo->prepare('
        UPDATE playlist_tracks
        INNER JOIN playlists ON playlists.id = playlist_tracks.playlist_id
        SET playlist_tracks.volume = ?
        WHERE playlist_tracks.id = ? AND playlists.user_id = ?
    ');
    $stmt->execute([$volume, $trackId, $userId]);

    jsonResponse(200, []);
}

if ($method === 'DELETE') {
    $body = readJsonBody();
    $trackId = (int)($body['id'] ?? 0);

    $stmt = $pdo->prepare('
        DELETE playlist_tracks FROM playlist_tracks
        INNER JOIN playlists ON playlists.id = playlist_tracks.playlist_id
        WHERE playlist_tracks.id = ? AND playlists.user_id = ?
    ');
    $stmt->execute([$trackId, $userId]);

    jsonResponse(200, []);
}

jsonResponse(405, ['error' => '허용되지 않은 요청이에요.']);
