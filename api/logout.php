<?php
declare(strict_types=1);

require __DIR__ . '/session.php';

startAppSession();
$_SESSION = [];
session_destroy();
setRememberCookie(false);

jsonResponse(200, ['ok' => true]);
