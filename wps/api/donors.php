<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/schema.php';

ensure_support_tables($pdo);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['message' => 'Method not allowed.'], 405);
}

$bloodGroup = trim((string)($_GET['blood_group'] ?? ''));
$city = trim((string)($_GET['city'] ?? ''));
$availableOnly = isset($_GET['available_only']) && $_GET['available_only'] === '1';

$sql = "
    SELECT
        d.donor_id AS id,
        d.name,
        d.gender,
        d.blood_group AS bloodGroup,
        d.location AS city,
        COALESCE(d.address, '') AS address,
        d.contact AS phone,
        d.availability,
        DATE_FORMAT(d.dob, '%Y-%m-%d') AS dob,
        COALESCE(DATE_FORMAT(d.last_donation_date, '%Y-%m-%d'), '') AS lastDonation,
        TIMESTAMPDIFF(YEAR, d.dob, CURDATE()) AS age,
        CASE
            WHEN d.last_donation_date IS NULL THEN 1
            WHEN DATE_ADD(d.last_donation_date, INTERVAL 90 DAY) <= CURDATE() THEN 1
            ELSE 0
        END AS eligible,
        CASE
            WHEN d.last_donation_date IS NULL THEN 0
            WHEN DATE_ADD(d.last_donation_date, INTERVAL 90 DAY) <= CURDATE() THEN 0
            ELSE DATEDIFF(DATE_ADD(d.last_donation_date, INTERVAL 90 DAY), CURDATE())
        END AS daysRemaining,
        COALESCE(DATE_FORMAT(DATE_ADD(d.last_donation_date, INTERVAL 90 DAY), '%Y-%m-%d'), '') AS nextEligibleDate,
        'Bronze Donor' AS badge,
        10 AS points
    FROM donors d
    WHERE (:blood_group = '' OR d.blood_group = :blood_group)
      AND (:city = '' OR d.location LIKE :city_like)
";

if ($availableOnly) {
    $sql .= "
      AND d.availability = 'Available'
      AND (
        d.last_donation_date IS NULL
        OR DATE_ADD(d.last_donation_date, INTERVAL 90 DAY) <= CURDATE()
      )
    ";
}

$sql .= " ORDER BY d.donor_id DESC";

$statement = $pdo->prepare($sql);
$statement->execute([
    ':blood_group' => $bloodGroup,
    ':city' => $city,
    ':city_like' => '%' . $city . '%'
]);

$rows = $statement->fetchAll();
$donors = array_map(static function (array $row): array {
    return [
        'id' => (int)$row['id'],
        'name' => (string)$row['name'],
        'gender' => (string)($row['gender'] ?? ''),
        'bloodGroup' => (string)$row['bloodGroup'],
        'city' => (string)$row['city'],
        'address' => (string)($row['address'] ?? ''),
        'phone' => (string)$row['phone'],
        'availability' => (string)$row['availability'],
        'dob' => (string)($row['dob'] ?? ''),
        'age' => isset($row['age']) ? (int)$row['age'] : null,
        'lastDonation' => (string)($row['lastDonation'] ?? ''),
        'eligible' => ((int)($row['eligible'] ?? 0)) === 1,
        'daysRemaining' => (int)($row['daysRemaining'] ?? 0),
        'nextEligibleDate' => (string)($row['nextEligibleDate'] ?? ''),
        'badge' => (string)$row['badge'],
        'points' => (int)$row['points']
    ];
}, $rows);

send_json(['donors' => $donors]);
