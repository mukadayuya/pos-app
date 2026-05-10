-- 年別月次サマリー取得関数（年別売上タブ用）
-- fetchYearOrders の limit(5000) を回避し、全件を正確に集計する。
-- Supabase Dashboard → SQL Editor で実行してください。

CREATE OR REPLACE FUNCTION get_yearly_summary(p_year INT)
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
    GROUP BY s.id, mo, s.total_amount, g
  )
  SELECT
    mo                    AS month,
    SUM(total_amount)::BIGINT AS total_rev,
    COUNT(*)::BIGINT      AS cnt,
    SUM(g)::BIGINT        AS guests,
    SUM(r10)::BIGINT      AS rev_10,
    SUM(r8)::BIGINT       AS rev_8
  FROM sale_items
  GROUP BY mo
  ORDER BY mo;
$$;

GRANT EXECUTE ON FUNCTION get_yearly_summary(INT) TO anon, authenticated;
