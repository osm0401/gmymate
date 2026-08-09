<?php
declare(strict_types=1);

require __DIR__ . '/db.php';
require __DIR__ . '/session.php';

startAppSession();

if (empty($_SESSION['user_id'])) {
    jsonResponse(401, ['error' => '로그인이 필요해요.']);
}

$userId = (int)$_SESSION['user_id'];
$pdo = getPdo();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT data_json, updated_at FROM user_data WHERE user_id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    if (!$row) {
        jsonResponse(200, ['data' => null, 'updatedAt' => null]);
    }

    $data = json_decode($row['data_json'], true);
    jsonResponse(200, ['data' => is_array($data) ? $data : null, 'updatedAt' => $row['updated_at']]);
}

if ($method === 'POST') {
    $body = readJsonBody();
    $json = json_encode($body, JSON_UNESCAPED_UNICODE);

    $stmt = $pdo->prepare('
        INSERT INTO user_data (user_id, data_json, updated_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = VALUES(updated_at)
    ');
    $stmt->execute([$userId, $json]);

    jsonResponse(200, []);
}

jsonResponse(405, ['error' => '허용되지 않은 요청이에요.']);
