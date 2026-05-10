import { MenuItem, MenuItemOptions, OptionGroup } from "@/types/pos";

export const menuItems: MenuItem[] = [
  // 昼部
  { id: "l1", name: "トンヒレカツと飛騨牛コロッケの合盛り", price: 930,  category: "lunch",  emoji: "🍱", taxRate: 0.10 },
  { id: "l2", name: "ハマチの酢豚風",                       price: 930,  category: "lunch",  emoji: "🐟", taxRate: 0.10 },
  { id: "l3", name: "豚肉となすのこうじ味噌焼き丼",          price: 930,  category: "lunch",  emoji: "🍚", taxRate: 0.10 },
  // 夜部
  { id: "d1", name: "チキンカツ",                           price: 1150, category: "dinner", emoji: "🍗", taxRate: 0.10 },
  { id: "d2", name: "シーフードミックスフライ",              price: 1150, category: "dinner", emoji: "🦐", taxRate: 0.10 },
  { id: "d3", name: "ゴーヤーチャンプルー",                 price: 1150, category: "dinner", emoji: "🥬", taxRate: 0.10 },
  { id: "d4", name: "豚ホルモンと五目野菜のしょうが炒め",    price: 1150, category: "dinner", emoji: "🥩", taxRate: 0.10 },
  { id: "d5", name: "照焼チキンとアボカドのサラダ丼",        price: 1150, category: "dinner", emoji: "🥑", taxRate: 0.10 },
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
