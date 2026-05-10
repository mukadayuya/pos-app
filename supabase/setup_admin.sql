-- ================================================================
-- FLOWS POS — 管理者ダッシュボード セットアップ SQL
-- Supabase Dashboard → SQL Editor で実行してください
-- setup_full.sql を先に実行済みであることが前提です
-- ================================================================

-- ─── stores テーブル ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stores (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  location    TEXT,
  plan        TEXT        NOT NULL DEFAULT 'standard',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── employees テーブル ─────────────────────────────────────────
-- localStorage の EmployeeRecord と対応するスキーマ
CREATE TABLE IF NOT EXISTS employees (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID        REFERENCES stores(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  type          TEXT        NOT NULL DEFAULT 'parttime',  -- 'fulltime' | 'parttime'
  weekly_hours  TEXT,
  has_insurance BOOLEAN     NOT NULL DEFAULT false,
  joined_at     DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── sales テーブルに store_id カラムを追加 ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'store_id'
  ) THEN
    ALTER TABLE sales ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── RLS ────────────────────────────────────────────────────────
ALTER TABLE stores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stores'    AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON stores    FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON employees FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── インデックス ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stores_active     ON stores    (is_active);
CREATE INDEX IF NOT EXISTS idx_sales_store_id    ON sales     (store_id);
CREATE INDEX IF NOT EXISTS idx_employees_store   ON employees (store_id);
CREATE INDEX IF NOT EXISTS idx_employees_joined  ON employees (joined_at);

-- ─── Kitchen Kazu をデフォルト店舗として登録 ────────────────────
INSERT INTO stores (name, location, plan)
VALUES ('Kitchen Kazu', '東京都', 'pro')
ON CONFLICT DO NOTHING;

-- ─── 既存の売上データを Kitchen Kazu に紐付け ───────────────────
UPDATE sales
SET store_id = (SELECT id FROM stores WHERE name = 'Kitchen Kazu' LIMIT 1)
WHERE store_id IS NULL;

-- ─── 確認クエリ ──────────────────────────────────────────────────
SELECT
  s.name,
  s.location,
  s.plan,
  s.is_active,
  COUNT(sl.id) AS sales_count
FROM stores s
LEFT JOIN sales sl ON sl.store_id = s.id
GROUP BY s.id, s.name, s.location, s.plan, s.is_active
ORDER BY s.created_at;
