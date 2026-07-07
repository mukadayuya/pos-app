// 焼鳥居酒屋ABC — マスターサンプル店舗のカテゴリ・メニュー投入スクリプト
//
// 使い方:  node scripts/setup_yakitori_abc_menu.mjs
// 再実行可: 既存の ABC 店舗のカテゴリ・メニューを削除してから投入する（冪等）。
// ID は固定 UUID（menuTranslations.ts の翻訳キーと一致させるため変更しないこと）。

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

// stores テーブルの 焼鳥居酒屋ABC の UUID（categories/menus は TEXT カラムなので文字列として保存）
export const ABC_STORE_ID = "6f0842d5-7fe6-4278-818c-86e8a8731130";

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

// ─── カテゴリ（7件・固定UUID） ───────────────────────────────────
const CAT = {
  yakitori: "2669b3ad-816f-4f31-9781-71eaa41ada9b",
  agemono:  "eb6abe02-0f03-4c10-b873-24ff0f46fa63",
  otsumami: "7bbbe267-1ca8-4f55-8f72-a34b8a7f520f",
  salad:    "0fcf29fc-3d09-4ab6-aded-cea98045db51",
  rice:     "2be996a3-7ed8-4863-93a2-73f88c7a04c3",
  dessert:  "f1865e3e-bd28-4c92-85cf-6dd3971e17e6",
  drink:    "f38cdf1f-1d2c-4041-aa53-35564cbadbca",
};

// 注意: categories.name にはグローバルな UNIQUE 制約があるため（categories_name_key）、
// tetsu-bo と重複しない名前にしている（おつまみ→一品料理、サラダ→野菜・サラダ、デザート→甘味）。
// supabase/fix_categories_per_store_unique.sql を実行すれば店舗単位のユニークに変わる。
const categories = [
  { id: CAT.yakitori, name: "焼鳥",         name_en: "Yakitori",        name_zh: "烤鸡串",    name_ko: "야키토리",     display_order: 1 },
  { id: CAT.agemono,  name: "揚げ物",       name_en: "Fried",           name_zh: "炸物",      name_ko: "튀김",         display_order: 2 },
  { id: CAT.otsumami, name: "一品料理",     name_en: "A La Carte",      name_zh: "单品料理",  name_ko: "일품요리",     display_order: 3 },
  { id: CAT.salad,    name: "野菜・サラダ", name_en: "Salads",          name_zh: "蔬菜沙拉",  name_ko: "채소·샐러드", display_order: 4 },
  { id: CAT.rice,     name: "ご飯・〆",     name_en: "Rice & Finisher", name_zh: "主食",      name_ko: "식사",         display_order: 5 },
  { id: CAT.dessert,  name: "甘味",         name_en: "Desserts",        name_zh: "甜点",      name_ko: "디저트",       display_order: 6 },
  { id: CAT.drink,    name: "ドリンク",     name_en: "Drinks",          name_zh: "饮品",      name_ko: "드링크",       display_order: 7 },
].map(c => ({ ...c, store_id: ABC_STORE_ID }));

