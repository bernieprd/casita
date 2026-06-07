-- Remove duplicate rows, keeping the earliest entry per user
DELETE FROM household_members
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM household_members GROUP BY clerk_user_id
);

-- Enforce one household per user going forward
CREATE UNIQUE INDEX IF NOT EXISTS hm_unique_user ON household_members(clerk_user_id);
