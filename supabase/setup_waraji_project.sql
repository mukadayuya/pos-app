-- ================================================================
-- FLOWS POS 炭火やきとり笑路 専用Supabaseプロジェクト 統合セットアップSQL
-- Supabase Dashboard の SQL Editor に貼り付けて Run するだけ。
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

-- ─── categories テーブル ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── menus テーブル ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menus (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  price       INTEGER     NOT NULL,
  category    TEXT        NOT NULL,
  emoji       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
CREATE TABLE IF NOT EXISTS employees (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID        REFERENCES stores(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  type          TEXT        NOT NULL DEFAULT 'parttime',
  weekly_hours  TEXT,
  has_insurance BOOLEAN     NOT NULL DEFAULT false,
  joined_at     DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── store_settings テーブル ────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── option_templates テーブル ──────────────────────────────────
CREATE TABLE IF NOT EXISTS option_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  groups     JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── menus/categories に store_id カラム追加 ────────────────────
ALTER TABLE menus       ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'tetsu-bo';
ALTER TABLE categories  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'tetsu-bo';

-- ─── sales に store_id カラム（UUID型）追加 ─────────────────────
ALTER TABLE sales ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- ─── その他カラム追加 ──────────────────────────────────────────
ALTER TABLE menus ADD COLUMN IF NOT EXISTS is_takeout_available BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS options              JSONB;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS is_available         BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS display_order        INTEGER NOT NULL DEFAULT 999;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS name_en              TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS name_zh              TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS name_ko              TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS description          TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS description_en       TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS description_zh       TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS description_ko       TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS is_tax_inclusive     BOOLEAN DEFAULT false;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS image_url            TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS tax_rate             NUMERIC DEFAULT 0.10;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_zh TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_ko TEXT;

ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax8                INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax10               INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax                 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount            JSONB;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS item_discount_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method      TEXT NOT NULL DEFAULT 'cash';

-- ─── RLS 有効化 & anon_all ポリシー ─────────────────────────────
ALTER TABLE sales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus            ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees        ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sales'            AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON sales            FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories'       AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON categories       FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menus'            AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON menus            FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stores'           AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON stores           FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees'        AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON employees        FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'store_settings'   AND policyname = 'allow_all') THEN
    CREATE POLICY "allow_all" ON store_settings  FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'option_templates' AND policyname = 'allow_all') THEN
    CREATE POLICY "allow_all" ON option_templates FOR ALL USING (true) WITH CHECK (true); END IF;
END $$;

-- ─── インデックス ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_created_at            ON sales      (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_store_id              ON sales      (store_id);
CREATE INDEX IF NOT EXISTS idx_categories_order            ON categories (display_order);
CREATE INDEX IF NOT EXISTS idx_menus_category              ON menus      (category);
CREATE INDEX IF NOT EXISTS idx_menus_store_display_order   ON menus      (store_id, display_order);
CREATE INDEX IF NOT EXISTS idx_menus_store_available       ON menus      (store_id, is_available);
CREATE INDEX IF NOT EXISTS idx_stores_active               ON stores     (is_active);
CREATE INDEX IF NOT EXISTS idx_employees_store             ON employees  (store_id);

-- ─── categories.name の UNIQUE を店舗単位に ────────────────────
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_store_name_unique') THEN
    ALTER TABLE categories ADD CONSTRAINT categories_store_name_unique UNIQUE (store_id, name);
  END IF;
END $$;

-- ─── store_settings 初期値 ─────────────────────────────────────
INSERT INTO store_settings (key, value) VALUES ('is_takeout_enabled', 'true'::jsonb)     ON CONFLICT (key) DO NOTHING;
INSERT INTO store_settings (key, value) VALUES ('is_emoji_enabled',   'true'::jsonb)     ON CONFLICT (key) DO NOTHING;
INSERT INTO store_settings (key, value) VALUES (
  'available_emojis',
  '["🍢","🍗","🍺","🥃","🍚","🍙","🥗","🥟","🍜","🧀","🍟","🌶️","🥒","🌭","🐟","🍄","🥔","🧊","🍤","🐙","🍋","☕","🍵","🍹"]'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ─── 炭火やきとり 笑路 店舗を固定UUIDで登録 ─────────────────────
INSERT INTO stores (id, name, location, plan)
VALUES ('a1c2b3d4-e5f6-4789-abcd-ef1234567890', '炭火やきとり 笑路', '愛知県豊田市丸山町9丁目18', 'pro')
ON CONFLICT (id) DO NOTHING;

-- ─── 最終確認 ──────────────────────────────────────────────────
SELECT 'stores' AS tbl, COUNT(*) FROM stores
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'menus',      COUNT(*) FROM menus
UNION ALL SELECT 'sales',      COUNT(*) FROM sales;
