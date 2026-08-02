<?php

declare(strict_types=1);

function encodeWorkoutData(array $data): string
{
    return json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
    );
}

function clearActiveWorkout(PDO $db, int $userId): void
{
    $statement = $db->prepare(
        "DELETE FROM workout_records
         WHERE user_id = :user_id
           AND JSON_UNQUOTE(JSON_EXTRACT(workout_data, '$.kind')) = 'active'"
    );
    $statement->execute(['user_id' => $userId]);
}

function findUserWorkoutData(PDO $db, int $userId): array
{
    $statement = $db->prepare(
        'SELECT id, workout_date, workout_data, memo, created_at
         FROM workout_records
         WHERE user_id = :user_id
         ORDER BY workout_date DESC, id DESC
         LIMIT 100'
    );
    $statement->execute(['user_id' => $userId]);
    $active = null;
    $history = [];

    foreach ($statement->fetchAll() as $row) {
        $data = json_decode((string) $row['workout_data'], true);

        if (!is_array($data)) {
            continue;
        }

        if (($data['kind'] ?? '') === 'active' && $active === null) {
            $active = [
                'workouts' => is_array($data['workouts'] ?? null) ? $data['workouts'] : [],
                'note' => (string) ($data['note'] ?? $row['memo'] ?? ''),
                'meta' => is_array($data['meta'] ?? null) ? $data['meta'] : [],
            ];
            continue;
        }

        if (($data['kind'] ?? '') === 'session' && is_array($data['session'] ?? null)) {
            $history[] = $data['session'];
        }
    }

    return ['active' => $active, 'history' => array_slice($history, 0, 80)];
}

function saveActiveWorkout(PDO $db, int $userId, string $date, array $active): void
{
    if (count($active['workouts']) === 0) {
        clearActiveWorkout($db, $userId);
        return;
    }

    $find = $db->prepare(
        "SELECT id
         FROM workout_records
         WHERE user_id = :user_id
           AND JSON_UNQUOTE(JSON_EXTRACT(workout_data, '$.kind')) = 'active'
         ORDER BY id DESC
         LIMIT 1"
    );
    $find->execute(['user_id' => $userId]);
    $recordId = $find->fetchColumn();
    $json = encodeWorkoutData([
        'kind' => 'active',
        'updatedAt' => gmdate(DATE_ATOM),
        'workouts' => $active['workouts'],
        'note' => $active['note'],
        'meta' => $active['meta'],
    ]);

    if ($recordId) {
        $update = $db->prepare(
            'UPDATE workout_records
             SET workout_date = :workout_date, workout_data = :workout_data, memo = :memo
             WHERE id = :id AND user_id = :user_id'
        );
        $update->execute([
            'workout_date' => $date,
            'workout_data' => $json,
            'memo' => $active['note'] ?: null,
            'id' => $recordId,
            'user_id' => $userId,
        ]);
        return;
    }

    $insert = $db->prepare(
        'INSERT INTO workout_records (user_id, workout_date, workout_data, memo)
         VALUES (:user_id, :workout_date, :workout_data, :memo)'
    );
    $insert->execute([
        'user_id' => $userId,
        'workout_date' => $date,
        'workout_data' => $json,
        'memo' => $active['note'] ?: null,
    ]);
}

function completeUserWorkout(PDO $db, int $userId, array $session): void
{
    $db->beginTransaction();

    try {
        clearActiveWorkout($db, $userId);
        $insert = $db->prepare(
            'INSERT INTO workout_records (user_id, workout_date, workout_data, memo)
             VALUES (:user_id, :workout_date, :workout_data, :memo)'
        );
        $insert->execute([
            'user_id' => $userId,
            'workout_date' => $session['dateKey'],
            'workout_data' => encodeWorkoutData(['kind' => 'session', 'session' => $session]),
            'memo' => $session['note'] ?: null,
        ]);
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function importUserWorkoutHistory(PDO $db, int $userId, array $history): int
{
    $find = $db->prepare(
        "SELECT id
         FROM workout_records
         WHERE user_id = :user_id
           AND JSON_UNQUOTE(JSON_EXTRACT(workout_data, '$.kind')) = 'session'
           AND JSON_UNQUOTE(JSON_EXTRACT(workout_data, '$.session.id')) = :session_id
         LIMIT 1"
    );
    $insert = $db->prepare(
        'INSERT INTO workout_records (user_id, workout_date, workout_data, memo)
         VALUES (:user_id, :workout_date, :workout_data, :memo)'
    );
    $imported = 0;
    $db->beginTransaction();

    try {
        foreach (array_slice($history, 0, 80) as $session) {
            $find->execute(['user_id' => $userId, 'session_id' => $session['id']]);

            if ($find->fetchColumn()) {
                continue;
            }

            $insert->execute([
                'user_id' => $userId,
                'workout_date' => $session['dateKey'],
                'workout_data' => encodeWorkoutData(['kind' => 'session', 'session' => $session]),
                'memo' => $session['note'] ?: null,
            ]);
            $imported += 1;
        }

        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }

    return $imported;
}
