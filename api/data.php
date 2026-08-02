<?php

declare(strict_types=1);

require_once __DIR__ . '/core/bootstrap.php';
require_once __DIR__ . '/repositories/settings.php';
require_once __DIR__ . '/repositories/habits.php';
require_once __DIR__ . '/repositories/exercises.php';
require_once __DIR__ . '/repositories/routines.php';
require_once __DIR__ . '/repositories/workouts.php';

function cleanText($value, int $maximum): string
{
    return mb_substr(trim((string) $value), 0, $maximum);
}

function cleanNumber($value, float $minimum, float $maximum, float $fallback): float
{
    $number = is_numeric($value) ? (float) $value : $fallback;
    return min(max($number, $minimum), $maximum);
}

function cleanInteger($value, int $minimum, int $maximum, int $fallback): int
{
    return (int) round(cleanNumber($value, $minimum, $maximum, $fallback));
}

function cleanBoolean($value, bool $fallback = false): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if ($value === 1 || $value === 0 || $value === '1' || $value === '0') {
        return (bool) $value;
    }

    return $fallback;
}

function cleanDate($value): string
{
    $date = cleanText($value, 10);
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);

    if (!$parsed || $parsed->format('Y-m-d') !== $date) {
        throw new InvalidArgumentException('Invalid date.');
    }

    return $date;
}

function cleanSettings(array $value): array
{
    return [
        'weightStepKg' => round(cleanNumber($value['weightStepKg'] ?? 1, 0.5, 50, 1), 1),
        'restSeconds' => cleanInteger($value['restSeconds'] ?? 90, 15, 600, 90),
        'largeTouch' => cleanBoolean($value['largeTouch'] ?? false),
        'easyWords' => cleanBoolean($value['easyWords'] ?? true, true),
        'workoutAlert' => cleanBoolean($value['workoutAlert'] ?? false),
        'beginnerMode' => cleanBoolean($value['beginnerMode'] ?? true, true),
    ];
}

function cleanExercise(array $value): array
{
    $exerciseId = cleanText($value['exerciseId'] ?? $value['id'] ?? '', 80);
    $name = cleanText($value['name'] ?? '', 100);
    $category = cleanText($value['category'] ?? '', 30);
    $difficulty = cleanText($value['difficulty'] ?? '', 10);

    if ($exerciseId === '' || $name === '' || $category === '') {
        throw new InvalidArgumentException('Exercise information is incomplete.');
    }

    if ($difficulty !== '' && !in_array($difficulty, ['초급', '중급', '고급'], true)) {
        $difficulty = '';
    }

    return [
        'exerciseId' => $exerciseId,
        'name' => $name,
        'category' => $category,
        'equipment' => cleanText($value['equipment'] ?? '', 50),
        'unit' => cleanText($value['unit'] ?? '회', 10) ?: '회',
        'description' => cleanText($value['description'] ?? '', 1000),
        'difficulty' => $difficulty,
        'sets' => cleanInteger($value['sets'] ?? 3, 1, 20, 3),
        'weight' => round(cleanNumber($value['weight'] ?? 0, 0, 1000, 0), 2),
        'reps' => cleanInteger($value['reps'] ?? 10, 1, 9999, 10),
        'restSeconds' => cleanInteger($value['restSeconds'] ?? 90, 15, 600, 90),
    ];
}

function cleanRoutine(array $value): array
{
    $name = cleanText($value['name'] ?? '', 100);

    if ($name === '') {
        throw new InvalidArgumentException('Routine name is required.');
    }

    $exercises = [];

    foreach (array_slice(is_array($value['exercises'] ?? null) ? $value['exercises'] : [], 0, 12) as $exercise) {
        if (is_array($exercise)) {
            $exercises[] = cleanExercise($exercise);
        }
    }

    if (count($exercises) === 0) {
        throw new InvalidArgumentException('Routine exercise is required.');
    }

    return [
        'id' => cleanText($value['id'] ?? '', 80),
        'dbId' => max((int) ($value['dbId'] ?? 0), 0),
        'name' => $name,
        'isFavorite' => cleanBoolean($value['isFavorite'] ?? false),
        'exercises' => $exercises,
    ];
}

