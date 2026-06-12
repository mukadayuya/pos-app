import { MenuItem, MenuItemOptions, OptionGroup } from "@/types/pos";
import type { CategoryRecord } from "@/lib/db";

export const menuItems: MenuItem[] = [
  // 昼部
  { id: "l1", name: "トンヒレカツと飛騨牛コロッケの合盛り", name_en: "Pork Fillet Katsu & Hida Beef Croquette", name_zh: "猪腰肉炸猪排与飞驒牛可乐饼拼盘", name_ko: "돈 히레카츠와 히다규 고로케 모둠", price: 930,  category: "lunch",  emoji: "🍱", taxRate: 0.10, imageUrl: "/images/l1.jpg" },
  { id: "l2", name: "ハマチの酢豚風",                       name_en: "Hamachi in Sweet & Sour Style",          name_zh: "琥珀鱼甜酸风味",                   name_ko: "방어 탕수육풍",                     price: 930,  category: "lunch",  emoji: "🐟", taxRate: 0.10, imageUrl: "/images/l2.jpg" },
  { id: "l3", name: "豚肉となすのこうじ味噌焼き丼",          name_en: "Pork & Eggplant Koji Miso Grill Bowl",  name_zh: "猪肉茄子米曲味噌烧丼饭",           name_ko: "돼지고기 가지 누룩 된장구이 덮밥",  price: 930,  category: "lunch",  emoji: "🍚", taxRate: 0.10, imageUrl: "/images/l3.jpg" },
  // ドリンク
  { id: "dr1", name: "サッポロ中瓶ビール",         name_en: "Sapporo Beer (Medium Bottle)", name_zh: "札幌中瓶啤酒",       name_ko: "삿포로 중병 맥주",      price: 600, category: "drink", emoji: "🍺", taxRate: 0.10 },
  { id: "dr2", name: "テーブルワイン デキャンタ",  name_en: "Table Wine (Decanter)",        name_zh: "桌酒（瓶装）",       name_ko: "테이블 와인 (디캔터)",  price: 600, category: "drink", emoji: "🍷", taxRate: 0.10 },
  { id: "dr3", name: "テーブルワイン グラス",      name_en: "Table Wine (Glass) Red/White", name_zh: "桌酒（杯）红/白",    name_ko: "테이블 와인 (잔)",      price: 250, category: "drink", emoji: "🥂", taxRate: 0.10 },
  { id: "dr4", name: "ノンアルコールビール",        name_en: "Non-Alcoholic Beer",           name_zh: "无酒精啤酒",         name_ko: "논알코올 맥주",         price: 330, category: "drink", emoji: "🍻", taxRate: 0.10 },
  { id: "dr5", name: "ソフトドリンク各種",          name_en: "Soft Drinks",                  name_zh: "软饮料（多种）",      name_ko: "소프트 드링크",         price: 250, category: "drink", emoji: "🥤", taxRate: 0.10 },
  // 夜部
  { id: "d1", name: "チキンカツ",                           name_en: "Chicken Katsu",                         name_zh: "炸鸡排",                            name_ko: "치킨카츠",                          price: 1150, category: "dinner", emoji: "🍗", taxRate: 0.10, imageUrl: "/images/d1.jpg" },
  { id: "d2", name: "シーフードミックスフライ",              name_en: "Seafood Mixed Fry",                     name_zh: "海鲜什锦炸拼",                      name_ko: "시푸드 믹스 프라이",                price: 1150, category: "dinner", emoji: "🦐", taxRate: 0.10, imageUrl: "/images/d2.jpg" },
  { id: "d3", name: "ゴーヤーチャンプルー",                 name_en: "Goya Champuru",                         name_zh: "苦瓜炒豆腐",                        name_ko: "고야 찬푸루",                       price: 1150, category: "dinner", emoji: "🥬", taxRate: 0.10, imageUrl: "/images/d3.jpg" },
  { id: "d4", name: "豚ホルモンと五目野菜のしょうが炒め",    name_en: "Pork Horumon & Veggie Ginger Stir-fry", name_zh: "猪杂与五目蔬菜生姜炒",              name_ko: "돼지 호르몬 야채 생강 볶음",        price: 1150, category: "dinner", emoji: "🥩", taxRate: 0.10, imageUrl: "/images/d4.jpg" },
  { id: "d5", name: "照焼チキンとアボカドのサラダ丼",        name_en: "Teriyaki Chicken & Avocado Salad Bowl", name_zh: "照烧鸡肉牛油果沙拉丼饭",            name_ko: "데리야키 치킨 아보카도 샐러드 덮밥", price: 1150, category: "dinner", emoji: "🥑", taxRate: 0.10, imageUrl: "/images/d5.jpg" },
];

export const TAX_RATE = 0.1;

export const categoryLabels: Record<string, string> = {
  lunch:   "昼部",
  dinner:  "夜部",
  takeout: "テイクアウト",
};

// Legacy labels — still used for backwards-compatible display of old in-session items
export const riceTypeLabels: Record<string, string> = {
  white: "白米",
  mochi: "十五穀米",
};

export const riceSizeLabels: Record<string, string> = {
  none:    "ご飯なし",
  small:   "小ライス",
  regular: "普通",
  large:   "大盛",
  extra:   "特盛",
};

// Legacy adjustments — used as fallback when item.options is undefined
export const riceSizeAdjustments: Record<string, number> = {
  none:    0,
  small:   -20,
  regular: 0,
  large:   0,
  extra:   80,
};

// Default option groups for rice dishes (used when item.options is undefined)
export const DEFAULT_RICE_OPTION_GROUPS: OptionGroup[] = [
  {
    id: "rice-size",
    name: "ご飯の量",
    items: [
      { id: "none",    name: "ご飯なし", price: 0 },
      { id: "small",   name: "小ライス", price: -20 },
      { id: "regular", name: "普通",     price: 0 },
      { id: "large",   name: "大盛",     price: 0 },
      { id: "extra",   name: "特盛",     price: 80 },
    ],
  },
  {
    id: "rice-type",
    name: "ご飯の種類",
    items: [
      { id: "white", name: "白米",     price: 0 },
      { id: "mochi", name: "十五穀米", price: 0 },
    ],
  },
];

export const DEFAULT_MENU_OPTIONS: MenuItemOptions = {
  optionGroups: DEFAULT_RICE_OPTION_GROUPS,
};

export const staticCategories: CategoryRecord[] = [
  { id: "lunch",  name: "昼部",       name_en: "Lunch",   name_zh: "午餐", name_ko: "런치",    display_order: 1 },
  { id: "dinner", name: "夜部",       name_en: "Dinner",  name_zh: "晚餐", name_ko: "디너",   display_order: 2 },
  { id: "drink",  name: "ドリンク",   name_en: "Drinks",  name_zh: "饮品", name_ko: "드링크", display_order: 3 },
];
