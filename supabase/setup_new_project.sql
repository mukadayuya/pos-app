-- ================================================================
-- FLOWS POS 新規Supabaseプロジェクト用 統合セットアップSQL（堅牢版）
-- 焼鳥居酒屋ABC 専用プロジェクト（案B）
-- Supabase Dashboard の SQL Editor に貼り付けて Run するだけ。
-- 破壊的な migrate_categories_to_uuid.sql は意図的に除外している。
-- ================================================================

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
-- menus と categories に store_id カラムを追加
-- 既存データは全て 'tetsu-bo'（旧URL）として扱う

ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'tetsu-bo';

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'tetsu-bo';

-- 既存データに store_id を明示的にセット
UPDATE menus SET store_id = 'tetsu-bo' WHERE store_id = 'tetsu-bo';
UPDATE categories SET store_id = 'tetsu-bo' WHERE store_id = 'tetsu-bo';
-- ================================================================
-- sales テーブルに store_id カラムを追加（マルチストア対応）
-- Supabase Dashboard → SQL Editor で実行してください
-- ================================================================

-- store_id カラムを追加（既存レコードは kitchen-wa として扱う）
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'kitchen-wa';

-- インデックス追加（ストア別クエリを高速化）
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON sales (store_id, created_at DESC);

-- ================================================================
-- get_yearly_summary 関数を store_id 対応に更新
-- ================================================================
CREATE OR REPLACE FUNCTION get_yearly_summary(p_year INT, p_store_id TEXT DEFAULT 'kitchen-wa')
RETURNS TABLE (
  month     INT,
  total_rev BIGINT,
  cnt       BIGINT,
  guests    BIGINT,
  rev_10    BIGINT,
  rev_8     BIGINT
) LANGUAGE sql STABLE AS $$
  WITH sale_items AS (
    SELECT
      s.id,
      EXTRACT(MONTH FROM s.created_at AT TIME ZONE 'Asia/Tokyo')::INT AS mo,
      s.total_amount,
      COALESCE(s.male_count, 0) + COALESCE(s.female_count, 0) AS g,
      COALESCE(SUM(CASE
        WHEN (it->>'tax_rate')::FLOAT >= 0.09
        THEN ROUND((it->>'unit_price')::NUMERIC
               * COALESCE((it->>'quantity')::NUMERIC, 1) * 1.10)
        ELSE 0 END), 0) AS r10,
      COALESCE(SUM(CASE
        WHEN (it->>'tax_rate')::FLOAT < 0.09
        THEN ROUND((it->>'unit_price')::NUMERIC
               * COALESCE((it->>'quantity')::NUMERIC, 1) * 1.08)
        ELSE 0 END), 0) AS r8
    FROM sales s
    LEFT JOIN LATERAL jsonb_array_elements(s.items) AS it ON true
    WHERE EXTRACT(YEAR FROM s.created_at AT TIME ZONE 'Asia/Tokyo') = p_year
      AND s.store_id::text = p_store_id
    GROUP BY s.id, mo, s.total_amount, g
  )
  SELECT
    mo                        AS month,
    SUM(total_amount)::BIGINT AS total_rev,
    COUNT(*)::BIGINT          AS cnt,
    SUM(g)::BIGINT            AS guests,
    SUM(r10)::BIGINT          AS rev_10,
    SUM(r8)::BIGINT           AS rev_8
  FROM sale_items
  GROUP BY mo
  ORDER BY mo;
$$;

GRANT EXECUTE ON FUNCTION get_yearly_summary(INT, TEXT) TO anon, authenticated;

