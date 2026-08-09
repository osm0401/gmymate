<?php
declare(strict_types=1);

function getPdo(): PDO
{
    $config = require __DIR__ . '/config.php';

    $dsn = "mysql:host={$config['host']};dbname={$config['name']};charset=utf8mb4";

    return new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}
