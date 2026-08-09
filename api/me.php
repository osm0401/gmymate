<?php
declare(strict_types=1);

require __DIR__ . '/session.php';

startAppSession();

if (empty($_SESSION['user_id'])) {
    jsonResponse(401, ['error' => '로그인이 필요해요.']);
}

jsonResponse(200, ['username' => $_SESSION['username']]);
