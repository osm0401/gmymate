<?php

declare(strict_types=1);

require_once __DIR__ . '/core/http.php';
require_once __DIR__ . '/core/session.php';

startSecureSession();

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1/interactions';
const GEMINI_MAX_PROMPT_LENGTH = 2000;
const GEMINI_REQUESTS_PER_MINUTE = 8;

function geminiConfig(): array
{
    $configPath = __DIR__ . '/config/gemini.php';
    $config = is_file($configPath) ? require $configPath : [];

    return is_array($config) ? $config : [];
}

function geminiApiKey(array $config): string
{
    $environmentKey = getenv('GEMINI_API_KEY');

    if (is_string($environmentKey) && trim($environmentKey) !== '') {
        return trim($environmentKey);
    }

    return trim((string) ($config['api_key'] ?? ''));
}

function geminiModel(array $config): string
{
    $model = trim((string) ($config['model'] ?? 'gemini-3.5-flash'));

    return preg_match('/^[a-zA-Z0-9._-]+$/', $model) ? $model : 'gemini-3.5-flash';
}

function enforceGeminiRateLimit(): void
{
    $now = time();
    $rate = $_SESSION['gemini_rate'] ?? ['started_at' => $now, 'count' => 0];

    if (!is_array($rate) || $now - (int) ($rate['started_at'] ?? 0) >= 60) {
        $rate = ['started_at' => $now, 'count' => 0];
    }

    if ((int) ($rate['count'] ?? 0) >= GEMINI_REQUESTS_PER_MINUTE) {
        respond([
            'success' => false,
            'message' => 'Too many requests. Please wait a minute and try again.',
        ], 429);
    }

    $rate['count'] = (int) ($rate['count'] ?? 0) + 1;
    $_SESSION['gemini_rate'] = $rate;
}

function geminiFailureMessage(int $status): string
{
    if ($status === 401 || $status === 403) {
        return 'Gemini authentication failed. Check the server API key and project access.';
    }

    if ($status === 429) {
        return 'The Gemini quota is currently exhausted. Please try again later.';
    }

    if ($status >= 500) {
        return 'Gemini is temporarily unavailable. Please try again shortly.';
    }

    return 'Gemini could not process this request. Check the model and prompt settings.';
}

function extractGeminiText(array $interaction): string
{
    $parts = [];

    foreach (($interaction['steps'] ?? []) as $step) {
        if (!is_array($step) || ($step['type'] ?? '') !== 'model_output') {
            continue;
        }

        foreach (($step['content'] ?? []) as $content) {
            if (is_array($content) && ($content['type'] ?? '') === 'text') {
                $text = trim((string) ($content['text'] ?? ''));

                if ($text !== '') {
                    $parts[] = $text;
                }
            }
        }
    }

    return trim(implode("\n\n", $parts));
}

function geminiHistory($value): array
{
    if (!is_array($value)) {
        return [];
    }

    $history = [];

    foreach (array_slice($value, -6) as $message) {
        if (!is_array($message)) {
            continue;
        }

        $roleValue = $message['role'] ?? null;
        $textValue = $message['text'] ?? null;

        if (!is_string($roleValue) || !is_string($textValue)) {
            continue;
        }

        $role = $roleValue;
        $text = trim($textValue);

        if (!in_array($role, ['user', 'assistant'], true) || $text === '') {
            continue;
        }

        if (function_exists('mb_substr')) {
            $text = mb_substr($text, 0, 1000, 'UTF-8');
        } else {
            $text = substr($text, 0, 1000);
        }

        $history[] = ['role' => $role, 'text' => $text];
    }

    return $history;
}

