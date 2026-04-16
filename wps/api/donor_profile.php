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

$stmt = $pdo->prepare(
    "SELECT donor_id, name, blood_group, contact, location, COALESCE(address, '') AS address, availability,
            DATE_FORMAT(dob, '%Y-%m-%d') AS dob,
            COALESCE(DATE_FORMAT(last_donation_date, '%Y-%m-%d'), '') AS lastDonation
     FROM donors
     WHERE donor_id = :id
     LIMIT 1"
);
$stmt->execute([':id' => $donorId]);
$donor = $stmt->fetch();

if (!$donor) {
    send_json(['message' => 'Donor not found.'], 404);
}

$age = null;
$eligible = true;
$daysRemaining = 0;
$nextEligibleDate = '';

if (!empty($donor['dob'])) {
    $dobDate = DateTime::createFromFormat('Y-m-d', (string)$donor['dob']);
    if ($dobDate) {
        $age = (int)$dobDate->diff(new DateTime('today'))->y;
    }
}

if (!empty($donor['lastDonation'])) {
    $lastDate = DateTime::createFromFormat('Y-m-d', (string)$donor['lastDonation']);
    if ($lastDate) {
        $nextDate = (clone $lastDate)->modify('+90 days');
        $today = new DateTime('today');
        $daysRemaining = max(0, (int)$today->diff($nextDate)->format('%r%a'));
        $eligible = $daysRemaining === 0;
        $nextEligibleDate = $nextDate->format('Y-m-d');
    }
}

send_json([
    'donor' => [
        'id' => (int)$donor['donor_id'],
        'name' => (string)$donor['name'],
        'bloodGroup' => (string)$donor['blood_group'],
        'phone' => (string)$donor['contact'],
        'city' => (string)$donor['location'],
        'address' => (string)$donor['address'],
        'availability' => (string)$donor['availability'],
        'dob' => (string)($donor['dob'] ?? ''),
        'age' => $age,
        'lastDonation' => (string)($donor['lastDonation'] ?? ''),
        'eligible' => $eligible,
        'daysRemaining' => $daysRemaining,
        'nextEligibleDate' => $nextEligibleDate
    ]
]);
