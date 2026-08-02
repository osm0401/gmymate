<?php

declare(strict_types=1);

function ensureExercise(PDO $db, array $exercise): int
{
    $find = $db->prepare('SELECT id FROM exercises WHERE name = :name ORDER BY id LIMIT 1');
    $find->execute(['name' => $exercise['name']]);
    $exerciseId = $find->fetchColumn();
    $values = [
        'category' => $exercise['category'],
        'name' => $exercise['name'],
        'equipment' => $exercise['equipment'] ?: null,
        'unit' => $exercise['unit'],
        'description' => $exercise['description'] ?: null,
        'difficulty' => $exercise['difficulty'] ?: null,
    ];

    if ($exerciseId) {
        $update = $db->prepare(
            'UPDATE exercises
             SET name = :name,
                 category = :category,
                 equipment = COALESCE(:equipment, equipment),
                 unit = :unit,
                 description = COALESCE(:description, description),
                 difficulty = COALESCE(:difficulty, difficulty)
             WHERE id = :id'
        );
        $update->execute($values + ['id' => $exerciseId]);
        return (int) $exerciseId;
    }

    $insert = $db->prepare(
        'INSERT INTO exercises (category, name, equipment, unit, description, difficulty)
         VALUES (:category, :name, :equipment, :unit, :description, :difficulty)'
    );
    $insert->execute($values);

    return (int) $db->lastInsertId();
}

function seedExercises(PDO $db, array $exercises): int
{
    $db->beginTransaction();

    try {
        foreach ($exercises as $exercise) {
            ensureExercise($db, $exercise);
        }

        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }

    return (int) $db->query('SELECT COUNT(*) FROM exercises')->fetchColumn();
}

function countExercises(PDO $db): int
{
    return (int) $db->query('SELECT COUNT(*) FROM exercises')->fetchColumn();
}
