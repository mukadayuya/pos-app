-- sales テーブルに payment_method カラムを追加（既存の場合はスキップ）
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash';

-- 確認クエリ
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'payment_method';
