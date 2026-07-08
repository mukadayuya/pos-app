// 炭火やきとり 笑路（豊田市）— マスターメニュー投入スクリプト
// 出典: https://chaoo.jp/gourmet/shop/waraji/menu/
//
// 使い方:  node scripts/setup_warai_menu.mjs
// 再実行可: 既存の笑路店舗のカテゴリ・メニューを削除してから投入する（冪等）。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const SB  = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 笑路 店舗UUID（stores テーブルに登録するID）
export const WARAI_STORE_ID = "a1c2b3d4-e5f6-4789-abcd-ef1234567890";

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

// カテゴリー固定UUID
const CAT = {
  yakitori: "4ccb66b1-afe5-43a1-bd49-6510ae51d5cf",
  nikumaki: "0cb9ab54-7ede-45af-ac63-42476024b668",
  yasai:    "ce704d85-01d6-450e-8c51-7242defd3a29",
  sasami:   "0819a8ee-6144-49f0-9cce-c6f08a7f98df",
  reisai:   "b6c78fba-95d3-471b-9c63-a5c23357b9d3",
  salad:    "f7167d0a-616b-48ab-bad9-9119c8d94d46",
  agemono:  "e2a61dbd-3d1c-41b1-9608-db9b1ccc76c1",
  shime:    "f5283a90-7974-4f88-9fa3-7dfd62298576",
  drink:    "db719734-099f-4515-9916-9918f14bfb3b",
};

const categories = [
  { id: CAT.yakitori, name: "焼鳥・串焼き", display_order: 1 },
  { id: CAT.nikumaki, name: "肉巻き串",     display_order: 2 },
  { id: CAT.yasai,    name: "野菜串",       display_order: 3 },
  { id: CAT.sasami,   name: "ササミ",       display_order: 4 },
  { id: CAT.reisai,   name: "冷菜・おつまみ", display_order: 5 },
  { id: CAT.salad,    name: "サラダ",       display_order: 6 },
  { id: CAT.agemono,  name: "揚げ物・一品料理", display_order: 7 },
  { id: CAT.shime,    name: "〆・ご飯もの", display_order: 8 },
  { id: CAT.drink,    name: "ドリンク",     display_order: 9 },
].map(c => ({ ...c, store_id: WARAI_STORE_ID }));

