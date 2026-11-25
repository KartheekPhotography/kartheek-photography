-- Server-side 10-minute inactivity follow-up state.
ALTER TABLE quotes ADD COLUMN last_activity_at TEXT;
ALTER TABLE quotes ADD COLUMN inactivity_email_claimed_at TEXT;
ALTER TABLE quotes ADD COLUMN inactivity_email_sent_at TEXT;

-- Existing records start their inactivity window from their last known update.
UPDATE quotes SET last_activity_at = updated_at WHERE last_activity_at IS NULL;
ALTER TABLE quotes ADD COLUMN first_email_sent_at TEXT;
ALTER TABLE quotes ADD COLUMN final_email_sent_at TEXT;
