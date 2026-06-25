CREATE TABLE IF NOT EXISTS user_comms_prefs (
  clerk_user_id               TEXT PRIMARY KEY,
  email_notifications_enabled INTEGER NOT NULL DEFAULT 1,
  email_frequency             TEXT NOT NULL DEFAULT 'instant',
  unsubscribe_token           TEXT
);

-- Copy existing preferences from household_members.
-- One-to-one: hm_unique_user enforces a single row per clerk_user_id.
INSERT INTO user_comms_prefs (clerk_user_id, email_notifications_enabled, email_frequency, unsubscribe_token)
SELECT clerk_user_id, email_notifications_enabled, email_frequency, unsubscribe_token
FROM household_members;

ALTER TABLE household_members DROP COLUMN unsubscribe_token;
ALTER TABLE household_members DROP COLUMN email_notifications_enabled;
ALTER TABLE household_members DROP COLUMN email_frequency;
