-- Donor profile enhancement (DOB + address + last donation date)
ALTER TABLE donors ADD COLUMN IF NOT EXISTS dob DATE NULL;
ALTER TABLE donors ADD COLUMN IF NOT EXISTS last_donation_date DATE NULL;
ALTER TABLE donors ADD COLUMN IF NOT EXISTS address VARCHAR(255) NULL;