function cleanWorkouts($value): array
{
    if (!is_array($value)) {
        return [];
    }

    $workouts = [];

    foreach (array_slice($value, 0, 20) as $workoutIndex => $workout) {
        if (!is_array($workout)) {
            continue;
        }

        $sets = [];

        foreach (array_slice(is_array($workout['sets'] ?? null) ? $workout['sets'] : [], 0, 20) as $set) {
            if (!is_array($set)) {
                continue;
            }

            $sets[] = [
                'weight' => round(cleanNumber($set['weight'] ?? 0, 0, 1000, 0), 2),
                'reps' => cleanInteger($set['reps'] ?? 1, 1, 9999, 1),
                'done' => cleanBoolean($set['done'] ?? false),
            ];
        }

        if (count($sets) === 0) {
            continue;
        }

        $exerciseId = cleanText($workout['exerciseId'] ?? '', 80);
        $name = cleanText($workout['name'] ?? '', 100);

        if ($exerciseId === '' || $name === '') {
            continue;
        }

        $workouts[] = [
            'id' => cleanText($workout['id'] ?? '', 120) ?: $exerciseId . '-' . $workoutIndex,
            'exerciseId' => $exerciseId,
            'name' => $name,
            'category' => cleanText($workout['category'] ?? '', 30),
            'restSeconds' => cleanInteger($workout['restSeconds'] ?? 90, 15, 600, 90),
            'sets' => $sets,
        ];
    }

    return $workouts;
}

function cleanActiveWorkout(array $value): array
{
    $meta = is_array($value['meta'] ?? null) ? $value['meta'] : [];

    return [
        'workouts' => cleanWorkouts($value['workouts'] ?? []),
        'note' => cleanText($value['note'] ?? '', 2000),
        'meta' => [
            'startedAt' => max((int) ($meta['startedAt'] ?? 0), 0),
            'updatedAt' => max((int) ($meta['updatedAt'] ?? 0), 0),
            'exerciseCount' => cleanInteger($meta['exerciseCount'] ?? 0, 0, 20, 0),
            'completedSets' => cleanInteger($meta['completedSets'] ?? 0, 0, 400, 0),
        ],
    ];
}

