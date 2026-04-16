<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/schema.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['message' => 'Method not allowed.'], 405);
}

ensure_support_tables($pdo);

try {
    $pdo->beginTransaction();
    $pdo->exec('DELETE FROM chat_messages');
    $pdo->exec('DELETE FROM donations');
    $pdo->exec('DELETE FROM requests');
    $pdo->exec('DELETE FROM patients');
    $pdo->exec('DELETE FROM donors');
    $pdo->commit();
    send_json(['message' => 'All records cleared successfully.']);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    send_json(['message' => 'Failed to clear records.'], 500);
}
