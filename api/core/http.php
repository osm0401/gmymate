<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(array $data, int $status = 200)
{
    // Dothome replaces non-2xx response bodies with an HTML error page.
    // Keep application failures as JSON and expose the intended status in the body.
    $transportStatus = $status >= 400 ? 200 : $status;

    if ($transportStatus !== $status) {
        $data['errorStatus'] = $status;
    }

    http_response_code($transportStatus);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function requestBody(): array
{
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '{}', true);

    if (!is_array($body)) {
        respond(['success' => false, 'message' => '요청 형식이 올바르지 않아요.'], 400);
    }

    return $body;
}
