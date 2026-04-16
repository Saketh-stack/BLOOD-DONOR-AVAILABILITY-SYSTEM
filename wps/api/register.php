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

$name = trim((string)($payload['name'] ?? ''));
$dob = trim((string)($payload['dob'] ?? ''));
$gender = trim((string)($payload['gender'] ?? ''));
$bloodGroup = trim((string)($payload['bloodGroup'] ?? ''));
$city = trim((string)($payload['city'] ?? ''));
$address = trim((string)($payload['address'] ?? ''));
$phone = trim((string)($payload['phone'] ?? ''));
$lastDonation = trim((string)($payload['lastDonation'] ?? ''));
$availability = trim((string)($payload['availability'] ?? 'Available'));

$validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
$validAvailability = ['Available', 'Not Available'];
$validGenders = ['Male', 'Female', 'Other'];

if ($name === '' || $dob === '' || $gender === '' || $bloodGroup === '' || $city === '' || $phone === '' || $lastDonation === '') {
    send_json(['message' => 'Please fill all required fields.'], 400);
}

$dobDate = DateTime::createFromFormat('Y-m-d', $dob);
if (!$dobDate || $dobDate->format('Y-m-d') !== $dob) {
    send_json(['message' => 'Invalid date of birth.'], 400);
}

$today = new DateTime('today');
$age = (int)$dobDate->diff($today)->y;
if ($age < 18 || $age > 65) {
    send_json(['message' => 'Donor age must be between 18 and 65 years.'], 400);
}

if (!in_array($gender, $validGenders, true)) {
    send_json(['message' => 'Invalid gender value.'], 400);
}
if (!in_array($bloodGroup, $validBloodGroups, true)) {
    send_json(['message' => 'Invalid blood group.'], 400);
}
if (!in_array($availability, $validAvailability, true)) {
    send_json(['message' => 'Invalid availability value.'], 400);
}

$lastDonationDate = DateTime::createFromFormat('Y-m-d', $lastDonation);
if (!$lastDonationDate || $lastDonationDate->format('Y-m-d') !== $lastDonation) {
    send_json(['message' => 'Invalid last donation date.'], 400);
}
if ($lastDonationDate > $today) {
    send_json(['message' => 'Last donation date cannot be in the future.'], 400);
}

$digits = preg_replace('/\D+/', '', $phone) ?? '';
if (strlen($digits) < 10) {
    send_json(['message' => 'Invalid phone number.'], 400);
}

try {
    $pdo->beginTransaction();

    $insertDonor = $pdo->prepare(
        'INSERT INTO donors (name, age, gender, blood_group, contact, location, availability, dob, last_donation_date, address)
         VALUES (:name, NULL, :gender, :blood_group, :contact, :location, :availability, :dob, :last_donation_date, :address)'
    );
    $insertDonor->execute([
        ':name' => $name,
        ':gender' => $gender,
        ':blood_group' => $bloodGroup,
        ':contact' => $phone,
        ':location' => $city,
        ':availability' => $availability,
        ':dob' => $dob,
        ':last_donation_date' => $lastDonation,
        ':address' => $address === '' ? null : $address
    ]);

    $donorId = (int)$pdo->lastInsertId();

    $insertDonation = $pdo->prepare(
        "INSERT INTO donations (donor_id, patient_id, date, status)
         VALUES (:donor_id, NULL, :donation_date, 'Completed')"
    );
    $insertDonation->execute([
        ':donor_id' => $donorId,
        ':donation_date' => $lastDonation
    ]);

    $pdo->commit();

    $nextEligibleDate = (clone $lastDonationDate)->modify('+90 days')->format('Y-m-d');
    $daysRemaining = max(0, (int)$today->diff(new DateTime($nextEligibleDate))->format('%r%a'));
    $eligibleNow = $daysRemaining === 0;

    send_json([
        'message' => 'Donor registered successfully.',
        'donor' => [
            'id' => $donorId,
            'name' => $name,
            'dob' => $dob,
            'age' => $age,
            'gender' => $gender,
            'bloodGroup' => $bloodGroup,
            'city' => $city,
            'address' => $address,
            'phone' => $phone,
            'lastDonation' => $lastDonation,
            'nextEligibleDate' => $nextEligibleDate,
            'daysRemaining' => $daysRemaining,
            'eligible' => $eligibleNow,
            'availability' => $availability
        ]
    ], 201);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if ((int)($exception->errorInfo[1] ?? 0) === 1062) {
        send_json(['message' => 'A donor with this phone number already exists.'], 409);
    }

    send_json(['message' => 'Failed to register donor.'], 500);
}
