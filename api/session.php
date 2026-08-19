<?php
declare(strict_types=1);

const REMEMBER_COOKIE = 'gmymate_remember';
const REMEMBER_SECONDS = 60 * 60 * 24 * 30;
const MAX_JSON_BODY_BYTES = 128 * 1024;
const LOGIN_MAX_FAILED_ATTEMPTS = 8;
const LOGIN_WINDOW_SECONDS = 10 * 60;
const RATE_LIMITS_SESSION_KEY = 'gmymate_rate_limits';

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

function destroyAppSession(): void
{
    $_SESSION = [];

    if (session_status() === PHP_SESSION_ACTIVE) {
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 3600,
                'path' => $params['path'] ?: '/',
                'domain' => $params['domain'] ?? '',
                'secure' => (bool)$params['secure'],
                'httponly' => (bool)$params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
        }

        session_destroy();
    }

    setRememberCookie(false);
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
    if (isset($_SERVER['CONTENT_LENGTH']) && (int)$_SERVER['CONTENT_LENGTH'] > MAX_JSON_BODY_BYTES) {
        jsonResponse(413, ['error' => '요청 본문이 너무 커요.']);
    }

    $raw = file_get_contents('php://input', false, null, 0, MAX_JSON_BODY_BYTES + 1);

    if ($raw === false || strlen($raw) > MAX_JSON_BODY_BYTES) {
        jsonResponse(413, ['error' => '요청 본문이 너무 커요.']);
    }

    $data = json_decode($raw, true);

    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        jsonResponse(400, ['error' => '요청 본문이 올바르지 않아요.']);
    }

    return $data;
}

function recentRateLimitAttempts($attempts, int $windowSeconds): array
{
    if (!is_array($attempts)) {
        return [];
    }

    $cutoff = time() - $windowSeconds;
    return array_values(array_filter($attempts, static function ($timestamp) use ($cutoff): bool {
        return is_int($timestamp) && $timestamp > $cutoff;
    }));
}

function sessionRateLimitExceeded(string $key, int $maxAttempts, int $windowSeconds): bool
{
    $limits = $_SESSION[RATE_LIMITS_SESSION_KEY] ?? [];
    $limits = is_array($limits) ? $limits : [];
    $attempts = recentRateLimitAttempts($limits[$key] ?? [], $windowSeconds);
    $limits[$key] = $attempts;
    $_SESSION[RATE_LIMITS_SESSION_KEY] = $limits;

    return count($attempts) >= $maxAttempts;
}

function recordSessionRateLimitAttempt(string $key, int $windowSeconds): void
{
    $limits = $_SESSION[RATE_LIMITS_SESSION_KEY] ?? [];
    $limits = is_array($limits) ? $limits : [];
    $attempts = recentRateLimitAttempts($limits[$key] ?? [], $windowSeconds);
    $limits[$key] = array_merge($attempts, [time()]);
    $_SESSION[RATE_LIMITS_SESSION_KEY] = $limits;
}

function resetSessionRateLimit(string $key): void
{
    $limits = $_SESSION[RATE_LIMITS_SESSION_KEY] ?? [];

    if (!is_array($limits)) {
        unset($_SESSION[RATE_LIMITS_SESSION_KEY]);
        return;
    }

    unset($limits[$key]);
    $_SESSION[RATE_LIMITS_SESSION_KEY] = $limits;
}

function loginRateLimitKey(): string
{
    return 'login:' . hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
}

function updateSharedRateLimitAttempts(string $key, string $operation, int $windowSeconds): array
{
    // ponytail: one locked temp file fits one shared host; move these buckets
    // to a shared cache if traffic or server count grows materially.
    $path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'gmymate-rate-limits-' . substr(hash('sha256', __DIR__), 0, 16) . '.json';
    $handle = @fopen($path, 'c+');

    if ($handle === false || !@flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        return [];
    }

    try {
        @chmod($path, 0600);
        @rewind($handle);
        $stored = json_decode((string)@stream_get_contents($handle), true);
        $stored = is_array($stored) ? $stored : [];
        $buckets = [];

        foreach ($stored as $storedKey => $attempts) {
            $recent = recentRateLimitAttempts($attempts, 24 * 60 * 60);
            if ($recent !== []) {
                $buckets[(string)$storedKey] = $recent;
            }
        }

        $attempts = recentRateLimitAttempts($buckets[$key] ?? [], $windowSeconds);

        if ($operation === 'record') {
            $attempts[] = time();
            $buckets[$key] = $attempts;
        } elseif ($operation === 'reset') {
            unset($buckets[$key]);
            $attempts = [];
        } elseif ($attempts === []) {
            unset($buckets[$key]);
        } else {
            $buckets[$key] = $attempts;
        }

        @rewind($handle);
        @ftruncate($handle, 0);
        @fwrite($handle, (string)json_encode($buckets));
        @fflush($handle);

        return $attempts;
    } finally {
        @flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function sharedRateLimitExceeded(string $key, int $maxAttempts, int $windowSeconds): bool
{
    return count(updateSharedRateLimitAttempts($key, 'read', $windowSeconds)) >= $maxAttempts;
}

function recordSharedRateLimitAttempt(string $key, int $windowSeconds): void
{
    updateSharedRateLimitAttempts($key, 'record', $windowSeconds);
}

function resetSharedRateLimit(string $key, int $windowSeconds): void
{
    updateSharedRateLimitAttempts($key, 'reset', $windowSeconds);
}

function loginRateLimitExceeded(): bool
{
    return sessionRateLimitExceeded(loginRateLimitKey(), LOGIN_MAX_FAILED_ATTEMPTS, LOGIN_WINDOW_SECONDS)
        || sharedRateLimitExceeded(loginRateLimitKey(), LOGIN_MAX_FAILED_ATTEMPTS, LOGIN_WINDOW_SECONDS);
}

function recordLoginFailure(): void
{
    recordSessionRateLimitAttempt(loginRateLimitKey(), LOGIN_WINDOW_SECONDS);
    recordSharedRateLimitAttempt(loginRateLimitKey(), LOGIN_WINDOW_SECONDS);
}

function resetLoginFailures(): void
{
    resetSessionRateLimit(loginRateLimitKey());
    resetSharedRateLimit(loginRateLimitKey(), LOGIN_WINDOW_SECONDS);
}
