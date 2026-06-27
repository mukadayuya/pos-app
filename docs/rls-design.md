# RLS（行レベルセキュリティ）設計 — 商用化に向けたデータ分離

作成: 2026-06-13

## 現状の問題

全テーブルに `anon_all`（USING true / WITH CHECK true）ポリシーが付いており、
**anonキーを知っていれば誰でも・どの店舗のデータも読み書き削除できる**。
anonキーはブラウザに配布されるため、商用では顧客間のデータ分離が成立しない。

アプリは anon キーで sales / categories / menus / option_templates / store_settings の
フルCRUDを行っているため、「書き込みだけ塞ぐ」対処はアプリを壊す。

## 選択肢

### 案B: 店舗ごとに Supabase プロジェクトを分ける（推奨・最初の商用顧客向け）

- 各顧客店舗に専用 Supabase プロジェクト（無料枠で開始可）＋専用 Vercel プロジェクト
- 環境変数（SUPABASE_URL / ANON_KEY / STORE_ID）を差し替えるだけ。**コード変更ゼロ**
- 分離は物理的に完全。1店舗の鍵が漏れても他店舗に影響なし
- 運用: `supabase/setup_full.sql` を新プロジェクトで実行 → セットアップスクリプト実行
- デメリット: 店舗数が増えるとプロジェクト管理が煩雑（〜10店舗までが現実的）

### 案A: Supabase Auth + RLS（スケール時の本命）

- 店舗ごとにSupabaseユーザーを発行し、JWT の `app_metadata.store_id` でRLS判定
- 1プロジェクトで何百店舗でも管理可能・管理ダッシュボードも作りやすい
- 必要な実装（約1日）:
  1. ログイン画面（`supabase.auth.signInWithPassword`）
  2. 店舗ユーザー作成フロー（service_role で `app_metadata.store_id` を設定）
  3. `supabase/enable_rls_per_store.sql` の適用（anon_all を削除）
  4. categories/menus の `store_id` カラムを TEXT → 実UUIDに統一

## 推奨ロードマップ

1. **最初の1〜3顧客**: 案B（プロジェクト分離）で即販売開始
2. **店舗数が5を超えたら**: 案Aを実装し、新規店舗から移行

## 適用SQL

- 案A用ポリシー: `supabase/enable_rls_per_store.sql`（**Auth実装前に流すとアプリが動かなくなるので注意**）

## 注意（既知の残課題）

- `stores` テーブルは現状 anon で INSERT 可能（デモ作成の都合）。案Bでは問題にならないが、
  案Aでは service_role 限定にする（SQLに含めてある）
- `store_settings` は key にstore_idを含めて擬似分離している（draft_order_* など）。
  案Aに移行する際は store_id カラムを追加して RLS 対象にする
