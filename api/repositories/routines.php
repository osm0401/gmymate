<?php

declare(strict_types=1);

function decodeRoutineMetadata(?string $value): array
{
    if (!$value) {
        return [];
    }

    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : [];
}

function findUserRoutines(PDO $db, int $userId): array
{
    $statement = $db->prepare(
        'SELECT r.id AS routine_id,
                r.title,
                r.description,
                ur.is_favorite,
                re.id AS routine_exercise_id,
                re.sort_order,
                re.target_sets,
                re.target_reps,
                e.id AS exercise_db_id,
                e.name AS exercise_name,
                e.category AS exercise_category,
                e.equipment,
                e.unit
         FROM user_routines ur
         INNER JOIN routines r ON r.id = ur.routine_id
         LEFT JOIN routine_exercises re ON re.routine_id = r.id
         LEFT JOIN exercises e ON e.id = re.exercise_id
         WHERE ur.user_id = :user_id
         ORDER BY ur.created_at DESC, r.id DESC, re.sort_order, re.id'
    );
    $statement->execute(['user_id' => $userId]);
    $routines = [];

    foreach ($statement->fetchAll() as $row) {
        $routineId = (int) $row['routine_id'];

        if (!isset($routines[$routineId])) {
            $metadata = decodeRoutineMetadata($row['description']);
            $appId = trim((string) ($metadata['appId'] ?? ''));
            $routines[$routineId] = [
                'id' => $appId !== '' ? $appId : 'routine-cloud-' . $routineId,
                'dbId' => $routineId,
                'name' => (string) $row['title'],
                'isFavorite' => (bool) $row['is_favorite'],
                'metadata' => $metadata,
                'exercises' => [],
            ];
        }

        if (!$row['routine_exercise_id'] || !$row['exercise_db_id']) {
            continue;
        }

        $routineExerciseId = (string) $row['routine_exercise_id'];
        $metadata = $routines[$routineId]['metadata']['exercises'][$routineExerciseId] ?? [];
        $frontendExerciseId = trim((string) ($metadata['exerciseId'] ?? ''));

        if ($frontendExerciseId === '') {
            continue;
        }

        $routines[$routineId]['exercises'][] = [
            'exerciseId' => $frontendExerciseId,
            'sets' => max((int) $row['target_sets'], 1),
            'weight' => max((float) ($metadata['weight'] ?? 0), 0),
            'reps' => max((int) $row['target_reps'], 1),
            'restSeconds' => min(max((int) ($metadata['restSeconds'] ?? 90), 15), 600),
        ];
    }

    return array_values(array_map(static function (array $routine): array {
        unset($routine['metadata']);
        return $routine;
    }, array_filter($routines, static function (array $routine): bool {
        return count($routine['exercises']) > 0;
    })));
}

function findOwnedRoutineMetadata(PDO $db, int $userId): array
{
    $statement = $db->prepare(
        'SELECT r.id, r.description
         FROM user_routines ur
         INNER JOIN routines r ON r.id = ur.routine_id
         WHERE ur.user_id = :user_id'
    );
    $statement->execute(['user_id' => $userId]);
    $owned = [];

    foreach ($statement->fetchAll() as $row) {
        $metadata = decodeRoutineMetadata($row['description']);

        if (($metadata['source'] ?? '') === 'gainmuscle-custom') {
            $owned[(int) $row['id']] = $metadata;
        }
    }

    return $owned;
}

function syncUserRoutines(PDO $db, int $userId, array $routines): array
{
    $db->beginTransaction();

    try {
        $owned = findOwnedRoutineMetadata($db, $userId);
        $keptIds = [];
        $insertRoutine = $db->prepare(
            'INSERT INTO routines (title, category, description)
             VALUES (:title, :category, :description)'
        );
        $linkRoutine = $db->prepare(
            'INSERT INTO user_routines (user_id, routine_id, is_favorite)
             VALUES (:user_id, :routine_id, :is_favorite)'
        );
        $updateRoutine = $db->prepare(
            'UPDATE routines SET title = :title, category = :category, description = :description WHERE id = :id'
        );
        $deleteExercises = $db->prepare('DELETE FROM routine_exercises WHERE routine_id = :routine_id');
        $insertExercise = $db->prepare(
            'INSERT INTO routine_exercises (routine_id, exercise_id, sort_order, target_sets, target_reps)
             VALUES (:routine_id, :exercise_id, :sort_order, :target_sets, :target_reps)'
        );

        foreach (array_slice($routines, 0, 30) as $routine) {
            $requestedDbId = (int) ($routine['dbId'] ?? 0);
            $routineId = isset($owned[$requestedDbId]) ? $requestedDbId : 0;
            $appId = trim((string) ($routine['id'] ?? ''));
            $title = trim((string) $routine['name']);

            if ($routineId < 1) {
                $insertRoutine->execute([
                    'title' => $title,
                    'category' => '나만의 루틴',
                    'description' => null,
                ]);
                $routineId = (int) $db->lastInsertId();
                $linkRoutine->execute([
                    'user_id' => $userId,
                    'routine_id' => $routineId,
                    'is_favorite' => !empty($routine['isFavorite']) ? 1 : 0,
                ]);
            }

            if ($appId === '') {
                $appId = 'routine-cloud-' . $routineId;
            }

            $deleteExercises->execute(['routine_id' => $routineId]);
            $exerciseMetadata = [];

            foreach (array_values($routine['exercises']) as $index => $exercise) {
                $exerciseDbId = ensureExercise($db, $exercise);
                $insertExercise->execute([
                    'routine_id' => $routineId,
                    'exercise_id' => $exerciseDbId,
                    'sort_order' => $index + 1,
                    'target_sets' => $exercise['sets'],
                    'target_reps' => $exercise['reps'],
                ]);
                $routineExerciseId = (string) $db->lastInsertId();
                $exerciseMetadata[$routineExerciseId] = [
                    'exerciseId' => $exercise['exerciseId'],
                    'weight' => $exercise['weight'],
                    'restSeconds' => $exercise['restSeconds'],
                ];
            }

            $description = json_encode([
                'source' => 'gainmuscle-custom',
                'appId' => mb_substr($appId, 0, 80),
                'exercises' => $exerciseMetadata,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            $updateRoutine->execute([
                'title' => $title,
                'category' => '나만의 루틴',
                'description' => $description,
                'id' => $routineId,
            ]);
            $keptIds[] = $routineId;
        }

        $unlink = $db->prepare('DELETE FROM user_routines WHERE user_id = :user_id AND routine_id = :routine_id');
        $countLinks = $db->prepare('SELECT COUNT(*) FROM user_routines WHERE routine_id = :routine_id');
        $deleteRoutine = $db->prepare('DELETE FROM routines WHERE id = :id');

        foreach ($owned as $routineId => $metadata) {
            if (in_array($routineId, $keptIds, true)) {
                continue;
            }

            $unlink->execute(['user_id' => $userId, 'routine_id' => $routineId]);
            $countLinks->execute(['routine_id' => $routineId]);

            if (($metadata['source'] ?? '') === 'gainmuscle-custom' && (int) $countLinks->fetchColumn() === 0) {
                $deleteRoutine->execute(['id' => $routineId]);
            }
        }

        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }

    return findUserRoutines($db, $userId);
}
