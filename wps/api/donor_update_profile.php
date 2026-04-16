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
$phone = trim((string)($payload['phone'] ?? ''));
$address = trim((string)($payload['address'] ?? ''));
$lastDonation = trim((string)($payload['lastDonation'] ?? ''));

if ($donorId <= 0 || $phone === '' || $lastDonation === '') {
    send_json(['message' => 'donorId, phone and last donation date are required.'], 400);
}

$digits = preg_replace('/\D+/', '', $phone) ?? '';
if (strlen($digits) < 10) {
    send_json(['message' => 'Please enter a valid phone number.'], 400);
}

$lastDonationDate = DateTime::createFromFormat('Y-m-d', $lastDonation);
if (!$lastDonationDate || $lastDonationDate->format('Y-m-d') !== $lastDonation) {
    send_json(['message' => 'Invalid last donation date.'], 400);
}

$today = new DateTime('today');
if ($lastDonationDate > $today) {
    send_json(['message' => 'Last donation date cannot be in the future.'], 400);
}

$profileStmt = $pdo->prepare('SELECT dob FROM donors WHERE donor_id = :id LIMIT 1');
$profileStmt->execute([':id' => $donorId]);
$existing = $profileStmt->fetch();
if (!$existing) {
    send_json(['message' => 'Donor not found.'], 404);
}

$age = null;
$dob = (string)($existing['dob'] ?? '');
if ($dob !== '') {
    $dobDate = DateTime::createFromFormat('Y-m-d', $dob);
    if ($dobDate) {
        $age = (int)$dobDate->diff($today)->y;
        if ($age < 18 || $age > 65) {
            send_json(['message' => 'Age must be between 18 and 65 years.'], 400);
        }
    }
}

$eligibilityDays = (int)$today->diff((clone $lastDonationDate)->modify('+90 days'))->format('%r%a');
$eligible = $eligibilityDays <= 0;
$availability = $eligible ? 'Available' : 'Not Available';

$update = $pdo->prepare(
    'UPDATE donors
     SET contact = :contact,
         address = :address,
         last_donation_date = :last_donation,
         availability = :availability
     WHERE donor_id = :id'
);

try {
    $update->execute([
        ':contact' => $phone,
        ':address' => $address === '' ? null : $address,
        ':last_donation' => $lastDonation,
        ':availability' => $availability,
        ':id' => $donorId
    ]);
} catch (PDOException $exception) {
    if ((int)($exception->errorInfo[1] ?? 0) === 1062) {
        send_json(['message' => 'Phone number already exists for another donor.'], 409);
    }
    send_json(['message' => 'Failed to update profile.'], 500);
}

$nextEligibleDate = (clone $lastDonationDate)->modify('+90 days')->format('Y-m-d');
$daysRemaining = max(0, $eligibilityDays);

send_json([
    'message' => 'Profile updated successfully.',
    'donor' => [
        'id' => $donorId,
        'phone' => $phone,
        'address' => $address,
        'dob' => $dob,
        'age' => $age,
        'lastDonation' => $lastDonation,
        'nextEligibleDate' => $nextEligibleDate,
        'daysRemaining' => $daysRemaining,
        'eligible' => $eligible,
        'availability' => $availability
    ]
]);
