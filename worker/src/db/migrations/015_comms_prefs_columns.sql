ALTER TABLE household_members ADD COLUMN email_notifications_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE household_members ADD COLUMN email_frequency TEXT NOT NULL DEFAULT 'instant';
