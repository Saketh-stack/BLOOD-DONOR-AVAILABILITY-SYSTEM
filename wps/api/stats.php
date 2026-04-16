<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['message' => 'Method not allowed.'], 405);
}

$totalStmt = $pdo->query('SELECT COUNT(*) AS totalDonors FROM donors');
$total = (int)$totalStmt->fetch()['totalDonors'];

$groupStmt = $pdo->query(
    'SELECT blood_group AS bloodGroup, COUNT(*) AS total
     FROM donors
     GROUP BY blood_group
     ORDER BY blood_group'
);

send_json([
    'totalDonors' => $total,
    'bloodGroups' => $groupStmt->fetchAll()
]);
