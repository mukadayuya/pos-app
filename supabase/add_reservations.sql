-- 予約・取り置き（Phase 1-⑪）
-- コース料理店や貸切対応の飲食店で必須。
-- 予約情報は独立テーブルで管理し、当日にレジ画面で確認・チェックインする。

CREATE TABLE IF NOT EXISTS reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  reserved_at   TIMESTAMPTZ NOT NULL,        -- 予約日時
  customer_name TEXT NOT NULL,
  phone         TEXT,
  party_size    INTEGER NOT NULL DEFAULT 2,  -- 人数
  table_pref    TEXT,                        -- 希望席（座敷/テーブル/カウンター 等）
  course_name   TEXT,                        -- 予約コース名
  course_price  INTEGER,                     -- コース単価（税込）
  deposit       INTEGER NOT NULL DEFAULT 0,  -- 前受金（取り置き金額）
  status        TEXT NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('confirmed','checked_in','completed','cancelled','no_show')),
  note          TEXT,                        -- アレルギー・要望メモ
  staff         TEXT,                        -- 予約受付者
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 当日予約一覧の高速化
CREATE INDEX IF NOT EXISTS idx_reservations_lookup
  ON reservations(store_id, reserved_at);

CREATE INDEX IF NOT EXISTS idx_reservations_active
  ON reservations(store_id, reserved_at, status)
  WHERE status IN ('confirmed', 'checked_in');

DROP POLICY IF EXISTS store_isolation ON reservations;
CREATE POLICY store_isolation ON reservations
  FOR ALL TO authenticated
  USING (store_id::text = current_store_id())
  WITH CHECK (store_id::text = current_store_id());
