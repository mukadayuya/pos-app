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
