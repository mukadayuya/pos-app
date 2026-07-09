// 炭火やきとり 笑路 メニュー・カテゴリー翻訳テーブル
// 日本語 / 英語 / ネパール語（ネパール人スタッフ用）を中心に、必要な他言語も

import type { Lang } from "@/lib/i18n";

export const warajiCategoryTranslations: Record<string, Partial<Record<Lang, string>>> = {
  "焼鳥・串焼き":    { en: "Yakitori / Skewers",  ne: "याकितोरी / सिख",           zh: "烤鸡串",       ko: "야키토리 / 꼬치" },
  "肉巻き串":        { en: "Meat-wrapped Skewers", ne: "मासु बेरिएको सिख",         zh: "肉卷串",       ko: "고기말이 꼬치" },
  "野菜串":          { en: "Vegetable Skewers",   ne: "तरकारी सिख",              zh: "蔬菜串",       ko: "야채 꼬치" },
  "ササミ":          { en: "Chicken Tenderloin",  ne: "कुखुराको तेन्डरलोइन",       zh: "鸡里脊",       ko: "닭 안심" },
  "冷菜・おつまみ":  { en: "Cold Dishes / Snacks", ne: "चिसो परिकार / खाजा",       zh: "凉菜·下酒菜", ko: "냉채 / 안주" },
  "サラダ":          { en: "Salad",               ne: "सलाद",                    zh: "沙拉",         ko: "샐러드" },
  "揚げ物・一品料理": { en: "Fried / A la Carte", ne: "फ्राइ / एकल परिकार",       zh: "炸物·单品",   ko: "튀김 / 일품요리" },
  "〆・ご飯もの":    { en: "Rice / Finishers",    ne: "भात / अन्तिम परिकार",      zh: "主食·收尾",   ko: "밥 / 마무리" },
  "ドリンク":        { en: "Drinks",              ne: "पेय पदार्थ",              zh: "饮品",         ko: "음료" },
  // ── 居食屋 笑点（系列店）のカテゴリー ──
  "本日のオススメ":  { en: "Today's Specials",    ne: "आजको विशेष",              zh: "今日推荐",     ko: "오늘의 추천" },
  "刺身・刺盛り":    { en: "Sashimi",             ne: "सासिमी",                  zh: "刺身拼盘",     ko: "사시미" },
  "お湯ぽちゃ料理":  { en: "Warm Comfort Dishes", ne: "तातो परिकार",             zh: "温热料理",     ko: "따뜻한 요리" },
  "SPEED・珍味":     { en: "Quick Bites",         ne: "छिटो खाजा",               zh: "快速小菜",     ko: "스피드 안주" },
  "野菜":            { en: "Vegetables",          ne: "तरकारी",                  zh: "蔬菜",         ko: "야채" },
  "揚物":            { en: "Fried",               ne: "फ्राइ",                   zh: "炸物",         ko: "튀김" },
  "焼物":            { en: "Grilled",             ne: "पोलेको",                  zh: "烤物",         ko: "구이" },
  "日本酒":          { en: "Sake",                ne: "सेक (जापानी रक्सी)",       zh: "日本酒",       ko: "사케" },
};

