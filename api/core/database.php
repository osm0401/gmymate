<?php

declare(strict_types=1);

function database(): PDO
{
    static $connection = null;

    if ($connection instanceof PDO) {
        return $connection;
    }

    $config = require dirname(__DIR__) . '/config/database.php';

    if ($config['password'] === 'PUT_YOUR_DB_PASSWORD_HERE') {
        throw new RuntimeException('Database password is not configured.');
    }

    $dsn = 'mysql:host=' . $config['host']
        . ';dbname=' . $config['database']
        . ';charset=' . $config['charset'];

    $connection = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $connection;
}
