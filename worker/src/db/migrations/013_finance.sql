CREATE TABLE IF NOT EXISTS finance_periods (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  start_date   TEXT NOT NULL,  -- YYYY-MM-DD
  end_date     TEXT NOT NULL,  -- YYYY-MM-DD
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fp_household ON finance_periods(household_id);
CREATE UNIQUE INDEX IF NOT EXISTS fp_unique ON finance_periods(household_id, start_date);

CREATE TABLE IF NOT EXISTS finance_income (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  period_id    TEXT NOT NULL REFERENCES finance_periods(id) ON DELETE CASCADE,
  source       TEXT NOT NULL,
  tag          TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fi_period ON finance_income(period_id);

CREATE TABLE IF NOT EXISTS finance_expenses (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  period_id    TEXT NOT NULL REFERENCES finance_periods(id) ON DELETE CASCADE,
  source       TEXT NOT NULL,
  tag          TEXT,
  type         TEXT NOT NULL DEFAULT 'personal',  -- 'shared' | 'personal'
  amount_cents INTEGER NOT NULL DEFAULT 0,
  budget_cents INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fe_period ON finance_expenses(period_id);
CREATE INDEX IF NOT EXISTS fe_user   ON finance_expenses(household_id, user_id);

CREATE TABLE IF NOT EXISTS finance_accounts (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  period_id    TEXT NOT NULL REFERENCES finance_periods(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  institution  TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  date         TEXT NOT NULL,  -- YYYY-MM-DD
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fa_period ON finance_accounts(period_id);
