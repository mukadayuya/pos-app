// 居食屋 笑点（豊田市・笑路の系列店）— マスターメニュー投入スクリプト
// 出典: 店舗メニューPDF（202607091623.pdf・2026/7/6版・価格は税抜）
//
// 使い方:  node scripts/setup_shoten_menu.mjs
// 再実行可: 既存の笑点店舗のカテゴリ・メニューを削除してから投入する（冪等）。
// Supabaseプロジェクトは笑路と共有（同一オーナー小黒様のため）。store_idで分離。

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

// 笑点 店舗UUID（storesテーブル登録用・固定）
export const SHOTEN_STORE_ID = "3f8a2b1c-9d4e-4f6a-8b2c-7e5d9a1f3c60";

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

// カテゴリー固定UUID（9カテゴリ）
const CAT = {
  osusume:  "e5f01001-2f3a-4b5c-8d6e-a00000000001",
  sashimi:  "e5f01002-2f3a-4b5c-8d6e-a00000000002",
  oyupocha: "e5f01003-2f3a-4b5c-8d6e-a00000000003",
  chinmi:   "e5f01004-2f3a-4b5c-8d6e-a00000000004",
  yasai:    "e5f01005-2f3a-4b5c-8d6e-a00000000005",
  agemono:  "e5f01006-2f3a-4b5c-8d6e-a00000000006",
  yakimono: "e5f01007-2f3a-4b5c-8d6e-a00000000007",
  shime:    "e5f01008-2f3a-4b5c-8d6e-a00000000008",
  sake:     "e5f01009-2f3a-4b5c-8d6e-a00000000009",
  drink:    "e5f01010-2f3a-4b5c-8d6e-a00000000010",
};

const categories = [
  { id: CAT.osusume,  name: "本日のオススメ",   display_order: 1 },
  { id: CAT.sashimi,  name: "刺身・刺盛り",     display_order: 2 },
  { id: CAT.oyupocha, name: "お湯ぽちゃ料理",   display_order: 3 },
  { id: CAT.chinmi,   name: "SPEED・珍味",      display_order: 4 },
  { id: CAT.yasai,    name: "野菜",             display_order: 5 },
  { id: CAT.agemono,  name: "揚物",             display_order: 6 },
  { id: CAT.yakimono, name: "焼物",             display_order: 7 },
  { id: CAT.shime,    name: "〆・ご飯もの",     display_order: 8 },
  { id: CAT.sake,     name: "日本酒",           display_order: 9 },
  { id: CAT.drink,    name: "ドリンク",         display_order: 10 },
].map(c => ({ ...c, store_id: SHOTEN_STORE_ID }));

