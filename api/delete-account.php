<?php
declare(strict_types=1);

require __DIR__ . '/db.php';
require __DIR__ . '/session.php';

const DELETE_ACCOUNT_MAX_FAILED_ATTEMPTS = 5;
const DELETE_ACCOUNT_WINDOW_SECONDS = 10 * 60;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => '허용되지 않은 요청이에요.']);
}

startAppSession();

if (empty($_SESSION['user_id'])) {
    jsonResponse(401, ['error' => '로그인이 필요해요.']);
}

$body = readJsonBody();
$password = is_string($body['password'] ?? null) ? $body['password'] : '';

if ($password === '') {
    jsonResponse(400, ['error' => '현재 비밀번호를 입력해주세요.']);
}

$userId = (int)$_SESSION['user_id'];
$rateLimitKey = 'delete-account:' . $userId;

if (sessionRateLimitExceeded($rateLimitKey, DELETE_ACCOUNT_MAX_FAILED_ATTEMPTS, DELETE_ACCOUNT_WINDOW_SECONDS)
    || sharedRateLimitExceeded($rateLimitKey, DELETE_ACCOUNT_MAX_FAILED_ATTEMPTS, DELETE_ACCOUNT_WINDOW_SECONDS)
) {
    jsonResponse(429, ['error' => '비밀번호 확인 시도가 너무 많아요. 잠시 후 다시 시도해주세요.']);
}

$pdo = null;

try {
    $pdo = getPdo();
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ? FOR UPDATE');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, (string)$user['password_hash'])) {
        recordSessionRateLimitAttempt($rateLimitKey, DELETE_ACCOUNT_WINDOW_SECONDS);
        recordSharedRateLimitAttempt($rateLimitKey, DELETE_ACCOUNT_WINDOW_SECONDS);
        $pdo->rollBack();
        jsonResponse(401, ['error' => '현재 비밀번호가 올바르지 않아요.']);
    }

    $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$userId]);

    if ($stmt->rowCount() !== 1) {
        throw new RuntimeException('User deletion did not affect one row.');
    }

    $pdo->commit();
    resetSessionRateLimit($rateLimitKey);
    resetSharedRateLimit($rateLimitKey, DELETE_ACCOUNT_WINDOW_SECONDS);
} catch (Throwable $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Account deletion failed: ' . get_class($error));
    jsonResponse(500, ['error' => '계정을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.']);
}

destroyAppSession();
jsonResponse(200, []);
