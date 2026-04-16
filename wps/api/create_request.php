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

$name = trim((string)($payload['name'] ?? ''));
$phone = trim((string)($payload['phone'] ?? ''));
$bloodGroup = trim((string)($payload['bloodGroup'] ?? ''));
$location = trim((string)($payload['location'] ?? ''));
$urgency = trim((string)($payload['urgency'] ?? 'High'));
$message = trim((string)($payload['message'] ?? ''));

if ($name === '' || $bloodGroup === '' || $location === '') {
    send_json(['message' => 'Name, blood group and location are required.'], 400);
}

$validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
$validUrgency = ['High', 'Medium', 'Low'];

if (!in_array($bloodGroup, $validBloodGroups, true)) {
    send_json(['message' => 'Invalid blood group.'], 400);
}

if (!in_array($urgency, $validUrgency, true)) {
    send_json(['message' => 'Invalid urgency level.'], 400);
}

try {
    $pdo->beginTransaction();

    $insertPatient = $pdo->prepare(
        'INSERT INTO patients (name, blood_group, contact, location, urgency_level)
         VALUES (:name, :blood_group, :contact, :location, :urgency_level)'
    );
    $insertPatient->execute([
        ':name' => $name,
        ':blood_group' => $bloodGroup,
        ':contact' => $phone,
        ':location' => $location,
        ':urgency_level' => $urgency
    ]);

    $patientId = (int)$pdo->lastInsertId();

    $insertRequest = $pdo->prepare(
        "INSERT INTO requests (patient_id, blood_group, date, status)
         VALUES (:patient_id, :blood_group, CURRENT_DATE, 'Pending')"
    );
    $insertRequest->execute([
        ':patient_id' => $patientId,
        ':blood_group' => $bloodGroup
    ]);

    $requestId = (int)$pdo->lastInsertId();

    if ($message !== '') {
        $insertMessage = $pdo->prepare(
            "INSERT INTO chat_messages (request_id, sender_role, sender_name, message)
             VALUES (:request_id, 'patient', :sender_name, :message)"
        );
        $insertMessage->execute([
            ':request_id' => $requestId,
            ':sender_name' => $name,
            ':message' => $message
        ]);
    }

    $pdo->commit();

    send_json([
        'message' => 'Emergency request created.',
        'request' => [
            'requestId' => $requestId,
            'patientId' => $patientId,
            'name' => $name,
            'bloodGroup' => $bloodGroup,
            'location' => $location,
            'urgency' => $urgency,
            'status' => 'Pending'
        ]
    ], 201);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    send_json([
        'message' => 'Failed to create emergency request.',
        'debug' => $exception->getMessage()
    ], 500);
}
