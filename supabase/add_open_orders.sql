-- 未会計注文の共有同期（Phase 1-⑩ 拡張）
-- 現状は端末LocalStorage で保存されている「未会計・未提供」の注文を Supabase に
-- 同期し、複数端末（ハンディ・レジ・テーブル管理ダッシュボード）で共有する。
--
-- LocalStorage は一次保存（オフライン耐性）、Supabase はミラー（クロス端末共有）。

CREATE TABLE IF NOT EXISTS open_orders (
  id             UUID PRIMARY KEY,               -- クライアント生成UUID
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  table_no       TEXT NOT NULL,
  staff          TEXT,
  items          JSONB NOT NULL,                 -- OrderRecord['items']
  total_tax_incl INTEGER NOT NULL DEFAULT 0,
  sent_at        TIMESTAMPTZ NOT NULL,
  served         BOOLEAN NOT NULL DEFAULT FALSE,
  closed         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- テーブル管理は「未クローズ」のみを頻繁にfetch
CREATE INDEX IF NOT EXISTS idx_open_orders_active
  ON open_orders(store_id, sent_at DESC)
  WHERE closed = FALSE;

-- 履歴・監査
CREATE INDEX IF NOT EXISTS idx_open_orders_all
  ON open_orders(store_id, sent_at DESC);

DROP POLICY IF EXISTS store_isolation ON open_orders;
CREATE POLICY store_isolation ON open_orders
  FOR ALL TO authenticated
  USING (store_id::text = current_store_id())
  WITH CHECK (store_id::text = current_store_id());
