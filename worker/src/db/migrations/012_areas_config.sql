ALTER TABLE households ADD COLUMN areas_config TEXT DEFAULT NULL;
-- NULL means all areas enabled (backwards-compatible)
