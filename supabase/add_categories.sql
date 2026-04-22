-- ================================================================
-- categories テーブル作成 + menus.category UUID 移行マイグレーション
-- Supabase Dashboard → SQL Editor に貼り付けて実行してください
-- ================================================================

-- ─── 1. categories テーブル（UUID主キー、DB自動生成）──────────
CREATE TABLE IF NOT EXISTS categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. RLS + ポリシー ────────────────────────────────────────
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE tablename = 'categories' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY "anon_all" ON categories FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_order ON categories (display_order);

-- ─── 3. 初期カテゴリーを挿入（name で重複チェック）────────────
INSERT INTO categories (name, display_order)
SELECT * FROM (VALUES
  ('昼部',         0),
  ('夜部',         1),
  ('テイクアウト', 2)
) AS v(name, disp)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE name = v.name
);

-- ─── 4. menus.category の TEXT スラグ → UUID に移行 ──────────
-- "lunch"  → 昼部 のUUID
UPDATE menus
SET    category = (SELECT id FROM categories WHERE name = '昼部'  LIMIT 1)
WHERE  category = 'lunch';

-- "dinner" → 夜部 のUUID
UPDATE menus
SET    category = (SELECT id FROM categories WHERE name = '夜部'  LIMIT 1)
WHERE  category = 'dinner';

-- "takeout" → テイクアウト のUUID
UPDATE menus
SET    category = (SELECT id FROM categories WHERE name = 'テイクアウト' LIMIT 1)
WHERE  category = 'takeout';

-- ─── 5. 結果確認 ─────────────────────────────────────────────
SELECT
  c.id,
  c.name,
  c.display_order,
  COUNT(m.id) AS menu_count
FROM       categories c
LEFT JOIN  menus       m ON m.category = c.id::text
GROUP BY   c.id, c.name, c.display_order
ORDER BY   c.display_order;
