-- ================================================================
-- ブロンコ POS — 2026年6月 売上デモデータ生成
--
-- 目標売上（実績見込み+10%盛り）
--   ランチ（11:00-14:30）: ¥165,000/日
--   ディナー（17:00-21:30）: ¥330,000/日
--   合計: ¥495,000/日 × 25営業日 ≒ ¥12,375,000/月
--
-- 営業日: 月曜定休（6/1,8,15,22,29 を除く）
-- スタッフ: 畠野50% / 向田30% / スタッフA20%
-- ================================================================

DO $$
DECLARE
  v_day     DATE;
  v_dow     INT;
  i         INT;
  v_ts      TIMESTAMPTZ;
  v_hour    INT;
  v_min     INT;
  v_staff   TEXT;
  v_male    INT;
  v_female  INT;
  v_payment TEXT;
  v_items   JSONB;
  v_total   INT;
  v_rand    FLOAT;
  v_r2      FLOAT;

  -- ── ランチメニュー（軽め・低単価中心） ──────────────────────
  -- [id, name, emoji, unit_price]
  l_ids    TEXT[]  := ARRAY['br-st4','br-hb3','br-hb2','br-hb1','br-st5','br-hb5','br-hb4'];
  l_names  TEXT[]  := ARRAY['ハラミ ステーキ 200g','ハンバーグ 200g','ハンバーグ 300g','ハンバーグ 400g','チキン ステーキ','ハンバーグ 300g チーズ','ハンバーグ 400g チーズ'];
  l_emojis TEXT[]  := ARRAY['🥩','🍔','🍔','🍔','🍗','🧀','🧀'];
  l_prices INT[]   := ARRAY[1100,810,1220,1540,990,1390,1740];
  l_n      INT     := 7;

  -- ── ディナーメニュー（高単価メイン） ─────────────────────────
  d_ids    TEXT[]  := ARRAY['br-st1','br-st2','br-st3','br-st4','br-st5','br-hb1','br-hb2','br-hb4','br-hb5','br-mx11'];
  d_names  TEXT[]  := ARRAY['リブロース ステーキ 450g','リブロース ステーキ 300g','リブロース ステーキ 220g','ハラミ ステーキ 200g','チキン ステーキ','ハンバーグ 400g','ハンバーグ 300g','ハンバーグ 400g チーズ','ハンバーグ 300g チーズ','スペアリブス B.B.Q'];
  d_emojis TEXT[]  := ARRAY['🥩','🥩','🥩','🥩','🍗','🍔','🍔','🧀','🧀','🍖'];
  d_prices INT[]   := ARRAY[3960,2800,2100,1100,990,1540,1220,1740,1390,1200];
  d_n      INT     := 10;

  -- ── サイドメニュー ────────────────────────────────────────
  s_ids    TEXT[]  := ARRAY['br-se1','br-sa3','br-sa2','br-sa1','br-sp3','br-sp2','br-sp1','br-mx3','br-mx5','br-ds1','br-ds2'];
  s_names  TEXT[]  := ARRAY['スモールサラダ＋ドリンクセット','メキシカン サラダ S','メキシカン サラダ M','メキシカン サラダ L','コーンスープ','メキシカンスープ','クラブ スープ','タコス','ブリト','バニラアイス small','バニラアイス large'];
  s_emojis TEXT[]  := ARRAY['☕','🥗','🥗','🥗','🌽','🍲','🦀','🌮','🌯','🍦','🍦'];
  s_prices INT[]   := ARRAY[280,220,440,550,660,550,880,750,770,200,400];
  s_n      INT     := 11;

  v_idx    INT;
  v_price  INT;
  v_side_p INT;
  v_n_lunch   INT;
  v_n_dinner  INT;

