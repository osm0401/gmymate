<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$userId = requireUserId();
$pdo = getPdo();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT id, name, workout_tag, created_at FROM playlists WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$userId]);
    $playlists = $stmt->fetchAll();

    foreach ($playlists as &$playlist) {
        $trackStmt = $pdo->prepare('SELECT id, provider, track_ref, title, artist, bpm, genre, position, volume FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC, id ASC');
        $trackStmt->execute([$playlist['id']]);
        $playlist['tracks'] = $trackStmt->fetchAll();
    }
    unset($playlist);

    jsonResponse(200, ['playlists' => $playlists]);
}

if ($method === 'POST') {
    $body = readJsonBody();
    $name = trim((string)($body['name'] ?? ''));
    $workoutTag = trim((string)($body['workoutTag'] ?? '')) ?: null;

    if ($name === '' || strlen($name) > 80) {
        jsonResponse(400, ['error' => '플레이리스트 이름을 확인해주세요.']);
    }

    $stmt = $pdo->prepare('INSERT INTO playlists (user_id, name, workout_tag, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$userId, $name, $workoutTag]);

    jsonResponse(201, ['id' => (int)$pdo->lastInsertId()]);
}

if ($method === 'DELETE') {
    $body = readJsonBody();
    $id = (int)($body['id'] ?? 0);

    $stmt = $pdo->prepare('DELETE FROM playlists WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);

    jsonResponse(200, []);
}

jsonResponse(405, ['error' => '허용되지 않은 요청이에요.']);
