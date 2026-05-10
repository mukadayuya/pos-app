-- ================================================================
-- Kitchen Kazu POS — リアルなダミーデータ生成（2024〜2026年）
--
-- 実店舗の2026年1〜4月実績をベースに設計:
--   純売上合計  : 約15,100,000円（2026年1〜4月）
--   客単価      : 約1,378円（平均 1.20品/会計）
--   テイクアウト: 全会計の約6.5%（8%軽減税率）
--   支払方法    : 現金45% / クレカ52% / QR3%
--   定休日      : 月曜（DOW = 1）
--
-- 2024・2025年は年間4,500万〜5,000万円ペース
-- Supabase Dashboard → SQL Editor で実行してください
-- ================================================================

-- ── Step 0: payment_method カラムを追加（未作成なら） ─────────
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- ── Step 1: 既存データをクリア ────────────────────────────────
TRUNCATE sales;

-- ── Step 2: リアルデータ生成 ──────────────────────────────────
DO $$
DECLARE
  -- カテゴリーID
  v_lunch_cat   TEXT;
  v_dinner_cat  TEXT;

  -- メニュー配列（昼部）
  v_l_ids    TEXT[];
  v_l_names  TEXT[];
  v_l_emojis TEXT[];
  v_l_prices INT[];
  v_l_n      INT := 0;

  -- メニュー配列（夜部）
  v_d_ids    TEXT[];
  v_d_names  TEXT[];
  v_d_emojis TEXT[];
  v_d_prices INT[];
  v_d_n      INT := 0;

  -- ループ制御
  v_year  INT;
  v_day   DATE;
  v_dow   INT;
  v_base  INT;
  v_count INT;
  i       INT;
  j       INT;

  -- トランザクション属性
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

  -- 商品選択
  v_rand  FLOAT;
  v_idx   INT;
  v_top   INT;
  v_id    TEXT;
  v_name  TEXT;
  v_emoji TEXT;
  v_price INT;
  v_tax   FLOAT;
  v_adj   INT;
  v_upr   INT;   -- 税抜単価
  v_itot  INT;   -- 税込小計

