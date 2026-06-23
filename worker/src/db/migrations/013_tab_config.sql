ALTER TABLE household_members ADD COLUMN tab_config TEXT DEFAULT NULL;
-- NULL → default pinned tabs: ['calendar', 'todos', 'shopping']
