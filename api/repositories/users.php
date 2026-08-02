<?php

declare(strict_types=1);

function findUser(PDO $db, int $userId): ?array
{
    $statement = $db->prepare(
        'SELECT id, username, email, age, height, current_weight, target_weight,
                experience, goal, weekly_plan
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $userId]);
    $user = $statement->fetch();

    return $user ?: null;
}

function userIdentityExists(PDO $db, string $username, string $email): bool
{
    $statement = $db->prepare(
        'SELECT id
         FROM users
         WHERE username = :username OR email = :email
         LIMIT 1'
    );
    $statement->execute(['username' => $username, 'email' => $email]);

    return (bool) $statement->fetch();
}

function createUser(PDO $db, string $username, string $email, string $passwordHash): int
{
    $statement = $db->prepare(
        'INSERT INTO users (username, email, password_hash)
         VALUES (:username, :email, :password_hash)'
    );
    $statement->execute([
        'username' => $username,
        'email' => $email,
        'password_hash' => $passwordHash,
    ]);

    return (int) $db->lastInsertId();
}

function findAccountByIdentifier(PDO $db, string $identifier): ?array
{
    $statement = $db->prepare(
        'SELECT id, password_hash
         FROM users
         WHERE username = :identifier OR email = :email
         LIMIT 1'
    );
    $statement->execute([
        'identifier' => $identifier,
        'email' => strtolower($identifier),
    ]);
    $account = $statement->fetch();

    return $account ?: null;
}

function updateUserProfile(PDO $db, int $userId, array $profile): void
{
    $statement = $db->prepare(
        'UPDATE users
         SET age = :age,
             height = :height,
             current_weight = :current_weight,
             target_weight = :target_weight,
             experience = :experience,
             goal = :goal,
             weekly_plan = :weekly_plan
         WHERE id = :id'
    );
    $statement->execute([
        'age' => $profile['age'],
        'height' => $profile['height'],
        'current_weight' => $profile['weight'],
        'target_weight' => $profile['targetWeight'],
        'experience' => $profile['experience'],
        'goal' => $profile['goal'],
        'weekly_plan' => $profile['weeklyWorkout'],
        'id' => $userId,
    ]);
}
