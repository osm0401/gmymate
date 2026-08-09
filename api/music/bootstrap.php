<?php
declare(strict_types=1);

require __DIR__ . '/../db.php';
require __DIR__ . '/../session.php';

function requireUserId(): int
{
    startAppSession();

    if (empty($_SESSION['user_id'])) {
        jsonResponse(401, ['error' => '로그인이 필요해요.']);
    }

    return (int)$_SESSION['user_id'];
}