function cleanSession(array $value): array
{
    $workouts = cleanWorkouts($value['workouts'] ?? []);
    $totalSets = 0;
    $doneSets = 0;
    $volume = 0.0;

    foreach ($workouts as $workout) {
        foreach ($workout['sets'] as $set) {
            $totalSets += 1;

            if ($set['done']) {
                $doneSets += 1;
                $volume += $set['weight'] * $set['reps'];
            }
        }
    }

    $dateKey = cleanDate($value['dateKey'] ?? '');
    $finishedAt = cleanText($value['finishedAt'] ?? '', 40);

    if ($finishedAt === '' || strtotime($finishedAt) === false) {
        $finishedAt = $dateKey . 'T12:00:00+00:00';
    }

    return [
        'id' => cleanText($value['id'] ?? '', 120) ?: 'session-' . (string) round(microtime(true) * 1000),
        'title' => cleanText($value['title'] ?? '운동 기록', 100) ?: '운동 기록',
        'dateKey' => $dateKey,
        'finishedAt' => $finishedAt,
        'exerciseCount' => count($workouts),
        'doneSets' => $doneSets,
        'totalSets' => $totalSets,
        'volume' => round($volume),
        'note' => cleanText($value['note'] ?? '', 2000),
        'workouts' => $workouts,
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $userId = requireUserId();
    $db = database();

    if ($method === 'GET') {
        $date = cleanDate($_GET['date'] ?? date('Y-m-d'));
        $habits = findUserHabits($db, $userId, $date);
        $workouts = findUserWorkoutData($db, $userId);
        $settings = findUserSettings($db, $userId);

        if ($settings === null) {
            respond(['success' => false, 'message' => '사용자 설정을 찾을 수 없어요.'], 404);
        }

        respond([
            'success' => true,
            'data' => [
                'userId' => $userId,
                'date' => $date,
                'settings' => $settings,
                'habits' => $habits['values'],
                'habitEntryCount' => $habits['entryCount'],
                'routines' => findUserRoutines($db, $userId),
                'activeWorkout' => $workouts['active'],
                'history' => $workouts['history'],
                'exerciseCount' => countExercises($db),
            ],
        ]);
    }

    if ($method !== 'POST') {
        respond(['success' => false, 'message' => '허용되지 않은 요청이에요.'], 405);
    }

    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 1048576) {
        respond(['success' => false, 'message' => '저장할 데이터가 너무 커요.'], 413);
    }

    $body = requestBody();
    $action = (string) ($body['action'] ?? '');

    if ($action === 'settings') {
        $settings = cleanSettings(is_array($body['settings'] ?? null) ? $body['settings'] : []);
        updateUserSettings($db, $userId, $settings);
        respond(['success' => true, 'settings' => findUserSettings($db, $userId)]);
    }

    if ($action === 'habit') {
        $key = cleanText($body['key'] ?? '', 30);

        if (!array_key_exists($key, DEFAULT_HABITS)) {
            throw new InvalidArgumentException('Unknown habit.');
        }

        saveUserHabit(
            $db,
            $userId,
            $key,
            cleanDate($body['date'] ?? ''),
            cleanBoolean($body['completed'] ?? false)
        );
        respond(['success' => true]);
    }

    if ($action === 'syncHabits') {
        $habits = is_array($body['habits'] ?? null) ? $body['habits'] : [];
        syncUserHabits($db, $userId, cleanDate($body['date'] ?? ''), $habits);
        respond(['success' => true]);
    }

    if ($action === 'seedExercises') {
        $exercises = [];

        foreach (array_slice(is_array($body['exercises'] ?? null) ? $body['exercises'] : [], 0, 100) as $exercise) {
            if (is_array($exercise)) {
                $exercises[] = cleanExercise($exercise);
            }
        }

        respond(['success' => true, 'exerciseCount' => seedExercises($db, $exercises)]);
    }

    if ($action === 'syncRoutines') {
        $routines = [];

        foreach (array_slice(is_array($body['routines'] ?? null) ? $body['routines'] : [], 0, 30) as $routine) {
            if (is_array($routine)) {
                $routines[] = cleanRoutine($routine);
            }
        }

        respond(['success' => true, 'routines' => syncUserRoutines($db, $userId, $routines)]);
    }

    if ($action === 'saveActiveWorkout') {
        $active = cleanActiveWorkout(is_array($body['active'] ?? null) ? $body['active'] : []);
        saveActiveWorkout($db, $userId, cleanDate($body['date'] ?? ''), $active);
        respond(['success' => true]);
    }

    if ($action === 'clearActiveWorkout') {
        clearActiveWorkout($db, $userId);
        respond(['success' => true]);
    }

    if ($action === 'completeWorkout') {
        $session = cleanSession(is_array($body['session'] ?? null) ? $body['session'] : []);
        completeUserWorkout($db, $userId, $session);
        respond(['success' => true, 'session' => $session]);
    }

    if ($action === 'importHistory') {
        $history = [];

        foreach (array_slice(is_array($body['history'] ?? null) ? $body['history'] : [], 0, 80) as $session) {
            if (is_array($session)) {
                $history[] = cleanSession($session);
            }
        }

        respond(['success' => true, 'imported' => importUserWorkoutHistory($db, $userId, $history)]);
    }

    respond(['success' => false, 'message' => '요청을 처리할 수 없어요.'], 400);
} catch (InvalidArgumentException $error) {
    respond(['success' => false, 'message' => '저장할 정보를 다시 확인해주세요.'], 422);
} catch (JsonException $error) {
    respond(['success' => false, 'message' => '저장할 데이터 형식이 올바르지 않아요.'], 422);
} catch (PDOException $error) {
    error_log($error->getMessage());
    respond(['success' => false, 'message' => '데이터베이스 저장에 실패했어요.'], 500);
} catch (Throwable $error) {
    error_log($error->getMessage());
    respond(['success' => false, 'message' => '데이터 동기화 설정을 확인해주세요.'], 500);
}
