/**
 * categories テーブル作成スクリプト
 *
 * 使い方:
 *   node scripts/create-categories-table.mjs <SUPABASE_PAT>
 *
 * PAT の取得先:
 *   https://supabase.com/dashboard/account/tokens
 *   → "Generate new token" をクリック → コピーしてここに貼る
 */

const PAT = process.argv[2] || process.env.SUPABASE_PAT;
const PROJECT_REF = "zrdefzqnbxhbwteukqpb";

if (!PAT) {
  console.error(`
❌ Personal Access Token が必要です。

取得手順:
  1. https://supabase.com/dashboard/account/tokens を開く
  2. "Generate new token" をクリック
  3. 発行されたトークンをコピー

実行方法:
  node scripts/create-categories-table.mjs <ここにトークンを貼る>
`);
  process.exit(1);
}

const sql = `
-- 1. categories テーブル（UUID主キー）
CREATE TABLE IF NOT EXISTS categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS + ポリシー
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE tablename = 'categories' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY "anon_all" ON categories FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories (display_order);

-- 3. 初期カテゴリー（name 重複チェック付き）
INSERT INTO categories (name, display_order)
SELECT * FROM (VALUES
  ('昼部',         0),
  ('夜部',         1),
  ('テイクアウト', 2)
) AS v(name, disp)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = v.name);

-- 4. menus.category の文字列スラグ → UUID に移行
UPDATE menus SET category = (SELECT id::text FROM categories WHERE name = '昼部'        LIMIT 1) WHERE category = 'lunch';
UPDATE menus SET category = (SELECT id::text FROM categories WHERE name = '夜部'        LIMIT 1) WHERE category = 'dinner';
UPDATE menus SET category = (SELECT id::text FROM categories WHERE name = 'テイクアウト' LIMIT 1) WHERE category = 'takeout';
`;

console.log("⏳ Supabase Management API へ接続中...\n");

try {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  const result = await res.json();
  console.log("✅ categories テーブルの作成が完了しました！\n");
  console.log("登録されたカテゴリー:");
  console.log("  - lunch  → 昼部");
  console.log("  - dinner → 夜部");
  console.log("  - takeout → テイクアウト\n");

  // 作成確認：テーブルから読み取り
  await verifyTable(PAT);

} catch (err) {
  console.error("❌ エラーが発生しました:", err.message);
  console.error("\n代替手段: Supabase Dashboard の SQL Editor で以下を実行してください:");
  console.error("  supabase/add_categories.sql の内容をそのまま貼り付けてください\n");
  process.exit(1);
}

async function verifyTable(pat) {
  console.log("⏳ 動作確認中...");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "SELECT id::text, name, display_order, (SELECT COUNT(*) FROM menus WHERE menus.category = categories.id::text) AS menu_count FROM categories ORDER BY display_order;" }),
    }
  );

  if (!res.ok) {
    console.warn("⚠️ 確認クエリの実行に失敗しました（テーブル自体は作成済みのはずです）");
    return;
  }

  const rows = await res.json();
  console.log("\n✅ categories テーブルの内容:");
  if (Array.isArray(rows)) {
    for (const row of rows) {
      console.log(`  [${row.display_order}] ${String(row.name).padEnd(12)} id=${row.id}  商品数=${row.menu_count ?? 0}`);
    }
  } else {
    console.log("  （データ形式の確認に失敗しました）");
  }

  console.log("\n🎉 セットアップ完了！テイクアウトカテゴリーも登録されました。");
}
