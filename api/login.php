<?php
declare(strict_types=1);

require __DIR__ . '/db.php';
require __DIR__ . '/session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => '허용되지 않은 요청이에요.']);
}

$body = readJsonBody();
$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');
$remember = !empty($body['remember']);

$pdo = getPdo();
$stmt = $pdo->prepare('SELECT id, username, password_hash FROM users WHERE username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonResponse(401, ['error' => '아이디 또는 비밀번호가 올바르지 않아요.']);
}

startAppSession($remember);
setRememberCookie($remember);
session_regenerate_id(true);

$_SESSION['user_id'] = (int)$user['id'];
$_SESSION['username'] = $user['username'];

jsonResponse(200, ['username' => $user['username']]);
