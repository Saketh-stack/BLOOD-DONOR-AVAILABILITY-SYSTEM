<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function send_json(array $payload, int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['message' => 'Method not allowed.'], 405);
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    send_json(['message' => 'Invalid request body.'], 400);
}

$userMessage = trim((string)($payload['message'] ?? ''));
$history = $payload['history'] ?? [];

if ($userMessage === '') {
    send_json(['message' => 'Please enter a message.'], 400);
}

$configFile = __DIR__ . '/ai.config.php';
$config = file_exists($configFile) ? (require $configFile) : [];

$apiKey = (string)($config['openai_api_key'] ?? getenv('OPENAI_API_KEY') ?: '');
$model = (string)($config['model'] ?? 'gpt-4o-mini');

if ($apiKey === '') {
    send_json(['reply' => 'AI chatbot is not configured yet. Add API key in api/ai.config.php']);
}

$messages = [[
    'role' => 'system',
    'content' => 'You are a helpful blood donation assistant. Answer clearly and briefly. If emergency, advise contacting nearest hospital/blood bank immediately.'
]];

if (is_array($history)) {
    foreach ($history as $entry) {
        if (!is_array($entry)) continue;
        $role = (string)($entry['role'] ?? '');
        $content = trim((string)($entry['content'] ?? ''));
        if (($role === 'user' || $role === 'assistant') && $content !== '') {
            $messages[] = ['role' => $role, 'content' => $content];
        }
    }
}
$messages[] = ['role' => 'user', 'content' => $userMessage];

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => 'https://api.openai.com/v1/chat/completions',
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'model' => $model,
        'messages' => $messages,
        'temperature' => 0.4
    ]),
    CURLOPT_TIMEOUT => 30
]);

$responseBody = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError !== '') {
    send_json(['reply' => 'AI connection failed: ' . $curlError], 500);
}
if ($responseBody === false || $httpCode < 200 || $httpCode >= 300) {
    $errorMsg = 'AI service error';
    if (is_string($responseBody) && $responseBody !== '') {
        $parsedErr = json_decode($responseBody, true);
        if (is_array($parsedErr)) {
            $errorMsg = (string)($parsedErr['error']['message'] ?? $errorMsg);
        }
    }
    send_json(['reply' => $errorMsg], 500);
}

$parsed = json_decode($responseBody, true);
$reply = (string)($parsed['choices'][0]['message']['content'] ?? '');
if (trim($reply) === '') {
    $reply = 'Sorry, I could not answer that right now.';
}

send_json(['reply' => $reply]);
