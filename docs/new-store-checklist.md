# 新規店舗デモ追加チェックリスト

> **このファイルの使い方**  
> 新店舗のデモを追加・デプロイするとき、Claude Codeは作業開始前にこのリストを全項目読み、  
> デプロイ前にセルフチェックとして使う。過去に毎回指摘されたポイントの再発防止が目的。

---

## STEP 0. 事前確認（必ず最初に行う）

- [ ] 今回追加する店舗ID（スラグ）を決める（例: `bronco`, `tetsu-bo`）
- [ ] Supabase の `stores` テーブルに新店舗を INSERT して UUID を取得する

```js
// Node.jsで実行
const { data } = await sb.from('stores')
  .insert({ name: '店舗名', location: '所在地', plan: 'pro', is_active: true })
  .select();
console.log(data[0].id); // → UUID をメモ
```

- [ ] 取得した UUID をメモしておく（以降のステップで使う）

---

## STEP 1. Vercel プロジェクト設定

- [ ] `vercel project add {name}` でプロジェクト作成
- [ ] Framework Preset を Next.js に設定
- [ ] SSO保護を無効化: `vercel project protection disable --sso`
- [ ] **`NEXT_PUBLIC_STORE_ID` を正しいスラグで設定**（例: `bronco`）
- [ ] `GEMINI_API_KEY` を設定（AIチャット・AIアップセル用）
- [ ] **環境変数を設定してから `vercel --prod` でビルドする**（順番を逆にすると env が焼き込まれない）
- [ ] デプロイ後 `.vercel/project.json` を kitchen-kazu に戻す

---

## STEP 2. db.ts — STORE_ID の UUID 解決

`src/lib/db.ts` の `STORE_ID` 定数は文字列IDではなく **Supabase UUID** でなければならない。  
`store_id` カラムは UUID 型のため、文字列スラグを直接使うとクエリエラーになる。

```ts
// NG: store_id カラムは UUID 型なので文字列スラグはエラー
// const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? "tetsu-bo";

// OK: スラグ → UUID に解決する
const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID === "bronco"
  ? "d61afc6a-ca9b-4641-a99b-1294985ade8e"
  : process.env.NEXT_PUBLIC_STORE_ID === "tetsu-bo"
  ? "（tetsu坊のUUID）"
  : (process.env.NEXT_PUBLIC_STORE_ID ?? "tetsu-bo");
```

- [ ] 新店舗の UUID を `db.ts` の STORE_ID 分岐に追加した

---

## STEP 3. IS_{店舗} パターン（店舗判定）

### モジュールレベルで定数を定義する（useEffect 内で process.env を読まない）

```ts
// ✅ ファイル冒頭（モジュールレベル）に定義
const IS_BRONCO = process.env.NEXT_PUBLIC_STORE_ID === "bronco";

// ❌ useEffect 内で process.env を直接読むと Next.js のビルド最適化で動作しないことがある
useEffect(() => {
  const storeId = process.env.NEXT_PUBLIC_STORE_ID; // ← NG
  if (storeId === "bronco") { ... }
}, []);

// ✅ モジュールレベル定数を使う
useEffect(() => {
  if (IS_BRONCO) { ... }
}, []);
```

- [ ] `register/page.tsx` の useEffect でモジュールレベル `IS_BRONCO` を使っている
- [ ] `product-management/page.tsx` の `load()` に静的データフォールバックを追加した

---

## STEP 4. ハードコードされた旧店舗名を全て置換する

**デプロイ前に必ず以下を実行してゼロ件を確認すること：**

```bash
grep -rn "Kitchen Kazu\|キッチン和\|Kazu\|tetsu-bo\|テツボ" src/ \
  --include="*.tsx" --include="*.ts"
```

### 過去に指摘された固定箇所（毎回漏れる）

