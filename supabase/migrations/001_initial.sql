-- Monolith initial schema
-- Tables: blocks, players, events

CREATE TABLE blocks (
  id TEXT PRIMARY KEY,
  layer INT NOT NULL,
  index INT NOT NULL,
  energy FLOAT DEFAULT 100,
  owner TEXT NOT NULL,
  owner_color TEXT,
  staked_amount INT DEFAULT 0,
  last_charge_time BIGINT,
  streak INT DEFAULT 0,
  last_streak_date TEXT,
  appearance JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_blocks_owner ON blocks(owner);

-- RLS: server uses service key (bypasses RLS), but enable for defense-in-depth
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE TABLE players (
  wallet TEXT PRIMARY KEY,
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  total_claims INT DEFAULT 0,
  total_charges INT DEFAULT 0,
  combo_best INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  block_id TEXT,
  wallet TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_created ON events(created_at DESC);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_wallet ON events(wallet);
CREATE INDEX idx_events_block_id ON events(block_id);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Allow anon/authenticated to read events (public activity feed)
CREATE POLICY events_read_policy ON events FOR SELECT TO anon, authenticated USING (true);

-- Allow anon/authenticated to read players (public leaderboard)
CREATE POLICY players_read_policy ON players FOR SELECT TO anon, authenticated USING (true);

-- Blocks are read-only for non-service roles
CREATE POLICY blocks_read_policy ON blocks FOR SELECT TO anon, authenticated USING (true);

-- Auto-delete old events (keep 30 days) via pg_cron or manual cleanup
-- For now, create a function that can be called periodically
CREATE OR REPLACE FUNCTION cleanup_old_events() RETURNS void AS $$
BEGIN
  DELETE FROM events WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
