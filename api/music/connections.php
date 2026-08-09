<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$userId = requireUserId();
$pdo = getPdo();

$stmt = $pdo->prepare('SELECT provider FROM music_connections WHERE user_id = ?');
$stmt->execute([$userId]);

jsonResponse(200, ['providers' => array_column($stmt->fetchAll(), 'provider')]);
