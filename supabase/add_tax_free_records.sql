-- 免税販売記録（Phase 1-⑬・インバウンド対応）
-- 訪日外国人客への免税販売時のパスポート情報・免税額を記録。
-- 税務署への保管義務(7年)対応。
--
-- 飲食店では以下を免税販売可能：
-- - テイクアウト商品（包装済み食品・土産物・調味料・酒 等）
-- - 総額5,000円以上50万円以下

CREATE TABLE IF NOT EXISTS tax_free_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sale_id        UUID REFERENCES sales(id) ON DELETE SET NULL,
  -- パスポート情報
  passport_no    TEXT NOT NULL,           -- パスポート番号
  nationality    TEXT NOT NULL,           -- 国籍 (ISO 3166 alpha-2 or 国名)
  customer_name  TEXT NOT NULL,           -- 氏名（ローマ字）
  entry_date     DATE,                    -- 入国年月日
  -- 商品分類（旅券法・免税制度上の区分）
  category       TEXT NOT NULL CHECK (category IN ('general','consumable','mixed')),
  -- 金額
  tax_excluded_total INTEGER NOT NULL,    -- 免税対象総額（税抜）
  tax_amount     INTEGER NOT NULL,        -- 免除された消費税額
  -- 運用
  staff          TEXT,                    -- 販売担当
  note           TEXT,                    -- メモ
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_free_records_lookup
  ON tax_free_records(store_id, created_at DESC);

DROP POLICY IF EXISTS store_isolation ON tax_free_records;
CREATE POLICY store_isolation ON tax_free_records
  FOR ALL TO authenticated
  USING (store_id::text = current_store_id())
  WITH CHECK (store_id::text = current_store_id());

-- sales テーブルに免税フラグ追加
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS is_tax_free BOOLEAN NOT NULL DEFAULT FALSE;
