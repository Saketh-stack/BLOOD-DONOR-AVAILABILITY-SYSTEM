<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/schema.php';

ensure_support_tables($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $requestId = (int)($_GET['request_id'] ?? 0);
    if ($requestId <= 0) {
        send_json(['message' => 'request_id is required.'], 400);
    }

    $exists = $pdo->prepare('SELECT request_id FROM requests WHERE request_id = :id LIMIT 1');
    $exists->execute([':id' => $requestId]);
    if (!$exists->fetch()) {
        send_json(['message' => 'Request not found.'], 404);
    }

    $stmt = $pdo->prepare(
        'SELECT message_id, request_id, sender_role, sender_name, message, sent_at
         FROM chat_messages
         WHERE request_id = :request_id
         ORDER BY message_id ASC'
    );
    $stmt->execute([':request_id' => $requestId]);

    send_json(['messages' => $stmt->fetchAll()]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        send_json(['message' => 'Invalid request body.'], 400);
    }

    $requestId = (int)($payload['requestId'] ?? 0);
    $senderRole = trim((string)($payload['senderRole'] ?? ''));
    $senderName = trim((string)($payload['senderName'] ?? ''));
    $message = trim((string)($payload['message'] ?? ''));

    if ($requestId <= 0 || $senderRole === '' || $senderName === '' || $message === '') {
        send_json(['message' => 'requestId, senderRole, senderName and message are required.'], 400);
    }

    $validRoles = ['patient', 'donor', 'hospital'];
    if (!in_array($senderRole, $validRoles, true)) {
        send_json(['message' => 'Invalid sender role.'], 400);
    }

    $exists = $pdo->prepare('SELECT request_id FROM requests WHERE request_id = :id LIMIT 1');
    $exists->execute([':id' => $requestId]);
    if (!$exists->fetch()) {
        send_json(['message' => 'Request not found.'], 404);
    }

    $insert = $pdo->prepare(
        'INSERT INTO chat_messages (request_id, sender_role, sender_name, message)
         VALUES (:request_id, :sender_role, :sender_name, :message)'
    );
    $insert->execute([
        ':request_id' => $requestId,
        ':sender_role' => $senderRole,
        ':sender_name' => $senderName,
        ':message' => $message
    ]);

    send_json([
        'message' => 'Message sent.',
        'messageId' => (int)$pdo->lastInsertId()
    ], 201);
}

send_json(['message' => 'Method not allowed.'], 405);
