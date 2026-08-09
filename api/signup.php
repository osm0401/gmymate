<?php
declare(strict_types=1);

require __DIR__ . '/db.php';
require __DIR__ . '/session.php';

startAppSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => '허용되지 않은 요청이에요.']);
}

$body = readJsonBody();
$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');

if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
    jsonResponse(400, ['error' => '아이디는 영문/숫자/밑줄 3~20자로 입력해주세요.']);
}

if (strlen($password) < 8) {
    jsonResponse(400, ['error' => '비밀번호는 8자 이상이어야 해요.']);
}

$pdo = getPdo();

$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
$stmt->execute([$username]);

if ($stmt->fetch()) {
    jsonResponse(409, ['error' => '이미 사용 중인 아이디예요.']);
}

$hash = password_hash($password, PASSWORD_DEFAULT);

$stmt = $pdo->prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, NOW())');
$stmt->execute([$username, $hash]);

session_regenerate_id(true);

$_SESSION['user_id'] = (int)$pdo->lastInsertId();
$_SESSION['username'] = $username;

jsonResponse(201, ['username' => $username]);
