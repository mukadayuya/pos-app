import type { MenuItem } from "@/types/pos";
import type { CategoryRecord } from "@/lib/db";

export const broncoCategories: CategoryRecord[] = [
  { id: "steak",     name: "ステーキ",   display_order: 1 },
  { id: "hamburger", name: "ハンバーグ", display_order: 2 },
  { id: "mexican",   name: "メキシカン", display_order: 3 },
  { id: "salad",     name: "サラダ",     display_order: 4 },
  { id: "soup",      name: "スープ",     display_order: 5 },
  { id: "set",       name: "セット",     display_order: 6 },
  { id: "kids",      name: "キッズ",     display_order: 7 },
  { id: "dessert",   name: "デザート",   display_order: 8 },
];

const TAX = 0.10 as const;

export const broncoMenuItems: MenuItem[] = [
  // ─── ステーキ ────────────────────────────────────────────────
  {
    id: "br-st1", name: "リブロース ステーキ 450g",
    description: "ライス150gまたはパン・トルティーヤ6枚付き",
    price: 3960, category: "steak", emoji: "🥩", taxRate: TAX,
  },
  {
    id: "br-st2", name: "リブロース ステーキ 300g",
    description: "ライス150gまたはパン・トルティーヤ6枚付き",
    price: 2800, category: "steak", emoji: "🥩", taxRate: TAX,
  },
  {
    id: "br-st3", name: "リブロース ステーキ 220g",
    description: "ライス150gまたはパン・トルティーヤ6枚付き",
    price: 2100, category: "steak", emoji: "🥩", taxRate: TAX,
  },
  {
    id: "br-st4", name: "ハラミ ステーキ 200g",
    description: "ライス150gまたはパン・トルティーヤ4in6枚付き",
    price: 1100, category: "steak", emoji: "🥩", taxRate: TAX,
  },
  {
    id: "br-st5", name: "チキン ステーキ",
    description: "ライス150gまたはパン・トルティーヤ4in6枚付き",
    price: 990, category: "steak", emoji: "🍗", taxRate: TAX,
  },

  // ─── ハンバーグ ──────────────────────────────────────────────
  {
    id: "br-hb1", name: "ハンバーグ 400g",
    description: "デミグラスソース付き",
    price: 1540, category: "hamburger", emoji: "🍔", taxRate: TAX,
  },
  {
    id: "br-hb2", name: "ハンバーグ 300g",
    description: "デミグラスソース付き",
    price: 1220, category: "hamburger", emoji: "🍔", taxRate: TAX,
  },
  {
    id: "br-hb3", name: "ハンバーグ 200g",
    description: "デミグラスソース付き",
    price: 810, category: "hamburger", emoji: "🍔", taxRate: TAX,
  },
  {
    id: "br-hb4", name: "ハンバーグ 400g チーズ",
    description: "デミグラスソース＋チーズトッピング",
    price: 1740, category: "hamburger", emoji: "🧀", taxRate: TAX,
  },
  {
    id: "br-hb5", name: "ハンバーグ 300g チーズ",
    description: "デミグラスソース＋チーズトッピング",
    price: 1390, category: "hamburger", emoji: "🧀", taxRate: TAX,
  },
  {
    id: "br-hb6", name: "ハンバーグ 200g チーズ",
    description: "デミグラスソース＋チーズトッピング",
    price: 940, category: "hamburger", emoji: "🧀", taxRate: TAX,
  },

  // ─── メキシカン ──────────────────────────────────────────────
  {
    id: "br-mx1", name: "トルティーヤ チップ",
    price: 440, category: "mexican", emoji: "🌽", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-mx2", name: "ナチョス",
    description: "トルティーヤチップとチーズ",
    price: 750, category: "mexican", emoji: "🧀", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-mx3", name: "タコス",
    description: "野菜たっぷり",
    price: 750, category: "mexican", emoji: "🌮", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-mx4", name: "タコス 追加1個",
    price: 350, category: "mexican", emoji: "🌮", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-mx5", name: "ブリト",
    description: "煮込んだ牛肉をフラワートルティーヤで包んだもの",
    price: 770, category: "mexican", emoji: "🌯", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-mx6", name: "メキシカン フォンデュ",
    description: "チーズフォンデュをコーントルティーヤで",
    price: 750, category: "mexican", emoji: "🫕", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-mx7", name: "エンチラダス",
    description: "牛挽肉とチーズをコーントルティーヤで巻いたもの",
    price: 750, category: "mexican", emoji: "🌯", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-mx8", name: "チリビーンズ",
    description: "牛挽肉と豆の煮込み",
    price: 750, category: "mexican", emoji: "🫘", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-mx9", name: "メキシカンピラフ",
    description: "辛いピラフ",
    price: 750, category: "mexican", emoji: "🍚", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-mx10", name: "チョリソ",
    description: "50年変わらぬ元祖の味",
    price: 750, category: "mexican", emoji: "🌭", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-mx11", name: "スペアリブス B.B.Q",
    description: "骨付き豚ばら肉バーベキュー味",
    price: 1200, category: "mexican", emoji: "🍖", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-mx12", name: "セシナ",
    description: "香辛料に漬け込んだ牛肉を焼いたもの",
    price: 750, category: "mexican", emoji: "🥩", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-mx13", name: "コーン バター",
    description: "バターで炒めたとうもろこし",
    price: 600, category: "mexican", emoji: "🌽", taxRate: TAX, options: { optionGroups: [] },
  },

  // ─── サラダ ──────────────────────────────────────────────────
  {
    id: "br-sa1", name: "メキシカン サラダ L",
    description: "コーン・トマト・きゅうり・オニオン・レーズン・自家製ドレッシング",
    price: 550, category: "salad", emoji: "🥗", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-sa2", name: "メキシカン サラダ M",
    description: "コーン・トマト・きゅうり・オニオン・レーズン・自家製ドレッシング",
    price: 440, category: "salad", emoji: "🥗", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-sa3", name: "メキシカン サラダ S",
    description: "コーン・トマト・きゅうり・オニオン・レーズン・自家製ドレッシング",
    price: 220, category: "salad", emoji: "🥗", taxRate: TAX, options: { optionGroups: [] },
  },

  // ─── スープ ──────────────────────────────────────────────────
  {
    id: "br-sp1", name: "クラブ スープ",
    description: "カニのほぐし身入り・辛いスープ",
    price: 880, category: "soup", emoji: "🦀", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-sp2", name: "メキシカンスープ",
    description: "ピリ辛でさっぱりした味わい",
    price: 550, category: "soup", emoji: "🍲", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-sp3", name: "コーンスープ",
    description: "つぶつぶとうもろこしのクリーミーなスープ",
    price: 660, category: "soup", emoji: "🌽", taxRate: TAX, options: { optionGroups: [] },
  },

  // ─── セット ──────────────────────────────────────────────────
  {
    id: "br-se1", name: "スモールサラダ＋ドリンクセット",
    description: "コーヒー（HOT・アイス）・OJ・GFJ・アイスウーロン茶・ジンジャーエール",
    price: 280, category: "set", emoji: "☕", taxRate: TAX, options: { optionGroups: [] },
  },

  // ─── キッズ ──────────────────────────────────────────────────
  {
    id: "br-ki1", name: "キッズ プレート",
    description: "サラダ・ごはん・ハンバーグ100g・ふりかけ・ゼリー付き（8歳まで）",
    price: 660, category: "kids", emoji: "👧", taxRate: TAX, options: { optionGroups: [] },
  },

  // ─── デザート ────────────────────────────────────────────────
  {
    id: "br-ds1", name: "バニラアイス small",
    description: "チョコレートソースとシリアル付き",
    price: 200, category: "dessert", emoji: "🍦", taxRate: TAX, options: { optionGroups: [] },
  },
  {
    id: "br-ds2", name: "バニラアイス large",
    description: "チョコレートソースとシリアル付き",
    price: 400, category: "dessert", emoji: "🍦", taxRate: TAX, options: { optionGroups: [] },
  },
];