// 全メニュー（読み仮名は kana 列に格納。読み仮名検索で使用）
// 税抜価格。表示価格 = price * 1.10（内税10%）
const rawMenus = [
  // ── 焼鳥・串焼き（17品） ─────────────────────────
  { id: "7c08303b-5ca8-4b65-a219-f7d94ab9e838", cat: "yakitori", name: "本日のおまかせ5種焼き",   kana: "ほんじつのおまかせ5しゅやき", price: 980, emoji: "🍢" },
  { id: "50ccbefe-e147-4e0b-9a0d-2736c9678ace", cat: "yakitori", name: "身焼き",                 kana: "みやき",                    price: 230, emoji: "🍢" },
  { id: "2d6ad840-70de-420d-a4ff-3b8222fcdb21", cat: "yakitori", name: "ねぎま",                 kana: "ねぎま",                    price: 200, emoji: "🍢" },
  { id: "bb9840d7-b7e7-4f86-adba-c3b641edf1bf", cat: "yakitori", name: "上セセリ",               kana: "じょうせせり",              price: 230, emoji: "🍢" },
  { id: "2d5710b1-3cf5-49cd-b4a7-b87a5cf37155", cat: "yakitori", name: "なんこつ",               kana: "なんこつ",                  price: 230, emoji: "🍢" },
  { id: "8a271237-e9e2-4228-be4e-cf1b5ec50083", cat: "yakitori", name: "レバ焼き（塩）",         kana: "ればやきしお",              price: 200, emoji: "🍢" },
  { id: "a4a51750-1dd2-45b1-a01f-58abb528f2d4", cat: "yakitori", name: "レバ焼き（タレ）",       kana: "ればやきたれ",              price: 200, emoji: "🍢" },
  { id: "f28e2035-1853-435c-85dd-9a167655cf31", cat: "yakitori", name: "つくね",                 kana: "つくね",                    price: 230, emoji: "🍢" },
  { id: "58baa12e-8167-4ec0-81a0-94031c260e99", cat: "yakitori", name: "とり皮",                 kana: "とりかわ",                  price: 180, emoji: "🍢" },
  { id: "d54406e0-517a-4810-a14f-c3e1460a1590", cat: "yakitori", name: "ハート",                 kana: "はーと",                    price: 230, emoji: "🍢" },
  { id: "a96d7e67-853a-45dd-8896-ac25e2abfa7c", cat: "yakitori", name: "砂肝",                   kana: "すなぎも",                  price: 230, emoji: "🍢" },
  { id: "84e1d98f-df1c-40c7-b38c-48a33f092367", cat: "yakitori", name: "手羽先焼き",             kana: "てばさきやき",              price: 200, emoji: "🍗" },
  { id: "11921383-1309-474e-9339-e60962129256", cat: "yakitori", name: "づけ焼き",               kana: "づけやき",                  price: 230, emoji: "🍢" },
  { id: "6c10d867-759b-4557-b71f-3a0ca50ec313", cat: "yakitori", name: "づけうずら焼き",         kana: "づけうずらやき",            price: 180, emoji: "🥚" },
  { id: "e9260435-bf9b-4d60-8b55-dd4aba221098", cat: "yakitori", name: "ボンジリ串",             kana: "ぼんじりくし",              price: 250, emoji: "🍢" },
  { id: "97bd6dc5-8675-481f-aea6-8ae50285a285", cat: "yakitori", name: "とりホル串",             kana: "とりほるくし",              price: 250, emoji: "🍢" },
  { id: "2233364b-8a1a-44c7-9a87-421b6ac4ac9a", cat: "yakitori", name: "ポークフランク串",       kana: "ぽーくふらんくくし",        price: 250, emoji: "🌭" },

  // ── 肉巻き串（4品） ─────────────────────────────
  { id: "b8b9af76-0d81-4016-bcc8-93181bf3109c", cat: "nikumaki", name: "肉巻き3種串",             kana: "にくまき3しゅくし",          price: 680, emoji: "🥓" },
  { id: "f96834c5-ea1c-4f1d-ae4b-02185f7c6cc6", cat: "nikumaki", name: "肉巻きプチトマト",       kana: "にくまきぷちとまと",        price: 230, emoji: "🍅" },
  { id: "a2f961a2-3161-49d0-a345-8cc1dd13842f", cat: "nikumaki", name: "えのきとチーズの肉巻き串", kana: "えのきとちーずのにくまきくし", price: 250, emoji: "🧀" },
  { id: "fc432113-37ee-4c8b-9d8e-90967701af86", cat: "nikumaki", name: "肉巻きうずら",           kana: "にくまきうずら",            price: 230, emoji: "🥚" },

  // ── 野菜串（4品） ───────────────────────────────
  { id: "5d302662-36e4-411f-847f-4d66e74be57b", cat: "yasai", name: "ししとう",                 kana: "ししとう",                  price: 200, emoji: "🌶️" },
  { id: "634016af-1ce3-4e85-8baa-9038dfb73828", cat: "yasai", name: "竹の子土佐焼き",           kana: "たけのことさやき",          price: 230, emoji: "🎋" },
  { id: "cd155fb9-70c1-4bf8-9e1f-88a98a589d6b", cat: "yasai", name: "いかだ",                   kana: "いかだ",                    price: 200, emoji: "🌱" },
  { id: "6fd0234a-b918-4d7c-ad69-a47468660fac", cat: "yasai", name: "しいたけ",                 kana: "しいたけ",                  price: 230, emoji: "🍄" },

  // ── ササミ（5品） ───────────────────────────────
  { id: "417fe4d4-daab-4022-92ba-0bb99a52be7b", cat: "sasami", name: "ササミ串",                 kana: "ささみくし",                price: 230, emoji: "🍢" },
  { id: "41800ee5-ea51-496a-8116-3ad740635c36", cat: "sasami", name: "梅しそササミ串",           kana: "うめしそささみくし",        price: 250, emoji: "🍢" },
  { id: "cefe2d66-bbc3-497d-932d-a99f273d575a", cat: "sasami", name: "ササミわさび",             kana: "ささみわさび",              price: 250, emoji: "🍢" },
  { id: "574dba61-003c-4def-81cd-999211f21238", cat: "sasami", name: "ササミおろしポン酢",       kana: "ささみおろしぽんず",        price: 250, emoji: "🍢" },
  { id: "bdda3d85-c936-499a-a511-9cb0243e9559", cat: "sasami", name: "ササミ3兄弟",             kana: "ささみ3きょうだい",         price: 700, emoji: "🍢" },

  // ── 冷菜・おつまみ（18品） ─────────────────────
  { id: "eb7ab1c9-352f-409e-ab99-c043a1a1c4ca", cat: "reisai", name: "クリームチーズの特製醤油づけ", kana: "くりーむちーずのとくせいしょうゆづけ", price: 480, emoji: "🧀" },
  { id: "6ef8db77-a4b5-4960-8a6e-d0da9e2c0169", cat: "reisai", name: "ねばねばMIX",             kana: "ねばねばみっくす",          price: 680, emoji: "🥗" },
  { id: "357c635a-58a9-45eb-a65b-0277eceb8b22", cat: "reisai", name: "きゅうりの1本漬け",       kana: "きゅうりのいっぽんづけ",    price: 450, emoji: "🥒" },
  { id: "916d1a1a-7918-40d3-b269-0827ffde9add", cat: "reisai", name: "とりポン",                 kana: "とりぽん",                  price: 380, emoji: "🍋" },
  { id: "07a60631-c906-4726-bf83-d68aa9772cd4", cat: "reisai", name: "えだ豆",                   kana: "えだまめ",                  price: 380, emoji: "🫛" },
  { id: "e7245644-1810-4f97-b3ea-9d5817c37c9e", cat: "reisai", name: "宗家キムチ",               kana: "そうけきむち",              price: 430, emoji: "🌶️" },
  { id: "e0b6b955-b91a-4479-a383-35faa293df15", cat: "reisai", name: "じゃこおろし",             kana: "じゃこおろし",              price: 430, emoji: "🐟" },
  { id: "83c74850-0e02-4b9a-b61d-551bb6cde0af", cat: "reisai", name: "なめたけおろし",           kana: "なめたけおろし",            price: 380, emoji: "🍄" },
  { id: "93996a83-99dc-49d1-a154-36ff1054b106", cat: "reisai", name: "じゃこおくら",             kana: "じゃこおくら",              price: 430, emoji: "🌱" },
  { id: "af1526c4-c15f-4f04-9161-6dc8d5802d7e", cat: "reisai", name: "オニオンスライス",         kana: "おにおんすらいす",          price: 380, emoji: "🧅" },
  { id: "28540098-4d26-4d1b-aaee-3c594a008b80", cat: "reisai", name: "みょうがスライス",         kana: "みょうがすらいす",          price: 430, emoji: "🌿" },
  { id: "383ece48-6b60-47bf-a864-69ec7115b45c", cat: "reisai", name: "おくらスライス",           kana: "おくらすらいす",            price: 430, emoji: "🌱" },
  { id: "fd012346-e202-4c13-9754-d0862d404202", cat: "reisai", name: "長芋短冊",                 kana: "ながいもたんざく",          price: 480, emoji: "🥔" },
  { id: "a5d42928-c613-432a-bf9f-9f44da061958", cat: "reisai", name: "やっこ",                   kana: "やっこ",                    price: 380, emoji: "🧊" },
  { id: "2b81a31e-2e3d-4d51-a824-b4afe05f6452", cat: "reisai", name: "台湾やっこ",               kana: "たいわんやっこ",            price: 530, emoji: "🧊" },
  { id: "a1188aaa-91d5-460a-b5d3-5d75e6bd160a", cat: "reisai", name: "温泉玉子",                 kana: "おんせんたまご",            price: 150, emoji: "🥚" },
  { id: "0239eeac-efa0-4522-8598-e5cc6133fe12", cat: "reisai", name: "温玉キムチ",               kana: "おんたまきむち",            price: 550, emoji: "🥚" },
  { id: "aa4af55d-5578-463f-9bfa-af834a1613e6", cat: "reisai", name: "かつおの酒盗",             kana: "かつおのしゅとう",          price: 480, emoji: "🐟" },

  // ── サラダ（3品） ───────────────────────────────
  { id: "3d6148d4-d519-4b66-83cc-784667c2aefd", cat: "salad", name: "シーザーサラダ",           kana: "しーざーさらだ",            price: 680, emoji: "🥗" },
  { id: "ca5f30fa-50bb-4a4a-8acf-688c7fa2a12a", cat: "salad", name: "血液サラサラダ",           kana: "けつえきさらさらだ",        price: 630, emoji: "🥗" },
  { id: "f46691c9-7dff-4cfc-b268-faccfcbd8016", cat: "salad", name: "チョレギサラダ",           kana: "ちょれぎさらだ",            price: 750, emoji: "🥗" },

  // ── 揚げ物・一品料理（10品） ───────────────────
  { id: "b6128507-936d-4ac6-bb81-91d6af48502e", cat: "agemono", name: "とりの唐揚",               kana: "とりのからあげ",            price: 580, emoji: "🍗" },
  { id: "e9c1808b-9e61-4cd6-88e8-334b79e2364b", cat: "agemono", name: "ポテト",                   kana: "ぽてと",                    price: 480, emoji: "🍟" },
  { id: "2d7613d7-a7f0-4006-889e-8963cd67470e", cat: "agemono", name: "とりしゅうまい",           kana: "とりしゅうまい",            price: 480, emoji: "🥟" },
  { id: "27e6b093-b756-4d8d-8f2d-3bc910119cab", cat: "agemono", name: "さつまスティック",         kana: "さつますてぃっく",          price: 550, emoji: "🍠" },
  { id: "986bb04f-8426-464d-be3a-1b57aee90f67", cat: "agemono", name: "えびマヨ",                 kana: "えびまよ",                  price: 680, emoji: "🍤" },
  { id: "658196f9-a33a-4269-820c-2976e4c76eb5", cat: "agemono", name: "とり皮チップス",           kana: "とりかわちっぷす",          price: 550, emoji: "🍟" },
  { id: "c9691e91-8b76-4ad4-adf1-3e55f21b23d5", cat: "agemono", name: "チーズフライ",             kana: "ちーずふらい",              price: 580, emoji: "🧀" },
  { id: "a21a7e25-3be6-4259-80e2-1b46b35fb3af", cat: "agemono", name: "なん唐",                   kana: "なんから",                  price: 480, emoji: "🍗" },
  { id: "2001b589-35d3-4540-9273-bc4d9e6462a2", cat: "agemono", name: "赤ウインナー",             kana: "あかういんなー",            price: 480, emoji: "🌭" },
  { id: "ff567055-14a4-426e-a167-bffed39e695e", cat: "agemono", name: "たこ唐",                   kana: "たこから",                  price: 580, emoji: "🐙" },

  // ── 〆・ご飯もの（7品） ────────────────────────
  { id: "d71a4726-1500-4692-9a46-088e77755996", cat: "shime", name: "とりだし茶づけ",             kana: "とりだしちゃづけ",          price: 480, emoji: "🍚" },
  { id: "8f1d7f6c-9b88-4dfb-95c8-215a1d9148ff", cat: "shime", name: "焼きおにぎり茶づけ",         kana: "やきおにぎりちゃづけ",      price: 550, emoji: "🍙" },
  { id: "27feba0b-71e7-4b09-aedb-d516a5ac7348", cat: "shime", name: "おにぎり",                   kana: "おにぎり",                  price: 170, emoji: "🍙" },
  { id: "85366864-ef37-4b68-b35b-4e7c3c216644", cat: "shime", name: "焼きおにぎり",               kana: "やきおにぎり",              price: 200, emoji: "🍙" },
  { id: "6b96b0df-b94c-4c3b-afe1-562afc8edbee", cat: "shime", name: "温玉しらす丼",               kana: "おんたましらすどん",        price: 680, emoji: "🍚" },
  { id: "e49980c2-cf8e-4e8f-a2c5-284de35fd478", cat: "shime", name: "温玉台湾丼",                 kana: "おんたまたいわんどん",      price: 680, emoji: "🍚" },
  { id: "addbb413-dc09-4e7c-af1c-f2e4d420b0a9", cat: "shime", name: "台湾まぜそば",               kana: "たいわんまぜそば",          price: 680, emoji: "🍜" },

  // ── ドリンク（10品） ────────────────────────────
  { id: "d4675f09-52c2-4a16-8723-b0275552e092", cat: "drink", name: "生ビール（中）",             kana: "なまびーるちゅう",          price: 500, emoji: "🍺" },
  { id: "9f9129a1-1788-4f1d-b8dc-eb74136276a9", cat: "drink", name: "ハイボール",                 kana: "はいぼーる",                price: 500, emoji: "🥃" },
  { id: "2ec546d0-a6ad-48f1-9329-9c44152d3b1a", cat: "drink", name: "レモンサワー",               kana: "れもんさわー",              price: 500, emoji: "🍋" },
  { id: "4e84ba90-f6ad-4328-b937-95cd23465009", cat: "drink", name: "モヒート",                   kana: "もひーと",                  price: 500, emoji: "🍹" },
  { id: "f6c3df71-01b5-44ab-866e-3bf88adc80c1", cat: "drink", name: "カシスオレンジ",             kana: "かしすおれんじ",            price: 500, emoji: "🍹" },
  { id: "dc82331b-03b1-4247-b78a-eaac4ad060e4", cat: "drink", name: "芋焼酎（グラス）",           kana: "いもじょうちゅうぐらす",    price: 500, emoji: "🥃" },
  { id: "9410fbac-2e61-4fd2-a253-95b48f2cc4aa", cat: "drink", name: "麦焼酎（グラス）",           kana: "むぎじょうちゅうぐらす",    price: 500, emoji: "🥃" },
  { id: "6dfd94d4-9c68-466b-8341-6ad34760cb08", cat: "drink", name: "米焼酎（グラス）",           kana: "こめじょうちゅうぐらす",    price: 500, emoji: "🥃" },
  { id: "ad11c7b5-310f-4ebe-9190-51447168747d", cat: "drink", name: "烏龍茶",                     kana: "うーろんちゃ",              price: 300, emoji: "☕" },
  { id: "b549c0af-6618-4f37-a457-38031b63220e", cat: "drink", name: "緑茶",                       kana: "りょくちゃ",                price: 300, emoji: "🍵" },
];

