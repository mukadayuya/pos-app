-- 勤怠管理（Phase 2-④）
-- スタッフマスター + 打刻イベント + 月次集計
-- 全店舗共通機能。給与計算の基礎データとしてZレポート運用と併走する。
--
-- 注意: 既存の employees テーブルは別用途（受給チャンス機能）で使われているため、
-- 勤怠管理用は staff_members / time_entries に分離する。

-- ── スタッフマスター ──
CREATE TABLE IF NOT EXISTS staff_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  role         TEXT,                            -- ホール/キッチン/店長 等
  hourly_wage  INTEGER NOT NULL DEFAULT 1100,   -- 時給（円）
  color        TEXT,                            -- シフト表示用の色（#hex）
  pin          TEXT,                            -- 打刻認証用PIN（任意）
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_members_store ON staff_members(store_id, is_active);

DROP POLICY IF EXISTS store_isolation ON staff_members;
CREATE POLICY store_isolation ON staff_members
  FOR ALL TO authenticated
  USING (store_id::text = current_store_id())
  WITH CHECK (store_id::text = current_store_id());

-- ── 打刻イベント ──
CREATE TABLE IF NOT EXISTS time_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  staff_id     UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  work_date    DATE NOT NULL,                   -- 勤務日（JST）
  clock_in     TIMESTAMPTZ NOT NULL,            -- 出勤時刻
  clock_out    TIMESTAMPTZ,                     -- 退勤時刻（未退勤の間NULL）
  break_min    INTEGER NOT NULL DEFAULT 0,      -- 休憩合計(分)
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_lookup
  ON time_entries(store_id, work_date DESC, staff_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_open
  ON time_entries(store_id, staff_id)
  WHERE clock_out IS NULL;

DROP POLICY IF EXISTS store_isolation ON time_entries;
CREATE POLICY store_isolation ON time_entries
  FOR ALL TO authenticated
  USING (store_id::text = current_store_id())
  WITH CHECK (store_id::text = current_store_id());
