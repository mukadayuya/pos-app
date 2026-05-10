# FLOWS POS — 開発ログ

このファイルは各セッション終了時に更新します。

---

## 実装済み機能（現在の確定状態）

### store_settings テーブル（Supabase）

**スキーマ（`supabase/add_store_settings.sql`）:**
```sql
CREATE TABLE store_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON store_settings FOR ALL USING (true) WITH CHECK (true);
```

**管理している設定行（key-value 形式）:**

| key | value 型 | デフォルト | 用途 |
|---|---|---|---|
| `is_takeout_enabled` | boolean | true | テイクアウト機能のマスタースイッチ |
| `is_emoji_enabled` | boolean | true | 商品登録画面の絵文字 UI 表示制御 |
| `available_emojis` | string[] (JSONB) | 24個の食料絵文字 | 商品登録で選択できる絵文字リスト |

**初期 SQL 適用順（Supabase Dashboard → SQL Editor）:**
1. `supabase/add_store_settings.sql`
2. `supabase/add_emoji_settings.sql`
3. （スキーマ問題が発生した場合のみ）`supabase/fix_store_settings_schema.sql`

---

### src/lib/storeSettings.ts — 確定実装

**fetch（読み取り）の設計原則:**
- localStorage を一切参照しない
- DB が明示的に `false` を持つ場合のみ `false` を返す
- エラー / 行なし / Supabase 未設定 → すべて `true`（デフォルト）

**write（書き込み）の設計原則:**
- `upsert(onConflict: "key")` は不使用（key に UNIQUE 制約がないスキーマで失敗するため）
- 代わりに `dbUpsertSetting()` ヘルパーで **UPDATE → 0件なら INSERT** の2段階パターンを使用
- この方式は key の UNIQUE 制約有無に依存しない

**エクスポートされる主な関数:**
- `fetchIsTakeoutEnabled(): Promise<boolean>`
- `persistIsTakeoutEnabled(value: boolean): Promise<void>` — エラー時は throw（呼び出し元がトースト表示）
- `fetchEmojiSettings(): Promise<EmojiSettings>`
- `persistEmojiSettings(settings: EmojiSettings): Promise<void>` — Promise.all で2キーを並列保存

---

### テイクアウト機能

- `src/components/CategoryBar.tsx`: テイクアウトボタンは `categories.map()` の**外側**に固定。カテゴリー state の変化に影響されない。
- `src/app/register/page.tsx`:
  - `isTakeoutEnabled` は `useState(true)` で初期化（フェッチ前もボタンを表示）
  - マウント時 + `visibilitychange`（タブ復帰時）に `fetchIsTakeoutEnabled()` を再実行
  - `enabled === false` の場合のみ無効化（明示的 if/else ガード）
- `src/app/product-management/page.tsx` → DisplayTab:
  - トグル操作中は `isTakeoutSaving` で無効化
  - 保存成功 → 3秒トースト、失敗 → 6秒トースト（エラー内容付き）

---

### 絵文字設定

- `src/types/pos.ts`: `MenuItem.emoji?: string`（optional — 未設定時は `undefined`）
- `src/lib/db.ts`: `toItem` で `emoji` が null/空なら `undefined` を返す（"🍽️" フォールバックを廃止）
- `src/components/MenuPanel.tsx`: `{item.emoji && <span>...</span>}` — 未設定時はスペースなしでスキップ
- DisplayTab（商品管理 → 表示設定）:
  - `is_emoji_enabled` トグル（ON/OFF）
  - 絵文字リスト編集（追加 / ✕で削除 / デフォルトに戻す）
  - 追加時バリデーション: `Intl.Segmenter` でグラフェムクラスタ数 = 1、かつ `\p{Extended_Pictographic}` に該当する文字のみ許可
- ItemForm（商品登録・編集）: `isEmojiEnabled` が false のとき絵文字選択 UI を非表示

---

### 商品別テイクアウト可否フラグ

- `menus.is_takeout_available BOOLEAN DEFAULT true`（`supabase/add_takeout_flag.sql`）
- `MenuItem.isTakeoutAvailable?: boolean`（`undefined` は `true` 扱い）
- db.ts: 42703 フォールバック（カラム未追加の旧 DB でも動作継続）
- MenuPanel: テイクアウトタブは `isTakeoutAvailable !== false` の商品のみ表示

---

### オプションテンプレート

- `option_templates` テーブル（`supabase/add_option_templates.sql`）
- `seedDefaultOptionTemplates` で「ご飯の量」「ご飯の種類」を初期投入（0件のときのみ）
- 商品管理 → オプション管理タブで CRUD 操作
- ItemForm でテンプレートを一括適用可能

---

### Dify API 連携フック（雛形）

- `src/lib/dify.ts` — 型定義
- `src/app/api/dify/route.ts` — サーバー側プロキシ（`DIFY_API_KEY` を隔離）
- `src/hooks/useDifyApi.ts` — 汎用フック
- `src/hooks/useDifyAnalysis.ts` — 売上分析専用フック

環境変数（`.env.local`）:
```
DIFY_API_KEY=app-xxxxxxxxxxxxxxxxxxxxxxxx
DIFY_BASE_URL=https://api.dify.ai/v1
DIFY_APP_TYPE=workflow
```

---

## テスト

Vitest 48件すべて通過（menuTransform:14, hourlyAnalysis:12, hourlyDrilldown:13, optionTemplates:9）

---

## 次回タスク候補

- [ ] **Dify アプリを設計・作成** — Dify でワークフローを作り `DIFY_API_KEY` を設定 → 売上データ画面に `useDifyAnalysis` を組み込む
- [ ] **レジ画面の商品並び順** — `menus` に `display_order` を追加してドラッグ&ドロップで並び替え
- [ ] **従業員管理** — `/employees` ページの実装（現在は空）
- [ ] **テイクアウト時の税率自動設定** — `is_takeout_available=true` 商品の登録時に 8% をデフォルト提案
- [ ] **売上データ画面の印刷/PDF 出力**

---

## ワークフロー

**このログの更新ルール（Claude Code 向け）:**
1. 各セッション終了時に本ファイルを更新する
2. 確定した実装のみ記録する（試行錯誤の過程は残さない）
3. 次回タスクは `🔲` / `[ ]` で優先度順に列挙
4. 技術的な設計判断（なぜその実装か）は残す。バグ修正の経緯は不要
