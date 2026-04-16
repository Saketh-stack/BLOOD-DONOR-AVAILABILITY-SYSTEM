<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['message' => 'Method not allowed.'], 405);
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    send_json(['message' => 'Invalid request body.'], 400);
}

$city = trim((string)($payload['city'] ?? ''));
$bloodGroup = trim((string)($payload['bloodGroup'] ?? ''));

if ($city === '') {
    send_json(['message' => 'Please provide location/city.'], 400);
}

$sql = "
    SELECT donor_id, name, contact
    FROM donors
    WHERE availability = 'Available'
      AND (last_donation_date IS NULL OR DATE_ADD(last_donation_date, INTERVAL 90 DAY) <= CURDATE())
      AND contact IS NOT NULL
      AND contact <> ''
";
$params = [];

if ($bloodGroup !== '') {
    $sql .= " AND blood_group = :blood_group";
    $params[':blood_group'] = $bloodGroup;
}

$sql .= " AND location LIKE :city";
$params[':city'] = '%' . $city . '%';

$findDonors = $pdo->prepare($sql);
$findDonors->execute($params);
$donors = $findDonors->fetchAll();

if (count($donors) === 0) {
    send_json(['message' => 'No available donors found for this location.'], 404);
}

$configFile = __DIR__ . '/notify.config.php';
$config = file_exists($configFile) ? (require $configFile) : [];

$provider = (string)($config['provider'] ?? '');
$twilioSid = (string)($config['twilio_sid'] ?? getenv('TWILIO_ACCOUNT_SID') ?: '');
$twilioToken = (string)($config['twilio_token'] ?? getenv('TWILIO_AUTH_TOKEN') ?: '');
$twilioFrom = (string)($config['twilio_from'] ?? getenv('TWILIO_FROM_NUMBER') ?: '');
$messagingServiceSid = (string)($config['twilio_messaging_service_sid'] ?? getenv('TWILIO_MESSAGING_SERVICE_SID') ?: '');

if ($provider !== 'twilio') {
    send_json(['message' => 'Set provider=twilio in api/notify.config.php'], 500);
}
if ($twilioSid === '' || $twilioToken === '' || ($twilioFrom === '' && $messagingServiceSid === '')) {
    send_json(['message' => 'Add Twilio SID, token, and Twilio number (or Messaging Service SID) in api/notify.config.php'], 500);
}

function to_india_e164(string $raw): string
{
    $digits = preg_replace('/\D+/', '', $raw) ?? '';
    if ($digits === '') {
        return '';
    }

    if (str_starts_with($digits, '91') && strlen($digits) === 12) {
        return '+' . $digits;
    }

    if (strlen($digits) === 10) {
        return '+91' . $digits;
    }

    if (str_starts_with($digits, '0') && strlen($digits) === 11) {
        return '+91' . substr($digits, 1);
    }

    return '+' . $digits;
}

function twilio_error(?string $responseBody, int $httpCode, string $curlError): string
{
    if ($curlError !== '') {
        return $curlError;
    }

    if (is_string($responseBody) && $responseBody !== '') {
        $parsed = json_decode($responseBody, true);
        if (is_array($parsed)) {
            $msg = (string)($parsed['message'] ?? '');
            $code = (string)($parsed['code'] ?? '');
            if ($msg !== '') {
                return 'Twilio HTTP ' . $httpCode . ': ' . $msg . ($code !== '' ? (' (code ' . $code . ')') : '');
            }
        }
    }

    return 'Twilio HTTP ' . $httpCode;
}

$messageText = 'Blood needed at location: ' . $city . '. Please contact immediately.';

$sent = [];
$failed = [];

foreach ($donors as $donor) {
    $to = to_india_e164((string)$donor['contact']);

    if (!preg_match('/^\+91\d{10}$/', $to)) {
        $failed[] = [
            'donor_id' => (int)$donor['donor_id'],
            'name' => $donor['name'],
            'phone' => (string)$donor['contact'],
            'error' => 'Phone must be Indian +91 format'
        ];
        continue;
    }

    $postFields = [
        'To' => $to,
        'Body' => $messageText
    ];

    if ($messagingServiceSid !== '') {
        $postFields['MessagingServiceSid'] = $messagingServiceSid;
    } else {
        $postFields['From'] = $twilioFrom;
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => "https://api.twilio.com/2010-04-01/Accounts/{$twilioSid}/Messages.json",
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => $twilioSid . ':' . $twilioToken,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_POSTFIELDS => http_build_query($postFields),
        CURLOPT_TIMEOUT => 20
    ]);

    $responseBody = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($responseBody !== false && $httpCode >= 200 && $httpCode < 300) {
        $sent[] = [
            'donor_id' => (int)$donor['donor_id'],
            'name' => $donor['name'],
            'phone' => $to
        ];
    } else {
        $failed[] = [
            'donor_id' => (int)$donor['donor_id'],
            'name' => $donor['name'],
            'phone' => $to,
            'error' => twilio_error(is_string($responseBody) ? $responseBody : null, $httpCode, $curlError)
        ];
    }
}

send_json([
    'message' => 'SOS SMS dispatch completed.',
    'provider' => 'twilio',
    'targeted' => count($donors),
    'sent_count' => count($sent),
    'failed_count' => count($failed),
    'sent' => $sent,
    'failed' => $failed
]);


