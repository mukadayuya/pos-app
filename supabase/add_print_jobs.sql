-- レシートプリンター連携（Phase 1-④ Fase A）
-- Star CloudPRNT方式: プリンターが定期HTTPポーリング→サーバーがジョブを配布
-- 参考: docs/rls-design.md, project_pos_production_roadmap
--
-- 注意点:
--  - CloudPRNTエンドポイントはプリンター（未認証機器）から叩かれるため、
--    APIルートは service_role_key で書き込む（RLSをバイパス）。
--    通常のブラウザからのアクセスは anon/authenticated + RLS で保護する。
--  - printer_mac は 12桁の大文字（例 "0011623AB4CD"）に統一する。
--    プリンターから届く MAC は "00:11:62:3A:B4:CD" 等の区切りが入るため、
--    アプリ側で normalizePrinterMac() を通してから照会する。

-- ─── printer_devices（プリンター機器台帳）─────────────────────────
CREATE TABLE IF NOT EXISTS printer_devices (
  mac_address TEXT PRIMARY KEY,
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT,                          -- "レジ横mPOP" 等の表示名
  model       TEXT,                          -- "mPOP" | "TM-m30III" 等
  status      TEXT DEFAULT 'unknown',        -- 'online' | 'paper_low' | 'paper_empty' | 'cover_open' | 'error'
  status_msg  TEXT,                          -- プリンターの生ステータス文字列（保守用）
  last_seen_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_printer_devices_store ON printer_devices(store_id);

-- ─── print_jobs（印刷ジョブキュー＋履歴）───────────────────────────
CREATE TABLE IF NOT EXISTS print_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  -- 特定プリンター宛にしたい場合のみ設定。NULLなら店舗内で最初にポーリング
  -- してきた任意のプリンターに配布する（1台運用向け）
  target_mac    TEXT REFERENCES printer_devices(mac_address) ON DELETE SET NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('receipt','kitchen','x_report','z_report','reprint','test')),
  content_type  TEXT NOT NULL DEFAULT 'application/vnd.star.starprnt',
  -- Base64エンコード済ペイロード（ESC/POS または StarPRNTバイト列）
  payload_b64   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','delivered','done','error','expired','cancelled')),
  sale_id       UUID REFERENCES sales(id) ON DELETE SET NULL,
  error_msg     TEXT,
  delivered_mac TEXT,                        -- どのプリンターが受け取ったかの実績
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at  TIMESTAMPTZ,
  done_at       TIMESTAMPTZ,
  -- 10分内に受け取られなかったジョブは expired 扱い（バッチで掃除）
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- CloudPRNTポーリング時の高速引取用（部分インデックス）
CREATE INDEX IF NOT EXISTS idx_print_jobs_pickup
  ON print_jobs(store_id, created_at)
  WHERE status = 'queued';

-- 履歴画面（過去24hを新しい順）用
CREATE INDEX IF NOT EXISTS idx_print_jobs_history
  ON print_jobs(store_id, created_at DESC);

-- ─── RLS（他店舗の印刷ジョブ・プリンターを見られない）──────────────
-- 現時点は enable_rls_per_store.sql と同様、Auth導入後に一括ENABLEする方針。
-- ここではポリシーだけ定義しておく（Auth導入時に ENABLE ROW LEVEL SECURITY で有効化）。

DROP POLICY IF EXISTS store_isolation ON printer_devices;
CREATE POLICY store_isolation ON printer_devices
  FOR ALL TO authenticated
  USING (store_id::text = current_store_id())
  WITH CHECK (store_id::text = current_store_id());

DROP POLICY IF EXISTS store_isolation ON print_jobs;
CREATE POLICY store_isolation ON print_jobs
  FOR ALL TO authenticated
  USING (store_id::text = current_store_id())
  WITH CHECK (store_id::text = current_store_id());

-- ─── 期限切れジョブの掃除関数（Vercel Cron or Supabase pg_cron から呼ぶ）──
CREATE OR REPLACE FUNCTION expire_stale_print_jobs() RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  n INTEGER;
BEGIN
  UPDATE print_jobs
     SET status = 'expired'
   WHERE status = 'queued'
     AND expires_at < NOW();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
