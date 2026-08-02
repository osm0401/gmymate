<?php

declare(strict_types=1);

function startSecureSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function requireUserId(): int
{
    $userId = (int) ($_SESSION['user_id'] ?? 0);

    if ($userId < 1) {
        respond(['success' => false, 'message' => '로그인이 필요해요.'], 401);
    }

    return $userId;
}

function clearUserSession(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            '',
            $params['secure'],
            $params['httponly']
        );
    }

    session_destroy();
}
