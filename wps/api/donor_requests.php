<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/schema.php';

ensure_support_tables($pdo);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['message' => 'Method not allowed.'], 405);
}

$donorId = (int)($_GET['donor_id'] ?? 0);
if ($donorId <= 0) {
    send_json(['message' => 'donor_id is required.'], 400);
}

$donorStmt = $pdo->prepare('SELECT donor_id FROM donors WHERE donor_id = :id LIMIT 1');
$donorStmt->execute([':id' => $donorId]);
if (!$donorStmt->fetch()) {
    send_json(['message' => 'Donor authentication failed. Please login again.'], 401);
}

$sql = "SELECT
            rr.id AS response_id,
            rr.request_id,
            rr.status AS response_status,
            rr.responded_at,
            br.blood_group,
            br.location,
            br.urgency_level,
            br.status AS request_status,
            br.created_at,
            br.hospital_latitude,
            br.hospital_longitude,
            h.hospital_name,
            h.location AS hospital_location,
            dl.latitude,
            dl.longitude,
            dl.updated_at AS location_updated_at
        FROM request_responses rr
        JOIN blood_requests br ON br.id = rr.request_id
        JOIN hospitals h ON h.hospital_id = br.hospital_id
        LEFT JOIN donor_locations dl ON dl.donor_id = rr.donor_id AND dl.request_id = rr.request_id
        WHERE rr.donor_id = :donor_id
        ORDER BY br.created_at DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute([':donor_id' => $donorId]);

send_json(['requests' => $stmt->fetchAll()]);

