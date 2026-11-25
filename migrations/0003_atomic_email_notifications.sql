-- Atomic notification claims. The final-submit and inactivity paths share one
-- second-email slot so only one of them can send the second owner notification.
ALTER TABLE quotes ADD COLUMN first_email_claimed_at TEXT;
ALTER TABLE quotes ADD COLUMN second_email_claimed_at TEXT;
ALTER TABLE quotes ADD COLUMN second_email_sent_at TEXT;

-- Preserve already-recorded second notifications from earlier deployments.
UPDATE quotes
SET second_email_sent_at = COALESCE(final_email_sent_at, inactivity_email_sent_at)
WHERE second_email_sent_at IS NULL
  AND (final_email_sent_at IS NOT NULL OR inactivity_email_sent_at IS NOT NULL);