// ─── 画像（Wikimedia Commons・ホットリンク可） ─────────────────────
const IMG = {
  yakitori1:   "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Yakitori_001.jpg/960px-Yakitori_001.jpg",
  yakitori2:   "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Yakitori_002.jpg/960px-Yakitori_002.jpg",
  liver:       "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Yakitori_018.jpg/960px-Yakitori_018.jpg",
  tsukune:     "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Kushiyaki-_tsukune%2C_scallion_and_pork_belly.jpg/960px-Kushiyaki-_tsukune%2C_scallion_and_pork_belly.jpg",
  karaage:     "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Classic_Chicken_Karaage_-_Sunoso_2023-11-28.jpg/960px-Classic_Chicken_Karaage_-_Sunoso_2023-11-28.jpg",
  tebasaki:    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tebasaki_karaage_by_kawanet_in_Kanayama%2C_Nagoya.jpg/960px-Tebasaki_karaage_by_kawanet_in_Kanayama%2C_Nagoya.jpg",
  fries:       "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/French_fries_at_Chez_Jolie.jpg/960px-French_fries_at_Chez_Jolie.jpg",
  edamame:     "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Edamame_bowl_by_habitatgirl.jpg/960px-Edamame_bowl_by_habitatgirl.jpg",
  hiyayakko:   "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg/960px-Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg",
  potatosalad: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Potato_salad_001.jpg/960px-Potato_salad_001.jpg",
  dashimaki:   "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Dashimaki_tamago_by_june29.jpg/960px-Dashimaki_tamago_by_june29.jpg",
  tomato:      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Sliced_Tomatoes_on_a_plate.jpg/960px-Sliced_Tomatoes_on_a_plate.jpg",
  greensalad:  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Small_Salad%2C_at_Ikinari%21_Steak_%282019-04-13%29.jpg/960px-Small_Salad%2C_at_Ikinari%21_Steak_%282019-04-13%29.jpg",
  caesar:      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Caesar_Salad_-_Purezza_2023-11-22.jpg/960px-Caesar_Salad_-_Purezza_2023-11-22.jpg",
  chicksalad:  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Fresh_garden_salad_with_grilled_chicken%2C_lettuce%2C_radishes%2C_and_a_creamy_dressing_undefined.jpg/960px-Fresh_garden_salad_with_grilled_chicken%2C_lettuce%2C_radishes%2C_and_a_creamy_dressing_undefined.jpg",
  yakionigiri: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Yaki-Onigiri_001.jpg/960px-Yaki-Onigiri_001.jpg",
  ochazuke:    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Instant_chazuke_by_shibainu.jpg/960px-Instant_chazuke_by_shibainu.jpg",
  oyakodon:    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Oyakodon_003.jpg/960px-Oyakodon_003.jpg",
  zosui:       "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Kinoko_Zosui%2C_at_Restaurant_Gusto_%282012.02.26%29.jpg/960px-Kinoko_Zosui%2C_at_Restaurant_Gusto_%282012.02.26%29.jpg",
  vanilla:     "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Vanilla_bean_ice_cream_%283086700978%29.jpg/960px-Vanilla_bean_ice_cream_%283086700978%29.jpg",
  matcha:      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Matcha_ice_cream_001.jpg/960px-Matcha_ice_cream_001.jpg",
  purin:       "https://upload.wikimedia.org/wikipedia/commons/c/c9/Japanese_Caramel_Custard_Pudding%2C_Purin%2C_Flan.jpg",
  beer:        "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Hoisting_a_Mug_of_St._George%27s_Draft_Beer_-_Adigrat_-_Ethiopia_%288706601227%29.jpg/960px-Hoisting_a_Mug_of_St._George%27s_Draft_Beer_-_Adigrat_-_Ethiopia_%288706601227%29.jpg",
  highball:    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Glass_of_Scotch_and_soda.jpg/960px-Glass_of_Scotch_and_soda.jpg",
  lemonsour:   "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Chanhmuoiglass.jpg/960px-Chanhmuoiglass.jpg",
  sake:        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Tokkuri_and_Choko_%28sake_cup%29_in_Osaka_-_Apr_18%2C_2019.jpg/960px-Tokkuri_and_Choko_%28sake_cup%29_in_Osaka_-_Apr_18%2C_2019.jpg",
  shochu:      "https://upload.wikimedia.org/wikipedia/commons/b/bc/Mugi-sh%C5%8Dch%C5%AB_Gunkanjima.jpg",
  oolong:      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Oolong_Tea.jpg/960px-Oolong_Tea.jpg",
  cola:        "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Glass_cola.jpg/960px-Glass_cola.jpg",
};