| ファイル | 箇所 | 修正方法 |
|---|---|---|
| `components/ReceiptIssueModal.tsx` | `localStorage.getItem("store_name") \|\| "Kitchen Kazu"` | IS_BRONCO 条件分岐 |
| `components/CheckoutScreen.tsx` | `localStorage.getItem("store_name") \|\| "Kitchen Kazu"` | IS_BRONCO 条件分岐 |
| `app/settings/page.tsx` | `useState("Kitchen Kazu")` 初期値 | IS_BRONCO 条件分岐 |
| `app/settings/page.tsx` | `localStorage.getItem(...) \|\| "Kitchen Kazu"` fallback | IS_BRONCO 条件分岐 |
| `app/settings/page.tsx` | フッター `Kitchen Kazu POS v2.0` | IS_BRONCO 条件分岐 |
| `app/sales-data/page.tsx` | ヘッダー `Kitchen Kazu · FLOWS` | STORE_DISPLAY_NAME 変数化 |
| `app/sales-data/page.tsx` | 税理士メールテンプレート内の店名 | STORE_DISPLAY_NAME 変数化 |
| `app/admin/sales/page.tsx` | ダッシュボード店名 | IS_BRONCO 条件分岐 |

- [ ] 上記 8 箇所を全て確認・修正した

---

## STEP 5. SELECT フォールバックの確認

`db.ts` の sales SELECT に `item_discount_total` が含まれるが、このカラムは Supabase に存在しないため毎回フォールバックに入る。  
**フォールバック SELECT が男女・担当者・決済手段のカラムを含んでいることを確認する。**

```ts
// ❌ フォールバックがこれだと男女/担当者/決済が全部 null になる
.select("id, total_amount, items, created_at")

// ✅ 正しいフォールバック
.select("id, total_amount, items, created_at, male_count, female_count, staff_name, payment_method, discount_amount, discount, tax8, tax10, tax")
```

- [ ] `fetchSalesDetail` のフォールバック SELECT が正しい
- [ ] `fetchYearOrders` のフォールバック SELECT が正しい
- [ ] `fetchMonthOrdersForAnalysis` のフォールバック SELECT が正しい

---

## STEP 6. 年別売上（fetchYearlySummary）

`get_yearly_summary` RPC は Supabase に存在しない。クライアントサイドで集計する実装になっていることを確認する。

- [ ] `fetchYearlySummary` が RPC ではなくクライアント集計になっている（db.ts 確認）

---

## STEP 7. 新店舗メニューデータ

### `src/data/{店舗}Menu.ts`
- [ ] `{店舗}Categories` を定義した
- [ ] `{店舗}MenuItems` を定義した（price は税抜き、taxRate: 0.10）
- [ ] `register/page.tsx` に IS_{店舗} チェックと import を追加した
- [ ] `product-management/page.tsx` の `load()` に IS_{店舗} 静的データ分岐を追加した

### 多言語対応が必要な場合
- [ ] 全アイテムに `description_en`, `description_zh`, `description_ko` 追加
- [ ] `src/data/menuTranslations.ts` に全アイテムID追加
- [ ] `src/app/customer/order/page.tsx` の `COMBO_TOASTS` に言語キー追加（**ビルドエラーの原因**）
- [ ] `src/app/api/upsell/route.ts` / `src/app/api/gemini/route.ts` に言語追加

### 画像
- [ ] 全カテゴリに画像を設定する（imageUrl なし = 絵文字表示 = NG）
- [ ] ドリンクは飲み物のみのアップ写真（料理・テーブル写真での代用禁止）

---

## STEP 8. ダミーデータ（seed）

```js
// ❌ store_id にスラグ文字列を使うとエラー（UUID 型カラム）
store_id: "bronco"  // → invalid input syntax for type uuid

// ✅ Supabase から取得した UUID を使う
store_id: "d61afc6a-ca9b-4641-a99b-1294985ade8e"
```

