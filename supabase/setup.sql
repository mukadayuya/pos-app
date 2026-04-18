-- kitchenkazu POSレジ — Supabase スキーマ
-- Supabaseダッシュボード → SQL Editor にてこのファイルを実行してください

-- ─── 売上テーブル ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id          UUID        PRIMARY KEY,
  total       INTEGER     NOT NULL,
  subtotal    INTEGER     NOT NULL,
  tax         INTEGER     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id          UUID    NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  menu_item_id     TEXT    NOT NULL,
  menu_item_name   TEXT    NOT NULL,
  menu_item_emoji  TEXT    NOT NULL,
  category         TEXT    NOT NULL,
  quantity         INTEGER NOT NULL,
  unit_price       INTEGER NOT NULL,
  rice_type        TEXT    NOT NULL,
  rice_size        TEXT    NOT NULL
);

-- ─── メニューテーブル ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS menus (
  id         TEXT        PRIMARY KEY,
  name       TEXT        NOT NULL,
  price      INTEGER     NOT NULL,
  category   TEXT        NOT NULL,
  emoji      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS（デモ用：匿名キーでの読み書きを許可）─────────────
ALTER TABLE sales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON sales      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON menus      FOR ALL USING (true) WITH CHECK (true);

-- ─── インデックス ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_created_at   ON sales      (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id  ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_menus_category      ON menus      (category);

-- ─── デフォルトメニューのシードデータ ─────────────────────
INSERT INTO menus (id, name, price, category, emoji) VALUES
  ('l1', 'トンヒレカツと飛騨牛コロッケの合盛り', 930, 'lunch',  '🍱'),
  ('l2', 'ハマチの酢豚風',                       930, 'lunch',  '🐟'),
  ('l3', '豚肉となすのこうじ味噌焼き丼',           930, 'lunch',  '🍚'),
  ('d1', 'チキンカツ',                            1150, 'dinner', '🍗'),
  ('d2', 'シーフードミックスフライ',               1150, 'dinner', '🦐'),
  ('d3', 'ゴーヤーチャンプルー',                  1150, 'dinner', '🥬'),
  ('d4', '豚ホルモンと五目野菜のしょうが炒め',     1150, 'dinner', '🥩'),
  ('d5', '照焼チキンとアボカドのサラダ丼',         1150, 'dinner', '🥑')
ON CONFLICT (id) DO NOTHING;