// ─── メニュー36品（価格は税抜・標準税率10%） ───────────────────────
const menus = [
  // ── 焼鳥 ──
  { id: "b28cc0d9-ef26-452c-9f3a-8dd080220114", category: CAT.yakitori, price: 180, emoji: "🍢", image: IMG.yakitori1, takeout: true,
    name: "もも（タレ・塩）", name_en: "Chicken Thigh Skewer (tare/salt)", name_zh: "鸡腿肉串（酱汁/盐味）", name_ko: "닭다리살 꼬치 (타레/소금)",
    description: "備長炭でじっくり焼き上げた定番の一本。タレ・塩お選びいただけます。",
    description_en: "Our classic skewer, slow-grilled over binchotan charcoal. Choose tare sauce or salt.",
    description_zh: "备长炭慢火烤制的招牌串。可选酱汁或盐味。",
    description_ko: "비장탄으로 천천히 구운 대표 꼬치. 타레 또는 소금 선택 가능." },
  { id: "cc374dd0-09d4-4efd-967f-010f83d117f9", category: CAT.yakitori, price: 200, emoji: "🍢", image: IMG.yakitori1, takeout: true,
    name: "ねぎま", name_en: "Negima (chicken & leek)", name_zh: "鸡肉大葱串", name_ko: "네기마 (닭고기·대파)",
    description: "ジューシーなもも肉と甘い九条ねぎの王道コンビ。",
    description_en: "Juicy thigh meat with sweet Kujo leek — the golden combination.",
    description_zh: "多汁鸡腿肉与香甜九条葱的经典组合。",
    description_ko: "육즙 가득한 다리살과 달콤한 파의 황금 조합." },
  { id: "4f5aca6b-1d90-4c2b-9a17-e0fdb834efda", category: CAT.yakitori, price: 220, emoji: "🍢", image: IMG.tsukune, takeout: true,
    name: "つくね（タレ）", name_en: "Tsukune Meatball Skewer", name_zh: "鸡肉丸串", name_ko: "츠쿠네 (닭고기 완자)",
    description: "ふんわり食感の自家製つくね。特製ダレを絡めて。",
    description_en: "Fluffy housemade chicken meatballs glazed with our special tare.",
    description_zh: "口感松软的自制鸡肉丸，裹上特制酱汁。",
    description_ko: "폭신한 수제 츠쿠네에 특제 타레를 발라 구웠습니다." },
  { id: "d58cbcaa-27de-4531-9076-08ef12c5ef88", category: CAT.yakitori, price: 160, emoji: "🍢", image: IMG.yakitori2, takeout: true,
    name: "皮（塩）", name_en: "Chicken Skin Skewer (salt)", name_zh: "鸡皮串（盐味）", name_ko: "닭껍질 꼬치 (소금)",
    description: "パリパリに焼き上げた香ばしい鶏皮。ビールのお供に。",
    description_en: "Crispy grilled chicken skin — the perfect beer companion.",
    description_zh: "烤得酥脆喷香的鸡皮，下酒一绝。",
    description_ko: "바삭하게 구운 고소한 닭껍질. 맥주 안주로 최고." },
  { id: "9abbf5fa-bee5-4468-bb19-f1be36012ec7", category: CAT.yakitori, price: 180, emoji: "🍢", image: IMG.liver, takeout: true,
    name: "レバー（タレ）", name_en: "Chicken Liver Skewer (tare)", name_zh: "鸡肝串（酱汁）", name_ko: "닭간 꼬치 (타레)",
    description: "とろける食感の新鮮レバー。甘辛ダレでどうぞ。",
    description_en: "Fresh liver with a melt-in-your-mouth texture, in sweet-savory tare.",
    description_zh: "入口即化的新鲜鸡肝，配甜辣酱汁。",
    description_ko: "입에서 녹는 신선한 간. 달콤짭짤한 타레와 함께." },
  { id: "d310533a-317a-41d4-8e83-77019480bb9b", category: CAT.yakitori, price: 200, emoji: "🍢", image: IMG.yakitori1, takeout: true,
    name: "ささみ（わさび醤油）", name_en: "Chicken Tender (wasabi soy)", name_zh: "鸡里脊串（芥末酱油）", name_ko: "닭안심 (와사비 간장)",
    description: "しっとりささみに、ツンと爽やかなわさびを添えて。",
    description_en: "Tender chicken breast fillet with a refreshing touch of wasabi.",
    description_zh: "嫩滑鸡里脊配清爽芥末。",
    description_ko: "촉촉한 안심에 알싸한 와사비를 곁들여." },
  { id: "6a877d1d-bc8a-4bb9-939c-9a91034d10ab", category: CAT.yakitori, price: 180, emoji: "🍢", image: IMG.yakitori2, takeout: true,
    name: "砂肝（塩）", name_en: "Chicken Gizzard Skewer (salt)", name_zh: "鸡胗串（盐味）", name_ko: "닭모래집 꼬치 (소금)",
    description: "コリコリ食感がクセになる砂肝をシンプルに塩で。",
    description_en: "Addictively crunchy gizzard, simply seasoned with salt.",
    description_zh: "口感脆爽的鸡胗，简单盐味更显鲜美。",
    description_ko: "꼬들꼬들한 식감이 중독적인 모래집을 소금으로 심플하게." },
  { id: "0a602383-7f75-4b9d-9e32-1b1c8b7c6ef8", category: CAT.yakitori, price: 180, emoji: "🍢", image: IMG.liver, takeout: true,
    name: "ハツ（塩）", name_en: "Chicken Heart Skewer (salt)", name_zh: "鸡心串（盐味）", name_ko: "닭염통 꼬치 (소금)",
    description: "プリッと弾ける食感のハツ。鮮度が命の人気部位。",
    description_en: "Plump, juicy chicken hearts — freshness makes all the difference.",
    description_zh: "弹嫩多汁的鸡心，新鲜是美味的关键。",
    description_ko: "탱글탱글한 식감의 염통. 신선함이 생명인 인기 부위." },
  { id: "e386b774-6b76-4e7e-86e7-44800cd39684", category: CAT.yakitori, price: 200, emoji: "🍢", image: IMG.tsukune, takeout: true,
    name: "豚バラ串", name_en: "Pork Belly Skewer", name_zh: "猪五花串", name_ko: "삼겹살 꼬치",
    description: "脂の甘みがじゅわっと広がる炭火焼き豚バラ。",
    description_en: "Charcoal-grilled pork belly with sweet, savory richness.",
    description_zh: "炭火烤猪五花，油脂香甜四溢。",
    description_ko: "고소한 기름의 단맛이 퍼지는 숯불 삼겹살 꼬치." },
  { id: "c3fa3476-229e-48a0-9640-5db8a056f151", category: CAT.yakitori, price: 880, emoji: "🍢", image: IMG.yakitori1, takeout: true,
    name: "焼鳥盛り合わせ（5本）", name_en: "Assorted Yakitori (5 skewers)", name_zh: "烤鸡串拼盘（5串）", name_ko: "야키토리 모둠 (5꼬치)",
    description: "もも・ねぎま・つくね・皮・砂肝の人気5本セット。迷ったらコレ。",
    description_en: "Five favorites: thigh, negima, tsukune, skin, and gizzard. Can't decide? Start here.",
    description_zh: "鸡腿、葱串、肉丸、鸡皮、鸡胗人气5串。选择困难就点这个。",
    description_ko: "다리살·네기마·츠쿠네·껍질·모래집 인기 5종 세트. 고민될 땐 이걸로." },

  // ── 揚げ物 ──
  { id: "ec56d2c2-4783-44ad-b73d-e75bcf288a24", category: CAT.agemono, price: 580, emoji: "🍗", image: IMG.karaage, takeout: true,
    name: "若鶏の唐揚げ", name_en: "Chicken Karaage", name_zh: "日式炸鸡块", name_ko: "치킨 가라아게",
    description: "外はカリッと中はジューシー。秘伝の醤油ダレに漬け込んだ自慢の唐揚げ。",
    description_en: "Crispy outside, juicy inside — marinated in our secret soy sauce blend.",
    description_zh: "外酥里嫩，腌制于秘传酱油的招牌炸鸡。",
    description_ko: "겉바속촉! 비법 간장 양념에 재운 자랑스러운 가라아게." },
  { id: "14aa3279-45b3-47a4-90ce-c99d9f0fdfb0", category: CAT.agemono, price: 520, emoji: "🍗", image: IMG.tebasaki, takeout: true,
    name: "手羽先唐揚げ（甘辛）", name_en: "Fried Chicken Wings (sweet & spicy)", name_zh: "甜辣炸鸡翅", name_ko: "닭날개 튀김 (매콤달콤)",
    description: "甘辛ダレと胡椒がやみつきになる名物手羽先。",
    description_en: "Our famous wings with addictive sweet-spicy glaze and pepper.",
    description_zh: "甜辣酱与胡椒让人欲罢不能的招牌鸡翅。",
    description_ko: "매콤달콤 양념과 후추가 중독적인 명물 닭날개." },
  { id: "d7fdc489-351b-4524-a70a-2be102359104", category: CAT.agemono, price: 420, emoji: "🍟", image: IMG.fries, takeout: true,
    name: "ポテトフライ", name_en: "French Fries", name_zh: "炸薯条", name_ko: "감자튀김",
    description: "アツアツほくほく。お子様にも大人気の定番サイド。",
    description_en: "Hot and fluffy — a classic side loved by kids and grown-ups alike.",
    description_zh: "热腾腾松软可口，大人小孩都爱的经典配菜。",
    description_ko: "따끈따끈 포슬포슬. 아이들에게도 인기 만점인 사이드." },

  // ── おつまみ ──
  { id: "dcc75b98-a643-42be-ab92-4fca8cf3c1d2", category: CAT.otsumami, price: 380, emoji: "🫛", image: IMG.edamame, takeout: false,
    name: "枝豆", name_en: "Edamame", name_zh: "盐水毛豆", name_ko: "에다마메 (삶은 풋콩)",
    description: "ほどよい塩加減の定番おつまみ。まずはこれから。",
    description_en: "Perfectly salted classic starter. The way every izakaya night begins.",
    description_zh: "咸淡适中的经典下酒菜，开胃首选。",
    description_ko: "간이 딱 좋은 기본 안주. 첫 주문은 이것부터." },
  { id: "220ec611-fd18-4830-9388-cf89cb037cc0", category: CAT.otsumami, price: 350, emoji: "🧊", image: IMG.hiyayakko, takeout: false,
    name: "冷奴", name_en: "Hiyayakko (chilled tofu)", name_zh: "冷豆腐", name_ko: "히야얏코 (찬 두부)",
    description: "かつお節と九条ねぎ、生姜を添えたさっぱり冷奴。",
    description_en: "Chilled tofu topped with bonito flakes, leek, and ginger.",
    description_zh: "配木鱼花、葱花和姜末的清爽冷豆腐。",
    description_ko: "가츠오부시와 파, 생강을 올린 깔끔한 찬 두부." },
  { id: "a76299fe-a8d0-48a1-8ac4-bfcc23d43327", category: CAT.otsumami, price: 420, emoji: "🥔", image: IMG.potatosalad, takeout: true,
    name: "自家製ポテトサラダ", name_en: "Housemade Potato Salad", name_zh: "自制土豆沙拉", name_ko: "수제 감자 샐러드",
    description: "ゴロゴロじゃがいもと半熟卵の濃厚ポテサラ。",
    description_en: "Rich potato salad with chunky potatoes and soft-boiled egg.",
    description_zh: "大块土豆与溏心蛋的浓郁土豆沙拉。",
    description_ko: "큼직한 감자와 반숙 달걀의 진한 감자 샐러드." },
  { id: "7898c77e-e4de-477d-b75c-36bb7f2621a9", category: CAT.otsumami, price: 480, emoji: "🥚", image: IMG.dashimaki, takeout: false,
    name: "だし巻き玉子", name_en: "Dashimaki Tamago (rolled omelet)", name_zh: "高汤蛋卷", name_ko: "다시마키 타마고 (계란말이)",
    description: "注文を受けてから焼く、出汁たっぷりのふわふわ玉子。",
    description_en: "Made to order — fluffy omelet brimming with dashi stock.",
    description_zh: "现点现做，高汤满满的松软蛋卷。",
    description_ko: "주문 후 바로 굽는 육수 가득 폭신한 계란말이." },
  { id: "750ab484-221f-454f-8350-1e806295d8da", category: CAT.otsumami, price: 380, emoji: "🍅", image: IMG.tomato, takeout: false,
    name: "冷やしトマト", name_en: "Chilled Tomato", name_zh: "冰镇番茄", name_ko: "차가운 토마토",
    description: "キンキンに冷えた完熟トマト。塩またはドレッシングで。",
    description_en: "Ice-cold ripe tomatoes, served with salt or dressing.",
    description_zh: "冰镇完熟番茄，可配盐或沙拉酱。",
    description_ko: "차갑게 식힌 완숙 토마토. 소금 또는 드레싱과 함께." },

  // ── サラダ ──
  { id: "dd124bc7-80fa-469f-9dc2-364c17f2f99f", category: CAT.salad, price: 480, emoji: "🥗", image: IMG.greensalad, takeout: false,
    name: "グリーンサラダ", name_en: "Green Salad", name_zh: "蔬菜沙拉", name_ko: "그린 샐러드",
    description: "シャキシャキ野菜をたっぷり。自家製和風ドレッシングで。",
    description_en: "A generous bowl of crisp greens with housemade Japanese dressing.",
    description_zh: "爽脆蔬菜满满一碗，配自制和风沙拉酱。",
    description_ko: "아삭한 채소 듬뿍. 수제 와후 드레싱과 함께." },
  { id: "d5d6f41c-1aa3-4deb-96ee-3fdcccbebb6e", category: CAT.salad, price: 580, emoji: "🥗", image: IMG.caesar, takeout: false,
    name: "シーザーサラダ", name_en: "Caesar Salad", name_zh: "凯撒沙拉", name_ko: "시저 샐러드",
    description: "温泉卵とパルメザンチーズの濃厚シーザー。",
    description_en: "Rich Caesar salad with onsen egg and Parmesan cheese.",
    description_zh: "配温泉蛋与帕玛森芝士的浓郁凯撒沙拉。",
    description_ko: "온천 달걀과 파르메산 치즈의 진한 시저 샐러드." },
  { id: "ee564000-6bf8-4285-a007-2e8eb063e006", category: CAT.salad, price: 620, emoji: "🥗", image: IMG.chicksalad, takeout: false,
    name: "蒸し鶏のサラダ", name_en: "Steamed Chicken Salad", name_zh: "蒸鸡肉沙拉", name_ko: "찐 닭고기 샐러드",
    description: "しっとり蒸し鶏と彩り野菜のごまドレッシングサラダ。",
    description_en: "Tender steamed chicken and colorful vegetables with sesame dressing.",
    description_zh: "嫩滑蒸鸡肉与缤纷蔬菜，配芝麻沙拉酱。",
    description_ko: "촉촉한 찐 닭고기와 채소에 참깨 드레싱을 곁들인 샐러드." },

  // ── ご飯・〆 ──
  { id: "9d282931-f1b6-4dd1-b9f6-92591bc40623", category: CAT.rice, price: 380, emoji: "🍙", image: IMG.yakionigiri, takeout: true,
    name: "焼きおにぎり（2個）", name_en: "Grilled Rice Balls (2 pcs)", name_zh: "烤饭团（2个）", name_ko: "구운 주먹밥 (2개)",
    description: "香ばしい醤油の焦げ目がたまらない炭火焼きおにぎり。",
    description_en: "Charcoal-grilled rice balls with irresistible caramelized soy sauce.",
    description_zh: "炭火烤制，酱油焦香令人难忘的烤饭团。",
    description_ko: "고소한 간장 불맛이 일품인 숯불 구운 주먹밥." },
  { id: "db85b4da-c1c5-4ca1-8424-8224590fae5a", category: CAT.rice, price: 480, emoji: "🍵", image: IMG.ochazuke, takeout: false,
    name: "鶏茶漬け", name_en: "Chicken Chazuke (tea rice)", name_zh: "鸡肉茶泡饭", name_ko: "닭고기 오차즈케",
    description: "蒸し鶏とあられ、わさびを添えた出汁茶漬け。〆の定番。",
    description_en: "Dashi-based rice soup with steamed chicken, rice crackers, and wasabi.",
    description_zh: "高汤茶泡饭配蒸鸡肉、米果与芥末，收尾必点。",
    description_ko: "찐 닭고기와 아라레, 와사비를 올린 육수 오차즈케. 마무리 정번." },
  { id: "6dd25ddf-3f60-402e-a0d1-4f758c611ca2", category: CAT.rice, price: 780, emoji: "🍚", image: IMG.oyakodon, takeout: true,
    name: "親子丼", name_en: "Oyakodon (chicken & egg bowl)", name_zh: "鸡肉鸡蛋盖饭", name_ko: "오야코동 (닭고기 달걀 덮밥)",
    description: "炭火焼き鶏ととろとろ半熟卵の絶品親子丼。",
    description_en: "Charcoal-grilled chicken and silky soft-set egg over rice.",
    description_zh: "炭烤鸡肉与滑嫩半熟蛋的绝品盖饭。",
    description_ko: "숯불 닭고기와 부드러운 반숙 달걀의 일품 덮밥." },
  { id: "dc7c6d67-df24-4517-9521-d4db3dedb396", category: CAT.rice, price: 580, emoji: "🍲", image: IMG.zosui, takeout: false,
    name: "鶏雑炊", name_en: "Chicken Zosui (rice soup)", name_zh: "鸡肉杂炊粥", name_ko: "닭고기 조스이 (죽)",
    description: "鶏の旨みが溶け込んだ優しい味わいの雑炊。飲んだ後に。",
    description_en: "Gentle rice soup infused with chicken umami — perfect after drinks.",
    description_zh: "融入鸡肉鲜味的温和杂炊粥，酒后暖胃首选。",
    description_ko: "닭 육수의 감칠맛이 녹아든 부드러운 죽. 술 마신 후에." },

  // ── デザート ──
  { id: "12e116dc-6ecf-4517-a7b0-5a1732878caa", category: CAT.dessert, price: 330, emoji: "🍨", image: IMG.vanilla, takeout: false,
    name: "バニラアイス", name_en: "Vanilla Ice Cream", name_zh: "香草冰淇淋", name_ko: "바닐라 아이스크림",
    description: "濃厚バニラビーンズのなめらかアイスクリーム。",
    description_en: "Smooth, rich ice cream made with real vanilla beans.",
    description_zh: "使用天然香草豆的浓郁丝滑冰淇淋。",
    description_ko: "진한 바닐라빈의 부드러운 아이스크림." },
  { id: "2f972508-133a-44de-930b-e6f54f73f518", category: CAT.dessert, price: 380, emoji: "🍵", image: IMG.matcha, takeout: false,
    name: "抹茶アイス", name_en: "Matcha Ice Cream", name_zh: "抹茶冰淇淋", name_ko: "말차 아이스크림",
    description: "宇治抹茶のほろ苦さが大人のデザート。",
    description_en: "Uji matcha's pleasant bitterness — a grown-up dessert.",
    description_zh: "宇治抹茶的微苦回甘，成熟风味甜点。",
    description_ko: "우지 말차의 쌉싸름함이 매력적인 어른의 디저트." },
  { id: "6cdd181e-06a0-4c33-ae39-5d7e33de12b7", category: CAT.dessert, price: 420, emoji: "🍮", image: IMG.purin, takeout: false,
    name: "自家製プリン", name_en: "Housemade Custard Pudding", name_zh: "自制布丁", name_ko: "수제 푸딩",
    description: "ほろ苦カラメルと卵のコクが自慢の昔ながらのプリン。",
    description_en: "Old-fashioned pudding with bittersweet caramel and rich egg custard.",
    description_zh: "焦糖微苦、蛋香浓郁的古早味布丁。",
    description_ko: "쌉싸름한 캐러멜과 달걀의 풍미가 자랑인 옛날식 푸딩." },

  // ── ドリンク ──
  { id: "a25df14c-d238-4958-927d-e7a68c620f31", category: CAT.drink, price: 550, emoji: "🍺", image: IMG.beer, takeout: false,
    name: "生ビール（中）", name_en: "Draft Beer (medium)", name_zh: "生啤酒（中杯）", name_ko: "생맥주 (중)",
    description: "キンキンに冷えたジョッキでどうぞ。焼鳥との相性抜群。",
    description_en: "Served in an ice-cold mug. The perfect match for yakitori.",
    description_zh: "冰镇啤酒杯盛装，与烤串是绝配。",
    description_ko: "차갑게 식힌 조끼로 제공. 야키토리와 환상 궁합." },
  { id: "81e63f8b-ea7d-416e-8faf-b46ac1e69805", category: CAT.drink, price: 450, emoji: "🥃", image: IMG.highball, takeout: false,
    name: "ハイボール", name_en: "Highball (whisky & soda)", name_zh: "威士忌苏打", name_ko: "하이볼",
    description: "炭酸強めの爽快ハイボール。濃いめ+50円。",
    description_en: "Refreshing highball with extra-strong soda. Make it strong for +¥50.",
    description_zh: "气泡感十足的清爽嗨棒。加浓+50日元。",
    description_ko: "탄산 강한 상쾌한 하이볼. 진하게는 +50엔." },
  { id: "58ffd364-6c57-4a6c-bc58-c95babdad051", category: CAT.drink, price: 420, emoji: "🍋", image: IMG.lemonsour, takeout: false,
    name: "レモンサワー", name_en: "Lemon Sour", name_zh: "柠檬沙瓦", name_ko: "레몬 사와",
    description: "生搾りレモンの定番サワー。さっぱり飲みやすい一杯。",
    description_en: "Classic sour with fresh-squeezed lemon. Crisp and easy to drink.",
    description_zh: "鲜榨柠檬经典沙瓦，清爽易饮。",
    description_ko: "생레몬을 짜 넣은 기본 사와. 깔끔하고 마시기 편한 한 잔." },
  { id: "7fc4c56f-6788-4945-8d88-085d67bbc959", category: CAT.drink, price: 420, emoji: "🍹", image: IMG.oolong, takeout: false,
    name: "ウーロンハイ", name_en: "Oolong-hai (oolong & shochu)", name_zh: "乌龙茶兑烧酒", name_ko: "우롱하이",
    description: "すっきり飲みやすい焼酎のウーロン茶割り。",
    description_en: "Shochu mixed with oolong tea — clean and refreshing.",
    description_zh: "烧酒兑乌龙茶，清爽顺口。",
    description_ko: "깔끔하게 마시기 좋은 소주 우롱차 칵테일." },
  { id: "b6678828-dc66-4b5e-9d6d-6726be4d2438", category: CAT.drink, price: 550, emoji: "🍶", image: IMG.sake, takeout: false,
    name: "日本酒（一合）", name_en: "Sake (180ml)", name_zh: "日本清酒（一合）", name_ko: "사케 (1홉)",
    description: "店主厳選の地酒。冷・燗お選びいただけます。",
    description_en: "Local sake selected by the owner. Served chilled or warmed.",
    description_zh: "店主严选地方清酒，可选冷酒或热酒。",
    description_ko: "주인장이 엄선한 지자케. 차갑게 또는 따뜻하게." },
  { id: "52c237dc-2bd0-4431-9a9a-34a5493b275a", category: CAT.drink, price: 480, emoji: "🥃", image: IMG.shochu, takeout: false,
    name: "麦焼酎（グラス）", name_en: "Barley Shochu (glass)", name_zh: "麦烧酒（杯）", name_ko: "보리 소주 (잔)",
    description: "香ばしくまろやかな麦焼酎。ロック・水割り・お湯割りで。",
    description_en: "Aromatic, mellow barley shochu — on the rocks, with water, or hot water.",
    description_zh: "香醇麦烧酒，可加冰、兑水或兑热水。",
    description_ko: "고소하고 부드러운 보리 소주. 온더록스·물·뜨거운 물 희석 가능." },
  { id: "ea5480ba-3f52-4c8d-b5e5-68c6cb215ad3", category: CAT.drink, price: 300, emoji: "🍵", image: IMG.oolong, takeout: false,
    name: "ウーロン茶", name_en: "Oolong Tea", name_zh: "乌龙茶", name_ko: "우롱차",
    description: "さっぱりとした定番ソフトドリンク。",
    description_en: "The classic refreshing soft drink.",
    description_zh: "清爽解腻的经典软饮。",
    description_ko: "깔끔한 기본 소프트드링크." },
  { id: "073df1dd-c359-4d6d-bf36-28b210289391", category: CAT.drink, price: 300, emoji: "🥤", image: IMG.cola, takeout: false,
    name: "コーラ", name_en: "Cola", name_zh: "可乐", name_ko: "콜라",
    description: "氷たっぷりのグラスでお届けします。",
    description_en: "Served in a glass full of ice.",
    description_zh: "加满冰块的玻璃杯装可乐。",
    description_ko: "얼음 가득한 잔에 시원하게 드립니다." },
];