-- 確認
SELECT store_id, COUNT(*) AS 件数, SUM(total_amount) AS 売上合計
FROM sales
GROUP BY store_id
ORDER BY store_id;
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
-- store_settings: 店舗機能フラグ（マスタースイッチ）
-- localStorage を primary として使用。このテーブルは将来的な多端末同期用。
CREATE TABLE IF NOT EXISTS store_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- テイクアウト機能のデフォルト値を投入（既存行があればスキップ）
INSERT INTO store_settings (key, value)
VALUES ('is_takeout_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- RLS: 全ロール読み書き可（将来的にオーナーロール制限を追加する場合はここを修正）
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON store_settings FOR ALL USING (true) WITH CHECK (true);
-- テイクアウト可否フラグをメニューテーブルに追加
-- Supabase Dashboard → SQL Editor で実行してください

ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS is_takeout_available BOOLEAN NOT NULL DEFAULT true;
-- 税区分内訳カラムを sales テーブルに追加
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax8  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax10 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax   INTEGER NOT NULL DEFAULT 0;
-- sales テーブルに割引カラムを追加
-- discount_amount: 割引後の差額（円単位の整数）
-- discount:        割引の詳細（type / value / inclusive）を JSONB で保持

ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount JSONB;

-- 確認クエリ
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name IN ('discount_amount', 'discount')
ORDER BY column_name;
-- 商品別割引合計カラムを sales テーブルに追加
ALTER TABLE sales ADD COLUMN IF NOT EXISTS item_discount_total INTEGER NOT NULL DEFAULT 0;
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
-- オプションテンプレートテーブル
-- Supabase Dashboard → SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS option_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  groups     JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE option_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON option_templates
  FOR ALL USING (true) WITH CHECK (true);
-- sales テーブルに payment_method カラムを追加（既存の場合はスキップ）
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash';

-- 確認クエリ
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'payment_method';
-- 絵文字設定を store_settings に追加
-- store_settings テーブルが存在している前提（add_store_settings.sql 実行済み）

INSERT INTO store_settings (key, value, updated_at)
VALUES ('is_emoji_enabled', 'true'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO store_settings (key, value, updated_at)
VALUES (
  'available_emojis',
  '["🍔","🍕","🍜","🍣","🍱","🥗","🍗","🍟","🍰","🍦","🍮","🎂","☕","🥤","🍺","🍵","🫖","🍊","🧃","🍶","🥩","🍛","🍝","🫕"]'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;
-- 年別月次サマリー取得関数（年別売上タブ用）
-- fetchYearOrders の limit(5000) を回避し、全件を正確に集計する。
-- Supabase Dashboard → SQL Editor で実行してください。

CREATE OR REPLACE FUNCTION get_yearly_summary(p_year INT)
RETURNS TABLE (
  month     INT,
  total_rev BIGINT,
  cnt       BIGINT,
  guests    BIGINT,
  rev_10    BIGINT,
  rev_8     BIGINT
) LANGUAGE sql STABLE AS $$
  WITH sale_items AS (
    SELECT
      s.id,
      EXTRACT(MONTH FROM s.created_at AT TIME ZONE 'Asia/Tokyo')::INT AS mo,
      s.total_amount,
      COALESCE(s.male_count, 0) + COALESCE(s.female_count, 0) AS g,
      COALESCE(SUM(CASE
        WHEN (it->>'tax_rate')::FLOAT >= 0.09
        THEN ROUND((it->>'unit_price')::NUMERIC
               * COALESCE((it->>'quantity')::NUMERIC, 1) * 1.10)
        ELSE 0 END), 0) AS r10,
      COALESCE(SUM(CASE
        WHEN (it->>'tax_rate')::FLOAT < 0.09
        THEN ROUND((it->>'unit_price')::NUMERIC
               * COALESCE((it->>'quantity')::NUMERIC, 1) * 1.08)
        ELSE 0 END), 0) AS r8
    FROM sales s
    LEFT JOIN LATERAL jsonb_array_elements(s.items) AS it ON true
    WHERE EXTRACT(YEAR FROM s.created_at AT TIME ZONE 'Asia/Tokyo') = p_year
    GROUP BY s.id, mo, s.total_amount, g
  )
  SELECT
    mo                    AS month,
    SUM(total_amount)::BIGINT AS total_rev,
    COUNT(*)::BIGINT      AS cnt,
    SUM(g)::BIGINT        AS guests,
    SUM(r10)::BIGINT      AS rev_10,
    SUM(r8)::BIGINT       AS rev_8
  FROM sale_items
  GROUP BY mo
  ORDER BY mo;
$$;

GRANT EXECUTE ON FUNCTION get_yearly_summary(INT) TO anon, authenticated;
-- store_settings スキーマ修正 & 設定行の初期化
-- 実行タイミング: Supabase Dashboard でテーブルを再作成・リセットした後に実行する
--
-- このスクリプトは以下を行います：
--   1. key カラムに UNIQUE 制約がなければ追加（id UUID PRIMARY KEY + key TEXT のスキーマに対応）
--   2. 必要な設定行を確保（存在しなければ INSERT、存在すれば何もしない）

DO $$
BEGIN
  -- key カラムへの UNIQUE 制約を追加（既存なら無視）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_name      = 'store_settings'
      AND ccu.column_name    = 'key'
  ) THEN
    ALTER TABLE store_settings ADD CONSTRAINT store_settings_key_unique UNIQUE (key);
    RAISE NOTICE 'UNIQUE 制約を key カラムに追加しました';
  ELSE
    RAISE NOTICE 'UNIQUE 制約は既に存在します（スキップ）';
  END IF;
END $$;

-- 設定行を確保（UNIQUE 制約追加後）
INSERT INTO store_settings (key, value)
VALUES ('is_takeout_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO store_settings (key, value)
VALUES ('is_emoji_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO store_settings (key, value)
VALUES (
  'available_emojis',
  '["🍔","🍕","🍜","🍣","🍱","🥗","🍗","🍟","🍰","🍦","🍮","🎂","☕","🥤","🍺","🍵","🫖","🍊","🧃","🍶","🥩","🍛","🍝","🫕"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
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
-- 目的: メニュー管理UI強化（Phase 1-②）
-- 追加カラム:
--   is_available    ... 販売可否フラグ（売り切れ表示に使用）
--   display_order   ... 表示順（オーナーが並び替え可能）
-- 実行タイミング: Supabase Dashboard の SQL Editor で一度だけ実行

BEGIN;

ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 999;

-- 既存メニューにストア毎の連番を初期割当（display_orderがすべて999だと並び替えできないため）
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY created_at) AS seq
  FROM public.menus
)
UPDATE public.menus m
SET display_order = numbered.seq
FROM numbered
WHERE m.id = numbered.id;

-- パフォーマンス: 店舗別に並び順で引くクエリを高速化
CREATE INDEX IF NOT EXISTS idx_menus_store_display_order
  ON public.menus (store_id, display_order);

CREATE INDEX IF NOT EXISTS idx_menus_store_available
  ON public.menus (store_id, is_available);

COMMIT;

-- ================================================================
-- 追加カラムの明示保証（旧プロジェクトで手動追加されていた分）
-- これが無いとメニュー投入スクリプトの多言語フィールドが失敗する
-- ================================================================
ALTER TABLE menus ADD COLUMN IF NOT EXISTS name_en          TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS name_zh          TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS name_ko          TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS description      TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS description_en   TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS description_zh   TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS description_ko   TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS is_tax_inclusive BOOLEAN DEFAULT false;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS image_url        TEXT;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_zh TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_ko TEXT;

-- menus.emoji の NOT NULL 制約を緩める（絵文字なしメニューでも投入可に）
ALTER TABLE menus ALTER COLUMN emoji DROP NOT NULL;

-- ================================================================
-- 焼鳥居酒屋ABC 店舗を固定UUIDで登録
-- （categories/menus/sales が参照する store_id と一致させる）
-- ================================================================
INSERT INTO stores (id, name, location, plan)
VALUES ('6f0842d5-7fe6-4278-818c-86e8a8731130', '焼鳥居酒屋ABC', '東京都新宿区', 'pro')
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 最終確認
-- ================================================================
SELECT 'stores' AS tbl, COUNT(*) FROM stores
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'menus', COUNT(*) FROM menus
UNION ALL SELECT 'sales', COUNT(*) FROM sales;
