-- Waitlist for landing page signups
CREATE TABLE waitlist (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  referral_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow anonymous inserts (landing page uses anon key)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" ON waitlist
  FOR INSERT
  WITH CHECK (true);

-- No SELECT/UPDATE/DELETE for anon — only service role can read