function geminiInput(string $prompt, array $history): string
{
    if ($history === []) {
        return $prompt;
    }

    $lines = ['Recent conversation:'];

    foreach ($history as $message) {
        $speaker = $message['role'] === 'assistant' ? 'Assistant' : 'User';
        $lines[] = $speaker . ': ' . $message['text'];
    }

    $lines[] = '';
    $lines[] = 'Current user message: ' . $prompt;

    return implode("\n", $lines);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method !== 'POST') {
    respond(['success' => false, 'message' => 'Only POST requests are allowed.'], 405);
}

if ((int) ($_SESSION['user_id'] ?? 0) < 1) {
    respond(['success' => false, 'message' => 'Please sign in before using the AI assistant.'], 401);
}

$body = requestBody();
$promptValue = $body['prompt'] ?? null;

if (!is_string($promptValue)) {
    respond(['success' => false, 'message' => 'The prompt must be text.'], 422);
}

$prompt = trim($promptValue);
$history = geminiHistory($body['history'] ?? []);
$promptLength = function_exists('mb_strlen') ? mb_strlen($prompt, 'UTF-8') : strlen($prompt);

if ($prompt === '') {
    respond(['success' => false, 'message' => 'Enter a question first.'], 422);
}

if ($promptLength > GEMINI_MAX_PROMPT_LENGTH) {
    respond([
        'success' => false,
        'message' => 'Keep the question under ' . GEMINI_MAX_PROMPT_LENGTH . ' characters.',
    ], 422);
}

$config = geminiConfig();
$apiKey = geminiApiKey($config);
$model = geminiModel($config);

if ($apiKey === '' || $apiKey === 'PASTE_YOUR_GEMINI_API_KEY_HERE') {
    respond([
        'success' => false,
        'message' => 'Gemini is not configured. Add the API key to api/config/gemini.php.',
    ], 503);
}

enforceGeminiRateLimit();

if (!function_exists('curl_init')) {
    respond(['success' => false, 'message' => 'The PHP cURL extension is required.'], 500);
}

$payload = [
    'model' => $model,
    'input' => geminiInput($prompt, $history),
    'system_instruction' => implode(' ', [
        'You are the GAINMUSCLE AI assistant.',
        'Answer the user question directly and accurately regardless of topic.',
        'Reply in the same language as the user and use metric units by default.',
        'Be clear, useful, and honest when information is uncertain.',
    ]),
    'store' => false,
];

$encodedPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

if ($encodedPayload === false) {
    respond(['success' => false, 'message' => 'The request could not be encoded.'], 500);
}

$curl = curl_init(GEMINI_ENDPOINT);

if ($curl === false) {
    respond(['success' => false, 'message' => 'The Gemini request could not be initialized.'], 500);
}

curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 45,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Accept: application/json',
        'x-goog-api-key: ' . $apiKey,
    ],
    CURLOPT_POSTFIELDS => $encodedPayload,
]);

$rawResponse = curl_exec($curl);
$upstreamStatus = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_error($curl);
curl_close($curl);

if ($rawResponse === false || $curlError !== '') {
    error_log('Gemini connection error: ' . $curlError);
    respond(['success' => false, 'message' => 'Could not connect to Gemini.'], 502);
}

$interaction = json_decode((string) $rawResponse, true);

if (!is_array($interaction)) {
    error_log('Gemini returned invalid JSON.');
    respond(['success' => false, 'message' => 'Gemini returned an invalid response.'], 502);
}

if ($upstreamStatus < 200 || $upstreamStatus >= 300) {
    $upstreamCode = (string) ($interaction['error']['status'] ?? $upstreamStatus);
    error_log('Gemini API error: ' . $upstreamCode);
    respond([
        'success' => false,
        'message' => geminiFailureMessage($upstreamStatus),
        'upstreamStatus' => $upstreamStatus,
    ], 502);
}

$reply = extractGeminiText($interaction);

if ($reply === '') {
    respond(['success' => false, 'message' => 'Gemini returned no text response.'], 502);
}

respond([
    'success' => true,
    'reply' => $reply,
    'model' => (string) ($interaction['model'] ?? $model),
]);
