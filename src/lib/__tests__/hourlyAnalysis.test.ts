import { describe, it, expect } from "vitest";
import { padHourlyData } from "../hourlyAnalysis";
import type { HourlySales } from "@/lib/db";

// ── 基本：24時間補完 ─────────────────────────────────────────────

it("空配列を渡すと24要素の配列が返る", () => {
  const result = padHourlyData([]);
  expect(result).toHaveLength(24);
});

it("空配列の全要素は total=0, count=0", () => {
  const result = padHourlyData([]);
  result.forEach(d => {
    expect(d.total).toBe(0);
    expect(d.count).toBe(0);
  });
});

it("hour は 0〜23 の昇順で並ぶ", () => {
  const result = padHourlyData([]);
  result.forEach((d, i) => expect(d.hour).toBe(i));
});

// ── 売上がある時間帯のデータが保持される ──────────────────────────

it("特定の時間帯のデータが正確に引き継がれる", () => {
  const input: HourlySales[] = [
    { hour: 12, total: 5000, count: 3 },
    { hour: 18, total: 12000, count: 7 },
  ];
  const result = padHourlyData(input);

  const h12 = result.find(d => d.hour === 12)!;
  const h18 = result.find(d => d.hour === 18)!;

  expect(h12.total).toBe(5000);
  expect(h12.count).toBe(3);
  expect(h18.total).toBe(12000);
  expect(h18.count).toBe(7);
});

it("売上がない時間帯は total=0, count=0 で埋められる", () => {
  const input: HourlySales[] = [
    { hour: 12, total: 5000, count: 3 },
  ];
  const result = padHourlyData(input);

  // 12時以外は全て0
  result.filter(d => d.hour !== 12).forEach(d => {
    expect(d.total).toBe(0);
    expect(d.count).toBe(0);
  });
});

// ── 出力は常に24要素 ─────────────────────────────────────────────

it("一部の時間帯だけデータがあっても出力は24要素", () => {
  const input: HourlySales[] = [
    { hour: 9,  total: 3000,  count: 2 },
    { hour: 12, total: 8500,  count: 5 },
    { hour: 15, total: 4200,  count: 3 },
    { hour: 19, total: 15000, count: 9 },
  ];
  expect(padHourlyData(input)).toHaveLength(24);
});

it("全24時間にデータがあっても出力は24要素（重複なし）", () => {
  const input: HourlySales[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h, total: h * 100, count: 1,
  }));
  const result = padHourlyData(input);
  expect(result).toHaveLength(24);
  expect(result[0].total).toBe(0);   // 0時 = 0 * 100
  expect(result[23].total).toBe(2300); // 23時 = 23 * 100
});

// ── 順序保証 ─────────────────────────────────────────────────────

it("入力が逆順でも出力は0〜23の昇順", () => {
  const input: HourlySales[] = [
    { hour: 23, total: 1000, count: 1 },
    { hour: 0,  total: 500,  count: 1 },
    { hour: 11, total: 2000, count: 2 },
  ];
  const result = padHourlyData(input);
  result.forEach((d, i) => expect(d.hour).toBe(i));
});

// ── 実営業シナリオ ──────────────────────────────────────────────

describe("昼・夜のみ売上がある典型的な1日", () => {
  const input: HourlySales[] = [
    { hour: 11, total: 4500,  count: 3 },
    { hour: 12, total: 18000, count: 11 },
    { hour: 13, total: 9500,  count: 6 },
    { hour: 17, total: 6000,  count: 4 },
    { hour: 18, total: 22000, count: 14 },
    { hour: 19, total: 19500, count: 12 },
    { hour: 20, total: 8500,  count: 5 },
  ];
  const result = padHourlyData(input);

  it("出力が24要素である", () => {
    expect(result).toHaveLength(24);
  });

  it("深夜帯（0〜10時）は全て0", () => {
    result.filter(d => d.hour <= 10).forEach(d => {
      expect(d.total).toBe(0);
      expect(d.count).toBe(0);
    });
  });

  it("14〜16時は0（アイドル帯）", () => {
    [14, 15, 16].forEach(h => {
      const d = result.find(r => r.hour === h)!;
      expect(d.total).toBe(0);
      expect(d.count).toBe(0);
    });
  });

  it("12時のピーク売上が保持されている", () => {
    const d = result.find(r => r.hour === 12)!;
    expect(d.total).toBe(18000);
    expect(d.count).toBe(11);
  });
});