// メニュー個別翻訳: 全78品ではなく主要な人気メニュー中心にカバー
// カバーされないものは日本語まま表示（自然な運用）
export const warajiMenuTranslations: Record<string, Partial<Record<Lang, string>>> = {
  // 焼鳥・串焼き
  "本日のおまかせ5種焼き": { en: "Today's 5 Kinds Assortment", ne: "आजको ५ किसिम्को असोर्टमेन्ट", zh: "今日拼盘5种", ko: "오늘의 5종 모듬" },
  "身焼き":           { en: "Chicken Breast",       ne: "कुखुराको प्रसाद",    zh: "鸡肉串",       ko: "닭가슴살 꼬치" },
  "ねぎま":           { en: "Chicken & Leek",       ne: "कुखुरा र लीक",      zh: "鸡肉葱串",     ko: "네기마" },
  "上セセリ":         { en: "Premium Neck Meat",    ne: "प्रिमियम घाँटी मासु", zh: "特级颈肉",     ko: "특급 목살" },
  "なんこつ":         { en: "Chicken Cartilage",    ne: "कुखुराको कार्टिलेज", zh: "鸡软骨",       ko: "닭 연골" },
  "レバ焼き（塩）":   { en: "Liver Skewer (Salt)",  ne: "कलेजोको सिख (नुन)", zh: "烤鸡肝（盐）", ko: "간꼬치 (소금)" },
  "レバ焼き（タレ）": { en: "Liver Skewer (Sauce)", ne: "कलेजोको सिख (सस)",  zh: "烤鸡肝（酱汁）", ko: "간꼬치 (양념)" },
  "つくね":           { en: "Chicken Meatball",     ne: "कुखुराको मीटबल",     zh: "鸡肉丸",       ko: "츠쿠네" },
  "とり皮":           { en: "Chicken Skin",         ne: "कुखुराको छाला",      zh: "鸡皮",         ko: "닭껍질" },
  "ハート":           { en: "Chicken Heart",        ne: "कुखुराको मुटु",      zh: "鸡心",         ko: "닭 심장" },
  "砂肝":             { en: "Gizzard",              ne: "बालुवा कलेजो",       zh: "鸡胗",         ko: "닭 모래집" },
  "手羽先焼き":       { en: "Chicken Wing",         ne: "कुखुराको पखेटा",     zh: "烤鸡翅",       ko: "닭날개" },
  "づけ焼き":         { en: "Marinated Skewer",     ne: "मरिनेटेड सिख",       zh: "腌制串",       ko: "절임 꼬치" },
  "づけうずら焼き":   { en: "Marinated Quail Egg",  ne: "मरिनेटेड बट्टाइको फुल", zh: "腌鹌鹑蛋",  ko: "절임 메추리알" },
  "ボンジリ串":       { en: "Chicken Tail",         ne: "कुखुराको पुच्छर",    zh: "鸡屁股肉",     ko: "닭 꼬리살" },
  "とりホル串":       { en: "Chicken Offal",        ne: "कुखुराको भित्री अंग", zh: "鸡内脏",       ko: "닭 내장" },
  "ポークフランク串": { en: "Pork Frankfurter",     ne: "पोर्क फ्रैंकफर्टर",   zh: "香肠串",       ko: "돼지 소시지" },

  // 肉巻き串
  "肉巻き3種串":         { en: "3 Kinds Meat-Wrap Skewer", ne: "३ किसिमको मासु बेरिएको सिख", zh: "肉卷3种串", ko: "고기말이 3종 꼬치" },
  "肉巻きプチトマト":     { en: "Meat-wrapped Cherry Tomato", ne: "मासु बेरिएको चेरी टमाटर",  zh: "肉卷小番茄",  ko: "고기말이 방울토마토" },
  "えのきとチーズの肉巻き串": { en: "Enoki & Cheese Meat-wrap", ne: "एनोकी र चीज मासु बेर",    zh: "金针菇奶酪肉卷", ko: "팽이버섯 치즈 고기말이" },
  "肉巻きうずら":         { en: "Meat-wrapped Quail Egg",   ne: "मासु बेरिएको बट्टाइको फुल", zh: "肉卷鹌鹑蛋",  ko: "고기말이 메추리알" },

  // 野菜串
  "ししとう":         { en: "Shishito Pepper",   ne: "शिशितो खुर्सानी",   zh: "狮子唐辛子",  ko: "시시토 고추" },
  "竹の子土佐焼き":   { en: "Bamboo Shoot Tosa", ne: "बाँसको तरुल टोसा",  zh: "土佐烤竹笋",  ko: "죽순 도사구이" },
  "いかだ":           { en: "Ikada Skewer",      ne: "इकादा सिख",         zh: "筏子串",      ko: "이카다 꼬치" },
  "しいたけ":         { en: "Shiitake Mushroom", ne: "शिताके च्याउ",      zh: "香菇",        ko: "표고버섯" },

  // ササミ
  "ササミ串":            { en: "Chicken Tenderloin Skewer", ne: "कुखुराको तेन्डरलोइन सिख", zh: "鸡里脊串", ko: "닭 안심 꼬치" },
  "梅しそササミ串":      { en: "Ume-Shiso Tenderloin",       ne: "उमे-शिसो तेन्डरलोइन",      zh: "梅紫苏鸡里脊",  ko: "우메시소 안심" },
  "ササミわさび":        { en: "Tenderloin with Wasabi",     ne: "वासाबीसँग तेन्डरलोइन",     zh: "芥末鸡里脊",    ko: "와사비 안심" },
  "ササミおろしポン酢":  { en: "Tenderloin Grated Ponzu",    ne: "पोन्जुसँग तेन्डरलोइन",     zh: "萝卜泥柚子醋鸡里脊", ko: "무즙 폰즈 안심" },
  "ササミ3兄弟":         { en: "3 Tenderloin Assortment",    ne: "३ किसिमको तेन्डरलोइन",     zh: "鸡里脊三兄弟",  ko: "안심 3형제" },

  // 冷菜・おつまみ
  "クリームチーズの特製醤油づけ": { en: "Soy-marinated Cream Cheese", ne: "सोयामा मरिनेटेड क्रीम चीज", zh: "特制酱油腌奶油奶酪", ko: "간장 절임 크림치즈" },
  "ねばねばMIX":       { en: "Sticky Ingredients Mix", ne: "टाँसिने मिक्स",          zh: "黏黏MIX",    ko: "네바네바 믹스" },
  "きゅうりの1本漬け": { en: "Whole Pickled Cucumber", ne: "पूरै अचारी काँक्रो",    zh: "腌黄瓜",    ko: "오이 통 절임" },
  "とりポン":          { en: "Chicken with Ponzu",     ne: "पोन्जुसँग कुखुरा",       zh: "柚子醋鸡",  ko: "치킨 폰즈" },
  "えだ豆":            { en: "Edamame",                ne: "एदामामे",                zh: "毛豆",      ko: "에다마메" },
  "宗家キムチ":        { en: "House Kimchi",           ne: "घरको किम्ची",            zh: "宗家泡菜",  ko: "종가 김치" },
  "じゃこおろし":      { en: "Grated Radish w/ Whitebait", ne: "गरेटेड मूला र माछा",  zh: "萝卜泥小鱼", ko: "잔멸치 무즙" },
  "なめたけおろし":    { en: "Grated Radish w/ Nametake", ne: "गरेटेड मूला र नामेतके च्याउ", zh: "萝卜泥金针菇", ko: "나메타케 무즙" },
  "じゃこおくら":      { en: "Whitebait & Okra",       ne: "जाको र भिन्डी",          zh: "小鱼秋葵",  ko: "잔멸치 오크라" },
  "オニオンスライス":  { en: "Sliced Onion",           ne: "काटिएको प्याज",           zh: "洋葱片",    ko: "양파 슬라이스" },
  "みょうがスライス":  { en: "Sliced Myoga",           ne: "काटिएको म्योगा",          zh: "茗荷片",    ko: "묘가 슬라이스" },
  "おくらスライス":    { en: "Sliced Okra",            ne: "काटिएको भिन्डी",          zh: "秋葵片",    ko: "오크라 슬라이스" },
  "長芋短冊":          { en: "Sliced Yam",             ne: "काटिएको लामो तरुल",       zh: "山药条",    ko: "산마 채썰기" },
  "やっこ":            { en: "Cold Tofu",              ne: "चिसो तोफु",              zh: "凉豆腐",    ko: "냉두부" },
  "台湾やっこ":        { en: "Taiwanese Cold Tofu",    ne: "ताइवानी चिसो तोफु",       zh: "台湾凉豆腐", ko: "대만식 냉두부" },
  "温泉玉子":          { en: "Onsen Egg",              ne: "ओन्सेन अण्डा",           zh: "温泉蛋",    ko: "온천 계란" },
  "温玉キムチ":        { en: "Kimchi w/ Onsen Egg",    ne: "किम्ची र ओन्सेन अण्डा",   zh: "温泉蛋泡菜", ko: "온천란 김치" },
  "かつおの酒盗":      { en: "Bonito Shuto",           ne: "बोनिटो शुतो",             zh: "鲣鱼酒盗",  ko: "가다랑어 슈토" },

  // サラダ
  "シーザーサラダ":  { en: "Caesar Salad",       ne: "सिजर सलाद",       zh: "凯撒沙拉",     ko: "시저 샐러드" },
  "血液サラサラダ":  { en: "Healthy Salad",      ne: "स्वस्थ सलाद",     zh: "养生沙拉",     ko: "건강 샐러드" },
  "チョレギサラダ":  { en: "Choregi Salad",      ne: "चोरेगी सलाद",     zh: "韩式沙拉",     ko: "겉절이 샐러드" },

  // 揚げ物・一品料理
  "とりの唐揚":     { en: "Chicken Karaage",     ne: "कुखुराको कारागे",     zh: "炸鸡块",     ko: "닭튀김" },
  "ポテト":         { en: "French Fries",         ne: "फ्रेन्च फ्राइज्",       zh: "薯条",       ko: "감자튀김" },
  "とりしゅうまい": { en: "Chicken Shumai",       ne: "कुखुराको सुमै",        zh: "鸡肉烧麦",   ko: "치킨 슈마이" },
  "さつまスティック": { en: "Sweet Potato Sticks", ne: "मीठो आलुका स्टिक्स", zh: "红薯条",    ko: "고구마 스틱" },
  "えびマヨ":       { en: "Shrimp Mayo",          ne: "झिँगे मेयो",           zh: "虾仁蛋黄酱", ko: "새우 마요" },
  "とり皮チップス": { en: "Chicken Skin Chips",   ne: "कुखुराको छाला चिप्स", zh: "鸡皮薯片",   ko: "닭껍질 칩" },
  "チーズフライ":   { en: "Cheese Fry",           ne: "चीज फ्राइ",            zh: "炸奶酪",     ko: "치즈 튀김" },
  "なん唐":         { en: "Nan Karaage",          ne: "नान कारागे",          zh: "南蛮炸鸡",   ko: "난반 튀김" },
  "赤ウインナー":   { en: "Red Sausage",          ne: "रातो सस्सेज",          zh: "红香肠",     ko: "빨간 소시지" },
  "たこ唐":         { en: "Octopus Karaage",      ne: "अक्टोपस कारागे",       zh: "炸章鱼",     ko: "문어 튀김" },

  // 〆・ご飯もの
  "とりだし茶づけ":     { en: "Chicken Broth Chazuke",     ne: "कुखुराको सुपसँग चाज्केि",  zh: "鸡汤茶泡饭",  ko: "닭육수 오차즈케" },
  "焼きおにぎり茶づけ": { en: "Grilled Rice Ball Chazuke", ne: "पोलेको भात चाज्केि",       zh: "烤饭团茶泡饭", ko: "구운 주먹밥 오차즈케" },
  "おにぎり":           { en: "Rice Ball",                 ne: "भातको डल्लो",              zh: "饭团",         ko: "주먹밥" },
  "焼きおにぎり":       { en: "Grilled Rice Ball",         ne: "पोलेको भातको डल्लो",       zh: "烤饭团",       ko: "구운 주먹밥" },
  "温玉しらす丼":       { en: "Whitebait & Onsen Egg Bowl", ne: "स्यरासु र ओन्सेन अण्डा भात", zh: "温泉蛋白鱼盖饭", ko: "잔멸치 온천란 덮밥" },
  "温玉台湾丼":         { en: "Taiwanese Rice Bowl",       ne: "ताइवानी भात",              zh: "台湾盖饭",     ko: "대만식 덮밥" },
  "台湾まぜそば":       { en: "Taiwanese Mixed Noodles",   ne: "ताइवानी मिसिएको चाउचाउ",  zh: "台湾拌面",     ko: "대만 비빔면" },

  // ドリンク
  "生ビール（中）": { en: "Draft Beer (M)",     ne: "ड्राफ्ट बियर (मध्यम)", zh: "生啤（中）",   ko: "생맥주 (중)" },
  "ハイボール":     { en: "Highball",           ne: "हाइबल",                zh: "威士忌苏打",   ko: "하이볼" },
  "レモンサワー":   { en: "Lemon Sour",         ne: "कागती सावर",          zh: "柠檬酎",      ko: "레몬 사워" },
  "モヒート":       { en: "Mojito",             ne: "मोहितो",              zh: "莫吉托",      ko: "모히토" },
  "カシスオレンジ": { en: "Cassis Orange",      ne: "क्यासिस सुन्तला",     zh: "黑加仑橙汁",  ko: "카시스 오렌지" },
  "芋焼酎（グラス）": { en: "Sweet Potato Shochu (Glass)", ne: "आलुको सोचु (गिलास)", zh: "红薯烧酒（杯）", ko: "고구마 소주 (잔)" },
  "麦焼酎（グラス）": { en: "Barley Shochu (Glass)", ne: "जौको सोचु (गिलास)",   zh: "麦烧酒（杯）",   ko: "보리 소주 (잔)" },
  "米焼酎（グラス）": { en: "Rice Shochu (Glass)",   ne: "चामलको सोचु (गिलास)", zh: "米烧酒（杯）",   ko: "쌀 소주 (잔)" },
  "烏龍茶":         { en: "Oolong Tea",         ne: "उलोङ चिया",           zh: "乌龙茶",     ko: "우롱차" },
  "緑茶":           { en: "Green Tea",          ne: "हरियो चिया",          zh: "绿茶",       ko: "녹차" },
};

