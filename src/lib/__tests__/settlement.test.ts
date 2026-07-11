import { describe, it, expect, vi, beforeEach } from "vitest";

// db.ts の STORE_ID とSupabaseクライアントをモックする
vi.mock("@/lib/supabase", () => {
  const rows: Record<string, unknown>[] = [];
  return {
    supabase: {
      from: (_table: string) => ({
        select: (_cols?: string) => ({
          eq: () => ({
            gte: () => ({
              lt: async () => ({ data: rows, error: null }),
            }),
          }),
        }),
      }),
      __setRows: (r: Record<string, unknown>[]) => { rows.splice(0, rows.length, ...r); },
    },
  };
});
vi.mock("@/lib/db", () => ({ STORE_ID: "test-store" }));

import { supabase } from "@/lib/supabase";
import { fetchDailySettlement, todayJstRange } from "@/lib/settlement";

const __set = (rows: Record<string, unknown>[]) =>
  (supabase as unknown as { __setRows: (r: Record<string, unknown>[]) => void }).__setRows(rows);

const FROM = new Date("2026-07-13T00:00:00+09:00");
const TO   = new Date("2026-07-14T00:00:00+09:00");

beforeEach(() => __set([]));

describe("fetchDailySettlement", () => {
  it("空の期間は全ゼロ", async () => {
    const s = await fetchDailySettlement(FROM, TO);
    expect(s.totalTaxIncl).toBe(0);
    expect(s.count).toBe(0);
    expect(s.byPayment.cash.total).toBe(0);
    expect(s.byHour).toHaveLength(24);
    expect(s.byHour.every(h => h.count === 0)).toBe(true);
  });

  it("複数レコードを集計する", async () => {
    __set([
      { total_amount: 1000, tax8: 0,  tax10: 91, tax: 91,  payment_method: "cash", discount_amount: 0,   male_count: 1, female_count: 1, created_at: "2026-07-13T12:30:00+09:00" },
      { total_amount: 2000, tax8: 74, tax10: 91, tax: 165, payment_method: "card", discount_amount: 100, male_count: 2, female_count: 0, created_at: "2026-07-13T18:15:00+09:00" },
      { total_amount: 3000, tax8: 0,  tax10: 273,tax: 273, payment_method: "qr",   discount_amount: 0,   male_count: 0, female_count: 3, created_at: "2026-07-13T20:00:00+09:00" },
    ]);
    const s = await fetchDailySettlement(FROM, TO);
    expect(s.totalTaxIncl).toBe(6000);
    expect(s.count).toBe(3);
    expect(s.guests).toBe(7);
    expect(s.discountTotal).toBe(100);
    expect(s.tax8).toBe(74);
    expect(s.tax10).toBe(455);
    // 逆算 sub8 = tax8 / 0.08 = 925, sub10 = tax10 / 0.10 = 4550
    expect(s.sub8).toBe(925);
    expect(s.sub10).toBe(4550);
    expect(s.byPayment.cash.total).toBe(1000);
    expect(s.byPayment.card.total).toBe(2000);
    expect(s.byPayment.qr.total).toBe(3000);
    expect(s.byPayment.voucher.total).toBe(0);
    // 時間帯: 12時と18時と20時にヒット
    expect(s.byHour[12].total).toBe(1000);
    expect(s.byHour[18].total).toBe(2000);
    expect(s.byHour[20].total).toBe(3000);
  });

  it("payment_method 日本語表記でも正規化する", async () => {
    __set([
      { total_amount: 500, payment_method: "現金",   created_at: "2026-07-13T12:00:00+09:00" },
      { total_amount: 700, payment_method: "カード", created_at: "2026-07-13T12:00:00+09:00" },
      { total_amount: 900, payment_method: "商品券", created_at: "2026-07-13T12:00:00+09:00" },
    ]);
    const s = await fetchDailySettlement(FROM, TO);
    expect(s.byPayment.cash.total).toBe(500);
    expect(s.byPayment.card.total).toBe(700);
    expect(s.byPayment.voucher.total).toBe(900);
  });

  it("未知の payment_method は無視される", async () => {
    __set([
      { total_amount: 500, payment_method: "unknown_method", created_at: "2026-07-13T12:00:00+09:00" },
    ]);
    const s = await fetchDailySettlement(FROM, TO);
    expect(s.byPayment.cash.total).toBe(0);
    expect(s.totalTaxIncl).toBe(500); // 総計には含まれる
  });
});

describe("todayJstRange", () => {
  it("24時間分のレンジを返す", () => {
    const { from, to, reportDate } = todayJstRange();
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(reportDate).toBeInstanceOf(Date);
  });
});
