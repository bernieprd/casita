ALTER TABLE todos ADD COLUMN frequency_interval INTEGER DEFAULT 1;
ALTER TABLE todos ADD COLUMN frequency_days TEXT;
UPDATE todos SET assigned_to = json_array(assigned_to) WHERE assigned_to IS NOT NULL AND assigned_to NOT LIKE '[%';
