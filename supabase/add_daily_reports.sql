-- 日次締めレポート（Phase 1-⑥／Phase 1-⑫ を同時完成）
-- 全店舗共通。既存 sales テーブルを集計して daily_reports に確定履歴として保存する。
--
-- Xレポート: 中間確認（保存しない・任意タイミング）
-- Zレポート: 日次締め（保存する・レジ金差異記録・原則1日1回）

CREATE TABLE IF NOT EXISTS daily_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  report_date  DATE NOT NULL,               -- 対象営業日（JST）
  kind         TEXT NOT NULL CHECK (kind IN ('x','z')),
  -- 期間（当日0時〜次日0時など、JSTベースのISO文字列で保持）
  period_from  TIMESTAMPTZ NOT NULL,
  period_to    TIMESTAMPTZ NOT NULL,
  -- 集計本体（JSONで柔軟に。将来の追加項目にも対応）
  --   { total_incl, count, tax8, tax10, sub8, sub10,
  --     by_payment: { cash, card, qr, voucher },
  --     by_hour: [{h, total, count}, ...],
  --     cash_declared: number|null,  -- レジ金実測合計（Zのみ）
  --     cash_diff:     number|null,  -- 差異（Zのみ）
  --     staff:         string|null,
  --     note:          string|null }
  totals_json  JSONB NOT NULL,
  printed_at   TIMESTAMPTZ,                 -- CloudPRNT印刷が完了した時刻
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, report_date, kind, created_at)
);

-- 履歴閲覧の高速化（店舗×日付降順）
CREATE INDEX IF NOT EXISTS idx_daily_reports_lookup
  ON daily_reports(store_id, report_date DESC, kind);

-- ─── RLS ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS store_isolation ON daily_reports;
CREATE POLICY store_isolation ON daily_reports
  FOR ALL TO authenticated
  USING (store_id::text = current_store_id())
  WITH CHECK (store_id::text = current_store_id());
