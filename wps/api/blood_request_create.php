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

$hospitalId = (int)($payload['hospitalId'] ?? 0);
$bloodGroup = trim((string)($payload['bloodGroup'] ?? ''));
$location = trim((string)($payload['location'] ?? ''));
$urgency = trim((string)($payload['urgencyLevel'] ?? 'High'));
$hospitalLat = isset($payload['hospitalLatitude']) ? (float)$payload['hospitalLatitude'] : null;
$hospitalLng = isset($payload['hospitalLongitude']) ? (float)$payload['hospitalLongitude'] : null;

$validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
$validUrgency = ['High', 'Medium', 'Low'];

if ($hospitalId <= 0 || $bloodGroup === '' || $location === '') {
    send_json(['message' => 'hospitalId, bloodGroup and location are required.'], 400);
}
if (!in_array($bloodGroup, $validBloodGroups, true)) {
    send_json(['message' => 'Invalid blood group.'], 400);
}
if (!in_array($urgency, $validUrgency, true)) {
    send_json(['message' => 'Invalid urgency level.'], 400);
}

$h = $pdo->prepare('SELECT hospital_id, hospital_name, location FROM hospitals WHERE hospital_id = :id LIMIT 1');
$h->execute([':id' => $hospitalId]);
$hospital = $h->fetch();
if (!$hospital) {
    send_json(['message' => 'Hospital authentication failed. Please login again.'], 401);
}

try {
    $pdo->beginTransaction();

    $insertRequest = $pdo->prepare(
        "INSERT INTO blood_requests (hospital_id, blood_group, location, urgency_level, status, hospital_latitude, hospital_longitude)
         VALUES (:hospital_id, :blood_group, :location, :urgency_level, 'Open', :lat, :lng)"
    );
    $insertRequest->execute([
        ':hospital_id' => $hospitalId,
        ':blood_group' => $bloodGroup,
        ':location' => $location,
        ':urgency_level' => $urgency,
        ':lat' => $hospitalLat,
        ':lng' => $hospitalLng
    ]);

    $requestId = (int)$pdo->lastInsertId();

    $donorQuery = $pdo->prepare(
        "SELECT donor_id
         FROM donors
         WHERE blood_group = :blood_group
           AND availability = 'Available'
           AND (last_donation_date IS NULL OR DATE_ADD(last_donation_date, INTERVAL 90 DAY) <= CURDATE())"
    );
    $donorQuery->execute([':blood_group' => $bloodGroup]);
    $donorIds = array_map(static fn(array $row): int => (int)$row['donor_id'], $donorQuery->fetchAll());

    if (count($donorIds) > 0) {
        $ins = $pdo->prepare(
            "INSERT INTO request_responses (request_id, donor_id, status)
             VALUES (:request_id, :donor_id, 'Pending')"
        );
        foreach ($donorIds as $donorId) {
            $ins->execute([
                ':request_id' => $requestId,
                ':donor_id' => $donorId
            ]);
        }
    }

    $pdo->commit();

    send_json([
        'message' => 'Blood request sent to matching available donors.',
        'requestId' => $requestId,
        'hospitalName' => (string)$hospital['hospital_name'],
        'targetedDonors' => count($donorIds)
    ], 201);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    send_json(['message' => 'Failed to create blood request.', 'debug' => $exception->getMessage()], 500);
}

