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

$donorId = (int)($payload['donorId'] ?? 0);
$requestId = (int)($payload['requestId'] ?? 0);
$status = trim((string)($payload['status'] ?? ''));

if ($donorId <= 0 || $requestId <= 0 || $status === '') {
    send_json(['message' => 'donorId, requestId and status are required.'], 400);
}

if (!in_array($status, ['Accepted', 'Rejected'], true)) {
    send_json(['message' => 'Status must be Accepted or Rejected.'], 400);
}

$donorCheck = $pdo->prepare('SELECT donor_id FROM donors WHERE donor_id = :donor_id LIMIT 1');
$donorCheck->execute([':donor_id' => $donorId]);
if (!$donorCheck->fetch()) {
    send_json(['message' => 'Invalid donor session. Please login again.'], 401);
}

$requestCheck = $pdo->prepare('SELECT id, status FROM blood_requests WHERE id = :request_id LIMIT 1');
$requestCheck->execute([':request_id' => $requestId]);
$request = $requestCheck->fetch();
if (!$request) {
    send_json(['message' => 'Blood request not found.'], 404);
}

$requestStatus = strtolower((string)($request['status'] ?? ''));
if (in_array($requestStatus, ['closed', 'cancelled'], true)) {
    send_json(['message' => 'This blood request is already closed.'], 409);
}

$upsert = $pdo->prepare(
    'INSERT INTO request_responses (request_id, donor_id, status, responded_at)
     VALUES (:request_id, :donor_id, :status, NOW())
     ON DUPLICATE KEY UPDATE status = VALUES(status), responded_at = NOW()'
);
$upsert->execute([
    ':request_id' => $requestId,
    ':donor_id' => $donorId,
    ':status' => $status
]);

if ($status === 'Rejected') {
    $clear = $pdo->prepare('UPDATE donor_locations SET request_id = NULL WHERE donor_id = :donor_id AND request_id = :request_id');
    $clear->execute([
        ':donor_id' => $donorId,
        ':request_id' => $requestId
    ]);
}

send_json([
    'message' => 'Request response updated.',
    'status' => $status,
    'requestId' => $requestId,
    'donorId' => $donorId
]);
