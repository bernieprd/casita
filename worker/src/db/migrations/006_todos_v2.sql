-- Expand todos with new fields
ALTER TABLE todos ADD COLUMN category_id TEXT;
ALTER TABLE todos ADD COLUMN assigned_to TEXT;
ALTER TABLE todos ADD COLUMN url TEXT;
ALTER TABLE todos ADD COLUMN notes TEXT;
ALTER TABLE todos ADD COLUMN frequency TEXT;
ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Todo categories concept table (same structure as household_recipe_types)
CREATE TABLE IF NOT EXISTS household_todo_categories (
  id           TEXT NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (household_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS htc_name ON household_todo_categories(household_id, name);

-- Workflow mode per household
ALTER TABLE households ADD COLUMN todo_workflow TEXT NOT NULL DEFAULT 'simple';
