-- 現金管理拡張（Phase 1-⑤）
-- 釣銭準備金・両替・仮払い・入出金の記録を一元管理する。
-- Zレポート実行時にこの日付分の入出金を差異計算に含められる。

CREATE TABLE IF NOT EXISTS cash_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_date   DATE NOT NULL,                 -- 対象営業日（JST）
  -- opening_float: 釣銭準備金（営業開始時）
  -- petty_cash:    仮払い（現金支出）
  -- deposit:       入金（他レジや金庫から現金追加）
  -- withdrawal:    出金（銀行預入等）
  -- change:        両替（内訳変更・合計は不変または変化）
  kind         TEXT NOT NULL CHECK (kind IN ('opening_float','petty_cash','deposit','withdrawal','change')),
  -- 符号付き: 入金 (+) / 出金 (-)。両替は 0 or 実質額
  amount       INTEGER NOT NULL,
  note         TEXT,                          -- 用途メモ（食材買出／銀行預入 等）
  staff        TEXT,                          -- 記録者
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_events_lookup
  ON cash_events(store_id, event_date DESC, created_at DESC);

DROP POLICY IF EXISTS store_isolation ON cash_events;
CREATE POLICY store_isolation ON cash_events
  FOR ALL TO authenticated
  USING (store_id::text = current_store_id())
  WITH CHECK (store_id::text = current_store_id());
