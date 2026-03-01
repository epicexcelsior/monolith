-- Add evolution system columns to blocks table
-- total_charges: cumulative charge count (drives evolution tier)
-- best_streak: all-time best streak (never decreases, gates higher tiers)
-- evolution_tier: denormalized 0-4 (Spark, Ember, Flame, Blaze, Beacon)

ALTER TABLE blocks ADD COLUMN IF NOT EXISTS total_charges INT DEFAULT 0;
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS best_streak INT DEFAULT 0;
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS evolution_tier INT DEFAULT 0;
