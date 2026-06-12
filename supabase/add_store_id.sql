-- menus と categories に store_id カラムを追加
-- 既存データは全て 'tetsu-bo'（旧URL）として扱う

ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'tetsu-bo';

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'tetsu-bo';

-- 既存データに store_id を明示的にセット
UPDATE menus SET store_id = 'tetsu-bo' WHERE store_id = 'tetsu-bo';
UPDATE categories SET store_id = 'tetsu-bo' WHERE store_id = 'tetsu-bo';
