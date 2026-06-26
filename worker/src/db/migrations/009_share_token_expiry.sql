-- Add expiry to recipe share tokens. NULL means the token was created before
-- this migration and is treated as never-expiring for backward compatibility.
-- New tokens generated after this migration will have a 30-day expiry (Unix ms).
ALTER TABLE recipes ADD COLUMN share_token_expires_at INTEGER;
