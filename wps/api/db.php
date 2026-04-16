<?php
declare(strict_types=1);

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

function send_json(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

$fileConfig = [];
$configFile = __DIR__ . '/db.config.php';
if (file_exists($configFile)) {
    $loaded = require $configFile;
    if (is_array($loaded)) {
        $fileConfig = $loaded;
    }
}

$host = (string)($fileConfig['host'] ?? getenv('DB_HOST') ?: '127.0.0.1');
$port = (int)($fileConfig['port'] ?? getenv('DB_PORT') ?: 3307);
$dbName = (string)($fileConfig['database'] ?? getenv('DB_NAME') ?: 'blood_donor_system');
$username = (string)($fileConfig['username'] ?? getenv('DB_USER') ?: 'root');
$password = (string)($fileConfig['password'] ?? getenv('DB_PASS') ?: '');

$dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";

try {
    $pdo = new PDO(
        $dsn,
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 2
        ]
    );
} catch (PDOException $exception) {
    send_json([
        'message' => 'Database connection failed. Check api/db.config.php settings.',
        'debug' => $exception->getMessage()
    ], 500);
}
