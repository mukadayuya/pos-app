-- テイクアウト可否フラグをメニューテーブルに追加
-- Supabase Dashboard → SQL Editor で実行してください

ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS is_takeout_available BOOLEAN NOT NULL DEFAULT true;
