-- store_settings スキーマ修正 & 設定行の初期化
-- 実行タイミング: Supabase Dashboard でテーブルを再作成・リセットした後に実行する
--
-- このスクリプトは以下を行います：
--   1. key カラムに UNIQUE 制約がなければ追加（id UUID PRIMARY KEY + key TEXT のスキーマに対応）
--   2. 必要な設定行を確保（存在しなければ INSERT、存在すれば何もしない）

DO $$
BEGIN
  -- key カラムへの UNIQUE 制約を追加（既存なら無視）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_name      = 'store_settings'
      AND ccu.column_name    = 'key'
  ) THEN
    ALTER TABLE store_settings ADD CONSTRAINT store_settings_key_unique UNIQUE (key);
    RAISE NOTICE 'UNIQUE 制約を key カラムに追加しました';
  ELSE
    RAISE NOTICE 'UNIQUE 制約は既に存在します（スキップ）';
  END IF;
END $$;

-- 設定行を確保（UNIQUE 制約追加後）
INSERT INTO store_settings (key, value)
VALUES ('is_takeout_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO store_settings (key, value)
VALUES ('is_emoji_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO store_settings (key, value)
VALUES (
  'available_emojis',
  '["🍔","🍕","🍜","🍣","🍱","🥗","🍗","🍟","🍰","🍦","🍮","🎂","☕","🥤","🍺","🍵","🫖","🍊","🧃","🍶","🥩","🍛","🍝","🫕"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