BEGIN
  -- 既存のブロンコデータを全件削除
  DELETE FROM sales WHERE store_id = 'bronco';
  RAISE NOTICE 'bronco既存データを削除しました';

  -- 6月1日〜30日をループ
  FOR v_day IN SELECT generate_series('2026-06-01'::DATE, '2026-06-30'::DATE, '1 day')::DATE LOOP

    v_dow := EXTRACT(DOW FROM v_day); -- 0=日, 1=月, ..., 6=土

    -- 月曜定休
    IF v_dow = 1 THEN CONTINUE; END IF;

    -- 土日は少し多め
    v_n_lunch  := CASE WHEN v_dow IN (0,6) THEN 90 + (random()*10)::INT
                        ELSE 80 + (random()*10)::INT END;
    v_n_dinner := CASE WHEN v_dow IN (0,6) THEN 118 + (random()*12)::INT
                        ELSE 108 + (random()*12)::INT END;

    -- ── ランチタイム ────────────────────────────────────────
    FOR i IN 1..v_n_lunch LOOP
      v_hour := 11 + (random() * 3.4)::INT;
      v_hour := LEAST(v_hour, 14);
      v_min  := (random() * 59)::INT;
      v_ts   := (v_day::TEXT || ' ' || LPAD(v_hour::TEXT,2,'0') || ':' || LPAD(v_min::TEXT,2,'0') || ':00+09:00')::TIMESTAMPTZ;

      -- スタッフ
      v_rand := random();
      v_staff := CASE WHEN v_rand < 0.50 THEN '畠野'
                      WHEN v_rand < 0.80 THEN '向田'
                      ELSE 'スタッフA' END;

      -- 客数
      v_male   := (random() * 2)::INT + 1;
      v_female := (random() * 2)::INT;

      -- 支払い
      v_rand := random();
      v_payment := CASE WHEN v_rand < 0.55 THEN 'cash'
                        WHEN v_rand < 0.85 THEN 'card'
                        ELSE 'qr' END;

      -- メイン1品を選ぶ（ランチメニューから）
      v_idx   := 1 + (random() * (l_n - 1))::INT;
      v_price := l_prices[v_idx];
      v_items := jsonb_build_array(jsonb_build_object(
        'id',         l_ids[v_idx],
        'name',       l_names[v_idx],
        'emoji',      l_emojis[v_idx],
        'unit_price', v_price,
        'quantity',   1,
        'tax_rate',   0.10
      ));

      -- サイド（80%の確率で1品追加）
      IF random() < 0.80 THEN
        v_idx    := 1 + (random() * (s_n - 1))::INT;
        v_side_p := s_prices[v_idx];
        v_price  := v_price + v_side_p;
        v_items  := v_items || jsonb_build_array(jsonb_build_object(
          'id',         s_ids[v_idx],
          'name',       s_names[v_idx],
          'emoji',      s_emojis[v_idx],
          'unit_price', v_side_p,
          'quantity',   1,
          'tax_rate',   0.10
        ));
      END IF;

      v_total := ROUND(v_price * 1.10);

      INSERT INTO sales (
        id, total_amount, items,
        store_id, staff_name,
        male_count, female_count,
        payment_method, created_at,
        tax10, tax8, tax
      ) VALUES (
        gen_random_uuid(), v_total, v_items,
        'bronco', v_staff,
        v_male, v_female,
        v_payment, v_ts,
        ROUND(v_price * 0.10), 0, ROUND(v_price * 0.10)
      );
    END LOOP;

    -- ── ディナータイム ───────────────────────────────────────
    FOR i IN 1..v_n_dinner LOOP
      v_hour := 17 + (random() * 4.4)::INT;
      v_hour := LEAST(v_hour, 21);
      v_min  := (random() * 59)::INT;
      v_ts   := (v_day::TEXT || ' ' || LPAD(v_hour::TEXT,2,'0') || ':' || LPAD(v_min::TEXT,2,'0') || ':00+09:00')::TIMESTAMPTZ;

      -- スタッフ
      v_rand := random();
      v_staff := CASE WHEN v_rand < 0.50 THEN '畠野'
                      WHEN v_rand < 0.80 THEN '向田'
                      ELSE 'スタッフA' END;

      -- 客数（ディナーは多め）
      v_male   := (random() * 2)::INT + 1;
      v_female := (random() * 3)::INT;

      -- 支払い（ディナーはカード多め）
      v_rand := random();
      v_payment := CASE WHEN v_rand < 0.45 THEN 'cash'
                        WHEN v_rand < 0.85 THEN 'card'
                        ELSE 'qr' END;

      -- メイン1品を選ぶ（ディナーメニューから）
      v_idx   := 1 + (random() * (d_n - 1))::INT;
      v_price := d_prices[v_idx];
      v_items := jsonb_build_array(jsonb_build_object(
        'id',         d_ids[v_idx],
        'name',       d_names[v_idx],
        'emoji',      d_emojis[v_idx],
        'unit_price', v_price,
        'quantity',   1,
        'tax_rate',   0.10
      ));

      -- サイド1品（90%の確率）
      IF random() < 0.90 THEN
        v_idx    := 1 + (random() * (s_n - 1))::INT;
        v_side_p := s_prices[v_idx];
        v_price  := v_price + v_side_p;
        v_items  := v_items || jsonb_build_array(jsonb_build_object(
          'id',         s_ids[v_idx],
          'name',       s_names[v_idx],
          'emoji',      s_emojis[v_idx],
          'unit_price', v_side_p,
          'quantity',   1,
          'tax_rate',   0.10
        ));
      END IF;

      -- サイド2品目（50%の確率）
      IF random() < 0.50 THEN
        v_idx    := 1 + (random() * (s_n - 1))::INT;
        v_side_p := s_prices[v_idx];
        v_price  := v_price + v_side_p;
        v_items  := v_items || jsonb_build_array(jsonb_build_object(
          'id',         s_ids[v_idx],
          'name',       s_names[v_idx],
          'emoji',      s_emojis[v_idx],
          'unit_price', v_side_p,
          'quantity',   1,
          'tax_rate',   0.10
        ));
      END IF;

      v_total := ROUND(v_price * 1.10);

      INSERT INTO sales (
        id, total_amount, items,
        store_id, staff_name,
        male_count, female_count,
        payment_method, created_at,
        tax10, tax8, tax
      ) VALUES (
        gen_random_uuid(), v_total, v_items,
        'bronco', v_staff,
        v_male, v_female,
        v_payment, v_ts,
        ROUND(v_price * 0.10), 0, ROUND(v_price * 0.10)
      );
    END LOOP;

  END LOOP;

  RAISE NOTICE '✅ ブロンコ 2026年6月データ生成完了';
END $$;

-- ================================================================
-- 確認クエリ
-- ================================================================
SELECT
  (created_at AT TIME ZONE 'Asia/Tokyo')::DATE         AS 日付,
  TO_CHAR(created_at AT TIME ZONE 'Asia/Tokyo', 'Dy')  AS 曜日,
  COUNT(*)                                              AS 件数,
  TO_CHAR(SUM(total_amount), 'FM¥9,999,999')           AS 売上合計
FROM sales
WHERE store_id = 'bronco'
  AND created_at >= '2026-06-01T00:00:00+09:00'
GROUP BY 1, 2
ORDER BY 1;
