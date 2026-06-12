-- categories.name の UNIQUE 制約を「店舗単位のユニーク」に変更する
--
-- 背景: setup_full.sql の `name TEXT NOT NULL UNIQUE` は全店舗共通の制約のため、
-- 複数店舗で同じカテゴリ名（例: サラダ）が使えない。
-- 焼鳥居酒屋ABC の追加時にこの制約に衝突した（2026-06-12）。
--
-- 実行方法: Supabase Dashboard → SQL Editor で実行
-- 実行後は scripts/setup_yakitori_abc_menu.mjs のカテゴリ名注記も不要になる。

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_store_name_unique'
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_store_name_unique UNIQUE (store_id, name);
  END IF;
END $$;
