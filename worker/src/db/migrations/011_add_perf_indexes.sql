-- Performance indexes to support batch supermarket lookups and JOIN-based concept queries.
CREATE INDEX IF NOT EXISTS hm_household_id  ON household_members(household_id);
CREATE INDEX IF NOT EXISTS is_item_id       ON item_supermarkets(item_id);
CREATE INDEX IF NOT EXISTS hs_household_id  ON household_supermarkets(household_id);
CREATE INDEX IF NOT EXISTS hrt_household_id ON household_recipe_types(household_id);