BEGIN
  -- ── カテゴリーID 取得 ────────────────────────────────────────
  SELECT id::TEXT INTO v_lunch_cat  FROM categories WHERE name = '昼部'  LIMIT 1;
  SELECT id::TEXT INTO v_dinner_cat FROM categories WHERE name = '夜部'  LIMIT 1;

  IF v_lunch_cat IS NULL THEN
    RAISE EXCEPTION '「昼部」カテゴリーが見つかりません。setup_full.sql を先に実行してください。';
  END IF;
  IF v_dinner_cat IS NULL THEN
    RAISE EXCEPTION '「夜部」カテゴリーが見つかりません。';
  END IF;

  -- ── メニュー配列ロード ────────────────────────────────────────
  SELECT
    array_agg(id::TEXT      ORDER BY created_at),
    array_agg(name          ORDER BY created_at),
    array_agg(COALESCE(emoji, '🍽️') ORDER BY created_at),
    array_agg(price         ORDER BY created_at)
  INTO v_l_ids, v_l_names, v_l_emojis, v_l_prices
  FROM menus WHERE category = v_lunch_cat;

  SELECT
    array_agg(id::TEXT      ORDER BY created_at),
    array_agg(name          ORDER BY created_at),
    array_agg(COALESCE(emoji, '🍽️') ORDER BY created_at),
    array_agg(price         ORDER BY created_at)
  INTO v_d_ids, v_d_names, v_d_emojis, v_d_prices
  FROM menus WHERE category = v_dinner_cat;

  v_l_n := COALESCE(array_length(v_l_ids, 1), 0);
  v_d_n := COALESCE(array_length(v_d_ids, 1), 0);

  IF v_l_n = 0 AND v_d_n = 0 THEN
    RAISE EXCEPTION 'メニューが未登録です。先にメニューを登録してください。';
  END IF;

  RAISE NOTICE '─ メニュー読み込み完了: 昼部 %件, 夜部 %件', v_l_n, v_d_n;

  -- ── 年ループ（2024 / 2025 / 2026） ────────────────────────────
  FOREACH v_year IN ARRAY ARRAY[2024, 2025, 2026] LOOP

    FOR v_day IN
      SELECT d::DATE FROM generate_series(
        make_date(v_year, 1, 1),
        CASE v_year WHEN 2026 THEN '2026-04-30'::DATE
                              ELSE make_date(v_year, 12, 31) END,
        '1 day'::INTERVAL
      ) d
      WHERE EXTRACT(DOW FROM d) <> 1   -- 月曜定休
    LOOP
      v_dow := EXTRACT(DOW FROM v_day)::INT;

      -- ── 月・年別の基準件数（平日ベース） ────────────────────
      --  2026年は実績ベース、2024-25年は類似規模（年4,500〜5,000万円）
      v_base := CASE
        WHEN v_year = 2026 THEN
          CASE EXTRACT(MONTH FROM v_day)::INT
            WHEN 1 THEN 93   WHEN 2 THEN 103
            WHEN 3 THEN 108  WHEN 4 THEN 111
            ELSE 100
          END
        ELSE  -- 2024・2025
          CASE EXTRACT(MONTH FROM v_day)::INT
            WHEN 1  THEN 82   WHEN 2  THEN 82
            WHEN 3  THEN 98   WHEN 4  THEN 98
            WHEN 5  THEN 98   WHEN 6  THEN 90
            WHEN 7  THEN 80   WHEN 8  THEN 78
            WHEN 9  THEN 93   WHEN 10 THEN 95
            WHEN 11 THEN 105  WHEN 12 THEN 108
            ELSE 90
          END
      END;

      -- 金・土はピーク（+30%）、日次ランダム変動（±15%）
      IF v_dow IN (5, 6) THEN
        v_base := ROUND(v_base * 1.30);
      END IF;
      v_count := GREATEST(ROUND(v_base * (0.85 + random() * 0.30))::INT, 10);

      -- ── トランザクションループ ────────────────────────────────
      FOR i IN 1..v_count LOOP

        -- ランチ（42%）か夜（58%）か
        v_is_lunch   := random() < 0.42;
        -- テイクアウト: 全会計の6.5%（ランチ・夜ともに発生しうる）
        v_is_takeout := random() < 0.065;

        -- 時間帯（JST）
        v_hour := CASE WHEN v_is_lunch
                       THEN 11 + (random() * 2.5)::INT   -- 11〜13時
                       ELSE 17 + (random() * 4.0)::INT   -- 17〜20時
                  END;
        v_min  := (random() * 59)::INT;
        v_ts   := (
          ( v_day::TEXT || ' '
            || lpad(v_hour::TEXT, 2, '0') || ':'
            || lpad(v_min::TEXT,  2, '0') || ':00'
          )::TIMESTAMP AT TIME ZONE 'Asia/Tokyo'
        );

        -- スタッフ（沖40% / 向田35% / スタッフA25%）
        v_rand  := random();
        v_staff := CASE WHEN v_rand < 0.40 THEN '沖'
                        WHEN v_rand < 0.75 THEN '向田'
                        ELSE 'スタッフA' END;

        -- 客層（テイクアウトはゼロ、男性はやや多め）
        IF v_is_takeout THEN
          v_male := 0;  v_female := 0;
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
          -- 最低1名
          IF v_male = 0 AND v_female = 0 THEN
            IF random() < 0.55 THEN v_male := 1; ELSE v_female := 1; END IF;
          END IF;
        END IF;

        -- 支払方法（現金45% / クレカ52% / QR3%）
        v_rand    := random();
        v_payment := CASE WHEN v_rand < 0.45 THEN 'cash'
                          WHEN v_rand < 0.97 THEN 'card'
                          ELSE 'qr' END;

        -- 品数（平均1.20品 → 客単価約1,378円に合わせる）
        -- 1品: 82% / 2品: 16% / 3品: 2%
        v_rand    := random();
        v_n_items := CASE WHEN v_rand < 0.82 THEN 1
                          WHEN v_rand < 0.98 THEN 2
                          ELSE 3 END;

        v_items := '[]'::JSONB;
        v_total := 0;

        FOR j IN 1..v_n_items LOOP
          -- ── メニュー選択 ────────────────────────────────────
          -- ランチ時間帯は昼部から優先選択、夜は夜部から
          -- 先頭50%の商品が60%の確率で選ばれる（看板商品への偏りを再現）
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
            -- 夜メニューがなく昼メニューのみの場合のフォールバック
            v_idx   := 1 + FLOOR(random() * v_l_n)::INT;
            v_idx   := LEAST(v_idx, v_l_n);
            v_id    := v_l_ids[v_idx];
            v_name  := v_l_names[v_idx];
            v_emoji := v_l_emojis[v_idx];
            v_price := v_l_prices[v_idx];
          END IF;

          v_tax  := CASE WHEN v_is_takeout THEN 0.08 ELSE 0.10 END;

          -- ご飯サイズ調整（税込差額: 特盛+80円5%/小ライス-20円8%）
          v_rand := random();
          v_adj  := CASE WHEN v_rand < 0.05 THEN  80
                         WHEN v_rand < 0.13 THEN -20
                         ELSE 0 END;

          -- 税抜単価 = floor( (税込定価 + 差額) / (1 + 税率) )
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
        END LOOP;  -- items

        INSERT INTO sales (
          id, total_amount, items,
          male_count, female_count, staff_name,
          payment_method, created_at
        ) VALUES (
          gen_random_uuid(), v_total, v_items,
          v_male, v_female, v_staff,
          v_payment, v_ts
        );

      END LOOP;  -- transactions
    END LOOP;  -- days

    RAISE NOTICE '✓ %年データ生成完了', v_year;
  END LOOP;  -- years

  RAISE NOTICE '✅ 全データ生成完了';
END $$;

-- ── Step 3: 集計確認クエリ ────────────────────────────────────
SELECT
  EXTRACT(YEAR FROM created_at)::TEXT            AS "年",
  COUNT(*)                                        AS "会計件数",
  TO_CHAR(SUM(total_amount), 'FM999,999,999')    AS "合計売上(円)",
  TO_CHAR(ROUND(AVG(total_amount)), 'FM9,999')   AS "平均単価(円)",
  ROUND(SUM(CASE WHEN pm.tax8 > 0 THEN 1.0 ELSE 0.0 END) / COUNT(*) * 100, 1)::TEXT || '%'
    AS "テイクアウト率"
FROM sales
CROSS JOIN LATERAL (
  SELECT SUM((item->>'tax_rate')::FLOAT * (item->>'unit_price')::INT) AS tax8
  FROM jsonb_array_elements(items) item
  WHERE (item->>'tax_rate')::FLOAT = 0.08
) pm
GROUP BY EXTRACT(YEAR FROM created_at)
ORDER BY 1;
