import { describe, it, expect } from "vitest";
import { computeItemDiscountAmount, computeTaxTotals, computeDiscountAmount } from "../utils";
import { OrderItem, MenuItem } from "@/types/pos";

const menuItem: MenuItem = {
  id: "m1", name: "テスト商品", price: 1000, category: "c1", emoji: "🍢", taxRate: 0.10,
};

function item(over: Partial<OrderItem>): OrderItem {
  return {
    itemKey: "k", menuItem, quantity: 1,
    options: { riceType: "white", riceSize: "regular", selections: [] },
    unitPrice: 1000, taxRate: 0.10,
    ...over,
  };
}

describe("computeItemDiscountAmount", () => {
  it("税抜パーセント割引", () => {
    expect(computeItemDiscountAmount({ type: "percent", value: 10, inclusive: false }, 1000)).toBe(100);
  });
  it("税込パーセント割引は税抜換算される", () => {
    // 税込1100の10% = 110 → 税抜換算 110/1.1 = 100
    expect(computeItemDiscountAmount({ type: "percent", value: 10, inclusive: true }, 1000, 0.10)).toBe(100);
  });
  it("100%超は100%に丸める", () => {
    expect(computeItemDiscountAmount({ type: "percent", value: 150, inclusive: false }, 1000)).toBe(1000);
  });
  it("固定額は商品額を超えない", () => {
    expect(computeItemDiscountAmount({ type: "fixed", value: 5000, inclusive: false }, 1000)).toBe(1000);
  });
  it("0円・マイナス割引は0", () => {
    expect(computeItemDiscountAmount({ type: "fixed", value: 0, inclusive: false }, 1000)).toBe(0);
    expect(computeItemDiscountAmount({ type: "percent", value: -5, inclusive: false }, 1000)).toBe(0);
  });
});

describe("computeTaxTotals", () => {
  it("10%・8%を分けて集計する", () => {
    const totals = computeTaxTotals([
      item({ unitPrice: 1000, quantity: 2, taxRate: 0.10 }), // 2000 → tax 200
      item({ itemKey: "k2", unitPrice: 500, quantity: 1, taxRate: 0.08 }), // 500 → tax 40
    ]);
    expect(totals.subtotal).toBe(2500);
    expect(totals.tax10).toBe(200);
    expect(totals.tax8).toBe(40);
    expect(totals.totalTax).toBe(240);
    expect(totals.baseTotal).toBe(2740);
  });

  it("商品割引は税計算前に差し引かれる", () => {
    const totals = computeTaxTotals([
      item({ unitPrice: 1000, quantity: 1, itemDiscount: { type: "percent", value: 10, inclusive: false } }),
    ]);
    expect(totals.itemDiscountTotal).toBe(100);
    expect(totals.tax10).toBe(90); // (1000-100) × 10%
    expect(totals.baseTotal).toBe(990);
  });

  it("端数は切り捨て", () => {
    const totals = computeTaxTotals([item({ unitPrice: 333, quantity: 1, taxRate: 0.10 })]);
    expect(totals.tax10).toBe(33); // floor(33.3)
    expect(totals.baseTotal).toBe(366);
  });

  it("空注文はすべて0", () => {
    const totals = computeTaxTotals([]);
    expect(totals.subtotal).toBe(0);
    expect(totals.totalTax).toBe(0);
    expect(totals.baseTotal).toBe(0);
  });
});

describe("computeDiscountAmount（注文全体割引）", () => {
  it("パーセントは税込合計に対して計算", () => {
    expect(computeDiscountAmount({ type: "percent", value: 10, inclusive: false }, 1000, 1100)).toBe(110);
  });
  it("税込固定額はそのまま（上限は合計）", () => {
    expect(computeDiscountAmount({ type: "fixed", value: 500, inclusive: true }, 1000, 1100)).toBe(500);
    expect(computeDiscountAmount({ type: "fixed", value: 9999, inclusive: true }, 1000, 1100)).toBe(1100);
  });
  it("税抜固定額は税率分を上乗せして換算", () => {
    // factor = 1100/1000 = 1.1 → 500 × 1.1 = 550
    expect(computeDiscountAmount({ type: "fixed", value: 500, inclusive: false }, 1000, 1100)).toBe(550);
  });
});