const perCatCounter = {};
const menuRows = rawMenus.map(m => {
  perCatCounter[m.cat] = (perCatCounter[m.cat] ?? 0) + 1;
  return {
    id: m.id,
    store_id: WARAI_STORE_ID,
    name: m.name,
    description: m.kana,  // 説明カラムに読み仮名を保存（Phase B-①の読み仮名検索で使用）
    price: m.price,
    category: CAT[m.cat],
    emoji: m.emoji,
    tax_rate: 0.10,
    is_tax_inclusive: false,
    is_takeout_available: false,
    is_available: true,
    display_order: perCatCounter[m.cat],
    options: [],
  };
});

async function req(method, path, body) {
  const res = await fetch(`${SB}/${path}`, {
    method,
    headers: HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
}

async function count(path) {
  const res = await fetch(`${SB}/${path}&select=id`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  return (await res.json()).length;
}

async function main() {
  console.log("既存の笑路データを削除...");
  await req("DELETE", `menus?store_id=eq.${WARAI_STORE_ID}`);
  await req("DELETE", `categories?store_id=eq.${WARAI_STORE_ID}`);

  console.log(`カテゴリ ${categories.length} 件を投入...`);
  await req("POST", "categories", categories);

  console.log(`メニュー ${menuRows.length} 件を投入...`);
  await req("POST", "menus", menuRows);

  const catN  = await count(`categories?store_id=eq.${WARAI_STORE_ID}`);
  const menuN = await count(`menus?store_id=eq.${WARAI_STORE_ID}`);
  console.log(`完了: categories=${catN}, menus=${menuN}`);
  if (catN !== categories.length || menuN !== menuRows.length) {
    throw new Error("投入件数が一致しません");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
