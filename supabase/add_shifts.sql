-- シフト作成（Phase 2-④ 拡張）
-- 週間シフト表として、スタッフの勤務予定を登録・確認する。
-- 実際の打刻(time_entries)と比較して勤務予実管理も可能に。

CREATE TABLE IF NOT EXISTS shifts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  staff_id     UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  work_date    DATE NOT NULL,                   -- 勤務日（JST）
  start_time   TEXT NOT NULL,                   -- '17:00' 形式（時刻のみ・日跨ぎ考慮のため文字列）
  end_time     TEXT NOT NULL,                   -- '23:00'
  role         TEXT,                            -- 当日の役割（ホール/キッチン等）
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 同一スタッフの同一日は1シフトのみ（複数勤務は end_time を後にずらして1本化推奨）
  UNIQUE (store_id, staff_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_shifts_lookup
  ON shifts(store_id, work_date);
CREATE INDEX IF NOT EXISTS idx_shifts_by_staff
  ON shifts(store_id, staff_id, work_date);

DROP POLICY IF EXISTS store_isolation ON shifts;
CREATE POLICY store_isolation ON shifts
  FOR ALL TO authenticated
  USING (store_id::text = current_store_id())
  WITH CHECK (store_id::text = current_store_id());
