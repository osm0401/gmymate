<?php

declare(strict_types=1);

require_once __DIR__ . '/core/bootstrap.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        respond(['success' => false, 'message' => '허용되지 않은 요청이에요.'], 405);
    }

    $userId = requireUserId();
    $body = requestBody();
    $age = filter_var($body['age'] ?? null, FILTER_VALIDATE_INT);
    $height = filter_var($body['height'] ?? null, FILTER_VALIDATE_FLOAT);
    $weight = filter_var($body['weight'] ?? null, FILTER_VALIDATE_FLOAT);
    $targetWeight = filter_var($body['targetWeight'] ?? null, FILTER_VALIDATE_FLOAT);
    $experience = (string) ($body['experience'] ?? '');
    $goal = (string) ($body['goal'] ?? '');
    $weeklyWorkout = filter_var($body['weeklyWorkout'] ?? null, FILTER_VALIDATE_INT);
    $experiences = ['beginner', 'under-6-months', 'under-2-years', 'over-2-years'];
    $goals = ['fat-loss', 'muscle-gain', 'strength', 'habit'];

    if ($age === false || $age < 10 || $age > 100) {
        respond(['success' => false, 'message' => '나이는 10~100세로 입력해주세요.'], 422);
    }

    if ($height === false || $height < 100 || $height > 230) {
        respond(['success' => false, 'message' => '키는 100~230cm로 입력해주세요.'], 422);
    }

    if ($weight === false || $weight < 30 || $weight > 250 ||
        $targetWeight === false || $targetWeight < 30 || $targetWeight > 250) {
        respond(['success' => false, 'message' => '몸무게는 30~250kg으로 입력해주세요.'], 422);
    }

    if (!in_array($experience, $experiences, true) || !in_array($goal, $goals, true)) {
        respond(['success' => false, 'message' => '운동 경력과 목표를 다시 선택해주세요.'], 422);
    }

    if ($weeklyWorkout === false || $weeklyWorkout < 2 || $weeklyWorkout > 5) {
        respond(['success' => false, 'message' => '주간 운동 횟수를 다시 선택해주세요.'], 422);
    }

    $profile = [
        'age' => $age,
        'height' => $height,
        'weight' => $weight,
        'targetWeight' => $targetWeight,
        'experience' => $experience,
        'goal' => $goal,
        'weeklyWorkout' => $weeklyWorkout,
    ];
    $db = database();
    updateUserProfile($db, $userId, $profile);
    $user = findUser($db, $userId);

    if (!$user) {
        respond(['success' => false, 'message' => '사용자 정보를 찾을 수 없어요.'], 404);
    }

    respond(['success' => true] + userResponse($user));
} catch (PDOException $error) {
    error_log($error->getMessage());
    respond(['success' => false, 'message' => '정보를 저장하지 못했어요.'], 500);
} catch (Throwable $error) {
    error_log($error->getMessage());
    respond(['success' => false, 'message' => '서버 설정을 확인해주세요.'], 500);
}
