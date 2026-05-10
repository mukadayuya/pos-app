-- ================================================================
-- Kitchen Kazu POS — 完全セットアップ SQL（setup_full.sql）
-- Supabase Dashboard → SQL Editor で実行してください
--
-- このファイルは旧 setup.sql を置き換えます。
-- 既存テーブルがある場合も安全に実行できます（IF NOT EXISTS）。
-- ================================================================

-- ─── sales テーブル ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id           UUID        PRIMARY KEY,
  total_amount INTEGER     NOT NULL,
  items        JSONB       NOT NULL DEFAULT '[]',
  male_count   INTEGER     NOT NULL DEFAULT 0,
  female_count INTEGER     NOT NULL DEFAULT 0,
  staff_name   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 旧スキーマ（total列）からのマイグレーション
DO $$
BEGIN
  -- total 列があって total_amount がない場合、列をリネーム
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'total'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE sales RENAME COLUMN total TO total_amount;
  END IF;

  -- items 列が無ければ追加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'items'
  ) THEN
    ALTER TABLE sales ADD COLUMN items JSONB NOT NULL DEFAULT '[]';
  END IF;

  -- male_count 列が無ければ追加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'male_count'
  ) THEN
    ALTER TABLE sales ADD COLUMN male_count INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- female_count 列が無ければ追加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'female_count'
  ) THEN
    ALTER TABLE sales ADD COLUMN female_count INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- staff_name 列が無ければ追加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'staff_name'
  ) THEN
    ALTER TABLE sales ADD COLUMN staff_name TEXT;
  END IF;
END $$;

-- ─── categories テーブル ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL UNIQUE,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── menus テーブル ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menus (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  price       INTEGER     NOT NULL,
  category    TEXT        NOT NULL,
  emoji       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS（匿名キーでの読み書きを許可） ─────────────────────────
ALTER TABLE sales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus      ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sales'      AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON sales      FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON categories FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menus'      AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON menus      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── インデックス ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales      (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories (display_order);
CREATE INDEX IF NOT EXISTS idx_menus_category   ON menus      (category);

-- ─── デフォルトカテゴリー ────────────────────────────────────────
INSERT INTO categories (name, display_order) VALUES
  ('昼部',         0),
  ('夜部',         1),
  ('テイクアウト', 2)
ON CONFLICT (name) DO NOTHING;

-- ─── 確認クエリ ─────────────────────────────────────────────────
SELECT
  'sales'      AS "テーブル", COUNT(*) AS "レコード数" FROM sales
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'menus',      COUNT(*) FROM menus;
