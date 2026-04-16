<?php
declare(strict_types=1);

function ensure_support_tables(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS hospitals (
            hospital_id INT PRIMARY KEY AUTO_INCREMENT,
            hospital_name VARCHAR(120) NOT NULL,
            location VARCHAR(120) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_hospital_name_location (hospital_name, location)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    // Donor profile enhancement fields.
    $pdo->exec("ALTER TABLE donors ADD COLUMN IF NOT EXISTS dob DATE NULL");
    $pdo->exec("ALTER TABLE donors ADD COLUMN IF NOT EXISTS last_donation_date DATE NULL");
    $pdo->exec("ALTER TABLE donors ADD COLUMN IF NOT EXISTS address VARCHAR(255) NULL");

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS blood_requests (
            id INT PRIMARY KEY AUTO_INCREMENT,
            hospital_id INT NOT NULL,
            blood_group VARCHAR(5) NOT NULL,
            location VARCHAR(150) NOT NULL,
            urgency_level ENUM('High', 'Medium', 'Low') NOT NULL DEFAULT 'High',
            status ENUM('Open', 'Closed', 'Cancelled') NOT NULL DEFAULT 'Open',
            hospital_latitude DECIMAL(10,7) NULL,
            hospital_longitude DECIMAL(10,7) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS request_responses (
            id INT PRIMARY KEY AUTO_INCREMENT,
            request_id INT NOT NULL,
            donor_id INT NOT NULL,
            status ENUM('Pending', 'Accepted', 'Rejected') NOT NULL DEFAULT 'Pending',
            responded_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_request_donor (request_id, donor_id),
            FOREIGN KEY (request_id) REFERENCES blood_requests(id)
                ON DELETE CASCADE
                ON UPDATE CASCADE,
            FOREIGN KEY (donor_id) REFERENCES donors(donor_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS donor_locations (
            donor_id INT PRIMARY KEY,
            request_id INT NULL,
            latitude DECIMAL(10,7) NOT NULL,
            longitude DECIMAL(10,7) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (donor_id) REFERENCES donors(donor_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE,
            FOREIGN KEY (request_id) REFERENCES blood_requests(id)
                ON DELETE SET NULL
                ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS chat_messages (
            message_id INT PRIMARY KEY AUTO_INCREMENT,
            request_id INT NOT NULL,
            sender_role ENUM('patient','donor','hospital') NOT NULL,
            sender_name VARCHAR(80) NOT NULL,
            message TEXT NOT NULL,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (request_id) REFERENCES requests(request_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_chat_request ON chat_messages(request_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_chat_time ON chat_messages(sent_at)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_blood_requests_hospital ON blood_requests(hospital_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_requests(status)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_request_responses_donor ON request_responses(donor_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_request_responses_status ON request_responses(status)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_donor_locations_request ON donor_locations(request_id)");

    // Query speed indexes for donor search + eligibility filters.
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_donors_blood_avail_date ON donors(blood_group, availability, last_donation_date)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_donors_location ON donors(location)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_donors_contact ON donors(contact)");
}