- [ ] `seed_{店舗}.js` の `STORE_ID` に UUID を使っている
- [ ] スタッフ比率が自然（担当者Aが一番多く、未設定が最少）
- [ ] 決済手段が分散している（現金だけにならない。cash / card / qr）
- [ ] 期間は「過去30日〜今月末」を含む
- [ ] 平日・週末で来客数に差をつけている（週末を多めに）
- [ ] シード後にエラーが出ていないことを確認（`item_discount_total` 等の列欠如）

---

## STEP 9. メインメニュー（ホーム画面）レイアウト

- [ ] `broncoHidden` 相当のフラグで非表示にすべきタイルを設定した
- [ ] タイル数が 5 個の場合、右下に空白ができないようレイアウトを調整した  
  例: `row-span-2` でレジタイルを縦長にする、または `grid-cols-2` に変更

---

## STEP 10. ビルド・デプロイ確認

```bash
npm run build    # TypeScript エラーゼロを確認
vercel env ls    # NEXT_PUBLIC_STORE_ID が正しい値か確認
vercel --prod    # 環境変数設定後に実行
```

- [ ] `npm run build` がローカルで通る
- [ ] `vercel env ls` で `NEXT_PUBLIC_STORE_ID` が正しい値になっている
- [ ] `vercel --prod` でデプロイ完了

---

## STEP 11. 動作確認（デプロイ後 Cmd+Shift+R で各ページ確認）

| ページ | 確認ポイント |
|---|---|
| ホーム | タイル数・レイアウトが正しい、旧店舗名が出ていない |
| レジ画面 | 新店舗のカテゴリ・メニューが表示される |
| 設定ページ | 店名・住所・電話番号が新店舗仕様になっている |
| レシート印刷 | 店名が正しい（Kitchen Kazu になっていない） |
| 領収書発行 | 店名が正しい |
| 売上データ | ヘッダー店名・男女別・年別が数値表示される |
| 商品管理 | 新店舗のメニュー一覧が表示される |
| 税理士メール | 店名がテンプレート内で正しい |

---

## プロジェクト・UUID 一覧

| 店舗 | Vercelプロジェクト名 | STORE_ID スラグ | Supabase UUID |
|---|---|---|---|
| キッチンかず (本番) | `kitchen-kazu-pos` | — | `f1cd0931-810b-480b-9aa4-3a05584d9fb4` |
| ブロンコ | `bronco-pos` | `bronco` | `d61afc6a-ca9b-4641-a99b-1294985ade8e` |
| Tetsu坊 | `tetsu-bo-pos` | `tetsu-bo` | 要確認 |
| 東京餃子楼 | `tokyo-gyoza-demo` | — | 要確認 |
| 焼鳥居酒屋ABC（マスターサンプル） | 未作成 | `yakitori-abc` | `6f0842d5-7fe6-4278-818c-86e8a8731130` |

## マスターサンプル店舗（焼鳥居酒屋ABC）について

Tetsu坊と同じ**DB駆動型**（メニュー・カテゴリをSupabaseに保持）のマスター版。
新店舗を作るときは以下の2スクリプトをコピーして店舗名・メニューを差し替えるだけでよい。

- メニュー投入: `scripts/setup_yakitori_abc_menu.mjs`（固定UUID・冪等・多言語ja/en/zh/ko + 画像URL込み）
- 売上シード: `scripts/seed_yakitori_abc.js`（冪等・平日/週末差・スタッフ比率・決済分散）
- es/hi/bn翻訳: `src/data/menuTranslations.ts` の「焼鳥居酒屋ABC」セクション
- カテゴリ翻訳: `customer/order/page.tsx` の CATEGORY_TRANSLATIONS / CATEGORY_BN

**注意: categories.name はグローバルUNIQUE制約**があり、他店舗と同名カテゴリは作れない。
`supabase/fix_categories_per_store_unique.sql` をSupabase Dashboardで実行すれば店舗単位ユニークになる（未実行）。