// 商品画像（全URL 200確認済み 2026-07-09。Special:FilePathは実体へリダイレクトされる公式URL）
const FP = (f) => `https://commons.wikimedia.org/wiki/Special:FilePath/${f}?width=960`;
const IMG = {
  // 既存プール（笑路で検証済み）
  yakitori1:   "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Yakitori_001.jpg/960px-Yakitori_001.jpg",
  yakitori2:   "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Yakitori_002.jpg/960px-Yakitori_002.jpg",
  liver:       "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Yakitori_018.jpg/960px-Yakitori_018.jpg",
  tsukune:     "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Kushiyaki-_tsukune%2C_scallion_and_pork_belly.jpg/960px-Kushiyaki-_tsukune%2C_scallion_and_pork_belly.jpg",
  tebasaki:    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tebasaki_karaage_by_kawanet_in_Kanayama%2C_Nagoya.jpg/960px-Tebasaki_karaage_by_kawanet_in_Kanayama%2C_Nagoya.jpg",
  karaage:     "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Classic_Chicken_Karaage_-_Sunoso_2023-11-28.jpg/960px-Classic_Chicken_Karaage_-_Sunoso_2023-11-28.jpg",
  fries:       "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/French_fries_at_Chez_Jolie.jpg/960px-French_fries_at_Chez_Jolie.jpg",
  edamame:     "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Edamame_bowl_by_habitatgirl.jpg/960px-Edamame_bowl_by_habitatgirl.jpg",
  hiyayakko:   "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg/960px-Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg",
  tomato:      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Sliced_Tomatoes_on_a_plate.jpg/960px-Sliced_Tomatoes_on_a_plate.jpg",
  greensalad:  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Small_Salad%2C_at_Ikinari%21_Steak_%282019-04-13%29.jpg/960px-Small_Salad%2C_at_Ikinari%21_Steak_%282019-04-13%29.jpg",
  caesar:      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Caesar_Salad_-_Purezza_2023-11-22.jpg/960px-Caesar_Salad_-_Purezza_2023-11-22.jpg",
  chicksalad:  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Fresh_garden_salad_with_grilled_chicken%2C_lettuce%2C_radishes%2C_and_a_creamy_dressing_undefined.jpg/960px-Fresh_garden_salad_with_grilled_chicken%2C_lettuce%2C_radishes%2C_and_a_creamy_dressing_undefined.jpg",
  yakionigiri: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Yaki-Onigiri_001.jpg/960px-Yaki-Onigiri_001.jpg",
  ochazuke:    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Instant_chazuke_by_shibainu.jpg/960px-Instant_chazuke_by_shibainu.jpg",
  dashimaki:   "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Dashimaki_tamago_by_june29.jpg/960px-Dashimaki_tamago_by_june29.jpg",
  sake:        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Tokkuri_and_Choko_%28sake_cup%29_in_Osaka_-_Apr_18%2C_2019.jpg/960px-Tokkuri_and_Choko_%28sake_cup%29_in_Osaka_-_Apr_18%2C_2019.jpg",
  // 笑点用に新規検証した画像
  sashimi:     FP("Deluxe%20sashimi%20platter%2001.jpg"),
  gyoza:       FP("Gyoza%20dumplings%20%2853726549642%29.jpg"),
  taiwanramen: FP("CodazziTaiwanRamen.jpg"),
  chahan:      FP("Ramen%20and%20Chahan%20002.jpg"),
  hokke:       FP("Grilled%20Okhotsk%20Atka%20Mackerel.jpg"),
  oyster:      FP("Raw%20Oysters%20%286639229789%29.jpg"),
  roastbeef:   FP("Roast%20topside%20of%20beef.jpg"),
  ebichili:    FP("Ebi%20Chili%20Mayo%20%283469826035%29.jpg"),
  kakuni:      FP("Kakuni%20by%20Kanko.jpg"),
  nimono:      FP("Nimono%20of%20japanese%20pumpkin%202014.jpg"),
  // 2026-07-10 明らかに違う画像の修正用（全URL 200確認済み）
  senmai:      FP("Beef%20tripe.jpg"),              // 牛モツ（黒毛和牛センマイ刺）
  kimchi:      FP("Korean%20Kimchi.jpg"),           // キムチ / チャンジャ（代替）
  umibudou:    FP("4454Arosep%20Caulerpa%20lentillifera%2015.jpg"), // 海ぶどう
  gratin:      FP("Gratin%20dauphinois.jpg"),        // シーフードグラタン
  okranatto:   FP("Okra%20natto%20by%20kamikura.jpg"), // ねばねばMIX
  kombu:       FP("Tsukudaniphoto.jpg"),             // わさび昆布（佃煮）
  ikasashimi:  FP("Ika%20sashimi.JPG"),              // ボイルイカ生わかめ
  // ドリンク用画像（全URL 200確認済み 2026-07-10）
  beer:        FP("Sapporo%20Ginjikomi%20Special%20Clean%20Malt%20Draft%20Beer%20%28224291451%29.jpg"), // 生ビール
  highball:    FP("Amber%20Moon%20Ingredients.jpg"), // ハイボール
  lemonsour:   FP("Niku%20Tokidoki%20Lemon%20Sour%20MeiekiIMG%2020220807%20184905%20HDR%2004.jpg"),     // レモンサワー
  mojito:      FP("Fresh%20Mojito%20Premium.jpg"),   // モヒート
  cassisorange:FP("Cassis%20and%20Orange%208757100129%20173bcfcb9d%20o.jpg"),                          // カシスオレンジ
  shochu:      FP("Shochu%20001.jpg"),               // 芋・麦・米焼酎（3種共用）
  oolong:      FP("Oolong%20Tea.jpg"),               // 烏龍茶
  greentea:    FP("White%20cup%20with%20green%20tea%20in%20it.jpg"),                                    // 緑茶
};

