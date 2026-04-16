<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/schema.php';

ensure_support_tables($pdo);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['message' => 'Method not allowed.'], 405);
}

$donorStmt = $pdo->query(
    'SELECT donor_id, name, blood_group, contact, location, availability
     FROM donors
     ORDER BY donor_id DESC'
);
$donors = $donorStmt->fetchAll();

$requestStmt = $pdo->query(
    "SELECT
        r.request_id,
        r.blood_group,
        r.date,
        r.status,
        p.name AS patient_name,
        p.contact AS patient_phone,
        p.location,
        p.urgency_level,
        (
            SELECT COUNT(*)
            FROM chat_messages cm
            WHERE cm.request_id = r.request_id
        ) AS message_count
    FROM requests r
    JOIN patients p ON p.patient_id = r.patient_id
    ORDER BY
        CASE p.urgency_level
            WHEN 'High' THEN 1
            WHEN 'Medium' THEN 2
            ELSE 3
        END,
        r.request_id DESC"
);
$requests = $requestStmt->fetchAll();

$availabilitySummary = [
    'available' => 0,
    'notAvailable' => 0
];

$locationBuckets = [];

foreach ($donors as $donor) {
    if (($donor['availability'] ?? '') === 'Available') {
        $availabilitySummary['available']++;
    } else {
        $availabilitySummary['notAvailable']++;
    }

    $loc = trim((string)($donor['location'] ?? ''));
    if ($loc === '') {
        $loc = 'Unknown';
    }
    $locationBuckets[$loc] = ($locationBuckets[$loc] ?? 0) + 1;
}

arsort($locationBuckets);
$topLocations = array_slice($locationBuckets, 0, 8, true);

$requestSummary = [
    'pending' => 0,
    'fulfilled' => 0,
    'highUrgency' => 0
];

foreach ($requests as $request) {
    if (($request['status'] ?? '') === 'Pending') {
        $requestSummary['pending']++;
    } else {
        $requestSummary['fulfilled']++;
    }

    if (($request['urgency_level'] ?? '') === 'High') {
        $requestSummary['highUrgency']++;
    }
}

send_json([
    'donors' => $donors,
    'requests' => $requests,
    'summary' => [
        'totalDonors' => count($donors),
        'availability' => $availabilitySummary,
        'requests' => $requestSummary,
        'topLocations' => $topLocations
    ]
]);
