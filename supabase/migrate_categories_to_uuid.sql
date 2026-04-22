-- ================================================================
-- categories テーブルの完全リセット & UUID マイグレーション
-- 【これを Supabase Dashboard > SQL Editor で実行してください】
--
-- 実行内容：
--  1. 旧 categories テーブルを削除し UUID 型で再作成
--  2. menus.category を新しい UUID に更新
--  3. デフォルトカテゴリー（昼部/夜部/テイクアウト）を投入
-- ================================================================

BEGIN;

-- ─── Step 1: 旧テーブルのデータを一時保存 ──────────────────
CREATE TEMP TABLE _cat_old AS
  SELECT * FROM categories;

-- 各行に新しい UUID を割り当て
CREATE TEMP TABLE _cat_map AS
  SELECT
    old.id                   AS old_id,
    gen_random_uuid()        AS new_uuid,
    old.name                 AS name,
    old.display_order        AS display_order
  FROM _cat_old old;

-- ─── Step 2: menus.category を新 UUID に更新 ────────────────
UPDATE menus m
SET    category = cm.new_uuid::text
FROM   _cat_map cm
WHERE  m.category = cm.old_id;

-- 旧スラグが残っている場合も吸収
UPDATE menus SET category = (
  SELECT new_uuid::text FROM _cat_map WHERE name = '昼部'         LIMIT 1)
WHERE category IN ('lunch', 'ランチ');

UPDATE menus SET category = (
  SELECT new_uuid::text FROM _cat_map WHERE name = '夜部'         LIMIT 1)
WHERE category IN ('dinner', 'ディナー');

UPDATE menus SET category = (
  SELECT new_uuid::text FROM _cat_map WHERE name = 'テイクアウト' LIMIT 1)
WHERE category IN ('takeout', 'テイクアウト');

-- ─── Step 3: 旧テーブルを削除して UUID 型で再作成 ──────────
DROP TABLE categories;

CREATE TABLE categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL UNIQUE,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON categories
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_categories_order ON categories (display_order);

-- ─── Step 4: データを復元（マップした UUID で）──────────────
INSERT INTO categories (id, name, display_order)
  SELECT new_uuid, name, display_order FROM _cat_map;

-- ─── Step 5: デフォルトカテゴリーが無ければ追加 ─────────────
INSERT INTO categories (name, display_order)
SELECT name, display_order FROM (VALUES
  ('昼部',         0),
  ('夜部',         1),
  ('テイクアウト', 2)
) AS v(name, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.name = v.name
);

COMMIT;

-- ─── 確認クエリ ──────────────────────────────────────────────
SELECT
  c.id,
  c.name,
  c.display_order,
  COUNT(m.id) AS menu_count
FROM       categories  c
LEFT JOIN  menus       m ON m.category = c.id::text
GROUP BY   c.id, c.name, c.display_order
ORDER BY   c.display_order;
