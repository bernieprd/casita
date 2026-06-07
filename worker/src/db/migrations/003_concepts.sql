-- Per-household concept tables: recipe types, item categories, supermarkets, tags

CREATE TABLE IF NOT EXISTS household_recipe_types (
  id           TEXT NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (household_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS hrt_name ON household_recipe_types(household_id, name);

CREATE TABLE IF NOT EXISTS household_categories (
  id           TEXT NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (household_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS hc_name ON household_categories(household_id, name);

CREATE TABLE IF NOT EXISTS household_supermarkets (
  id           TEXT NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (household_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS hs_name ON household_supermarkets(household_id, name);

CREATE TABLE IF NOT EXISTS household_tags (
  id           TEXT NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (household_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS htag_name ON household_tags(household_id, name);
