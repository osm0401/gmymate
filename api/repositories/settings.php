<?php

declare(strict_types=1);

function findUserSettings(PDO $db, int $userId): ?array
{
    $statement = $db->prepare(
        'SELECT weight_step, rest_time, large_touch, easy_mode, workout_alarm, beginner_mode
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $userId]);
    $row = $statement->fetch();

    if (!$row) {
        return null;
    }

    return [
        'weightStepKg' => (float) $row['weight_step'],
        'restSeconds' => (int) $row['rest_time'],
        'largeTouch' => (bool) $row['large_touch'],
        'easyWords' => (bool) $row['easy_mode'],
        'workoutAlert' => (bool) $row['workout_alarm'],
        'beginnerMode' => (bool) $row['beginner_mode'],
    ];
}

function updateUserSettings(PDO $db, int $userId, array $settings): void
{
    $statement = $db->prepare(
        'UPDATE users
         SET weight_step = :weight_step,
             rest_time = :rest_time,
             large_touch = :large_touch,
             easy_mode = :easy_mode,
             workout_alarm = :workout_alarm,
             beginner_mode = :beginner_mode
         WHERE id = :id'
    );
    $statement->execute([
        'weight_step' => $settings['weightStepKg'],
        'rest_time' => $settings['restSeconds'],
        'large_touch' => $settings['largeTouch'] ? 1 : 0,
        'easy_mode' => $settings['easyWords'] ? 1 : 0,
        'workout_alarm' => $settings['workoutAlert'] ? 1 : 0,
        'beginner_mode' => $settings['beginnerMode'] ? 1 : 0,
        'id' => $userId,
    ]);
}
