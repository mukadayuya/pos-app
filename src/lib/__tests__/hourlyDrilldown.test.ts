import { describe, it, expect } from "vitest";
import { drilldownHour } from "../hourlyAnalysis";
import type { SaleDetailRow } from "@/lib/db";

// タイムゾーン安全なヘルパー: new Date(y,m,d,h) は「ローカル時刻」で作成され
// .toISOString() → getHours() の往復で同一時刻が返る
const makeOrder = (
  localHour: number,
  items: SaleDetailRow["items"],
  id = "ord",
): SaleDetailRow => {
  const d = new Date(2026, 4, 1, localHour, 15, 0); // May 1 2026, local time
  const total = (items ?? []).reduce((s, i) => {
    const tax = isFinite(Number(i.tax_rate)) ? Number(i.tax_rate) : 0.1;
    return s + Math.round(Number(i.unit_price) * (1 + tax) * Number(i.quantity));
  }, 0);
  return { id, created_at: d.toISOString(), total_amount: total, items };
};

// ── テストデータ ─────────────────────────────────────────────────
const lunchOrders: SaleDetailRow[] = [
  // 12時台 — 2会計
  makeOrder(12, [
    { name: "チキンカツ",         emoji: "🍗", quantity: 2, unit_price: 1045, tax_rate: 0.10 },
    { name: "ゴーヤーチャンプルー", emoji: "🥬", quantity: 1, unit_price: 1045, tax_rate: 0.10 },
  ], "ord-12-1"),
  makeOrder(12, [
    { name: "チキンカツ",             emoji: "🍗", quantity: 1, unit_price: 1045, tax_rate: 0.10 },
    { name: "シーフードミックスフライ", emoji: "🦐", quantity: 2, unit_price: 1045, tax_rate: 0.10 },
  ], "ord-12-2"),
  // 13時台 — 1会計
  makeOrder(13, [
    { name: "豚肉となすのこうじ味噌焼き丼", emoji: "🍚", quantity: 3, unit_price: 845, tax_rate: 0.10 },
  ], "ord-13-1"),
];

const dinnerOrders: SaleDetailRow[] = [
  makeOrder(18, [
    { name: "照焼チキンとアボカドのサラダ丼", emoji: "🥑", quantity: 2, unit_price: 1045, tax_rate: 0.10 },
    { name: "豚ホルモンと五目野菜のしょうが炒め", emoji: "🥩", quantity: 1, unit_price: 1045, tax_rate: 0.10 },
  ], "ord-18-1"),
];

const allOrders = [...lunchOrders, ...dinnerOrders];

// ── 基本：時間帯フィルタリング ────────────────────────────────────

it("指定した時間帯の注文のみ集計される", () => {
  const result = drilldownHour(allOrders, 12);
  const names  = result.map(r => r.name);
  expect(names).not.toContain("豚肉となすのこうじ味噌焼き丼"); // 13時
  expect(names).not.toContain("照焼チキンとアボカドのサラダ丼"); // 18時
});

it("該当時間帯に売上がなければ空配列を返す", () => {
  expect(drilldownHour(allOrders, 3)).toHaveLength(0);
  expect(drilldownHour(allOrders, 0)).toHaveLength(0);
});

it("空注文リストを渡すと空配列を返す", () => {
  expect(drilldownHour([], 12)).toHaveLength(0);
});

// ── 商品の集計 ────────────────────────────────────────────────────

it("同じ商品が複数会計にまたがる場合は合算される（チキンカツ: 2+1=3）", () => {
  const result = drilldownHour(allOrders, 12);
  const chicken = result.find(r => r.name === "チキンカツ")!;
  expect(chicken).toBeDefined();
  expect(chicken.quantity).toBe(3); // ord-12-1(×2) + ord-12-2(×1)
});

it("集計後の tax-inclusive 合計が正確（チキンカツ 3個 × 1045 × 1.1）", () => {
  const result  = drilldownHour(allOrders, 12);
  const chicken = result.find(r => r.name === "チキンカツ")!;
  const expected = Math.round(1045 * 1.10 * 3);
  expect(chicken.total).toBe(expected);
});

it("異なる商品は個別の行になる（12時台: チキンカツ・ゴーヤー・シーフード）", () => {
  const result = drilldownHour(allOrders, 12);
  expect(result).toHaveLength(3);
});

// ── ソート ──────────────────────────────────────────────────────

it("合計売上の高い順（降順）にソートされる", () => {
  const result = drilldownHour(allOrders, 12);
  for (let i = 1; i < result.length; i++) {
    expect(result[i - 1].total).toBeGreaterThanOrEqual(result[i].total);
  }
});

// ── 税率の整合性（8% vs 10%）────────────────────────────────────

describe("テイクアウト(8%)と店内(10%)の税率が正しく計算される", () => {
  const mixedOrders: SaleDetailRow[] = [
    makeOrder(11, [
      { name: "弁当A", emoji: "🥡", quantity: 2, unit_price: 800, tax_rate: 0.08 },
      { name: "定食A", emoji: "🍽️", quantity: 1, unit_price: 900, tax_rate: 0.10 },
    ], "ord-mix"),
  ];

  const result = drilldownHour(mixedOrders, 11);

  it("弁当A(8%) の税込合計が正確", () => {
    const item = result.find(r => r.name === "弁当A")!;
    expect(item.total).toBe(Math.round(800 * 1.08 * 2));
  });

  it("定食A(10%) の税込合計が正確", () => {
    const item = result.find(r => r.name === "定食A")!;
    expect(item.total).toBe(Math.round(900 * 1.10 * 1));
  });

  it("テイクアウトと店内が別の行として存在する", () => {
    expect(result).toHaveLength(2);
  });
});

// ── 欠損データの耐性 ────────────────────────────────────────────

it("tax_rate が undefined でも 10% として計算される", () => {
  const orders: SaleDetailRow[] = [
    makeOrder(9, [{ name: "商品X", emoji: "🍱", quantity: 1, unit_price: 1000 }], "ord-notax"),
  ];
  const result = drilldownHour(orders, 9);
  expect(result[0].total).toBe(Math.round(1000 * 1.10));
});

it("emoji が空文字・undefined の場合でも 🍽️ にフォールバックする", () => {
  const orders: SaleDetailRow[] = [
    makeOrder(10, [{ name: "商品Y", emoji: "", quantity: 1, unit_price: 500, tax_rate: 0.10 }], "ord-noemoji"),
  ];
  const result = drilldownHour(orders, 10);
  expect(result[0].emoji).toBe("🍽️");
});

// ── emoji・name が正しく引き継がれる ────────────────────────────

it("emoji が正しく引き継がれる（🦐）", () => {
  const result = drilldownHour(allOrders, 12);
  const seafood = result.find(r => r.name === "シーフードミックスフライ")!;
  expect(seafood.emoji).toBe("🦐");
});
