<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

requireUserId();

$configPath = __DIR__ . '/apple-config.php';
if (!file_exists($configPath)) {
    jsonResponse(500, ['error' => 'Apple Music 연동이 아직 설정되지 않았어요.']);
}

$config = require $configPath;

function base64UrlEncode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

// MusicKit needs a raw (r,s) ES256 signature, not the DER-encoded ASN.1
// structure openssl_sign() produces — this unpacks one into the other.
function derToJoseSignature(string $der): string
{
    $offset = 2;
    $rLength = ord($der[$offset + 1]);
    $r = substr($der, $offset + 2, $rLength);
    $offset += 2 + $rLength;
    $sLength = ord($der[$offset + 1]);
    $s = substr($der, $offset + 2, $sLength);

    $r = str_pad(ltrim($r, "\x00"), 32, "\x00", STR_PAD_LEFT);
    $s = str_pad(ltrim($s, "\x00"), 32, "\x00", STR_PAD_LEFT);

    return $r . $s;
}

$header = base64UrlEncode((string)json_encode(['alg' => 'ES256', 'kid' => $config['key_id']]));
$now = time();
$payload = base64UrlEncode((string)json_encode([
    'iss' => $config['team_id'],
    'iat' => $now,
    'exp' => $now + 3600 * 12,
]));

$privateKey = openssl_pkey_get_private($config['private_key']);
if ($privateKey === false) {
    jsonResponse(500, ['error' => 'Apple Music 개인 키를 읽을 수 없어요.']);
}

$signingInput = "$header.$payload";
openssl_sign($signingInput, $signature, $privateKey, OPENSSL_ALGO_SHA256);

jsonResponse(200, ['developerToken' => $signingInput . '.' . base64UrlEncode(derToJoseSignature($signature))]);
