import { describe, it, expect } from "vitest";
import {
  UNSENT_SALES_KEY,
  StorageLike,
  serializeRecord,
  deserializeRecord,
  loadQueue,
  enqueueUnsentSale,
  queueLength,
  isDuplicateKeyError,
  flushUnsentSales,
} from "../unsentSalesQueue";
import { SalesRecord, MenuItem } from "@/types/pos";

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
  };
}

const menuItem: MenuItem = {
  id: "m1", name: "ねぎま", price: 200, category: "yakitori", emoji: "🍢", taxRate: 0.10,
};

function makeRecord(id: string): SalesRecord {
  return {
    id,
    items: [{
      itemKey: "k1", menuItem, quantity: 2,
      options: { riceType: "white", riceSize: "regular", selections: [] },
      unitPrice: 200, taxRate: 0.10,
    }],
    subtotal: 400,
    itemDiscountTotal: 0,
    tax8: 0,
    tax10: 40,
    tax: 40,
    total: 440,
    payments: [{ method: "cash", amount: 440 }],
    serviceTab: "dinner",
    createdAt: new Date("2026-06-13T19:30:00+09:00"),
  };
}

describe("serializeRecord / deserializeRecord", () => {
  it("Date を ISO 文字列にして往復できる", () => {
    const rec = makeRecord("r1");
    const back = deserializeRecord(serializeRecord(rec));
    expect(back.createdAt).toBeInstanceOf(Date);
    expect(back.createdAt.getTime()).toBe(rec.createdAt.getTime());
    expect(back.total).toBe(440);
  });
});

describe("enqueueUnsentSale / loadQueue", () => {
  it("追加してキュー長を返す", () => {
    const s = memoryStorage();
    expect(enqueueUnsentSale(makeRecord("a"), s)).toBe(1);
    expect(enqueueUnsentSale(makeRecord("b"), s)).toBe(2);
    expect(loadQueue(s).map(r => r.id)).toEqual(["a", "b"]);
  });

  it("同一IDは重複追加しない", () => {
    const s = memoryStorage();
    enqueueUnsentSale(makeRecord("a"), s);
    expect(enqueueUnsentSale(makeRecord("a"), s)).toBe(1);
    expect(queueLength(s)).toBe(1);
  });

  it("壊れたJSONは空キュー扱い", () => {
    const s = memoryStorage({ [UNSENT_SALES_KEY]: "{{{broken" });
    expect(loadQueue(s)).toEqual([]);
    expect(enqueueUnsentSale(makeRecord("a"), s)).toBe(1);
  });

  it("配列以外が入っていても空キュー扱い", () => {
    const s = memoryStorage({ [UNSENT_SALES_KEY]: JSON.stringify({ not: "array" }) });
    expect(loadQueue(s)).toEqual([]);
  });

  it("storage が null（SSR）でも例外を出さない", () => {
    expect(loadQueue(null)).toEqual([]);
    expect(() => enqueueUnsentSale(makeRecord("a"), null)).not.toThrow();
  });
});

describe("isDuplicateKeyError", () => {
  it("PostgreSQL 23505 を検知する", () => {
    expect(isDuplicateKeyError({ code: "23505" })).toBe(true);
    expect(isDuplicateKeyError({ message: "duplicate key value violates unique constraint" })).toBe(true);
  });
  it("通常エラーは false", () => {
    expect(isDuplicateKeyError(new Error("network down"))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError({ code: "42703" })).toBe(false);
  });
});

describe("flushUnsentSales", () => {
  it("全件成功で空になる", async () => {
    const s = memoryStorage();
    enqueueUnsentSale(makeRecord("a"), s);
    enqueueUnsentSale(makeRecord("b"), s);
    const sent: string[] = [];
    const result = await flushUnsentSales(async r => { sent.push(r.id); }, s);
    expect(result).toEqual({ sent: 2, remaining: 0 });
    expect(sent).toEqual(["a", "b"]);
    expect(queueLength(s)).toBe(0);
  });

  it("失敗したらそこで中断し残りを保持する", async () => {
    const s = memoryStorage();
    enqueueUnsentSale(makeRecord("a"), s);
    enqueueUnsentSale(makeRecord("b"), s);
    enqueueUnsentSale(makeRecord("c"), s);
    const result = await flushUnsentSales(async r => {
      if (r.id === "b") throw new Error("network down");
    }, s);
    expect(result).toEqual({ sent: 1, remaining: 2 });
    expect(loadQueue(s).map(r => r.id)).toEqual(["b", "c"]);
  });

  it("主キー重複（=保存済み）はキューから除去して続行する", async () => {
    const s = memoryStorage();
    enqueueUnsentSale(makeRecord("a"), s);
    enqueueUnsentSale(makeRecord("b"), s);
    const result = await flushUnsentSales(async r => {
      if (r.id === "a") throw { code: "23505" };
    }, s);
    expect(result).toEqual({ sent: 1, remaining: 0 });
    expect(queueLength(s)).toBe(0);
  });

  it("空キューは何もしない", async () => {
    const s = memoryStorage();
    const result = await flushUnsentSales(async () => {}, s);
    expect(result).toEqual({ sent: 0, remaining: 0 });
  });
});