// ── 居食屋 笑点（系列店）のメニュー翻訳 ──
// 笑路と同名の商品（ポテト・ねぎま等）は上の既存エントリが自動で使われる
Object.assign(warajiMenuTranslations, {
  // 本日のオススメ
  "コーンクリームコロッケ":       { en: "Corn Cream Croquette",      ne: "कर्न क्रीम क्रोकेट",        zh: "玉米奶油可乐饼", ko: "콘 크림 고로케" },
  "飛騨牛のタタキ":               { en: "Hida Beef Tataki",          ne: "हिदा गाईको तातकी",          zh: "飞驒牛tataki",   ko: "히다규 타타키" },
  "ローストビーフ":               { en: "Roast Beef",                ne: "रोस्ट बिफ",                 zh: "烤牛肉",         ko: "로스트비프" },
  "黒毛和牛センマイ刺":           { en: "Wagyu Tripe Sashimi",       ne: "वागु ट्राइप सासिमी",        zh: "黑毛和牛千层肚", ko: "흑모와규 천엽회" },
  "あん肝":                       { en: "Monkfish Liver",            ne: "मंकफिस कलेजो",              zh: "鮟鱇鱼肝",       ko: "아귀 간" },
  "バイ貝煮付け":                 { en: "Simmered Whelk",            ne: "उमालेको शंखे",              zh: "煮海螺",         ko: "고둥 조림" },
  "生ガキ":                       { en: "Raw Oyster (Iwate)",        ne: "काँचो सिपी",                zh: "生蚝",           ko: "생굴" },
  "カンパチかま塩焼":             { en: "Salt-grilled Amberjack Collar", ne: "नुनमा पोलेको माछा",     zh: "盐烤章红鱼下巴", ko: "소금구이 방어목살" },
  "豚巻きアスパラ":               { en: "Pork-wrapped Asparagus",    ne: "पोर्कमा बेरिएको एस्पारागस", zh: "猪肉卷芦笋",     ko: "돼지고기 아스파라거스말이" },
  "ボイルイカ生わかめ":           { en: "Boiled Squid & Wakame",     ne: "उमालेको स्क्विड र वाकामे", zh: "白灼鱿鱼海带",   ko: "데친 오징어 미역" },
  "穴子の煮付け":                 { en: "Simmered Conger Eel",       ne: "उमालेको ईल",                zh: "煮星鳗",         ko: "붕장어 조림" },
  "もろこし丸":                   { en: "Corn Fritter Ball",         ne: "मकैको बल",                  zh: "玉米丸",         ko: "옥수수 완자" },
  "シーフードグラタン":           { en: "Seafood Gratin",            ne: "सिफुड ग्राटिन",             zh: "海鲜焗烤",       ko: "씨푸드 그라탕" },
  "海ぶどう":                     { en: "Sea Grapes",                ne: "समुद्री अंगूर",             zh: "海葡萄",         ko: "바다포도" },
  "里芋の唐あげ":                 { en: "Fried Taro",                ne: "तारो फ्राइ",                zh: "炸芋头",         ko: "토란 튀김" },
  "トーフステーキ":               { en: "Tofu Steak",                ne: "तोफु स्टेक",                zh: "豆腐排",         ko: "두부 스테이크" },
  "クリームチーズの特製醤油漬け": { en: "Soy-marinated Cream Cheese", ne: "सोयामा क्रीम चीज",         zh: "酱油腌奶油奶酪", ko: "간장절임 크림치즈" },
  "手羽唐":                       { en: "Fried Chicken Wings",       ne: "पखेटा फ्राइ",               zh: "炸鸡翅",         ko: "닭날개 튀김" },
  "焼春巻":                       { en: "Grilled Spring Roll",       ne: "पोलेको स्प्रिङ रोल",        zh: "烤春卷",         ko: "구운 춘권" },
  "棒々鶏":                       { en: "Bang Bang Chicken",         ne: "बाङबाङ चिकन",               zh: "棒棒鸡",         ko: "방방지" },
  "えびチリ":                     { en: "Chili Shrimp",              ne: "चिली झिंगा",                zh: "干烧虾仁",       ko: "칠리새우" },
  "こんにゃくの唐あげ":           { en: "Fried Konjac",              ne: "कोन्याकु फ्राइ",            zh: "炸魔芋",         ko: "곤약 튀김" },
  "厚切りハムカツ":               { en: "Thick-cut Ham Cutlet",      ne: "बाक्लो ह्याम कट्लेट",       zh: "厚切火腿排",     ko: "두꺼운 햄까스" },
  // 刺身・刺盛り
  "刺盛り（1人前 2〜5種）":       { en: "Sashimi Platter (2-5 kinds)", ne: "सासिमी प्लेटर",           zh: "刺身拼盘",       ko: "모듬회" },
  "本マグロ":                     { en: "Bluefin Tuna",              ne: "ब्लुफिन टुना",              zh: "蓝鳍金枪鱼",     ko: "참다랑어" },
  "シマアジ":                     { en: "Striped Jack",              ne: "धारीदार माछा",              zh: "条纹竹荚鱼",     ko: "시마아지" },
  "ヤリイカ":                     { en: "Spear Squid",               ne: "स्क्विड",                   zh: "枪乌贼",         ko: "창오징어" },
  "サーモン":                     { en: "Salmon",                    ne: "सामन",                      zh: "三文鱼",         ko: "연어" },
  "タイ昆布じめ":                 { en: "Kombu-cured Sea Bream",     ne: "कोम्बुमा राखेको माछा",      zh: "昆布腌鲷鱼",     ko: "다시마절임 도미" },
  "タコ":                         { en: "Octopus",                   ne: "अक्टोपस",                   zh: "章鱼",           ko: "문어" },
  // お湯ぽちゃ料理
  "角煮":                         { en: "Braised Pork Belly",        ne: "पोर्क बेली",                zh: "红烧肉",         ko: "삼겹살 조림" },
  "だし巻き玉子":                 { en: "Dashi Rolled Omelet",       ne: "दशी ओम्लेट",                zh: "高汤蛋卷",       ko: "계란말이" },
  "ピリ辛手羽煮":                 { en: "Spicy Simmered Wings",      ne: "पिरो पखेटा",                zh: "微辣炖鸡翅",     ko: "매콤 닭날개조림" },
  "さばみそ":                     { en: "Mackerel in Miso",          ne: "मिसो म्याकरेल",             zh: "味噌青花鱼",     ko: "고등어 미소조림" },
  "どて煮":                       { en: "Nagoya Miso Stew",          ne: "मिसो स्ट्यु",               zh: "味噌炖牛筋",     ko: "도테니" },
  "スタミナサラダ":               { en: "Stamina Salad",             ne: "स्टामिना सलाद",             zh: "活力沙拉",       ko: "스태미나 샐러드" },
  "台湾どーふ":                   { en: "Taiwanese Spicy Tofu",      ne: "ताइवानी तोफु",              zh: "台湾豆腐",       ko: "대만 두부" },
  "じゃがバター":                 { en: "Butter Potato",             ne: "बटर आलु",                   zh: "黄油土豆",       ko: "감자버터" },
  "焼き小なす":                   { en: "Grilled Baby Eggplant",     ne: "पोलेको भन्टा",              zh: "烤小茄子",       ko: "구운 애가지" },
  "塩ソーキ大根煮":               { en: "Salt Soki & Daikon",        ne: "सोकी र मूला",               zh: "盐味软骨炖萝卜", ko: "소키 무 조림" },
  // SPEED・珍味
  "チャンジャ":                   { en: "Changja (spicy cod guts)",  ne: "चाङजा",                     zh: "鳕鱼肠",         ko: "창난젓" },
  "いか塩辛":                     { en: "Salted Squid",              ne: "नुनिलो स्क्विड",            zh: "咸鱿鱼",         ko: "오징어젓" },
  "わさび昆布":                   { en: "Wasabi Kombu",              ne: "वासाबी कोम्बु",             zh: "山葵昆布",       ko: "와사비 다시마" },
  "コブクロ":                     { en: "Pork Offal",                ne: "पोर्क अफल",                 zh: "猪小肚",         ko: "코부쿠로" },
  "梅水晶":                       { en: "Ume Shark Cartilage",       ne: "उमे कार्टिलेज",             zh: "梅水晶",         ko: "우메스이쇼" },
  // 野菜
  "茶豆":                         { en: "Edamame (Chamame)",         ne: "चामामे",                    zh: "茶豆",           ko: "챠마메" },
  "韓国宗家キムチ":               { en: "Jongga Kimchi",             ne: "किम्ची",                    zh: "宗家泡菜",       ko: "종가 김치" },
  "グリーンサラダ":               { en: "Green Salad",               ne: "हरियो सलाद",                zh: "蔬菜沙拉",       ko: "그린 샐러드" },
  "セロリスティック":             { en: "Celery Sticks",             ne: "सेलेरी स्टिक",              zh: "芹菜条",         ko: "셀러리 스틱" },
  "トマトスライス":               { en: "Sliced Tomato",             ne: "टमाटर स्लाइस",              zh: "番茄片",         ko: "토마토 슬라이스" },
  "おかんのQちゃん":              { en: "Mom's Cucumber Pickles",    ne: "काँक्रोको अचार",            zh: "妈妈的腌黄瓜",   ko: "큐짱 절임" },
  "なす揚げびたし":               { en: "Fried Marinated Eggplant",  ne: "भन्टा फ्राइ",               zh: "炸茄子浸汁",     ko: "가지 튀김절임" },
  "新玉オンスラ":                 { en: "New Onion Slices",          ne: "प्याज स्लाइस",              zh: "新洋葱片",       ko: "햇양파 슬라이스" },
  "冷やっこ":                     { en: "Cold Tofu",                 ne: "चिसो तोफु",                 zh: "凉豆腐",         ko: "냉두부" },
  "おかんのらっきょ":             { en: "Pickled Scallion",          ne: "अचारी प्याज",               zh: "腌藠头",         ko: "락교" },
  // 揚物
  "れんこんのはさみあげ":         { en: "Stuffed Lotus Root",        ne: "कमल जरा फ्राइ",             zh: "藕夹",           ko: "연근 튀김" },
  "唐あげ":                       { en: "Fried Chicken (Karaage)",   ne: "करागे",                     zh: "炸鸡",           ko: "가라아게" },
  "うずらフライ":                 { en: "Fried Quail Eggs",          ne: "बट्टाई फ्राइ",              zh: "炸鹌鹑蛋",       ko: "메추리알 튀김" },
  "タコ唐":                       { en: "Fried Octopus",             ne: "अक्टोपस फ्राइ",             zh: "炸章鱼",         ko: "문어 튀김" },
  "みそ串カツ":                   { en: "Miso Kushikatsu",           ne: "मिसो कुशिकात्सु",           zh: "味噌串炸",       ko: "미소 쿠시카츠" },
  // 焼物
  "ポークフランクソーセージ":     { en: "Pork Frankfurter",          ne: "पोर्क ससेज",                zh: "猪肉香肠",       ko: "포크 소시지" },
  "砂肝串":                       { en: "Gizzard Skewer",            ne: "गिजार्ड सिख",               zh: "鸡胗串",         ko: "모래집 꼬치" },
  "ししゃも":                     { en: "Shishamo Smelt",            ne: "सिसामो माछा",               zh: "柳叶鱼",         ko: "시샤모" },
  "いか一夜干し":                 { en: "Overnight-dried Squid",     ne: "सुकाएको स्क्विड",           zh: "一夜干鱿鱼",     ko: "반건조 오징어" },
  "エイヒレ":                     { en: "Grilled Stingray Fin",      ne: "स्टिङरे फिन",               zh: "烤魟鱼鳍",       ko: "가오리 지느러미" },
  "ほっけ焼":                     { en: "Grilled Atka Mackerel",     ne: "पोलेको होक्के माछा",        zh: "烤花鲫鱼",       ko: "임연수 구이" },
  // 〆・ご飯もの
  "五目あんかけ焼そば":           { en: "Gomoku Ankake Yakisoba",    ne: "गोमोकु याकिसोबा",           zh: "五目烩炒面",     ko: "고모쿠 안카케 야키소바" },
  "おにぎり（梅・鮭）":           { en: "Rice Ball (Ume/Salmon)",    ne: "भातको डल्लो",               zh: "饭团(梅/鲑鱼)",  ko: "주먹밥(우메/연어)" },
  "だし茶漬け（梅・鮭）":         { en: "Dashi Chazuke (Ume/Salmon)", ne: "दशी चाज़ुके",              zh: "高汤茶泡饭",     ko: "다시 오차즈케" },
  "チャーハン":                   { en: "Fried Rice",                ne: "फ्राइड राइस",               zh: "炒饭",           ko: "볶음밥" },
  "温玉肉丼":                     { en: "Meat Bowl w/ Soft Egg",     ne: "मासु भात र अण्डा",          zh: "温泉蛋肉盖饭",   ko: "고기 온천란 덮밥" },
  "台湾ラーメン":                 { en: "Taiwan Ramen",              ne: "ताइवान रामेन",              zh: "台湾拉面",       ko: "대만 라멘" },
  "ライス":                       { en: "Rice",                      ne: "भात",                       zh: "米饭",           ko: "공기밥" },
  "ギョーザ":                     { en: "Gyoza (5pcs, homemade)",    ne: "ग्योजा",                    zh: "自制饺子",       ko: "교자" },
  // 日本酒
  "くどき上手（純米吟醸 300ml）": { en: "Kudoki Jozu (Junmai Ginjo)", ne: "कुदोकी जोजु सेक",          zh: "口说上手 纯米吟酿", ko: "쿠도키죠즈" },
  "出羽桜（桜花吟醸 300ml）":     { en: "Dewazakura (Oka Ginjo)",    ne: "देवाजाकुरा सेक",            zh: "出羽樱 樱花吟酿", ko: "데와자쿠라" },
  "陸奥男山（超辛口純米 300ml）": { en: "Mutsu Otokoyama (Dry)",     ne: "मुत्सु ओतोकोयामा सेक",      zh: "陆奥男山 超辛口", ko: "무츠오토코야마" },
  "考の司（純米吟醸 300ml）":     { en: "Ko no Tsukasa (Junmai Ginjo)", ne: "कोनोत्सुकासा सेक",       zh: "考之司 纯米吟酿", ko: "코노츠카사" },
});

export function warajiCatName(name: string, lang: Lang): string {
  if (lang === "ja") return name;
  return warajiCategoryTranslations[name]?.[lang] ?? name;
}

export function warajiItemName(name: string, lang: Lang): string {
  if (lang === "ja") return name;
  return warajiMenuTranslations[name]?.[lang] ?? name;
}
