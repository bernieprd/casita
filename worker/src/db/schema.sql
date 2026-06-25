CREATE TABLE IF NOT EXISTS households (
  id          TEXT PRIMARY KEY,    -- crypto.randomUUID()
  name        TEXT NOT NULL,
  invite_code   TEXT UNIQUE,         -- nullable = invites disabled
  created_at    INTEGER NOT NULL,    -- Unix ms
  todo_workflow TEXT NOT NULL DEFAULT 'simple',
  areas_config  TEXT DEFAULT NULL    -- JSON; NULL means all areas enabled (backwards-compatible)
);

CREATE TABLE IF NOT EXISTS household_members (
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,     -- Clerk's user ID (e.g. "user_2abc...")
  role          TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  email         TEXT,
  joined_at     INTEGER NOT NULL,
  locale        TEXT NOT NULL DEFAULT 'en',
  tab_config         TEXT DEFAULT NULL,        -- JSON TabConfig; NULL → default pinned tabs
  PRIMARY KEY (household_id, clerk_user_id)
);
CREATE INDEX IF NOT EXISTS hm_clerk_user_id ON household_members(clerk_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS hm_unique_user ON household_members(clerk_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS hm_email ON household_members(email);
CREATE INDEX IF NOT EXISTS hm_household_id  ON household_members(household_id);

CREATE TABLE IF NOT EXISTS user_comms_prefs (
  clerk_user_id               TEXT PRIMARY KEY,
  email_notifications_enabled INTEGER NOT NULL DEFAULT 1,
  email_frequency             TEXT NOT NULL DEFAULT 'instant',
  unsubscribe_token           TEXT
);

-- Seed (run after both users log in once and you have their Clerk user IDs):
-- INSERT INTO households VALUES ('hh-home', 'Home', NULL, unixepoch() * 1000);
-- INSERT INTO household_members VALUES ('hh-home', '<bernardo_clerk_id>', 'owner', unixepoch() * 1000);
-- INSERT INTO household_members VALUES ('hh-home', '<cesar_clerk_id>', 'member', unixepoch() * 1000);

-- ── Items (shopping list + pantry) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS items (
  id               TEXT PRIMARY KEY,
  household_id     TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  category         TEXT,
  on_shopping_list INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS items_household ON items(household_id);
CREATE INDEX IF NOT EXISTS items_shopping  ON items(household_id, on_shopping_list);

CREATE TABLE IF NOT EXISTS item_supermarkets (
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  supermarket TEXT NOT NULL,
  PRIMARY KEY (item_id, supermarket)
);
CREATE INDEX IF NOT EXISTS is_item_id ON item_supermarkets(item_id);

-- ── Recipes ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipes (
  id              TEXT PRIMARY KEY,
  household_id    TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT,
  day             TEXT,
  url             TEXT,
  cover_photo_url TEXT,
  share_token            TEXT UNIQUE,
  share_token_expires_at INTEGER,         -- Unix ms; NULL = legacy token (no expiry)
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS recipes_household   ON recipes(household_id);
CREATE INDEX IF NOT EXISTS recipes_share_token ON recipes(share_token);

CREATE TABLE IF NOT EXISTS recipe_blocks (
  id         TEXT PRIMARY KEY,
  recipe_id  TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'paragraph',
  text       TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS recipe_blocks_recipe ON recipe_blocks(recipe_id, sort_order);

-- ── Recipe Ingredients ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id             TEXT PRIMARY KEY,
  household_id   TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id      TEXT NOT NULL REFERENCES recipes(id)   ON DELETE CASCADE,
  item_id        TEXT NOT NULL REFERENCES items(id),
  quantity       TEXT,
  section        TEXT,
  needs_shopping INTEGER NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ri_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS ri_item   ON recipe_ingredients(item_id);

-- ── Concept lists (per household) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS household_recipe_types (
  id           TEXT NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (household_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS hrt_name        ON household_recipe_types(household_id, name);
CREATE INDEX IF NOT EXISTS hrt_household_id ON household_recipe_types(household_id);

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
CREATE UNIQUE INDEX IF NOT EXISTS hs_name        ON household_supermarkets(household_id, name);
CREATE INDEX IF NOT EXISTS hs_household_id  ON household_supermarkets(household_id);

-- ── Todos ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS todos (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'Todo',
  priority     TEXT,
  due          TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  category_id  TEXT,
  assigned_to  TEXT,                          -- JSON array of clerkUserIds
  url          TEXT,
  notes        TEXT,
  frequency    TEXT,
  frequency_interval INTEGER DEFAULT 1,
  frequency_days     TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS todos_household ON todos(household_id);
CREATE INDEX IF NOT EXISTS todos_due       ON todos(household_id, due);

CREATE TABLE IF NOT EXISTS household_todo_categories (
  id           TEXT NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (household_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS htc_name ON household_todo_categories(household_id, name);
