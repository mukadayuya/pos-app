-- ================================================================
-- Kitchen Kazu POS — 2026年5月 売上データ再生成（v2）
--
-- 【操作内容】
--   1. sales テーブルから 5月1日以降のデータを全件 DELETE
--   2. 5月1日〜3日を新規 INSERT
--      - 60〜80 件/日、ランチ/ディナー集中
--      - スタッフ比率 沖50% / 向田30% / スタッフA20%
--      - menus テーブルの実メニューを使用
--      - 1〜4名のゲスト数
-- ================================================================

DO $$
DECLARE
  v_lunch_cat   TEXT;
  v_dinner_cat  TEXT;

  v_l_ids    TEXT[];
  v_l_names  TEXT[];
  v_l_emojis TEXT[];
  v_l_prices INT[];
  v_l_n      INT := 0;

  v_d_ids    TEXT[];
  v_d_names  TEXT[];
  v_d_emojis TEXT[];
  v_d_prices INT[];
  v_d_n      INT := 0;

  v_day      DATE;
  v_count    INT;
  i          INT;
  j          INT;

  v_ts         TIMESTAMPTZ;
  v_hour       INT;
  v_min        INT;
  v_is_lunch   BOOLEAN;
  v_is_takeout BOOLEAN;
  v_staff      TEXT;
  v_male       INT;
  v_female     INT;
  v_total_guests INT;
  v_payment    TEXT;
  v_n_items    INT;
  v_items      JSONB;
  v_total      INT;

  v_rand  FLOAT;
  v_idx   INT;
  v_id    TEXT;
  v_name  TEXT;
  v_emoji TEXT;
  v_price INT;
  v_tax   FLOAT;
  v_upr   INT;
  v_itot  INT;

