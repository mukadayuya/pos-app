-- Add options JSONB column to menus table for per-item option price settings
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS options JSONB DEFAULT NULL;

-- Example options structure:
-- {
--   "riceSize": { "none": 0, "small": -20, "regular": 0, "large": 50, "extra": 100 },
--   "riceType": { "white": 0, "mochi": 50 }
-- }
-- Values are tax-inclusive yen deltas (税込差額).
-- null or missing column = use app defaults (small: -20, extra: +80, others: 0).
