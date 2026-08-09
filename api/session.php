<?php
declare(strict_types=1);

const REMEMBER_COOKIE = 'gmymate_remember';
const REMEMBER_SECONDS = 60 * 60 * 24 * 30;

// startAppSession() is called on every request, and PHP resends Set-Cookie
// on every session_start() using whatever lifetime this call configures —
// so a persistent cookie set once at login would get silently downgraded to
// a session-only cookie on the very next request unless every endpoint uses
// the same lifetime. The separate REMEMBER_COOKIE marker (set at login,
// cleared at logout) lets every endpoint agree on that lifetime without
// needing to read session data before session_start() can run.
function startAppSession(?bool $remember = null): void
{
    if ($remember === null) {
        $remember = isset($_COOKIE[REMEMBER_COOKIE]);
    }

    $lifetime = $remember ? REMEMBER_SECONDS : 0;

    // ponytail: gc_maxlifetime always generous so shared hosting doesn't GC a
    // remembered session between visits; fine at this app's scale. If usage
    // grows, replace this whole cookie-lifetime scheme with a dedicated
    // remember-token table (random token + hash, rotated on use) instead of
    // trusting a long-lived session cookie.
    ini_set('session.gc_maxlifetime', (string)REMEMBER_SECONDS);

    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    session_start();
}

function setRememberCookie(bool $remember): void
{
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $options = [
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $secure,
    ];

    if ($remember) {
        setcookie(REMEMBER_COOKIE, '1', $options + ['expires' => time() + REMEMBER_SECONDS]);
    } else {
        setcookie(REMEMBER_COOKIE, '', $options + ['expires' => time() - 3600]);
    }
}

function jsonResponse(int $status, array $data): void
{
    // dothome's Apache silently discards the PHP-CGI response body for any
    // status code >= 400 and substitutes its own bare default error page —
    // confirmed this happens even with the HTTP-spec companion headers
    // (WWW-Authenticate, Allow) present, so it isn't a missing-header issue.
    // Since this is a JSON API consumed via fetch(), not a page a user
    // navigates directly, always answer 200 and carry the real outcome
    // (ok/status) inside the body instead of relying on the HTTP status line.
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => $status < 400, 'status' => $status] + $data, JSON_UNESCAPED_UNICODE);
    exit;
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
