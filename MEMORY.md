# FLOWS POS — 開発記録 (MEMORY.md)

> Claude Code はタスク完了時にこのファイルを更新すること。

---

## プロジェクト概要
- **アプリ名**: FLOWS by Infotainment
- **用途**: 飲食店向け POS レジ（Kitchen Kazu）
- **スタック**: Next.js 16 / TypeScript / Tailwind CSS v4 / Supabase

---

## 完了済みタスク

### 2026-04 フェーズ1: コア機能
- [x] Supabase 連携（sales / categories / menus テーブル）
- [x] 動的カテゴリーサイドバー（DB から取得、フォールバック対応）
- [x] `isTableMissingError` — テーブル未作成時のクラッシュ防止
- [x] オプションモーダル（ライス種別・サイズ選択）
- [x] 会計画面（現金・カード・複数決済対応）
- [x] 売上履歴スライドパネル
- [x] 売上データ管理ページ（`/admin/sales`）

### 2026-04 フェーズ2: UX 改善
- [x] 客層カウンター（👨男性 / 👩女性）— sales テーブルに `male_count` / `female_count` 保存
- [x] 担当者ピッカー（StaffPicker コンポーネント）— localStorage 永続化
- [x] `setup_full.sql` に `male_count`, `female_count`, `staff_name` マイグレーション追加

### 2026-04 フェーズ3: FLOWS ブランディング
- [x] 全ページをライトテーマ（`bg-[#F5F6FA]`）に統一
- [x] グラスモーフィズムヘッダー（`bg-white/80 backdrop-blur-xl`）
- [x] FLOWS ロゴ（indigo→violet グラデーション "FL" ボックス）
- [x] ホームページ完全リデザイン（Tile コンポーネント、amber "受給チャンス" タイル）
- [x] レジページに「受給チャンス」amber ボタン追加
- [x] `.clinerules` 作成（プロジェクト憲法）

### 2026-04 フェーズ5: 売上データ画面リニューアル＋データ取得不具合解消
- [x] `/sales-data` を `/admin` と同一スタイルに完全リライト
  - ダークインディゴヘッダー（`bg-indigo-700`）+ FLOWS ロゴ（`bg-white/20` 正方形）
  - `bg-slate-100` 背景 / `bg-white rounded-2xl border border-slate-200 shadow-sm` カード
  - 期間サマリーカード（先月 / 昨日 / 今月 / 本日）— 訂正・削除後に即再計算
  - 時間別バーチャート（本日・div ベース）
  - 日別 / 月別 / 年別 切替グラフ + 一覧テーブル
  - メニュー別ランキング
  - **本日の注文明細一覧 + 月別注文履歴**（月セレクター付き）
  - **注文訂正モーダル**（品目ごとに数量 ± 操作 → 合計自動再計算 → Supabase 更新）
  - **削除機能**（インライン確認 UI、window.confirm 不使用）
  - CSV エクスポート・領収書発行・税理士メール機能を維持
- [x] **データ取得エラー修正**（`store_id` 追加後に全データ取得が壊れていた問題）
  - `storeMatch()` ヘルパー（`Record<string, string>`）+ `.match()` でオプション店舗フィルター
  - `fetchDefaultStoreId()` で Kitchen Kazu の UUID を起動時に取得→全クエリに渡す
  - `fetchSalesDetail`: 拡張カラム（`male_count` 等）未設定時のフォールバック（42703 → 基本カラム再試行）
  - 全サマリー関数（`fetchTodaySummary` 等 6 関数）に `storeId` オプション追加
- [x] `src/lib/db.ts` に `updateSaleRecord()` / `storeMatch()` 追加
- [x] `SaleDetailRow` 型に `male_count / female_count / staff_name` 追加
- [x] `SaleDetailItem` / `SaleRecordUpdate` 型を新設
- [x] `src/lib/adminDb.ts` に `fetchDefaultStoreId()` 追加

### 2026-04 フェーズ4: 管理者ダッシュボード（多店舗管理）
- [x] `supabase/setup_admin.sql` — stores / employees テーブル + sales.store_id FK
- [x] `src/lib/adminDb.ts` — 店舗一覧・ダッシュボードデータ取得ロジック
- [x] `src/app/admin/page.tsx` — コンサルタント専用管理ダッシュボード
  - KPI カード（導入店舗数 / アラート数 / 当月総売上 / 総従業員数）
  - フィルター（全店舗 / ⚠️ アラートあり）
  - 店舗カード: 3ヶ月バーチャート（純 SVG）+ 前月比 MoM + アラートチップ
  - アラート自動検出: 売上減少（-5%未満）/ 雇用増（当月新規雇用）
- [x] ホームページに「管理ダッシュボード」タイル追加（旧「入出金管理」と置換）

---

### 2026-04 フェーズ6: タブ形式 UI への統合リニューアル
- [x] `/sales-data` を左サイドバー型タブ UI（Liquid レジ風）に完全刷新
  - 左ナビ（violet-900、210px）: この日の売上 / 会計一覧 / カテゴリー別 / 商品別 / 担当者別 / 時間帯別
  - 対象月セレクターをサイドバーに統合（非 today タブ時のみ表示）
  - `monthOrders` から client-side でカテゴリー・商品・担当者・時間帯を集計
  - `storeId` を `string | null | undefined` で管理（undefined = 未取得）→ storeId 確定後にのみ月別 fetch
  - すべてのアクションボタン（CSV / 領収書 / レジへ）をヘッダーに集約
- [x] `/settings` を FLOWS ブランド（violet ヘッダー + slate-50 背景）に完全リライト
  - 横タブ: 店舗設定 / 点検・精算 / ハードウェア
  - 点検・精算サブタブ: 点検（DB からサマリー + 時間別グラフ） / レジ金入力（紙幣・硬貨カウンター） / 精算実行
  - レジ金入力: 9種類の紙幣・硬貨カウンター → 合計自動計算
  - 精算実行: 売上 vs レジ金の差異表示 + 精算前チェックリスト
- [x] `/admin` 廃止 → ホームから「管理ダッシュボード」タイルを削除し「入出金管理（準備中）」に置換
- [x] `/register` の「売上データ」リンクを `/admin/sales` → `/sales-data` に変更

## 未完了 / 今後の課題

- [ ] ユーザー作業: `supabase/setup_admin.sql` を Supabase Dashboard で実行
- [ ] ユーザー作業: `supabase/setup_full.sql` を実行して `male_count` 等カラムを反映
- [ ] 入出金管理機能（現状「準備中」タイル）
- [ ] `/product-management` ページの安定化

---

## 重要な設計メモ

### カテゴリー ↔ ServiceTab の分離
`activeCategoryId` は純粋にフィルター用。税率に使う `ServiceTab` はカテゴリー名から導出：
```
isTakeout = selectedCategory?.name === "テイクアウト"
activeTab = isTakeout ? "takeout" : name === "昼部" ? "lunch" : "dinner"
```

### DB フォールバック戦略
1. Supabase 呼び出し失敗 → `isTableMissingError` でキャッチ → デフォルト値を返す
2. `saveSaleRecord`: 新カラムでエラー(42703) → 基本カラムのみで再試行

### Supabase セットアップ
`supabase/setup_full.sql` を Supabase Dashboard → SQL Editor で実行。
既存テーブルがあっても安全（IF NOT EXISTS + DO ブロックマイグレーション）。
