const { createClient } = require("@supabase/supabase-js");
const { randomUUID } = require("crypto");

const SUPABASE_URL = "https://zrdefzqnbxhbwteukqpb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyZGVmenFuYnhoYnd0ZXVrcXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDc0MzcsImV4cCI6MjA5MTk4MzQzN30.zIfHIy0f14IH5C5YFALCm-eEjsZim8dXascFgvR8nlc";
const STORE_ID = "d61afc6a-ca9b-4641-a99b-1294985ade8e"; // ブロンコ store UUID

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// メインメニュー（price=税抜, taxRate=10%）
const MENU = [
  // ステーキ（高単価・人気）
  { id: "br-st1", name: "リブロース ステーキ 450g", emoji: "🥩", price: 3960, w: 3 },
  { id: "br-st2", name: "リブロース ステーキ 300g", emoji: "🥩", price: 2800, w: 5 },
  { id: "br-st3", name: "リブロース ステーキ 220g", emoji: "🥩", price: 2100, w: 6 },
  { id: "br-st4", name: "ハラミ ステーキ 200g",     emoji: "🥩", price: 1100, w: 4 },
  { id: "br-st5", name: "チキン ステーキ",           emoji: "🍗", price:  990, w: 4 },
  // ハンバーグ
  { id: "br-hb1", name: "ハンバーグ 400g",           emoji: "🍔", price: 1540, w: 5 },
  { id: "br-hb2", name: "ハンバーグ 300g",           emoji: "🍔", price: 1220, w: 6 },
  { id: "br-hb3", name: "ハンバーグ 200g",           emoji: "🍔", price:  810, w: 4 },
  { id: "br-hb4", name: "ハンバーグ 400g チーズ",    emoji: "🧀", price: 1740, w: 3 },
  { id: "br-hb5", name: "ハンバーグ 300g チーズ",    emoji: "🧀", price: 1390, w: 4 },
  // メキシカン
  { id: "br-mx1", name: "トルティーヤ チップ",       emoji: "🌽", price:  440, w: 4 },
  { id: "br-mx2", name: "ナチョス",                   emoji: "🧀", price:  750, w: 5 },
  { id: "br-mx3", name: "タコス",                     emoji: "🌮", price:  750, w: 5 },
  { id: "br-mx5", name: "ブリト",                     emoji: "🌯", price:  770, w: 3 },
  { id: "br-mx10", name: "チョリソ",                  emoji: "🌭", price:  750, w: 3 },
  { id: "br-mx11", name: "スペアリブス B.B.Q",        emoji: "🍖", price: 1200, w: 3 },
  // サラダ・スープ
  { id: "br-sa1", name: "メキシカン サラダ L",        emoji: "🥗", price:  550, w: 4 },
  { id: "br-sa2", name: "メキシカン サラダ M",        emoji: "🥗", price:  440, w: 5 },
  { id: "br-sp1", name: "クラブ スープ",              emoji: "🦀", price:  880, w: 3 },
  { id: "br-sp2", name: "メキシカンスープ",           emoji: "🍲", price:  550, w: 4 },
  // セット・デザート
  { id: "br-se1", name: "スモールサラダ＋ドリンクセット", emoji: "☕", price: 280, w: 6 },
  { id: "br-ds1", name: "バニラアイス small",         emoji: "🍦", price:  200, w: 4 },
  { id: "br-ds2", name: "バニラアイス large",         emoji: "🍦", price:  400, w: 3 },
];

// 重み付きランダム選択
const POOL = MENU.flatMap(m => Array(m.w).fill(m));
// 畠野50% 向田35% 未設定15%
const STAFF    = ["畠野","畠野","畠野","畠野","畠野","畠野","畠野","畠野","畠野","畠野",
                  "向田","向田","向田","向田","向田","向田","向田",
                  null,null,null];
// 現金40% カード35% QR25%
const PAYMENTS = ["cash","cash","cash","cash","cash","cash","cash","cash",
                  "card","card","card","card","card","card","card",
                  "qr","qr","qr","qr","qr"];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr)      { return arr[Math.floor(Math.random() * arr.length)]; }

function makeOrder(dayDate) {
  // 夕食 17:00-21:59
  const h = rand(17, 21);
  const m = rand(0, 59);
  const dt = new Date(dayDate);
  dt.setHours(h, m, rand(0,59), 0);

  // テーブル1〜4名、注文アイテム2〜5品
  const guests = rand(1, 4);
  const itemCount = rand(2, 5);
  const orderItems = [];
  let subtotal = 0;

  for (let i = 0; i < itemCount; i++) {
    const m = pick(POOL);
    const qty = rand(1, 2);
    subtotal += m.price * qty;
    orderItems.push({
      id: m.id, name: m.name, emoji: m.emoji,
      quantity: qty, unit_price: m.price, tax_rate: 0.1,
    });
  }

  const tax10 = Math.round(subtotal * 0.1);
  const total  = subtotal + tax10;
  const males  = rand(Math.ceil(guests / 2) - 1, guests);
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
  const start = new Date("2026-05-10");
  const end   = new Date("2026-06-30");
  const records = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // 平日20件、週末30件前後
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const count = isWeekend ? rand(25, 40) : rand(12, 25);
    for (let i = 0; i < count; i++) {
      records.push(makeOrder(d));
    }
  }

  console.log(`生成: ${records.length}件 (5/10〜6/30)`);

  // 100件ずつバッチ投入
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    const { error } = await sb.from("sales").insert(batch);
    if (error) {
      console.error(`バッチ${i/100 + 1} エラー:`, error.message);
    } else {
      process.stdout.write(`\r投入済み: ${Math.min(i + 100, records.length)}/${records.length}`);
    }
  }
  console.log("\n完了！");
}

seed().catch(console.error);
