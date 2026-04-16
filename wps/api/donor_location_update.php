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
$latitude = isset($payload['latitude']) ? (float)$payload['latitude'] : null;
$longitude = isset($payload['longitude']) ? (float)$payload['longitude'] : null;

if ($donorId <= 0 || $requestId <= 0 || $latitude === null || $longitude === null) {
    send_json(['message' => 'donorId, requestId, latitude and longitude are required.'], 400);
}

$allow = $pdo->prepare(
    "SELECT id
     FROM request_responses
     WHERE donor_id = :donor_id
       AND request_id = :request_id
       AND status = 'Accepted'
     LIMIT 1"
);
$allow->execute([
    ':donor_id' => $donorId,
    ':request_id' => $requestId
]);
if (!$allow->fetch()) {
    send_json(['message' => 'Location can be shared only after accepting the request.'], 403);
}

$upsert = $pdo->prepare(
    "INSERT INTO donor_locations (donor_id, request_id, latitude, longitude)
     VALUES (:donor_id, :request_id, :latitude, :longitude)
     ON DUPLICATE KEY UPDATE
       request_id = VALUES(request_id),
       latitude = VALUES(latitude),
       longitude = VALUES(longitude),
       updated_at = CURRENT_TIMESTAMP"
);
$upsert->execute([
    ':donor_id' => $donorId,
    ':request_id' => $requestId,
    ':latitude' => $latitude,
    ':longitude' => $longitude
]);

send_json([
    'message' => 'Live location updated.',
    'latitude' => $latitude,
    'longitude' => $longitude
]);
