-- sales テーブルに割引カラムを追加
-- discount_amount: 割引後の差額（円単位の整数）
-- discount:        割引の詳細（type / value / inclusive）を JSONB で保持

ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount JSONB;

-- 確認クエリ
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name IN ('discount_amount', 'discount')
ORDER BY column_name;
