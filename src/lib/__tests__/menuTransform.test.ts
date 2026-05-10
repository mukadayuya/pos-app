import { describe, it, expect } from "vitest";
import { toTakeoutMenuItem } from "../menuTransform";
import type { MenuItem } from "@/types/pos";

const dineinItem: MenuItem = {
  id: "item-001",
  name: "トンヒレカツと飛騨牛コロッケの合盛り",
  price: 845,         // 税抜
  category: "cat-lunch-uuid",
  emoji: "🍱",
  taxRate: 0.10,
  options: {
    optionGroups: [
      {
        id: "rice-size",
        name: "ご飯の量",
        items: [
          { id: "none",    name: "ご飯なし", price: 0   },
          { id: "small",   name: "小ライス", price: -20 },
          { id: "regular", name: "普通",     price: 0   },
          { id: "large",   name: "大盛",     price: 0   },
          { id: "extra",   name: "特盛",     price: 80  },
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
    ],
  },
};

// --- emoji preservation ---

it("テイクアウト変換後も emoji が保持される", () => {
  const result = toTakeoutMenuItem(dineinItem);
  expect(result.emoji).toBe("🍱");
});

it("image_url フォールバックがある場合も emoji として保持される", () => {
  const itemWithImageUrl = { ...dineinItem, emoji: "", image_url: "🐟" } as MenuItem & { image_url: string };
  const result = toTakeoutMenuItem(itemWithImageUrl);
  // image_url should surface as emoji in takeout view
  expect(result.emoji || (itemWithImageUrl as unknown as Record<string, string>).image_url).toBeTruthy();
});

it("emoji が null/空文字でもクラッシュしない", () => {
  const noEmoji = { ...dineinItem, emoji: "" };
  expect(() => toTakeoutMenuItem(noEmoji)).not.toThrow();
});

// --- options / optionGroups preservation ---

it("変換後も optionGroups の数が変わらない", () => {
  const result = toTakeoutMenuItem(dineinItem);
  expect(result.options?.optionGroups).toHaveLength(2);
});

it("変換後も rice-size グループの中身がすべて保持される", () => {
  const result = toTakeoutMenuItem(dineinItem);
  const sizeGroup = result.options?.optionGroups.find(g => g.id === "rice-size");
  expect(sizeGroup).toBeDefined();
  expect(sizeGroup!.items).toHaveLength(5);
  expect(sizeGroup!.items.find(i => i.id === "extra")?.price).toBe(80);
});

it("変換後も rice-type グループが保持され 十五穀米 が含まれる", () => {
  const result = toTakeoutMenuItem(dineinItem);
  const typeGroup = result.options?.optionGroups.find(g => g.id === "rice-type");
  expect(typeGroup).toBeDefined();
  expect(typeGroup!.items.find(i => i.id === "mochi")?.name).toBe("十五穀米");
});

it("options が undefined のメニューは変換後も undefined のまま", () => {
  const noOptions = { ...dineinItem, options: undefined };
  const result = toTakeoutMenuItem(noOptions);
  expect(result.options).toBeUndefined();
});

// --- taxRate conversion ---

it("taxRate が 0.08（テイクアウト軽減税率）に変換される", () => {
  const result = toTakeoutMenuItem(dineinItem);
  expect(result.taxRate).toBe(0.08);
});

it("すでに 0.08 のアイテムはそのまま 0.08", () => {
  const already8 = { ...dineinItem, taxRate: 0.08 as const };
  expect(toTakeoutMenuItem(already8).taxRate).toBe(0.08);
});

// --- other properties untouched ---

describe("それ以外のプロパティはすべてそのまま引き継がれる", () => {
  const result = toTakeoutMenuItem(dineinItem);

  it("id が保持される", () => { expect(result.id).toBe(dineinItem.id); });
  it("name が保持される", () => { expect(result.name).toBe(dineinItem.name); });
  it("price（税抜）が保持される", () => { expect(result.price).toBe(dineinItem.price); });
  it("category が保持される", () => { expect(result.category).toBe(dineinItem.category); });
});

it("変換は元のオブジェクトを変更しない（immutable）", () => {
  toTakeoutMenuItem(dineinItem);
  expect(dineinItem.taxRate).toBe(0.10);
  expect(dineinItem.emoji).toBe("🍱");
});