BEGIN
  -- ── 既存の5月データを全件削除 ─────────────────────────────────
  DELETE FROM sales WHERE created_at >= '2026-05-01T00:00:00+09:00';
  RAISE NOTICE '5月データを削除しました（%件）', found;

  -- ── カテゴリーID取得 ──────────────────────────────────────────
  SELECT id::TEXT INTO v_lunch_cat  FROM categories WHERE name = '昼部' LIMIT 1;
  SELECT id::TEXT INTO v_dinner_cat FROM categories WHERE name = '夜部' LIMIT 1;

  IF v_lunch_cat IS NULL THEN
    RAISE EXCEPTION '「昼部」カテゴリーが見つかりません';
  END IF;

  -- ── メニュー配列ロード ────────────────────────────────────────
  SELECT
    array_agg(id::TEXT              ORDER BY created_at),
    array_agg(name                  ORDER BY created_at),
    array_agg(COALESCE(emoji,'🍽️') ORDER BY created_at),
    array_agg(price                 ORDER BY created_at)
  INTO v_l_ids, v_l_names, v_l_emojis, v_l_prices
  FROM menus WHERE category = v_lunch_cat AND price > 0;

  IF v_dinner_cat IS NOT NULL THEN
    SELECT
      array_agg(id::TEXT              ORDER BY created_at),
      array_agg(name                  ORDER BY created_at),
      array_agg(COALESCE(emoji,'🍽️') ORDER BY created_at),
      array_agg(price                 ORDER BY created_at)
    INTO v_d_ids, v_d_names, v_d_emojis, v_d_prices
    FROM menus WHERE category = v_dinner_cat AND price > 0;
  END IF;

  v_l_n := COALESCE(array_length(v_l_ids, 1), 0);
  v_d_n := COALESCE(array_length(v_d_ids, 1), 0);

  IF v_l_n = 0 AND v_d_n = 0 THEN
    RAISE EXCEPTION 'メニューが登録されていません';
  END IF;

  RAISE NOTICE 'メニュー読み込み: 昼部 %件 / 夜部 %件', v_l_n, v_d_n;

  -- ── 2026年5月1日〜3日（月曜定休なし・全日営業） ───────────────
  FOR v_day IN
    SELECT d::DATE
    FROM generate_series('2026-05-01'::DATE, '2026-05-03'::DATE, '1 day'::INTERVAL) d
    WHERE EXTRACT(DOW FROM d) <> 1  -- 月曜定休
  LOOP
    -- 60〜80 件/日
    v_count := 60 + FLOOR(random() * 21)::INT;

    FOR i IN 1..v_count LOOP

      -- ── 時間帯決定 ────────────────────────────────────────────
      -- ランチ 45% (11-13時台) / ディナー 55% (17-20時台)
      v_is_lunch := random() < 0.45;
      v_hour := CASE
        WHEN v_is_lunch THEN 11 + FLOOR(random() * 3)::INT  -- 11, 12, 13
        ELSE                  17 + FLOOR(random() * 4)::INT  -- 17, 18, 19, 20
      END;
      v_min := FLOOR(random() * 60)::INT;
      v_ts  := (
        v_day::TEXT
        || ' '
        || lpad(v_hour::TEXT, 2, '0')
        || ':'
        || lpad(v_min::TEXT,  2, '0')
        || ':00'
      )::TIMESTAMP AT TIME ZONE 'Asia/Tokyo';

      -- ── テイクアウト（5%） ────────────────────────────────────
      v_is_takeout := random() < 0.05;

      -- ── スタッフ: 沖50% / 向田30% / スタッフA20% ─────────────
      v_rand  := random();
      v_staff := CASE
        WHEN v_rand < 0.50 THEN '沖'
        WHEN v_rand < 0.80 THEN '向田'
        ELSE 'スタッフA'
      END;

      -- ── 客数（テイクアウト = 0名） ────────────────────────────
      IF v_is_takeout THEN
        v_male := 0; v_female := 0;
      ELSE
        -- 合計人数: 1名30% / 2名40% / 3名20% / 4名10%
        v_rand := random();
        v_total_guests := CASE
          WHEN v_rand < 0.30 THEN 1
          WHEN v_rand < 0.70 THEN 2
          WHEN v_rand < 0.90 THEN 3
          ELSE 4
        END;
        -- 男女比をランダムに配分
        v_male   := FLOOR(random() * (v_total_guests + 1))::INT;
        v_female := v_total_guests - v_male;
        -- 全員同性になりすぎないよう軽く補正（任意）
        IF v_total_guests >= 2 AND v_male = v_total_guests AND random() < 0.3 THEN
          v_male   := v_total_guests - 1;
          v_female := 1;
        END IF;
        IF v_total_guests >= 2 AND v_female = v_total_guests AND random() < 0.3 THEN
          v_female := v_total_guests - 1;
          v_male   := 1;
        END IF;
      END IF;

      -- ── 支払い方法: 現金45% / カード52% / QR3% ───────────────
      v_rand    := random();
      v_payment := CASE
        WHEN v_rand < 0.45 THEN 'cash'
        WHEN v_rand < 0.97 THEN 'card'
        ELSE 'qr'
      END;

      -- ── 商品数: 1品70% / 2品22% / 3品8% ─────────────────────
      v_rand    := random();
      v_n_items := CASE
        WHEN v_rand < 0.70 THEN 1
        WHEN v_rand < 0.92 THEN 2
        ELSE 3
      END;

      -- ── 商品選択 & 合計計算 ───────────────────────────────────
      v_items := '[]'::JSONB;
      v_total := 0;

      FOR j IN 1..v_n_items LOOP
        -- ランチ or ディナーの対応カテゴリーからランダム選択
        IF v_is_lunch AND v_l_n > 0 THEN
          v_idx   := 1 + FLOOR(random() * v_l_n)::INT;
          v_idx   := LEAST(v_idx, v_l_n);
          v_id    := v_l_ids[v_idx];
          v_name  := v_l_names[v_idx];
          v_emoji := v_l_emojis[v_idx];
          v_price := v_l_prices[v_idx];
        ELSIF v_d_n > 0 THEN
          v_idx   := 1 + FLOOR(random() * v_d_n)::INT;
          v_idx   := LEAST(v_idx, v_d_n);
          v_id    := v_d_ids[v_idx];
          v_name  := v_d_names[v_idx];
          v_emoji := v_d_emojis[v_idx];
          v_price := v_d_prices[v_idx];
        ELSE
          -- 夜部がない場合は昼部で代替
          v_idx   := 1 + FLOOR(random() * v_l_n)::INT;
          v_idx   := LEAST(v_idx, v_l_n);
          v_id    := v_l_ids[v_idx];
          v_name  := v_l_names[v_idx];
          v_emoji := v_l_emojis[v_idx];
          v_price := v_l_prices[v_idx];
        END IF;

        -- 税率: テイクアウト8% / 店内10%
        v_tax  := CASE WHEN v_is_takeout THEN 0.08 ELSE 0.10 END;
        -- unit_price = 税抜き価格 (menus.price を税抜きとして扱う)
        v_upr  := v_price;
        v_itot := ROUND(v_upr * (1.0 + v_tax));
        v_total := v_total + v_itot;

        v_items := v_items || jsonb_build_array(
          jsonb_build_object(
            'id',         v_id,
            'name',       v_name,
            'emoji',      v_emoji,
            'quantity',   1,
            'unit_price', v_upr,
            'tax_rate',   v_tax
          )
        );
      END LOOP;

      INSERT INTO sales (
        id, total_amount, items,
        male_count, female_count, staff_name,
        payment_method, created_at
      ) VALUES (
        gen_random_uuid(),
        v_total,
        v_items,
        v_male,
        v_female,
        v_staff,
        v_payment,
        v_ts
      );

    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ 2026年5月1日〜3日のデータ生成完了';
END $$;

-- ================================================================
-- 確認クエリ
-- ================================================================

-- 日別サマリー
SELECT
  (created_at AT TIME ZONE 'Asia/Tokyo')::DATE AS 日付,
  COUNT(*)                                       AS 件数,
  TO_CHAR(SUM(total_amount), 'FM9,999,999')     AS 売上合計
FROM sales
WHERE created_at >= '2026-05-01T00:00:00+09:00'
  AND created_at <  '2026-05-04T00:00:00+09:00'
GROUP BY 1
ORDER BY 1;

-- スタッフ別シェア（5月計）
SELECT
  staff_name                                           AS スタッフ,
  COUNT(*)                                             AS 件数,
  TO_CHAR(SUM(total_amount), 'FM9,999,999')           AS 売上,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS 件数比率
FROM sales
WHERE created_at >= '2026-05-01T00:00:00+09:00'
  AND created_at <  '2026-05-04T00:00:00+09:00'
GROUP BY staff_name
ORDER BY 件数 DESC;

-- 5月3日の時間帯分布（時間帯別グラフ検証用）
SELECT
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Tokyo')::INT AS 時間,
  COUNT(*) AS 件数,
  TO_CHAR(SUM(total_amount), 'FM9,999,999') AS 売上
FROM sales
WHERE created_at >= '2026-05-03T00:00:00+09:00'
  AND created_at <  '2026-05-04T00:00:00+09:00'
GROUP BY 1
ORDER BY 1;
