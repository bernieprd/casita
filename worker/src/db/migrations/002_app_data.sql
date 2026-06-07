-- ── Items (shopping list + pantry) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS items (
  id               TEXT PRIMARY KEY,           -- crypto.randomUUID()
  household_id     TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  category         TEXT,                        -- denormalized name
  on_shopping_list INTEGER NOT NULL DEFAULT 0, -- boolean
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

CREATE TABLE IF NOT EXISTS item_tags (
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (item_id, tag)
);

-- ── Recipes ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipes (
  id              TEXT PRIMARY KEY,
  household_id    TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT,
  day             TEXT,
  url             TEXT,
  cover_photo_url TEXT,
  share_token     TEXT UNIQUE,    -- replaces KV share:{token} → recipe_id
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS recipes_household   ON recipes(household_id);
CREATE INDEX IF NOT EXISTS recipes_share_token ON recipes(share_token);

-- Recipe instructions (replaces Notion block children)
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
  needs_shopping INTEGER NOT NULL DEFAULT 0,  -- boolean
  sort_order     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ri_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS ri_item   ON recipe_ingredients(item_id);

-- ── Todos ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS todos (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'Todo',
  priority     TEXT,
  due          TEXT,           -- ISO date string (YYYY-MM-DD), nullable
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS todos_household ON todos(household_id);
CREATE INDEX IF NOT EXISTS todos_due       ON todos(household_id, due);
