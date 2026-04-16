<?php
declare(strict_types=1);

session_start();

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Vary: Origin');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

function out(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

$supported = ['en', 'te', 'hi'];
$default = 'en';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$incoming = null;

if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (is_array($payload)) {
        $incoming = strtolower(trim((string)($payload['lang'] ?? '')));
    }
} else {
    $incoming = strtolower(trim((string)($_GET['lang'] ?? '')));
}

if (!in_array((string)$incoming, $supported, true)) {
    $incoming = null;
}

if ($incoming !== null) {
    $_SESSION['lang'] = $incoming;
}

$lang = $_SESSION['lang'] ?? $default;
if (!in_array((string)$lang, $supported, true)) {
    $lang = $default;
    $_SESSION['lang'] = $lang;
}

$file = __DIR__ . '/lang_' . $lang . '.php';
if (!file_exists($file)) {
    $lang = $default;
    $file = __DIR__ . '/lang_' . $default . '.php';
}

$translations = require $file;
if (!is_array($translations)) {
    out(['message' => 'Language file is invalid.'], 500);
}

out([
    'lang' => $lang,
    'translations' => $translations
]);
