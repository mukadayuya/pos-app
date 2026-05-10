-- Seed Kitchen Kazu menu items with dynamic option groups
-- Run AFTER: setup_full.sql and add_menu_options.sql
-- Safe to run multiple times (skips if menus table already has rows)

DO $$
DECLARE
  lunch_id  UUID;
  dinner_id UUID;
  default_options JSONB;
BEGIN
  -- Find category UUIDs by name
  SELECT id INTO lunch_id  FROM categories WHERE name = '昼部'  LIMIT 1;
  SELECT id INTO dinner_id FROM categories WHERE name = '夜部'  LIMIT 1;

  IF lunch_id IS NULL THEN
    RAISE EXCEPTION '「昼部」カテゴリーが見つかりません。先にカテゴリーを作成してください。';
  END IF;
  IF dinner_id IS NULL THEN
    RAISE EXCEPTION '「夜部」カテゴリーが見つかりません。先にカテゴリーを作成してください。';
  END IF;

  -- Skip if data already exists
  IF (SELECT COUNT(*) FROM menus) > 0 THEN
    RAISE NOTICE 'menus テーブルに既存データがあります。スキップします（既存データを保持）。';
    RETURN;
  END IF;

  -- Default option groups (rice size + type) — tax-inclusive yen deltas
  default_options := jsonb_build_object(
    'optionGroups', jsonb_build_array(
      jsonb_build_object(
        'id',    'rice-size',
        'name',  'ご飯の量',
        'items', jsonb_build_array(
          jsonb_build_object('id','none',    'name','ご飯なし', 'price', 0),
          jsonb_build_object('id','small',   'name','小ライス', 'price',-20),
          jsonb_build_object('id','regular', 'name','普通',     'price', 0),
          jsonb_build_object('id','large',   'name','大盛',     'price', 0),
          jsonb_build_object('id','extra',   'name','特盛',     'price',80)
        )
      ),
      jsonb_build_object(
        'id',    'rice-type',
        'name',  'ご飯の種類',
        'items', jsonb_build_array(
          jsonb_build_object('id','white', 'name','白米',     'price', 0),
          jsonb_build_object('id','mochi', 'name','十五穀米', 'price', 0)
        )
      )
    )
  );

  -- Insert lunch items
  INSERT INTO menus (id, name, price, category, emoji, tax_rate, options, created_at) VALUES
    (gen_random_uuid(), 'トンヒレカツと飛騨牛コロッケの合盛り', 930, lunch_id,  '🍱', 0.10, default_options, NOW() - INTERVAL '3 days'),
    (gen_random_uuid(), 'ハマチの酢豚風',                       930, lunch_id,  '🐟', 0.10, default_options, NOW() - INTERVAL '3 days' + INTERVAL '1 minute'),
    (gen_random_uuid(), '豚肉となすのこうじ味噌焼き丼',          930, lunch_id,  '🍚', 0.10, default_options, NOW() - INTERVAL '3 days' + INTERVAL '2 minutes'),
    (gen_random_uuid(), 'チキンカツ',                           1150, dinner_id, '🍗', 0.10, default_options, NOW() - INTERVAL '3 days' + INTERVAL '3 minutes'),
    (gen_random_uuid(), 'シーフードミックスフライ',              1150, dinner_id, '🦐', 0.10, default_options, NOW() - INTERVAL '3 days' + INTERVAL '4 minutes'),
    (gen_random_uuid(), 'ゴーヤーチャンプルー',                 1150, dinner_id, '🥬', 0.10, default_options, NOW() - INTERVAL '3 days' + INTERVAL '5 minutes'),
    (gen_random_uuid(), '豚ホルモンと五目野菜のしょうが炒め',    1150, dinner_id, '🥩', 0.10, default_options, NOW() - INTERVAL '3 days' + INTERVAL '6 minutes'),
    (gen_random_uuid(), '照焼チキンとアボカドのサラダ丼',        1150, dinner_id, '🥑', 0.10, default_options, NOW() - INTERVAL '3 days' + INTERVAL '7 minutes');

  RAISE NOTICE '% 件のメニューを投入しました。', 8;
END $$;
