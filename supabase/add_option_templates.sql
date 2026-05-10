-- オプションテンプレートテーブル
-- Supabase Dashboard → SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS option_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  groups     JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE option_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON option_templates
  FOR ALL USING (true) WITH CHECK (true);
