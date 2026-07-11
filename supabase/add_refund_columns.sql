-- 返品・取消（Phase 1-⑦）
-- 会計後の返品を「マイナス売上」として同じ sales テーブルに記録する。
-- ハード削除(deleteSale)は現状のまま残すが、通常運用では返品を使う方針。
--
-- 集計は自動でネットする（返品はマイナスの total_amount を持つため）。

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS is_refund          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS refund_of_sale_id  UUID REFERENCES sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_reason      TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_refund_of ON sales(refund_of_sale_id) WHERE refund_of_sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_is_refund ON sales(is_refund) WHERE is_refund = TRUE;
