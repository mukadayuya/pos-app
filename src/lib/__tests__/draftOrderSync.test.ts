import { describe, it, expect } from "vitest";
import { buildDraft, isValidDraft } from "../draftOrderSync";
import { OrderItem, MenuItem } from "@/types/pos";

const menuItem: MenuItem = {
  id: "m1", name: "ねぎま", price: 200, category: "yakitori", emoji: "🍢", taxRate: 0.10,
};

const orderItem: OrderItem = {
  itemKey: "k1", menuItem, quantity: 1,
  options: { riceType: "white", riceSize: "regular", selections: [] },
  unitPrice: 200, taxRate: 0.10,
};

describe("buildDraft", () => {
  it("注文状態とタイムスタンプを保持する", () => {
    const draft = buildDraft([orderItem], 2, 1, { type: "percent", value: 10, inclusive: false });
    expect(draft.items).toHaveLength(1);
    expect(draft.maleCount).toBe(2);
    expect(draft.femaleCount).toBe(1);
    expect(draft.discount?.value).toBe(10);
    expect(Number.isNaN(Date.parse(draft.updatedAt))).toBe(false);
  });
});

describe("isValidDraft", () => {
  it("正常なドラフトを受理する", () => {
    expect(isValidDraft(buildDraft([orderItem], 0, 0, null))).toBe(true);
  });
  it("null・壊れた値・itemsなしを拒否する", () => {
    expect(isValidDraft(null)).toBe(false);
    expect(isValidDraft("string")).toBe(false);
    expect(isValidDraft({})).toBe(false);
    expect(isValidDraft({ items: "not-array", updatedAt: "2026-06-13" })).toBe(false);
    expect(isValidDraft({ items: [], maleCount: 0 })).toBe(false); // updatedAt なし
  });
});
