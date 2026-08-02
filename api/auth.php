<?php

declare(strict_types=1);

require_once __DIR__ . '/core/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$body = [];

if ($method === 'POST') {
    $body = requestBody();

    if (($body['action'] ?? '') === 'logout') {
        clearUserSession();
        respond(['success' => true]);
    }
}

try {
    if ($method === 'GET') {
        $userId = (int) ($_SESSION['user_id'] ?? 0);

        if ($userId < 1) {
            respond(['success' => true, 'authenticated' => false]);
        }

        $user = findUser(database(), $userId);

        if (!$user) {
            clearUserSession();
            respond(['success' => true, 'authenticated' => false]);
        }

        respond(['success' => true, 'authenticated' => true] + userResponse($user));
    }

    if ($method !== 'POST') {
        respond(['success' => false, 'message' => '허용되지 않은 요청이에요.'], 405);
    }

    if (tooManyAttempts()) {
        respond(['success' => false, 'message' => '로그인 시도가 많아요. 10분 뒤 다시 시도해주세요.'], 429);
    }

    $action = (string) ($body['action'] ?? '');
    $db = database();

    if ($action === 'register') {
        $username = trim((string) ($body['username'] ?? ''));
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');

        if (!preg_match('/^[\p{L}\p{N}_]{2,30}$/u', $username)) {
            respond(['success' => false, 'message' => '아이디는 2~30자의 한글, 영문, 숫자, 밑줄만 사용할 수 있어요.'], 422);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
            respond(['success' => false, 'message' => '이메일 주소를 확인해주세요.'], 422);
        }

        if (strlen($password) < 8 || strlen($password) > 72) {
            respond(['success' => false, 'message' => '비밀번호는 8~72자로 입력해주세요.'], 422);
        }

        if (userIdentityExists($db, $username, $email)) {
            respond(['success' => false, 'message' => '이미 사용 중인 아이디 또는 이메일이에요.'], 409);
        }

        $userId = createUser($db, $username, $email, password_hash($password, PASSWORD_DEFAULT));
        finishAuthentication($db, $userId);
    }

    if ($action === 'login') {
        $identifier = trim((string) ($body['identifier'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if ($identifier === '' || $password === '') {
            respond(['success' => false, 'message' => '아이디와 비밀번호를 입력해주세요.'], 422);
        }

        $account = findAccountByIdentifier($db, $identifier);

        if (!$account || !password_verify($password, (string) $account['password_hash'])) {
            recordFailedAttempt();
            respond(['success' => false, 'message' => '아이디 또는 비밀번호가 맞지 않아요.'], 401);
        }

        finishAuthentication($db, (int) $account['id']);
    }

    respond(['success' => false, 'message' => '요청을 처리할 수 없어요.'], 400);
} catch (PDOException $error) {
    error_log($error->getMessage());
    $duplicate = (int) ($error->errorInfo[1] ?? 0) === 1062;
    respond([
        'success' => false,
        'message' => $duplicate
            ? '이미 사용 중인 아이디 또는 이메일이에요.'
            : '데이터베이스에 연결하지 못했어요. 잠시 후 다시 시도해주세요.',
    ], $duplicate ? 409 : 500);
} catch (Throwable $error) {
    error_log($error->getMessage());
    respond(['success' => false, 'message' => '서버 설정을 확인해주세요.'], 500);
}
