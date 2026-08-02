<?php

declare(strict_types=1);

function recentAuthAttempts(): array
{
    return array_values(array_filter(
        $_SESSION['auth_attempts'] ?? [],
        static function ($time) {
            return is_int($time) && $time > time() - 600;
        }
    ));
}

function recordFailedAttempt(): void
{
    $attempts = recentAuthAttempts();
    $attempts[] = time();
    $_SESSION['auth_attempts'] = $attempts;
}

function tooManyAttempts(): bool
{
    $attempts = recentAuthAttempts();
    $_SESSION['auth_attempts'] = $attempts;

    return count($attempts) >= 10;
}

function finishAuthentication(PDO $db, int $userId)
{
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    $_SESSION['auth_attempts'] = [];
    $user = findUser($db, $userId);

    if (!$user) {
        respond(['success' => false, 'message' => '계정 정보를 찾을 수 없어요.'], 404);
    }

    respond(['success' => true, 'authenticated' => true] + userResponse($user));
}
