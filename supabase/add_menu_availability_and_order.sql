-- 目的: メニュー管理UI強化（Phase 1-②）
-- 追加カラム:
--   is_available    ... 販売可否フラグ（売り切れ表示に使用）
--   display_order   ... 表示順（オーナーが並び替え可能）
-- 実行タイミング: Supabase Dashboard の SQL Editor で一度だけ実行

BEGIN;

ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 999;

-- 既存メニューにストア毎の連番を初期割当（display_orderがすべて999だと並び替えできないため）
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY created_at) AS seq
  FROM public.menus
)
UPDATE public.menus m
SET display_order = numbered.seq
FROM numbered
WHERE m.id = numbered.id;

-- パフォーマンス: 店舗別に並び順で引くクエリを高速化
CREATE INDEX IF NOT EXISTS idx_menus_store_display_order
  ON public.menus (store_id, display_order);

CREATE INDEX IF NOT EXISTS idx_menus_store_available
  ON public.menus (store_id, is_available);

COMMIT;
