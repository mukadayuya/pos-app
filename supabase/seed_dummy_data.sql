-- ================================================================
-- FLOWS POS — デモ用ダミーデータ投入スクリプト
-- Supabase Dashboard → SQL Editor で実行してください
-- 実行後、/sales-data で直近1ヶ月の集計が確認できます
-- ================================================================
DO $$
DECLARE
  v_day         DATE;
  v_rec_count   INT;
  i             INT;
  j             INT;
  v_ts          TIMESTAMPTZ;
  v_hour        INT;
  v_min         INT;
  v_is_lunch    BOOLEAN;
  v_is_takeout  BOOLEAN;
  v_staff       TEXT;
  v_male        INT;
  v_female      INT;
  v_item_count  INT;
  v_items       JSONB;
  v_total       INT;
  v_rand        FLOAT;
  v_item_id     TEXT;
  v_item_name   TEXT;
  v_item_emoji  TEXT;
  v_base_price  INT;
  v_unit_price  INT;
  v_item_tax    FLOAT;
  v_rice_adj    INT;
  v_item_total  INT;
  v_store_id    UUID;
  v_has_sid     BOOLEAN;
BEGIN
  -- store_id カラムの有無を確認
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'store_id'
  ) INTO v_has_sid;

  -- stores テーブルがあれば Kitchen Kazu の store_id を取得
  IF v_has_sid THEN
    BEGIN
      EXECUTE 'SELECT id FROM stores ORDER BY created_at LIMIT 1' INTO v_store_id;
    EXCEPTION WHEN OTHERS THEN
      v_store_id := NULL;
    END;
  END IF;

  FOR v_day IN
    SELECT d::DATE
    FROM generate_series(
      CURRENT_DATE - INTERVAL '30 days',
      CURRENT_DATE - INTERVAL '1 day',
      INTERVAL '1 day'
    ) d
    WHERE EXTRACT(DOW FROM d) != 1  -- 月曜定休
  LOOP
    -- 金・土はピーク（18〜23件）、平日は13〜19件
    v_rec_count := CASE
      WHEN EXTRACT(DOW FROM v_day) IN (5, 6) THEN 18 + (random() * 5)::INT
      ELSE 13 + (random() * 6)::INT
    END;

    FOR i IN 1..v_rec_count LOOP
      v_is_lunch   := random() < 0.42;
      v_is_takeout := (NOT v_is_lunch) AND (random() < 0.12);

      -- 時間帯（昼11〜13時、夜17〜21時）
      IF v_is_lunch THEN
        v_hour := 11 + (random() * 2.8)::INT;
      ELSE
        v_hour := 17 + (random() * 4.5)::INT;
      END IF;
      v_min := (random() * 59)::INT;
      v_ts := (
        (v_day::TEXT || ' ' || lpad(v_hour::TEXT, 2, '0') || ':' || lpad(v_min::TEXT, 2, '0') || ':00')::TIMESTAMP
        AT TIME ZONE 'Asia/Tokyo'
      );

      -- スタッフ（沖40% / 向田35% / スタッフA25%）
      v_rand := random();
      v_staff := CASE
        WHEN v_rand < 0.40 THEN '沖'
        WHEN v_rand < 0.75 THEN '向田'
        ELSE 'スタッフA'
      END;

      -- 客層（テイクアウトはゼロ）
      IF v_is_takeout THEN
        v_male := 0; v_female := 0;
      ELSE
        v_male   := (random() * 3)::INT;   -- 0〜3
        v_female := (random() * 2.5)::INT; -- 0〜2
        -- 最低1名は記録
        IF v_male = 0 AND v_female = 0 THEN
          IF random() < 0.55 THEN v_male := 1; ELSE v_female := 1; END IF;
        END IF;
      END IF;

      -- 1〜3品
      v_item_count := 1 + (random() * 2.4)::INT;
      v_items := '[]'::JSONB;
      v_total := 0;

      FOR j IN 1..v_item_count LOOP
        v_rand := random();
        -- 看板商品（ハマチの酢豚風・トンヒレカツ）を重点配分
        IF    v_rand < 0.24 THEN
          v_item_id := 'l2'; v_item_name := 'ハマチの酢豚風';
          v_item_emoji := '🐟'; v_base_price := 930;
        ELSIF v_rand < 0.43 THEN
          v_item_id := 'l1'; v_item_name := 'トンヒレカツと飛騨牛コロッケの合盛り';
          v_item_emoji := '🍱'; v_base_price := 930;
        ELSIF v_rand < 0.58 THEN
          v_item_id := 'l3'; v_item_name := '豚肉となすのこうじ味噌焼き丼';
          v_item_emoji := '🍚'; v_base_price := 930;
        ELSIF v_rand < 0.70 THEN
          v_item_id := 'd1'; v_item_name := 'チキンカツ';
          v_item_emoji := '🍗'; v_base_price := 1150;
        ELSIF v_rand < 0.80 THEN
          v_item_id := 'd2'; v_item_name := 'シーフードミックスフライ';
          v_item_emoji := '🦐'; v_base_price := 1150;
        ELSIF v_rand < 0.88 THEN
          v_item_id := 'd4'; v_item_name := '豚ホルモンと五目野菜のしょうが炒め';
          v_item_emoji := '🥩'; v_base_price := 1150;
        ELSIF v_rand < 0.94 THEN
          v_item_id := 'd3'; v_item_name := 'ゴーヤーチャンプルー';
          v_item_emoji := '🥬'; v_base_price := 1150;
        ELSE
          v_item_id := 'd5'; v_item_name := '照焼チキンとアボカドのサラダ丼';
          v_item_emoji := '🥑'; v_base_price := 1150;
        END IF;

        v_item_tax := CASE WHEN v_is_takeout THEN 0.08 ELSE 0.10 END;

        -- ご飯サイズ（税込差額）
        v_rand := random();
        v_rice_adj := CASE
          WHEN v_rand < 0.07 THEN  80   -- 特盛
          WHEN v_rand < 0.15 THEN -20   -- 小ライス
          ELSE 0                         -- 普通/大盛
        END;

        -- 税抜単価 = round( (round(base*(1+tax)) + adj) / (1+tax) )
        v_unit_price := ROUND(
          (ROUND(v_base_price::FLOAT * (1.0 + v_item_tax)) + v_rice_adj)::FLOAT
          / (1.0 + v_item_tax)
        );
        v_item_total := ROUND(v_unit_price::FLOAT * (1.0 + v_item_tax));
        v_total      := v_total + v_item_total;

        v_items := v_items || jsonb_build_array(jsonb_build_object(
          'id',         v_item_id,
          'name',       v_item_name,
          'emoji',      v_item_emoji,
          'quantity',   1,
          'unit_price', v_unit_price,
          'tax_rate',   v_item_tax
        ));
      END LOOP;

      -- store_id カラムがある場合は含めて挿入
      IF v_has_sid AND v_store_id IS NOT NULL THEN
        EXECUTE '
          INSERT INTO sales (id, total_amount, items, male_count, female_count, staff_name, store_id, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)'
        USING gen_random_uuid(), v_total, v_items, v_male, v_female, v_staff, v_store_id, v_ts;
      ELSE
        INSERT INTO sales (id, total_amount, items, male_count, female_count, staff_name, created_at)
        VALUES (gen_random_uuid(), v_total, v_items, v_male, v_female, v_staff, v_ts);
      END IF;

    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ デモデータ挿入完了（直近30日分）';
END $$;
