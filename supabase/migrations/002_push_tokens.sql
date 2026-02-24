-- Push notification tokens for players
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL REFERENCES players(wallet) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_tokens_wallet ON push_tokens(wallet);

-- RLS: service role only (server manages tokens)
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Notification log to prevent spam (loose throttle)
CREATE TABLE notification_log (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_log_wallet_type ON notification_log(wallet, notification_type, created_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Cleanup old notification logs (keep 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_notification_logs() RETURNS void AS $$
BEGIN
  DELETE FROM notification_log WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