// カテゴリー内での連番（並び替え初期値）を計算
const perCatCounter = {};
const menuRows = menus.map(m => {
  perCatCounter[m.category] = (perCatCounter[m.category] ?? 0) + 1;
  return {
    id: m.id,
    store_id: ABC_STORE_ID,
    name: m.name,
    name_en: m.name_en,
    name_zh: m.name_zh,
    name_ko: m.name_ko,
    description: m.description,
    description_en: m.description_en,
    description_zh: m.description_zh,
    description_ko: m.description_ko,
    price: m.price,
    category: m.category,
    emoji: m.emoji,
    tax_rate: 0.10,
    is_tax_inclusive: false,
    image_url: m.image,
    is_takeout_available: m.takeout,
    is_available: true,
    display_order: perCatCounter[m.category],
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
  console.log("既存のABCデータを削除...");
  await req("DELETE", `menus?store_id=eq.${ABC_STORE_ID}`);
  await req("DELETE", `categories?store_id=eq.${ABC_STORE_ID}`);

  console.log(`カテゴリ ${categories.length} 件を投入...`);
  await req("POST", "categories", categories);

  console.log(`メニュー ${menuRows.length} 件を投入...`);
  await req("POST", "menus", menuRows);

  const catN  = await count(`categories?store_id=eq.${ABC_STORE_ID}`);
  const menuN = await count(`menus?store_id=eq.${ABC_STORE_ID}`);
  console.log(`完了: categories=${catN}, menus=${menuN}`);
  if (catN !== categories.length || menuN !== menuRows.length) {
    throw new Error("投入件数が一致しません");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
