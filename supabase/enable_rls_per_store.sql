-- 店舗単位RLS（案A: Supabase Auth 導入後に適用）
--
-- ⚠️ 警告: Auth（ログイン）実装前にこのSQLを流すと、anonキーで動いている
-- 現行アプリは一切読み書きできなくなる。docs/rls-design.md を先に読むこと。
--
-- 前提:
--   - 店舗ユーザーの JWT に app_metadata.store_id（storesテーブルのUUID文字列）が入っている
--   - categories.store_id / menus.store_id は店舗UUID文字列で統一されている

-- JWTから店舗IDを取り出すヘルパー
CREATE OR REPLACE FUNCTION current_store_id() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'store_id',
    ''
  );
$$;

-- ─── sales ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_all ON sales;
CREATE POLICY store_isolation ON sales
  FOR ALL TO authenticated
  USING (store_id::text = current_store_id())
  WITH CHECK (store_id::text = current_store_id());

-- ─── categories ─────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_all ON categories;
CREATE POLICY store_isolation ON categories
  FOR ALL TO authenticated
  USING (store_id = current_store_id())
  WITH CHECK (store_id = current_store_id());

-- ─── menus ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_all ON menus;
CREATE POLICY store_isolation ON menus
  FOR ALL TO authenticated
  USING (store_id = current_store_id())
  WITH CHECK (store_id = current_store_id());

-- ─── stores（自店舗の参照のみ・作成/変更は service_role 限定）────
DROP POLICY IF EXISTS anon_all ON stores;
CREATE POLICY store_read_own ON stores
  FOR SELECT TO authenticated
  USING (id::text = current_store_id());

-- ─── store_settings / option_templates ──────────────────────────
-- store_id カラム追加後に同様の store_isolation ポリシーを適用する
-- （現状は key 名に store_id を含める擬似分離。rls-design.md 参照）
