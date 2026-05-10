-- ================================================================
-- Kitchen Kazu POS — 2026年5月1日〜15日 追加データ生成
--
-- 既存データは削除しません（TRUNCATE なし）。INSERT のみ。
-- 2026年4月の実績（111件/日）を継承したペースで生成します。
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
  v_dow      INT;
  v_base     INT;
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
  v_payment    TEXT;
  v_n_items    INT;
  v_items      JSONB;
  v_total      INT;

  v_rand  FLOAT;
  v_idx   INT;
  v_top   INT;
  v_id    TEXT;
  v_name  TEXT;
  v_emoji TEXT;
  v_price INT;
  v_tax   FLOAT;
  v_adj   INT;
  v_upr   INT;
  v_itot  INT;

BEGIN
  -- カテゴリーID取得
  SELECT id::TEXT INTO v_lunch_cat  FROM categories WHERE name = '昼部'  LIMIT 1;
  SELECT id::TEXT INTO v_dinner_cat FROM categories WHERE name = '夜部'  LIMIT 1;

  IF v_lunch_cat IS NULL THEN
    RAISE EXCEPTION '「昼部」カテゴリーが見つかりません。';
  END IF;

  -- メニュー配列ロード
  SELECT
    array_agg(id::TEXT      ORDER BY created_at),
    array_agg(name          ORDER BY created_at),
    array_agg(COALESCE(emoji, '🍽️') ORDER BY created_at),
    array_agg(price         ORDER BY created_at)
  INTO v_l_ids, v_l_names, v_l_emojis, v_l_prices
  FROM menus WHERE category = v_lunch_cat;

  IF v_dinner_cat IS NOT NULL THEN
    SELECT
      array_agg(id::TEXT      ORDER BY created_at),
      array_agg(name          ORDER BY created_at),
      array_agg(COALESCE(emoji, '🍽️') ORDER BY created_at),
      array_agg(price         ORDER BY created_at)
    INTO v_d_ids, v_d_names, v_d_emojis, v_d_prices
    FROM menus WHERE category = v_dinner_cat;
  END IF;

  v_l_n := COALESCE(array_length(v_l_ids, 1), 0);
  v_d_n := COALESCE(array_length(v_d_ids, 1), 0);

  IF v_l_n = 0 AND v_d_n = 0 THEN
    RAISE EXCEPTION 'メニューが登録されていません。';
  END IF;

  RAISE NOTICE 'メニュー読み込み完了: 昼部 %件, 夜部 %件', v_l_n, v_d_n;

  -- 2026年5月1日〜15日（月曜定休）
  FOR v_day IN
    SELECT d::DATE
    FROM generate_series('2026-05-01'::DATE, '2026-05-15'::DATE, '1 day'::INTERVAL) d
    WHERE EXTRACT(DOW FROM d) <> 1
  LOOP
    v_dow := EXTRACT(DOW FROM v_day)::INT;

    -- 5月基準件数（4月実績111の継続）
    v_base := 111;

    -- 土日ピーク +30%、日次ランダム変動 ±15%
    IF v_dow IN (5, 6) THEN
      v_base := ROUND(v_base * 1.30);
    END IF;
    v_count := GREATEST(ROUND(v_base * (0.85 + random() * 0.30))::INT, 10);

    FOR i IN 1..v_count LOOP
      v_is_lunch   := random() < 0.42;
      v_is_takeout := random() < 0.065;

      v_hour := CASE WHEN v_is_lunch
                     THEN 11 + (random() * 2.5)::INT
                     ELSE 17 + (random() * 4.0)::INT
                END;
      v_min  := (random() * 59)::INT;
      v_ts   := (
        ( v_day::TEXT || ' '
          || lpad(v_hour::TEXT, 2, '0') || ':'
          || lpad(v_min::TEXT,  2, '0') || ':00'
        )::TIMESTAMP AT TIME ZONE 'Asia/Tokyo'
      );

      v_rand  := random();
      v_staff := CASE WHEN v_rand < 0.40 THEN '沖'
                      WHEN v_rand < 0.75 THEN '向田'
                      ELSE 'スタッフA' END;

      IF v_is_takeout THEN
        v_male := 0; v_female := 0;
      ELSE
        v_rand   := random();
        v_male   := CASE WHEN v_rand < 0.28 THEN 0
                         WHEN v_rand < 0.62 THEN 1
                         WHEN v_rand < 0.86 THEN 2
                         ELSE 3 END;
        v_rand   := random();
        v_female := CASE WHEN v_rand < 0.33 THEN 0
                         WHEN v_rand < 0.70 THEN 1
                         WHEN v_rand < 0.93 THEN 2
                         ELSE 3 END;
        IF v_male = 0 AND v_female = 0 THEN
          IF random() < 0.55 THEN v_male := 1; ELSE v_female := 1; END IF;
        END IF;
      END IF;

      v_rand    := random();
      v_payment := CASE WHEN v_rand < 0.45 THEN 'cash'
                        WHEN v_rand < 0.97 THEN 'card'
                        ELSE 'qr' END;

      v_rand    := random();
      v_n_items := CASE WHEN v_rand < 0.82 THEN 1
                        WHEN v_rand < 0.98 THEN 2
                        ELSE 3 END;

      v_items := '[]'::JSONB;
      v_total := 0;

      FOR j IN 1..v_n_items LOOP
        IF v_is_lunch AND v_l_n > 0 THEN
          v_top := GREATEST(1, CEIL(v_l_n::FLOAT * 0.5)::INT);
          v_idx := CASE WHEN random() < 0.60 AND v_l_n > 1
                        THEN 1 + FLOOR(random() * v_top)::INT
                        ELSE 1 + FLOOR(random() * v_l_n)::INT
                   END;
          v_idx   := LEAST(v_idx, v_l_n);
          v_id    := v_l_ids[v_idx];
          v_name  := v_l_names[v_idx];
          v_emoji := v_l_emojis[v_idx];
          v_price := v_l_prices[v_idx];
        ELSIF v_d_n > 0 THEN
          v_top := GREATEST(1, CEIL(v_d_n::FLOAT * 0.5)::INT);
          v_idx := CASE WHEN random() < 0.60 AND v_d_n > 1
                        THEN 1 + FLOOR(random() * v_top)::INT
                        ELSE 1 + FLOOR(random() * v_d_n)::INT
                   END;
          v_idx   := LEAST(v_idx, v_d_n);
          v_id    := v_d_ids[v_idx];
          v_name  := v_d_names[v_idx];
          v_emoji := v_d_emojis[v_idx];
          v_price := v_d_prices[v_idx];
        ELSE
          v_idx   := 1 + FLOOR(random() * v_l_n)::INT;
          v_idx   := LEAST(v_idx, v_l_n);
          v_id    := v_l_ids[v_idx];
          v_name  := v_l_names[v_idx];
          v_emoji := v_l_emojis[v_idx];
          v_price := v_l_prices[v_idx];
        END IF;

        v_tax  := CASE WHEN v_is_takeout THEN 0.08 ELSE 0.10 END;

        v_rand := random();
        v_adj  := CASE WHEN v_rand < 0.05 THEN  80
                       WHEN v_rand < 0.13 THEN -20
                       ELSE 0 END;

        v_upr  := FLOOR((ROUND(v_price * (1.0 + v_tax)) + v_adj) / (1.0 + v_tax));
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
        gen_random_uuid(), v_total, v_items,
        v_male, v_female, v_staff,
        v_payment, v_ts
      );

    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ 2026年5月1日〜15日のデータ生成完了';
END $$;

-- 確認クエリ
SELECT
  created_at::DATE AT TIME ZONE 'Asia/Tokyo' AS 日付,
  COUNT(*)                                    AS 件数,
  TO_CHAR(SUM(total_amount), 'FM9,999,999')  AS 売上合計
FROM sales
WHERE created_at >= '2026-05-01T00:00:00+09:00'
  AND created_at <  '2026-05-16T00:00:00+09:00'
GROUP BY 1
ORDER BY 1;
