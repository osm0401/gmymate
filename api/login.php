<?php
declare(strict_types=1);

require __DIR__ . '/db.php';
require __DIR__ . '/session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => '허용되지 않은 요청이에요.']);
}

$body = readJsonBody();
$username = is_string($body['username'] ?? null) ? trim($body['username']) : '';
$password = is_string($body['password'] ?? null) ? $body['password'] : '';
$remember = !empty($body['remember']);

startAppSession($remember);

if (loginRateLimitExceeded()) {
    jsonResponse(429, ['error' => '로그인 시도가 너무 많아요. 잠시 후 다시 시도해주세요.']);
}

$pdo = getPdo();
$stmt = $pdo->prepare('SELECT id, username, password_hash FROM users WHERE username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    recordLoginFailure();
    jsonResponse(401, ['error' => '아이디 또는 비밀번호가 올바르지 않아요.']);
}

resetLoginFailures();
setRememberCookie($remember);
session_regenerate_id(true);

$_SESSION['user_id'] = (int)$user['id'];
$_SESSION['username'] = $user['username'];

jsonResponse(200, ['username' => $user['username']]);
