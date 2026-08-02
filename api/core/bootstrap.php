<?php

declare(strict_types=1);

require_once __DIR__ . '/http.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/database.php';
require_once dirname(__DIR__) . '/repositories/users.php';
require_once dirname(__DIR__) . '/services/users.php';
require_once dirname(__DIR__) . '/services/authentication.php';

startSecureSession();
