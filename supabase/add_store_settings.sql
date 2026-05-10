-- store_settings: 店舗機能フラグ（マスタースイッチ）
-- localStorage を primary として使用。このテーブルは将来的な多端末同期用。
CREATE TABLE IF NOT EXISTS store_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- テイクアウト機能のデフォルト値を投入（既存行があればスキップ）
INSERT INTO store_settings (key, value)
VALUES ('is_takeout_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- RLS: 全ロール読み書き可（将来的にオーナーロール制限を追加する場合はここを修正）
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON store_settings FOR ALL USING (true) WITH CHECK (true);
