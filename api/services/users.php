<?php

declare(strict_types=1);

function userResponse(array $user): array
{
    $profile = [
        'age' => $user['age'] !== null ? (string) $user['age'] : '',
        'height' => $user['height'] !== null ? (string) $user['height'] : '',
        'weight' => $user['current_weight'] !== null ? (string) $user['current_weight'] : '',
        'targetWeight' => $user['target_weight'] !== null ? (string) $user['target_weight'] : '',
        'experience' => $user['experience'] ?? '',
        'goal' => $user['goal'] ?? '',
        'weeklyWorkout' => $user['weekly_plan'] !== null ? (string) $user['weekly_plan'] : '',
    ];
    $needsOnboarding = in_array('', $profile, true);

    return [
        'user' => [
            'id' => (int) $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'profile' => $profile,
        ],
        'needsOnboarding' => $needsOnboarding,
        'next' => $needsOnboarding ? './onboarding.html' : './main.html',
    ];
}
