-- Blood Donor Live Request + Tracking Tables
CREATE TABLE IF NOT EXISTS blood_requests (
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
);

CREATE TABLE IF NOT EXISTS request_responses (
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
);

CREATE TABLE IF NOT EXISTS donor_locations (
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
);
