<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/schema.php';

ensure_support_tables($pdo);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['message' => 'Method not allowed.'], 405);
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    send_json(['message' => 'Invalid request body.'], 400);
}

$hospitalName = trim((string)($payload['hospitalName'] ?? ''));
$location = trim((string)($payload['location'] ?? ''));
$password = (string)($payload['password'] ?? '');

if ($hospitalName === '' || $location === '' || $password === '') {
    send_json(['message' => 'Hospital name, location and password are required.'], 400);
}

if (strlen($password) < 6) {
    send_json(['message' => 'Password must be at least 6 characters.'], 400);
}

$passwordHash = password_hash($password, PASSWORD_DEFAULT);

try {
    $insert = $pdo->prepare(
        'INSERT INTO hospitals (hospital_name, location, password_hash)
         VALUES (:hospital_name, :location, :password_hash)'
    );
    $insert->execute([
        ':hospital_name' => $hospitalName,
        ':location' => $location,
        ':password_hash' => $passwordHash
    ]);

    send_json([
        'message' => 'Hospital account created successfully.',
        'hospital' => [
            'id' => (int)$pdo->lastInsertId(),
            'hospitalName' => $hospitalName,
            'location' => $location
        ]
    ], 201);
} catch (PDOException $exception) {
    if ((int)($exception->errorInfo[1] ?? 0) === 1062) {
        send_json(['message' => 'Hospital already registered with same name and location.'], 409);
    }

    send_json(['message' => 'Failed to create hospital account.'], 500);
}
