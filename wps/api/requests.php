<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['message' => 'Method not allowed.'], 405);
}

$bloodGroup = trim((string)($_GET['blood_group'] ?? ''));

$sql = "SELECT
            r.request_id,
            r.blood_group,
            r.date,
            r.status,
            p.name AS patient_name,
            p.contact AS patient_phone,
            p.location,
            p.urgency_level
        FROM requests r
        JOIN patients p ON p.patient_id = r.patient_id
        WHERE r.status = 'Pending'";

$params = [];
if ($bloodGroup !== '') {
    $sql .= ' AND r.blood_group = :blood_group';
    $params[':blood_group'] = $bloodGroup;
}

$sql .= " ORDER BY
            CASE p.urgency_level
                WHEN 'High' THEN 1
                WHEN 'Medium' THEN 2
                ELSE 3
            END,
            r.request_id DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);

send_json(['requests' => $stmt->fetchAll()]);