// 全91品（kana = 読み仮名検索用、img = 画像キー）
const rawMenus = [
  // ── 本日のオススメ（25品）─────────────────────
  { cat: "osusume", name: "コーンクリームコロッケ",           kana: "こーんくりーむころっけ",     price: 350,  emoji: "🌽", img: "karaage" },
  { cat: "osusume", name: "飛騨牛のタタキ",                   kana: "ひだぎゅうのたたき",         price: 1280, emoji: "🥩", img: "roastbeef" },
  { cat: "osusume", name: "ローストビーフ",                   kana: "ろーすとびーふ",             price: 1280, emoji: "🥩", img: "roastbeef" },
  { cat: "osusume", name: "黒毛和牛センマイ刺",               kana: "くろげわぎゅうせんまいさし", price: 780,  emoji: "🥩", img: "senmai" },
  { cat: "osusume", name: "あん肝",                           kana: "あんきも",                   price: 880,  emoji: "🐟", img: "sashimi" },
  { cat: "osusume", name: "バイ貝煮付け",                     kana: "ばいがいにつけ",             price: 680,  emoji: "🐚", img: "nimono" },
  { cat: "osusume", name: "生ガキ",                           kana: "なまがき",                   price: 580,  emoji: "🦪", img: "oyster" },
  { cat: "osusume", name: "カンパチかま塩焼",                 kana: "かんぱちかましおやき",       price: 780,  emoji: "🐟", img: "hokke" },
  { cat: "osusume", name: "豚巻きアスパラ",                   kana: "ぶたまきあすぱら",           price: 780,  emoji: "🥓", img: "tsukune" },
  { cat: "osusume", name: "ボイルイカ生わかめ",               kana: "ぼいるいかなまわかめ",       price: 580,  emoji: "🦑", img: "ikasashimi" },
  { cat: "osusume", name: "穴子の煮付け",                     kana: "あなごのにつけ",             price: 780,  emoji: "🐟", img: "nimono" },
  { cat: "osusume", name: "もろこし丸",                       kana: "もろこしまる",               price: 780,  emoji: "🌽", img: "karaage" },
  { cat: "osusume", name: "シーフードグラタン",               kana: "しーふーどぐらたん",         price: 780,  emoji: "🧀", img: "gratin" },
  { cat: "osusume", name: "海ぶどう",                         kana: "うみぶどう",                 price: 780,  emoji: "🌿", img: "umibudou" },
  { cat: "osusume", name: "里芋の唐あげ",                     kana: "さといものからあげ",         price: 380,  emoji: "🥔", img: "karaage" },
  { cat: "osusume", name: "トーフステーキ",                   kana: "とーふすてーき",             price: 480,  emoji: "🧊", img: "hiyayakko" },
  { cat: "osusume", name: "クリームチーズの特製醤油漬け",     kana: "くりーむちーずのとくせいしょうゆづけ", price: 450, emoji: "🧀", img: "hiyayakko" },
  { cat: "osusume", name: "赤ウインナー",                     kana: "あかういんなー",             price: 450,  emoji: "🌭", img: "tsukune" },
  { cat: "osusume", name: "手羽唐",                           kana: "てばから",                   price: 480,  emoji: "🍗", img: "tebasaki" },
  { cat: "osusume", name: "焼春巻",                           kana: "やきはるまき",               price: 650,  emoji: "🌯", img: "gyoza" },
  { cat: "osusume", name: "えびマヨ",                         kana: "えびまよ",                   price: 650,  emoji: "🍤", img: "ebichili" },
  { cat: "osusume", name: "棒々鶏",                           kana: "ばんばんじー",               price: 780,  emoji: "🐔", img: "chicksalad" },
  { cat: "osusume", name: "えびチリ",                         kana: "えびちり",                   price: 750,  emoji: "🍤", img: "ebichili" },
  { cat: "osusume", name: "こんにゃくの唐あげ",               kana: "こんにゃくのからあげ",       price: 580,  emoji: "🍢", img: "karaage" },
  { cat: "osusume", name: "厚切りハムカツ",                   kana: "あつぎりはむかつ",           price: 480,  emoji: "🥩", img: "karaage" },

  // ── 刺身・刺盛り（7品）───────────────────────
  { cat: "sashimi", name: "刺盛り（1人前 2〜5種）",           kana: "さしもり",                   price: 1280, emoji: "🍣", img: "sashimi" },
  { cat: "sashimi", name: "本マグロ",                         kana: "ほんまぐろ",                 price: 1280, emoji: "🍣", img: "sashimi" },
  { cat: "sashimi", name: "シマアジ",                         kana: "しまあじ",                   price: 980,  emoji: "🍣", img: "sashimi" },
  { cat: "sashimi", name: "ヤリイカ",                         kana: "やりいか",                   price: 980,  emoji: "🦑", img: "sashimi" },
  { cat: "sashimi", name: "サーモン",                         kana: "さーもん",                   price: 980,  emoji: "🍣", img: "sashimi" },
  { cat: "sashimi", name: "タイ昆布じめ",                     kana: "たいこぶじめ",               price: 880,  emoji: "🍣", img: "sashimi" },
  { cat: "sashimi", name: "タコ",                             kana: "たこ",                       price: 780,  emoji: "🐙", img: "sashimi" },

  // ── お湯ぽちゃ料理（10品）────────────────────
  { cat: "oyupocha", name: "角煮",                            kana: "かくに",                     price: 680,  emoji: "🥩", img: "kakuni" },
  { cat: "oyupocha", name: "だし巻き玉子",                    kana: "だしまきたまご",             price: 600,  emoji: "🥚", img: "dashimaki" },
  { cat: "oyupocha", name: "ピリ辛手羽煮",                    kana: "ぴりからてばに",             price: 500,  emoji: "🍗", img: "tebasaki" },
  { cat: "oyupocha", name: "さばみそ",                        kana: "さばみそ",                   price: 750,  emoji: "🐟", img: "hokke" },
  { cat: "oyupocha", name: "どて煮",                          kana: "どてに",                     price: 500,  emoji: "🥘", img: "kakuni" },
  { cat: "oyupocha", name: "スタミナサラダ",                  kana: "すたみなさらだ",             price: 780,  emoji: "🥗", img: "chicksalad" },
  { cat: "oyupocha", name: "台湾どーふ",                      kana: "たいわんどーふ",             price: 500,  emoji: "🌶️", img: "hiyayakko" },
  { cat: "oyupocha", name: "じゃがバター",                    kana: "じゃがばたー",               price: 550,  emoji: "🥔", img: "fries" },
  { cat: "oyupocha", name: "焼き小なす",                      kana: "やきこなす",                 price: 480,  emoji: "🍆", img: "nimono" },
  { cat: "oyupocha", name: "塩ソーキ大根煮",                  kana: "しおそーきだいこんに",       price: 680,  emoji: "🥘", img: "kakuni" },

  // ── SPEED・珍味（5品）───────────────────────
  { cat: "chinmi", name: "チャンジャ",                        kana: "ちゃんじゃ",                 price: 580,  emoji: "🌶️", img: "kimchi" },
  { cat: "chinmi", name: "いか塩辛",                          kana: "いかしおから",               price: 480,  emoji: "🦑", img: "sashimi" },
  { cat: "chinmi", name: "わさび昆布",                        kana: "わさびこんぶ",               price: 480,  emoji: "🌿", img: "kombu" },
  { cat: "chinmi", name: "コブクロ",                          kana: "こぶくろ",                   price: 580,  emoji: "🥩", img: "liver" },
  { cat: "chinmi", name: "梅水晶",                            kana: "うめすいしょう",             price: 680,  emoji: "🐟" },

  // ── 野菜（13品）──────────────────────────────
  { cat: "yasai", name: "茶豆",                               kana: "ちゃまめ",                   price: 300,  emoji: "🫛", img: "edamame" },
  { cat: "yasai", name: "韓国宗家キムチ",                     kana: "かんこくそうけきむち",       price: 380,  emoji: "🌶️", img: "kimchi" },
  { cat: "yasai", name: "グリーンサラダ",                     kana: "ぐりーんさらだ",             price: 580,  emoji: "🥗", img: "greensalad" },
  { cat: "yasai", name: "ねばねばMIX",                        kana: "ねばねばみっくす",           price: 580,  emoji: "🥗", img: "okranatto" },
  { cat: "yasai", name: "血液サラサラダ",                     kana: "けつえきさらさらだ",         price: 580,  emoji: "🥗", img: "greensalad" },
  { cat: "yasai", name: "セロリスティック",                   kana: "せろりすてぃっく",           price: 480,  emoji: "🥬", img: "greensalad" },
  { cat: "yasai", name: "きゅうりの1本漬け",                  kana: "きゅうりのいっぽんづけ",     price: 480,  emoji: "🥒", img: "greensalad" },
  { cat: "yasai", name: "トマトスライス",                     kana: "とまとすらいす",             price: 380,  emoji: "🍅", img: "tomato" },
  { cat: "yasai", name: "おかんのQちゃん",                    kana: "おかんのきゅーちゃん",       price: 380,  emoji: "🥒", img: "greensalad" },
  { cat: "yasai", name: "なす揚げびたし",                     kana: "なすあげびたし",             price: 380,  emoji: "🍆", img: "nimono" },
  { cat: "yasai", name: "新玉オンスラ",                       kana: "しんたまおんすら",           price: 380,  emoji: "🧅", img: "greensalad" },
  { cat: "yasai", name: "冷やっこ",                           kana: "ひややっこ",                 price: 380,  emoji: "🧊", img: "hiyayakko" },
  { cat: "yasai", name: "おかんのらっきょ",                   kana: "おかんのらっきょ",           price: 380,  emoji: "🧄", img: "greensalad" },

  // ── 揚物（9品）───────────────────────────────
  { cat: "agemono", name: "ポテト",                           kana: "ぽてと",                     price: 450,  emoji: "🍟", img: "fries" },
  { cat: "agemono", name: "チーズフライ",                     kana: "ちーずふらい",               price: 550,  emoji: "🧀", img: "karaage" },
  { cat: "agemono", name: "なん唐",                           kana: "なんから",                   price: 480,  emoji: "🍗", img: "karaage" },
  { cat: "agemono", name: "れんこんのはさみあげ",             kana: "れんこんのはさみあげ",       price: 380,  emoji: "🥔", img: "karaage" },
  { cat: "agemono", name: "唐あげ",                           kana: "からあげ",                   price: 680,  emoji: "🍗", img: "karaage" },
  { cat: "agemono", name: "うずらフライ",                     kana: "うずらふらい",               price: 380,  emoji: "🥚", img: "karaage" },
  { cat: "agemono", name: "タコ唐",                           kana: "たこから",                   price: 650,  emoji: "🐙", img: "karaage" },
  { cat: "agemono", name: "さつまスティック",                 kana: "さつますてぃっく",           price: 650,  emoji: "🍠", img: "fries" },
  { cat: "agemono", name: "みそ串カツ",                       kana: "みそくしかつ",               price: 350,  emoji: "🍢", img: "karaage" },

  // ── 焼物（8品）───────────────────────────────
  { cat: "yakimono", name: "ねぎま",                          kana: "ねぎま",                     price: 300,  emoji: "🍢", img: "yakitori2" },
  { cat: "yakimono", name: "つくね",                          kana: "つくね",                     price: 250,  emoji: "🍢", img: "tsukune" },
  { cat: "yakimono", name: "ポークフランクソーセージ",        kana: "ぽーくふらんくそーせーじ",   price: 450,  emoji: "🌭", img: "tsukune" },
  { cat: "yakimono", name: "砂肝串",                          kana: "すなぎもくし",               price: 250,  emoji: "🍢", img: "liver" },
  { cat: "yakimono", name: "ししゃも",                        kana: "ししゃも",                   price: 580,  emoji: "🐟", img: "hokke" },
  { cat: "yakimono", name: "いか一夜干し",                    kana: "いかいちやぼし",             price: 780,  emoji: "🦑", img: "hokke" },
  { cat: "yakimono", name: "エイヒレ",                        kana: "えいひれ",                   price: 780,  emoji: "🐟", img: "hokke" },
  { cat: "yakimono", name: "ほっけ焼",                        kana: "ほっけやき",                 price: 780,  emoji: "🐟", img: "hokke" },

  // ── 〆・ご飯もの（10品）──────────────────────
  { cat: "shime", name: "五目あんかけ焼そば",                 kana: "ごもくあんかけやきそば",     price: 880,  emoji: "🍜", img: "taiwanramen" },
  { cat: "shime", name: "おにぎり（梅・鮭）",                 kana: "おにぎり",                   price: 250,  emoji: "🍙", img: "yakionigiri" },
  { cat: "shime", name: "だし茶漬け（梅・鮭）",               kana: "だしちゃづけ",               price: 500,  emoji: "🍚", img: "ochazuke" },
  { cat: "shime", name: "温玉台湾丼",                         kana: "おんたまたいわんどん",       price: 780,  emoji: "🍚", img: "chahan" },
  { cat: "shime", name: "チャーハン",                         kana: "ちゃーはん",                 price: 680,  emoji: "🍚", img: "chahan" },
  { cat: "shime", name: "温玉しらす丼",                       kana: "おんたましらすどん",         price: 780,  emoji: "🍚", img: "chahan" },
  { cat: "shime", name: "温玉肉丼",                           kana: "おんたまにくどん",           price: 780,  emoji: "🍚", img: "chahan" },
  { cat: "shime", name: "台湾ラーメン",                       kana: "たいわんらーめん",           price: 780,  emoji: "🍜", img: "taiwanramen" },
  { cat: "shime", name: "ライス",                             kana: "らいす",                     price: 200,  emoji: "🍚", img: "yakionigiri" },
  { cat: "shime", name: "ギョーザ",                           kana: "ぎょーざ",                   price: 580,  emoji: "🥟", img: "gyoza" },

  // ── 日本酒（4品・飲みきり300mlボトル）────────
  { cat: "sake", name: "くどき上手（純米吟醸 300ml）",        kana: "くどきじょうず",             price: 1350, emoji: "🍶", img: "sake" },
  { cat: "sake", name: "出羽桜（桜花吟醸 300ml）",            kana: "でわざくら",                 price: 1350, emoji: "🍶", img: "sake" },
  { cat: "sake", name: "陸奥男山（超辛口純米 300ml）",        kana: "むつおとこやま",             price: 1500, emoji: "🍶", img: "sake" },
  { cat: "sake", name: "考の司（純米吟醸 300ml）",            kana: "こうのつかさ",               price: 1500, emoji: "🍶", img: "sake" },

  // ── ドリンク（10品・笑路と同一ラインナップ）─
  { cat: "drink", name: "生ビール（中）",                     kana: "なまびーるちゅう",           price: 500,  emoji: "🍺", img: "beer" },
  { cat: "drink", name: "ハイボール",                         kana: "はいぼーる",                 price: 500,  emoji: "🥃", img: "highball" },
  { cat: "drink", name: "レモンサワー",                       kana: "れもんさわー",               price: 500,  emoji: "🍋", img: "lemonsour" },
  { cat: "drink", name: "モヒート",                           kana: "もひーと",                   price: 500,  emoji: "🍹", img: "mojito" },
  { cat: "drink", name: "カシスオレンジ",                     kana: "かしすおれんじ",             price: 500,  emoji: "🍹", img: "cassisorange" },
  { cat: "drink", name: "芋焼酎（グラス）",                   kana: "いもじょうちゅうぐらす",     price: 500,  emoji: "🥃", img: "shochu" },
  { cat: "drink", name: "麦焼酎（グラス）",                   kana: "むぎじょうちゅうぐらす",     price: 500,  emoji: "🥃", img: "shochu" },
  { cat: "drink", name: "米焼酎（グラス）",                   kana: "こめじょうちゅうぐらす",     price: 500,  emoji: "🥃", img: "shochu" },
  { cat: "drink", name: "烏龍茶",                             kana: "うーろんちゃ",               price: 300,  emoji: "☕", img: "oolong" },
  { cat: "drink", name: "緑茶",                               kana: "りょくちゃ",                 price: 300,  emoji: "🍵", img: "greentea" },
];

