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

$find = $pdo->prepare(
    'SELECT hospital_id, hospital_name, location, password_hash
     FROM hospitals
     WHERE hospital_name = :hospital_name AND location = :location
     LIMIT 1'
);
$find->execute([
    ':hospital_name' => $hospitalName,
    ':location' => $location
]);

$hospital = $find->fetch();
if (!$hospital) {
    send_json(['message' => 'Hospital login failed. Details do not match.'], 401);
}

if (!password_verify($password, (string)$hospital['password_hash'])) {
    send_json(['message' => 'Hospital login failed. Incorrect password.'], 401);
}

send_json([
    'message' => 'Hospital login successful.',
    'hospital' => [
        'id' => (int)$hospital['hospital_id'],
        'hospitalName' => (string)$hospital['hospital_name'],
        'location' => (string)$hospital['location']
    ]
]);
