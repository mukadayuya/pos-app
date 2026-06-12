@AGENTS.md

# POS Flows — Claude作業ガイド

## 現在の状態
- **作業ブランチ**: `feature/v3-customer-feedback`
- **旧版保存**: `feature/pos-v2-ai-evolution`
- **Vercelデプロイ**: 未完了
  - 残作業: Vercelトークン取得 → 新規プロジェクト作成
  - 既存projectId: `prj_W41x5ctQh4B3Pf0MS3P9pfqG8aIj`
  - orgId: `team_cTfwR4R6ZDuvsjqHpVNKqmCa`
  - 旧URL: https://pos-app-one-rose.vercel.app/
- **マスターサンプル店舗「焼鳥居酒屋ABC」**（2026-06-12作成）
  - スラグ `yakitori-abc` / Supabase UUID `6f0842d5-7fe6-4278-818c-86e8a8731130`
  - Tetsu坊型のDB駆動（カテゴリ7・メニュー36品・多言語・画像・売上シード約1,000件）
  - `.env.local` の `NEXT_PUBLIC_STORE_ID=yakitori-abc` に設定中（bronco から変更）
  - 詳細は `docs/new-store-checklist.md` 末尾の「マスターサンプル店舗」参照

## 技術スタック
- Next.js App Router + TypeScript
- Supabase（`@supabase/supabase-js`直接使用、Prismaなし）

## ルート構成
```
src/app/
  admin/              管理画面
  customer/           客向け（モバイルオーダー）
  employees/          従業員管理
  kitchen/            キッチンモニター
  product-management/ 商品管理
  register/           レジ画面
  sales-data/         売上データ
  settings/           設定
  api/                APIルート
```

## よく使うコマンド
```bash
npm run dev      # localhost:3000
npm run build    # デプロイ前に必ず確認
npm run test     # vitest
```

## 将来実装予定（優先度順）
1. 補助金・助成金リアルタイム提案エンジン（売上・従業員数から自動判定）
2. 多言語対応モバイルオーダー（インバウンド需要）
3. AIによる自動アップセル
4. ステーブルコイン決済
