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

$phoneRaw = trim((string)($payload['phone'] ?? ''));
$bloodGroup = trim((string)($payload['bloodGroup'] ?? ''));

if ($phoneRaw === '' || $bloodGroup === '') {
    send_json(['message' => 'Please enter phone number and blood group.'], 400);
}

$validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
if (!in_array($bloodGroup, $validBloodGroups, true)) {
    send_json(['message' => 'Invalid blood group.'], 400);
}

$normalizedDigits = preg_replace('/\D+/', '', $phoneRaw) ?? '';
if ($normalizedDigits === '') {
    send_json(['message' => 'Invalid phone number.'], 400);
}

$phoneCandidates = array_values(array_unique([
    $phoneRaw,
    $normalizedDigits,
    '+' . $normalizedDigits,
    strlen($normalizedDigits) === 10 ? '+91' . $normalizedDigits : $normalizedDigits,
    strlen($normalizedDigits) === 10 ? '91' . $normalizedDigits : $normalizedDigits
]));

$placeholders = implode(',', array_fill(0, count($phoneCandidates), '?'));
$sql = "
    SELECT donor_id, name, gender, blood_group, contact, location, availability, dob, last_donation_date, address
    FROM donors
    WHERE blood_group = ?
      AND contact IN ($placeholders)
    LIMIT 1
";

$stmt = $pdo->prepare($sql);
$params = array_merge([$bloodGroup], $phoneCandidates);
$stmt->execute($params);
$donor = $stmt->fetch();

if (!$donor) {
    send_json(['message' => 'Login failed. Registered details do not match.'], 401);
}

$dob = (string)($donor['dob'] ?? '');
$lastDonation = (string)($donor['last_donation_date'] ?? '');

$age = null;
if ($dob !== '') {
    $dobDate = DateTime::createFromFormat('Y-m-d', $dob);
    if ($dobDate) {
        $age = (int)$dobDate->diff(new DateTime('today'))->y;
    }
}

$eligible = true;
$daysRemaining = 0;
$nextEligibleDate = '';
if ($lastDonation !== '') {
    $lastDate = DateTime::createFromFormat('Y-m-d', $lastDonation);
    if ($lastDate) {
        $nextDate = (clone $lastDate)->modify('+90 days');
        $today = new DateTime('today');
        $daysRemaining = max(0, (int)$today->diff($nextDate)->format('%r%a'));
        $eligible = $daysRemaining === 0;
        $nextEligibleDate = $nextDate->format('Y-m-d');
    }
}

$creditsStmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM donations WHERE donor_id = :id AND status = 'Completed'");
$creditsStmt->execute([':id' => (int)$donor['donor_id']]);
$completedDonations = (int)($creditsStmt->fetch()['cnt'] ?? 0);
$creditsEarned = $completedDonations * 10;

send_json([
    'message' => 'Login successful.',
    'donor' => [
        'id' => (int)$donor['donor_id'],
        'name' => (string)$donor['name'],
        'dob' => $dob,
        'age' => $age,
        'gender' => (string)($donor['gender'] ?? ''),
        'bloodGroup' => (string)$donor['blood_group'],
        'phone' => (string)$donor['contact'],
        'city' => (string)$donor['location'],
        'address' => (string)($donor['address'] ?? ''),
        'lastDonation' => $lastDonation,
        'nextEligibleDate' => $nextEligibleDate,
        'daysRemaining' => $daysRemaining,
        'eligible' => $eligible,
        'availability' => (string)$donor['availability'],
        'completedDonations' => $completedDonations,
        'creditsEarned' => $creditsEarned
    ]
]);
