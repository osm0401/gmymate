<?php
declare(strict_types=1);

require __DIR__ . '/session.php';

startAppSession();
destroyAppSession();

jsonResponse(200, ['ok' => true]);
