<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['message' => 'Method not allowed.'], 405);
}

$configFile = __DIR__ . '/maps.config.php';
$config = file_exists($configFile) ? (require $configFile) : [];
$key = (string)($config['google_maps_api_key'] ?? '');

send_json([
    'googleMapsApiKey' => $key
]);