const perCatCounter = {};
const menuRows = rawMenus.map((m, i) => {
  perCatCounter[m.cat] = (perCatCounter[m.cat] ?? 0) + 1;
  return {
    id: `shoten-${String(i + 1).padStart(3, "0")}`,
    store_id: SHOTEN_STORE_ID,
    name: m.name,
    description: m.kana,  // 読み仮名（音声・かな検索用）
    price: m.price,
    category: CAT[m.cat],
    emoji: m.emoji,
    tax_rate: 0.10,
    is_tax_inclusive: false,
    image_url: IMG[m.img] ?? null,
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
  console.log("笑点の店舗レコードを登録（既存なら維持）...");
  const storeRes = await fetch(`${SB}/stores?id=eq.${SHOTEN_STORE_ID}&select=id`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const existing = await storeRes.json();
  if (existing.length === 0) {
    await req("POST", "stores", [{
      id: SHOTEN_STORE_ID,
      name: "居食屋 笑点",
      location: "愛知県豊田市",
      plan: "pro",
    }]);
    console.log("→ stores に登録しました");
  } else {
    console.log("→ 既に登録済み");
  }

  console.log("既存の笑点データを削除...");
  await req("DELETE", `menus?store_id=eq.${SHOTEN_STORE_ID}`);
  await req("DELETE", `categories?store_id=eq.${SHOTEN_STORE_ID}`);

  console.log(`カテゴリ ${categories.length} 件を投入...`);
  await req("POST", "categories", categories);

  console.log(`メニュー ${menuRows.length} 件を投入...`);
  await req("POST", "menus", menuRows);

  const catN  = await count(`categories?store_id=eq.${SHOTEN_STORE_ID}`);
  const menuN = await count(`menus?store_id=eq.${SHOTEN_STORE_ID}`);
  console.log(`完了: categories=${catN}, menus=${menuN}`);
  if (catN !== categories.length || menuN !== menuRows.length) {
    throw new Error("投入件数が一致しません");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
