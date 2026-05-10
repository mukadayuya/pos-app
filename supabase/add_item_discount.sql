-- 商品別割引合計カラムを sales テーブルに追加
ALTER TABLE sales ADD COLUMN IF NOT EXISTS item_discount_total INTEGER NOT NULL DEFAULT 0;
