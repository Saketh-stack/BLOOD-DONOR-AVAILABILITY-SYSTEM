<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/schema.php';

ensure_support_tables($pdo);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['message' => 'Method not allowed.'], 405);
}

$hospitalId = (int)($_GET['hospital_id'] ?? 0);
$requestIdFilter = (int)($_GET['request_id'] ?? 0);

if ($hospitalId <= 0) {
    send_json(['message' => 'hospital_id is required.'], 400);
}

$h = $pdo->prepare('SELECT hospital_id, hospital_name, location FROM hospitals WHERE hospital_id = :id LIMIT 1');
$h->execute([':id' => $hospitalId]);
$hospital = $h->fetch();
if (!$hospital) {
    send_json(['message' => 'Hospital authentication failed.'], 401);
}

$sqlRequests = "SELECT
                    br.id,
                    br.blood_group,
                    br.location,
                    br.urgency_level,
                    br.status,
                    br.hospital_latitude,
                    br.hospital_longitude,
                    br.created_at,
                    (SELECT COUNT(*) FROM request_responses rr WHERE rr.request_id = br.id) AS targeted_count,
                    (SELECT COUNT(*) FROM request_responses rr WHERE rr.request_id = br.id AND rr.status = 'Accepted') AS accepted_count,
                    (SELECT COUNT(*) FROM request_responses rr WHERE rr.request_id = br.id AND rr.status = 'Rejected') AS rejected_count,
                    (SELECT COUNT(*) FROM request_responses rr WHERE rr.request_id = br.id AND rr.status = 'Pending') AS pending_count
                FROM blood_requests br
                WHERE br.hospital_id = :hospital_id";
$params = [':hospital_id' => $hospitalId];

if ($requestIdFilter > 0) {
    $sqlRequests .= ' AND br.id = :request_id';
    $params[':request_id'] = $requestIdFilter;
}

$sqlRequests .= ' ORDER BY br.created_at DESC';

$r = $pdo->prepare($sqlRequests);
$r->execute($params);
$requests = $r->fetchAll();

$acceptedSql = "SELECT
                    br.id AS request_id,
                    d.donor_id,
                    d.name AS donor_name,
                    d.contact AS donor_phone,
                    d.location AS donor_city,
                    dl.latitude,
                    dl.longitude,
                    dl.updated_at,
                    br.hospital_latitude,
                    br.hospital_longitude,
                    br.location AS hospital_location
                FROM blood_requests br
                JOIN request_responses rr ON rr.request_id = br.id AND rr.status = 'Accepted'
                JOIN donors d ON d.donor_id = rr.donor_id
                LEFT JOIN donor_locations dl ON dl.donor_id = d.donor_id AND dl.request_id = br.id
                WHERE br.hospital_id = :hospital_id";

$acceptedParams = [':hospital_id' => $hospitalId];
if ($requestIdFilter > 0) {
    $acceptedSql .= ' AND br.id = :request_id';
    $acceptedParams[':request_id'] = $requestIdFilter;
}
$acceptedSql .= ' ORDER BY br.created_at DESC, dl.updated_at DESC';

$a = $pdo->prepare($acceptedSql);
$a->execute($acceptedParams);
$accepted = $a->fetchAll();

send_json([
    'hospital' => [
        'id' => (int)$hospital['hospital_id'],
        'name' => (string)$hospital['hospital_name'],
        'location' => (string)$hospital['location']
    ],
    'requests' => $requests,
    'acceptedDonors' => $accepted
]);
