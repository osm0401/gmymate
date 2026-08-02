<?php

declare(strict_types=1);

const DEFAULT_HABITS = [
    'protein' => '운동 후 단백질 챙기기',
    'water' => '물 2L 마시기',
    'stretch' => '스트레칭 5분 하기',
];

function ensureDefaultHabits(PDO $db): array
{
    $find = $db->prepare('SELECT id FROM habits WHERE title = :title ORDER BY id LIMIT 1');
    $insert = $db->prepare('INSERT INTO habits (title) VALUES (:title)');
    $ids = [];

    foreach (DEFAULT_HABITS as $key => $title) {
        $find->execute(['title' => $title]);
        $id = $find->fetchColumn();

        if (!$id) {
            $insert->execute(['title' => $title]);
            $id = $db->lastInsertId();
        }

        $ids[$key] = (int) $id;
    }

    return $ids;
}

function findUserHabits(PDO $db, int $userId, string $date): array
{
    $habitIds = ensureDefaultHabits($db);
    $values = array_fill_keys(array_keys(DEFAULT_HABITS), false);
    $entryCount = 0;
    $statement = $db->prepare(
        'SELECT habit_id, completed
         FROM user_habits
         WHERE user_id = :user_id AND checked_date = :checked_date'
    );
    $statement->execute(['user_id' => $userId, 'checked_date' => $date]);
    $keysById = array_flip($habitIds);

    foreach ($statement->fetchAll() as $row) {
        $key = $keysById[(int) $row['habit_id']] ?? null;

        if ($key !== null) {
            $values[$key] = (bool) $row['completed'];
            $entryCount += 1;
        }
    }

    return ['values' => $values, 'entryCount' => $entryCount];
}

function saveUserHabit(PDO $db, int $userId, string $key, string $date, bool $completed): void
{
    $habitIds = ensureDefaultHabits($db);

    if (!isset($habitIds[$key])) {
        throw new InvalidArgumentException('Unknown habit.');
    }

    $find = $db->prepare(
        'SELECT id
         FROM user_habits
         WHERE user_id = :user_id AND habit_id = :habit_id AND checked_date = :checked_date
         ORDER BY id
         LIMIT 1'
    );
    $params = [
        'user_id' => $userId,
        'habit_id' => $habitIds[$key],
        'checked_date' => $date,
    ];
    $find->execute($params);
    $entryId = $find->fetchColumn();

    if ($entryId) {
        $update = $db->prepare('UPDATE user_habits SET completed = :completed WHERE id = :id');
        $update->execute(['completed' => $completed ? 1 : 0, 'id' => $entryId]);
        return;
    }

    $insert = $db->prepare(
        'INSERT INTO user_habits (user_id, habit_id, checked_date, completed)
         VALUES (:user_id, :habit_id, :checked_date, :completed)'
    );
    $insert->execute($params + ['completed' => $completed ? 1 : 0]);
}

function syncUserHabits(PDO $db, int $userId, string $date, array $habits): void
{
    $db->beginTransaction();

    try {
        foreach (DEFAULT_HABITS as $key => $title) {
            saveUserHabit($db, $userId, $key, $date, !empty($habits[$key]));
        }

        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}
