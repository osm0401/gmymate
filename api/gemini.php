<?php
declare(strict_types=1);

require __DIR__ . '/session.php';

const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_DEFAULT_MODEL = 'gemini-3.7-flash';
const GEMINI_MAX_PROMPT_CHARS = 2000;
const GEMINI_MAX_HISTORY_ITEMS = 6;
const GEMINI_MAX_HISTORY_CHARS = 1000;
const GEMINI_REQUESTS_PER_MINUTE = 8;
const GEMINI_SYSTEM_INSTRUCTION = 'You are GMYMATE\'s concise fitness expert and conversational assistant. Lead with exercise, nutrition, recovery, and wellness expertise. Do not reject a question merely because it is unrelated to fitness; answer general conversation and basic math normally. Never diagnose a medical condition or present an answer as a diagnosis. If asked for a diagnosis, refuse briefly and recommend a qualified clinician; for urgent danger, advise contacting local emergency services. Keep answers practical, safe, and clear.';

function utf8Length(string $text): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($text, 'UTF-8');
    }

    $length = preg_match_all('/./us', $text, $matches);
    return $length === false ? strlen($text) : $length;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => '허용되지 않은 요청이에요.']);
}

startAppSession();

if (empty($_SESSION['user_id'])) {
    jsonResponse(401, ['error' => '로그인이 필요해요.']);
}

$body = readJsonBody();
$prompt = is_string($body['prompt'] ?? null) ? trim($body['prompt']) : '';
$history = $body['history'] ?? [];

if ($prompt === '' || utf8Length($prompt) > GEMINI_MAX_PROMPT_CHARS) {
    jsonResponse(400, ['error' => '질문은 1~2000자로 입력해주세요.']);
}

if (!is_array($history) || count($history) > GEMINI_MAX_HISTORY_ITEMS) {
    jsonResponse(400, ['error' => '대화 기록이 올바르지 않아요.']);
}

$input = [];

foreach ($history as $item) {
    $role = is_array($item) && is_string($item['role'] ?? null) ? $item['role'] : '';
    $content = is_array($item) ? ($item['content'] ?? $item['text'] ?? null) : null;
    $content = is_string($content) ? trim($content) : '';

    if (!in_array($role, ['user', 'assistant', 'model'], true)
        || $content === ''
        || utf8Length($content) > GEMINI_MAX_HISTORY_CHARS
    ) {
        jsonResponse(400, ['error' => '대화 기록이 올바르지 않아요.']);
    }

    $input[] = [
        'type' => $role === 'user' ? 'user_input' : 'model_output',
        'content' => [['type' => 'text', 'text' => $content]],
    ];
}

$input[] = [
    'type' => 'user_input',
    'content' => [['type' => 'text', 'text' => $prompt]],
];

$configPath = __DIR__ . '/config/gemini.php';

if (!is_file($configPath)) {
    jsonResponse(503, ['error' => 'AI 기능이 아직 설정되지 않았어요.']);
}

try {
    $config = require $configPath;
} catch (Throwable $error) {
    error_log('Gemini configuration could not be loaded: ' . get_class($error));
    jsonResponse(503, ['error' => 'AI 기능이 아직 설정되지 않았어요.']);
}

$apiKey = is_array($config) && is_string($config['api_key'] ?? null) ? trim($config['api_key']) : '';
$model = is_array($config) && is_string($config['model'] ?? null) && trim($config['model']) !== ''
    ? trim($config['model'])
    : GEMINI_DEFAULT_MODEL;

if ($apiKey === '' || $apiKey === 'your_gemini_api_key') {
    jsonResponse(503, ['error' => 'AI 기능이 아직 설정되지 않았어요.']);
}

$rateLimitKey = 'gemini:' . (int)$_SESSION['user_id'];

if (sessionRateLimitExceeded($rateLimitKey, GEMINI_REQUESTS_PER_MINUTE, 60)
    || sharedRateLimitExceeded($rateLimitKey, GEMINI_REQUESTS_PER_MINUTE, 60)
) {
    jsonResponse(429, ['error' => 'AI 요청이 너무 많아요. 잠시 후 다시 시도해주세요.']);
}

recordSessionRateLimitAttempt($rateLimitKey, 60);
recordSharedRateLimitAttempt($rateLimitKey, 60);
session_write_close();

$requestJson = json_encode([
    'model' => $model,
    'store' => false,
    'system_instruction' => GEMINI_SYSTEM_INSTRUCTION,
    'input' => $input,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

if ($requestJson === false || !function_exists('curl_init')) {
    jsonResponse(500, ['error' => 'AI 요청을 처리하지 못했어요.']);
}

$ch = curl_init(GEMINI_INTERACTIONS_URL);

if ($ch === false) {
    jsonResponse(500, ['error' => 'AI 요청을 처리하지 못했어요.']);
}

$configured = curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $requestJson,
    CURLOPT_HTTPHEADER => [
        'Accept: application/json',
        'Content-Type: application/json',
        'x-goog-api-key: ' . $apiKey,
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 30,
]);

if (!$configured) {
    curl_close($ch);
    jsonResponse(500, ['error' => 'AI 요청을 처리하지 못했어요.']);
}

$response = curl_exec($ch);
$httpStatus = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false || $httpStatus < 200 || $httpStatus >= 300) {
    jsonResponse(502, ['error' => 'AI 응답을 받지 못했어요.']);
}

$responseData = json_decode($response, true);
$steps = is_array($responseData) ? ($responseData['steps'] ?? null) : null;

if (!is_array($steps)
    || (isset($responseData['status']) && $responseData['status'] !== 'completed')
) {
    jsonResponse(502, ['error' => 'AI 응답을 확인하지 못했어요.']);
}

$textParts = [];

foreach ($steps as $step) {
    if (!is_array($step) || ($step['type'] ?? null) !== 'model_output' || !is_array($step['content'] ?? null)) {
        continue;
    }

    foreach ($step['content'] as $content) {
        if (is_array($content)
            && ($content['type'] ?? null) === 'text'
            && is_string($content['text'] ?? null)
            && trim($content['text']) !== ''
        ) {
            $textParts[] = trim($content['text']);
        }
    }
}

if ($textParts === []) {
    jsonResponse(502, ['error' => 'AI 응답을 확인하지 못했어요.']);
}

jsonResponse(200, ['reply' => implode("\n", $textParts)]);
