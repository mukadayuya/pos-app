import { MenuItem } from "@/types/pos";

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

export const riceTypeLabels: Record<string, string> = {
  white: "白米",
  mochi: "もち麦",
};

export const riceSizeLabels: Record<string, string> = {
  small:   "小ライス",
  regular: "普通",
  large:   "大盛",
  extra:   "特盛",
};

export const riceSizeAdjustments: Record<string, number> = {
  small:   -20,
  regular: 0,
  large:   0,
  extra:   80,
};
