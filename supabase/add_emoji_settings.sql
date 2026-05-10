-- 絵文字設定を store_settings に追加
-- store_settings テーブルが存在している前提（add_store_settings.sql 実行済み）

INSERT INTO store_settings (key, value, updated_at)
VALUES ('is_emoji_enabled', 'true'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO store_settings (key, value, updated_at)
VALUES (
  'available_emojis',
  '["🍔","🍕","🍜","🍣","🍱","🥗","🍗","🍟","🍰","🍦","🍮","🎂","☕","🥤","🍺","🍵","🫖","🍊","🧃","🍶","🥩","🍛","🍝","🫕"]'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;
