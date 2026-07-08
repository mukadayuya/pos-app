// 焼鳥居酒屋ABC — ダミー売上データ投入スクリプト
//
// 使い方:  node scripts/seed_yakitori_abc.js
// 再実行可: 既存のABC店舗の sales を削除してから投入する（冪等）。
// メニューIDは setup_yakitori_abc_menu.mjs の固定UUIDと一致させること。

const { createClient } = require("@supabase/supabase-js");
const { randomUUID } = require("crypto");
const { readFileSync } = require("fs");
const { join } = require("path");

// .env.local から読み込む（Supabase移行後も同じスクリプトで動く）
function loadEnv() {
  const env = {};
  const path = join(__dirname, "..", ".env.local");
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const STORE_ID = env.ABC_STORE_ID || "6f0842d5-7fe6-4278-818c-86e8a8731130";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// フード（price=税抜, taxRate=10%, w=出現重み）
const FOOD = [
  // 焼鳥（主力・高頻度）
  { id: "b28cc0d9-ef26-452c-9f3a-8dd080220114", name: "もも（タレ・塩）",       emoji: "🍢", price: 180, w: 8 },
  { id: "cc374dd0-09d4-4efd-967f-010f83d117f9", name: "ねぎま",                 emoji: "🍢", price: 200, w: 8 },
  { id: "4f5aca6b-1d90-4c2b-9a17-e0fdb834efda", name: "つくね（タレ）",         emoji: "🍢", price: 220, w: 7 },
  { id: "d58cbcaa-27de-4531-9076-08ef12c5ef88", name: "皮（塩）",               emoji: "🍢", price: 160, w: 6 },
  { id: "9abbf5fa-bee5-4468-bb19-f1be36012ec7", name: "レバー（タレ）",         emoji: "🍢", price: 180, w: 4 },
  { id: "d310533a-317a-41d4-8e83-77019480bb9b", name: "ささみ（わさび醤油）",   emoji: "🍢", price: 200, w: 4 },
  { id: "6a877d1d-bc8a-4bb9-939c-9a91034d10ab", name: "砂肝（塩）",             emoji: "🍢", price: 180, w: 4 },
  { id: "0a602383-7f75-4b9d-9e32-1b1c8b7c6ef8", name: "ハツ（塩）",             emoji: "🍢", price: 180, w: 3 },
  { id: "e386b774-6b76-4e7e-86e7-44800cd39684", name: "豚バラ串",               emoji: "🍢", price: 200, w: 5 },
  { id: "c3fa3476-229e-48a0-9640-5db8a056f151", name: "焼鳥盛り合わせ（5本）",  emoji: "🍢", price: 880, w: 7 },
  // 揚げ物
  { id: "ec56d2c2-4783-44ad-b73d-e75bcf288a24", name: "若鶏の唐揚げ",           emoji: "🍗", price: 580, w: 6 },
  { id: "14aa3279-45b3-47a4-90ce-c99d9f0fdfb0", name: "手羽先唐揚げ（甘辛）",   emoji: "🍗", price: 520, w: 5 },
  { id: "d7fdc489-351b-4524-a70a-2be102359104", name: "ポテトフライ",           emoji: "🍟", price: 420, w: 5 },
  // 一品料理
  { id: "dcc75b98-a643-42be-ab92-4fca8cf3c1d2", name: "枝豆",                   emoji: "🫛", price: 380, w: 7 },
  { id: "220ec611-fd18-4830-9388-cf89cb037cc0", name: "冷奴",                   emoji: "🧊", price: 350, w: 4 },
  { id: "a76299fe-a8d0-48a1-8ac4-bfcc23d43327", name: "自家製ポテトサラダ",     emoji: "🥔", price: 420, w: 5 },
  { id: "7898c77e-e4de-477d-b75c-36bb7f2621a9", name: "だし巻き玉子",           emoji: "🥚", price: 480, w: 5 },
  { id: "750ab484-221f-454f-8350-1e806295d8da", name: "冷やしトマト",           emoji: "🍅", price: 380, w: 3 },
  // 野菜・サラダ
  { id: "dd124bc7-80fa-469f-9dc2-364c17f2f99f", name: "グリーンサラダ",         emoji: "🥗", price: 480, w: 3 },
  { id: "d5d6f41c-1aa3-4deb-96ee-3fdcccbebb6e", name: "シーザーサラダ",         emoji: "🥗", price: 580, w: 4 },
  { id: "ee564000-6bf8-4285-a007-2e8eb063e006", name: "蒸し鶏のサラダ",         emoji: "🥗", price: 620, w: 3 },
  // ご飯・〆
  { id: "9d282931-f1b6-4dd1-b9f6-92591bc40623", name: "焼きおにぎり（2個）",    emoji: "🍙", price: 380, w: 4 },
  { id: "db85b4da-c1c5-4ca1-8424-8224590fae5a", name: "鶏茶漬け",               emoji: "🍵", price: 480, w: 3 },
  { id: "6dd25ddf-3f60-402e-a0d1-4f758c611ca2", name: "親子丼",                 emoji: "🍚", price: 780, w: 3 },
  { id: "dc7c6d67-df24-4517-9521-d4db3dedb396", name: "鶏雑炊",                 emoji: "🍲", price: 580, w: 2 },
  // 甘味
  { id: "12e116dc-6ecf-4517-a7b0-5a1732878caa", name: "バニラアイス",           emoji: "🍨", price: 330, w: 2 },
  { id: "2f972508-133a-44de-930b-e6f54f73f518", name: "抹茶アイス",             emoji: "🍵", price: 380, w: 2 },
  { id: "6cdd181e-06a0-4c33-ae39-5d7e33de12b7", name: "自家製プリン",           emoji: "🍮", price: 420, w: 2 },
];

// ドリンク（居酒屋なので高頻度・人数分以上出る）
const DRINK = [
  { id: "a25df14c-d238-4958-927d-e7a68c620f31", name: "生ビール（中）",         emoji: "🍺", price: 550, w: 10 },
  { id: "81e63f8b-ea7d-416e-8faf-b46ac1e69805", name: "ハイボール",             emoji: "🥃", price: 450, w: 7 },
  { id: "58ffd364-6c57-4a6c-bc58-c95babdad051", name: "レモンサワー",           emoji: "🍋", price: 420, w: 7 },
  { id: "7fc4c56f-6788-4945-8d88-085d67bbc959", name: "ウーロンハイ",           emoji: "🍹", price: 420, w: 4 },
  { id: "b6678828-dc66-4b5e-9d6d-6726be4d2438", name: "日本酒（一合）",         emoji: "🍶", price: 550, w: 3 },
  { id: "52c237dc-2bd0-4431-9a9a-34a5493b275a", name: "麦焼酎（グラス）",       emoji: "🥃", price: 480, w: 3 },
  { id: "ea5480ba-3f52-4c8d-b5e5-68c6cb215ad3", name: "ウーロン茶",             emoji: "🍵", price: 300, w: 3 },
  { id: "073df1dd-c359-4d6d-bf36-28b210289391", name: "コーラ",                 emoji: "🥤", price: 300, w: 2 },
];

const FOOD_POOL  = FOOD.flatMap(m => Array(m.w).fill(m));
const DRINK_POOL = DRINK.flatMap(m => Array(m.w).fill(m));

// 佐藤50% 山田35% 未設定15%
const STAFF = ["佐藤","佐藤","佐藤","佐藤","佐藤","佐藤","佐藤","佐藤","佐藤","佐藤",
               "山田","山田","山田","山田","山田","山田","山田",
               null,null,null];
// 現金40% カード35% QR25%
const PAYMENTS = ["cash","cash","cash","cash","cash","cash","cash","cash",
                  "card","card","card","card","card","card","card",
                  "qr","qr","qr","qr","qr"];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr)      { return arr[Math.floor(Math.random() * arr.length)]; }

