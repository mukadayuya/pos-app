-- ================================================================
-- sales テーブルに store_id カラムを追加（マルチストア対応）
-- Supabase Dashboard → SQL Editor で実行してください
-- ================================================================

-- store_id カラムを追加（既存レコードは kitchen-wa として扱う）
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'kitchen-wa';

-- インデックス追加（ストア別クエリを高速化）
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON sales (store_id, created_at DESC);

-- ================================================================
-- get_yearly_summary 関数を store_id 対応に更新
-- ================================================================
CREATE OR REPLACE FUNCTION get_yearly_summary(p_year INT, p_store_id TEXT DEFAULT 'kitchen-wa')
RETURNS TABLE (
  month     INT,
  total_rev BIGINT,
  cnt       BIGINT,
  guests    BIGINT,
  rev_10    BIGINT,
  rev_8     BIGINT
) LANGUAGE sql STABLE AS $$
  WITH sale_items AS (
    SELECT
      s.id,
      EXTRACT(MONTH FROM s.created_at AT TIME ZONE 'Asia/Tokyo')::INT AS mo,
      s.total_amount,
      COALESCE(s.male_count, 0) + COALESCE(s.female_count, 0) AS g,
      COALESCE(SUM(CASE
        WHEN (it->>'tax_rate')::FLOAT >= 0.09
        THEN ROUND((it->>'unit_price')::NUMERIC
               * COALESCE((it->>'quantity')::NUMERIC, 1) * 1.10)
        ELSE 0 END), 0) AS r10,
      COALESCE(SUM(CASE
        WHEN (it->>'tax_rate')::FLOAT < 0.09
        THEN ROUND((it->>'unit_price')::NUMERIC
               * COALESCE((it->>'quantity')::NUMERIC, 1) * 1.08)
        ELSE 0 END), 0) AS r8
    FROM sales s
    LEFT JOIN LATERAL jsonb_array_elements(s.items) AS it ON true
    WHERE EXTRACT(YEAR FROM s.created_at AT TIME ZONE 'Asia/Tokyo') = p_year
      AND s.store_id = p_store_id
    GROUP BY s.id, mo, s.total_amount, g
  )
  SELECT
    mo                        AS month,
    SUM(total_amount)::BIGINT AS total_rev,
    COUNT(*)::BIGINT          AS cnt,
    SUM(g)::BIGINT            AS guests,
    SUM(r10)::BIGINT          AS rev_10,
    SUM(r8)::BIGINT           AS rev_8
  FROM sale_items
  GROUP BY mo
  ORDER BY mo;
$$;

GRANT EXECUTE ON FUNCTION get_yearly_summary(INT, TEXT) TO anon, authenticated;

-- 確認
SELECT store_id, COUNT(*) AS 件数, SUM(total_amount) AS 売上合計
FROM sales
GROUP BY store_id
ORDER BY store_id;
