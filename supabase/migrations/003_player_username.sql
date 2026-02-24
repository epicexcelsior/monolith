-- Add username column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_username ON players(username) WHERE username IS NOT NULL;