function makeOrder(dayDate) {
  // 居酒屋営業 17:00-22:59（ピークは19-21時）
  const h = pick([17, 18, 19, 19, 20, 20, 21, 21, 22]);
  const m = rand(0, 59);
  const dt = new Date(dayDate);
  dt.setHours(h, m, rand(0, 59), 0);

  const guests = rand(1, 4);
  const itemMap = new Map();

  // ドリンクは人数分+α、フードは2〜5品
  const drinkCount = guests + rand(0, guests);
  for (let i = 0; i < drinkCount; i++) {
    const d = pick(DRINK_POOL);
    itemMap.set(d.id, { ...d, qty: (itemMap.get(d.id)?.qty ?? 0) + 1 });
  }
  const foodCount = rand(2, 5);
  for (let i = 0; i < foodCount; i++) {
    const f = pick(FOOD_POOL);
    const qty = f.price <= 220 ? rand(1, 3) : 1; // 串物は複数本頼まれやすい
    itemMap.set(f.id, { ...f, qty: (itemMap.get(f.id)?.qty ?? 0) + qty });
  }

  let subtotal = 0;
  const orderItems = [];
  for (const it of itemMap.values()) {
    subtotal += it.price * it.qty;
    orderItems.push({
      id: it.id, name: it.name, emoji: it.emoji,
      quantity: it.qty, unit_price: it.price, tax_rate: 0.1,
    });
  }

  const tax10 = Math.round(subtotal * 0.1);
  const total = subtotal + tax10;
  const males = rand(Math.max(0, Math.ceil(guests / 2) - 1), guests);
  const females = guests - males;

  return {
    id: randomUUID(),
    total_amount: total,
    items: orderItems,
    created_at: dt.toISOString(),
    store_id: STORE_ID,
    male_count: Math.max(0, males),
    female_count: Math.max(0, females),
    staff_name: pick(STAFF),
    payment_method: pick(PAYMENTS),
    discount_amount: 0,
    discount: null,
    tax8: 0,
    tax10,
    tax: tax10,
  };
}

async function seed() {
  console.log("既存のABC売上データを削除...");
  const { error: delErr } = await sb.from("sales").delete().eq("store_id", STORE_ID);
  if (delErr) { console.error("削除エラー:", delErr); process.exit(1); }

  const start = new Date("2026-05-13");
  const end   = new Date("2026-07-30");
  const records = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    // 月曜定休、金土が繁忙
    if (dow === 1) continue;
    const busy = dow === 5 || dow === 6;
    const count = busy ? rand(28, 42) : rand(14, 24);
    for (let i = 0; i < count; i++) records.push(makeOrder(d));
  }

  console.log(`生成: ${records.length}件 (5/13〜6/30、月曜定休)`);

  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    const { error } = await sb.from("sales").insert(batch);
    if (error) { console.error(`バッチ ${i / 100 + 1} エラー:`, error); process.exit(1); }
    process.stdout.write(`\r投入: ${Math.min(i + 100, records.length)}/${records.length}`);
  }

  const { count } = await sb.from("sales").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID);
  console.log(`\n完了: sales=${count}件`);
}

seed();
