ALTER TABLE household_members ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS hm_email ON household_members(email);
