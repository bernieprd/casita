CREATE TABLE IF NOT EXISTS households (
  id          TEXT PRIMARY KEY,    -- crypto.randomUUID()
  name        TEXT NOT NULL,
  invite_code TEXT UNIQUE,         -- nullable = invites disabled
  created_at  INTEGER NOT NULL     -- Unix ms
);

CREATE TABLE IF NOT EXISTS household_members (
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,     -- Clerk's user ID (e.g. "user_2abc...")
  role          TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  joined_at     INTEGER NOT NULL,
  PRIMARY KEY (household_id, clerk_user_id)
);
CREATE INDEX IF NOT EXISTS hm_clerk_user_id ON household_members(clerk_user_id);

-- Replaces hardcoded env.NOTION_*_DB vars; one row per household
CREATE TABLE IF NOT EXISTS household_notion_config (
  household_id         TEXT PRIMARY KEY REFERENCES households(id),
  shopping_list_db     TEXT NOT NULL,
  recipes_db           TEXT NOT NULL,
  recipe_ingredient_db TEXT NOT NULL,
  todos_db             TEXT NOT NULL
);

-- Seed (run after both users log in once and you have their Clerk user IDs):
-- INSERT INTO households VALUES ('hh-home', 'Home', NULL, unixepoch() * 1000);
-- INSERT INTO household_notion_config VALUES ('hh-home', '<shopping_db>', '<recipes_db>', '<ingredient_db>', '<todos_db>');
-- INSERT INTO household_members VALUES ('hh-home', '<bernardo_clerk_id>', 'owner', unixepoch() * 1000);
-- INSERT INTO household_members VALUES ('hh-home', '<cesar_clerk_id>', 'member', unixepoch() * 1000);
