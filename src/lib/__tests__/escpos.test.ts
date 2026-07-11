import { describe, it, expect } from "vitest";
import { buildReceipt, buildSettlementReport, toBase64, type ReceiptInput, type SettlementReportInput } from "@/lib/printer/escpos";
import iconv from "iconv-lite";

// 基本レシート入力（テストの土台）
const base: ReceiptInput = {
  storeName: "居食屋 笑点",
  storeAddress: "愛知県豊田市御幸本町",
  storeTel: "0565-00-0000",
  createdAt: new Date("2026-07-13T18:30:00+09:00"),
  tableLabel: "1番テーブル",
  staff: "ラム",
  lines: [
    { name: "生ビール（中）", qty: 2, unitPriceTaxIncl: 550, taxRate: 0.10 },
    { name: "飛騨牛のタタキ", qty: 1, unitPriceTaxIncl: 1408, taxRate: 0.10 },
  ],
  subtotalTaxIncl: 2508,
  totalTaxIncl: 2508,
  tax10: 228,
  paidAmount: 3000,
  change: 492,
  paymentMethod: "現金",
  openDrawer: true,
};

describe("buildReceipt", () => {
  it("初期化コマンド(ESC @)で始まる", () => {
    const bytes = buildReceipt(base);
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
  });

  it("末尾がカットコマンド(GS V 1)で終わる", () => {
    const bytes = buildReceipt(base);
    // 直前の LF(0x0a) 群を許容してカット位置を探す
    const last3 = bytes.slice(-3);
    expect(Array.from(last3)).toEqual([0x1d, 0x56, 1]);
  });

  it("openDrawer=true でドロワーキック(ESC p ...)が出る", () => {
    const bytes = buildReceipt({ ...base, openDrawer: true });
    // カット前にキック(0x1b 0x70 0x00 0x32 0x32)が入っているか
    const s = Array.from(bytes).join(",");
    expect(s).toContain([0x1b, 0x70, 0x00, 50, 50].join(","));
  });

  it("openDrawer=false ならドロワーキックは出ない", () => {
    const bytes = buildReceipt({ ...base, openDrawer: false });
    const s = Array.from(bytes).join(",");
    expect(s).not.toContain([0x1b, 0x70, 0x00, 50, 50].join(","));
  });

  it("日本語テキストがShift_JISでエンコードされている", () => {
    const bytes = buildReceipt(base);
    // "笑点" のShift_JIS: 8F CE 93 5F を検索
    const target = iconv.encode("笑点", "shift_jis");
    let found = false;
    for (let i = 0; i <= bytes.length - target.length; i++) {
      let ok = true;
      for (let j = 0; j < target.length; j++) {
        if (bytes[i + j] !== target[j]) { ok = false; break; }
      }
      if (ok) { found = true; break; }
    }
    expect(found).toBe(true);
  });

  it("商品ライン分だけ金額文字が出現する", () => {
    const bytes = buildReceipt(base);
    const decoded = iconv.decode(Buffer.from(bytes), "shift_jis");
    // \\1,100 と \\1,408 が両方入っているはず（生ビール中×2＝1,100、飛騨牛=1,408）
    expect(decoded).toContain("1,100");
    expect(decoded).toContain("1,408");
    expect(decoded).toContain("2,508"); // 合計
  });

  it("値引がある場合は小計＋値引が出る、無い場合は合計のみ", () => {
    const withDiscount = buildReceipt({ ...base, discountTaxIncl: 300, totalTaxIncl: 2208 });
    const decodedD = iconv.decode(Buffer.from(withDiscount), "shift_jis");
    expect(decodedD).toContain("値引");
    expect(decodedD).toContain("小計");

    const noDiscount = buildReceipt(base);
    const decodedN = iconv.decode(Buffer.from(noDiscount), "shift_jis");
    expect(decodedN).not.toContain("値引");
  });

  it("registerNo(適格請求書番号)は指定時のみ印字", () => {
    const withReg = buildReceipt({ ...base, storeRegNo: "T1234567890123" });
    const decodedW = iconv.decode(Buffer.from(withReg), "shift_jis");
    expect(decodedW).toContain("T1234567890123");
    const noReg = buildReceipt(base);
    const decodedN = iconv.decode(Buffer.from(noReg), "shift_jis");
    expect(decodedN).not.toContain("登録番号");
  });

  it("toBase64 が Node Buffer と同一結果", () => {
    const bytes = buildReceipt(base);
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});

// ── X/Zレポート ─────────────────────────────────────────────
const baseReport: SettlementReportInput = {
  storeName: "居食屋 笑点",
  storeTel: "0565-00-0000",
  kind: "Z",
  reportDate: new Date("2026-07-13T00:00:00+09:00"),
  createdAt:  new Date("2026-07-14T02:00:00+09:00"),
  from:       new Date("2026-07-13T00:00:00+09:00"),
  to:         new Date("2026-07-14T00:00:00+09:00"),
  staff: "ラム",
  count: 42, guests: 88,
  totalTaxIncl: 128000,
  discountTotal: 3200,
  tax8: 800, tax10: 10000,
  sub8: 10000, sub10: 100000,
  byPayment: {
    cash: { total: 80000, count: 26 },
    card: { total: 30000, count: 10 },
    voucher: { total: 3000, count: 2 },
    qr:   { total: 15000, count: 4 },
  },
  byHour: [
    { hour: 18, total: 40000, count: 12 },
    { hour: 19, total: 55000, count: 18 },
    { hour: 20, total: 33000, count: 12 },
  ],
  cashDeclared: 80500,
  cashDiff: 500,
};

describe("buildSettlementReport", () => {
  it("Z レポートに主要項目が全て入る", () => {
    const bytes = buildSettlementReport(baseReport);
    const decoded = iconv.decode(Buffer.from(bytes), "shift_jis");
    expect(decoded).toContain("Z レポート");
    expect(decoded).toContain("128,000"); // 合計
    expect(decoded).toContain("42件");     // 会計件数
    expect(decoded).toContain("88名");     // 客数
    expect(decoded).toContain("8%対象");
    expect(decoded).toContain("10%対象");
    expect(decoded).toContain("現金");
    expect(decoded).toContain("カード");
    expect(decoded).toContain("QR決済");
    expect(decoded).toContain("商品券");
    expect(decoded).toContain("18時");
    expect(decoded).toContain("レジ金実測");
    expect(decoded).toContain("差異");
    expect(decoded).toContain("+\\500"); // Shift_JIS の ¥ は "\" として印字
  });

  it("X レポートはレジ金差異を印字しない", () => {
    const xReport: SettlementReportInput = { ...baseReport, kind: "X" };
    // cashDeclared が入っていても X なら レジ金 セクションは出ない
    const bytes = buildSettlementReport({ ...xReport, cashDeclared: 80500 });
    const decoded = iconv.decode(Buffer.from(bytes), "shift_jis");
    expect(decoded).toContain("X レポート");
    expect(decoded).not.toContain("レジ金実測");
  });

  it("時間帯データがない/売上ゼロなら時間帯セクションを出さない", () => {
    const noHour = { ...baseReport, byHour: undefined };
    const decoded = iconv.decode(Buffer.from(buildSettlementReport(noHour)), "shift_jis");
    expect(decoded).not.toContain("時間帯別");
  });

  it("末尾がカット(GS V 1)で終わる", () => {
    const bytes = buildSettlementReport(baseReport);
    const last3 = Array.from(bytes.slice(-3));
    expect(last3).toEqual([0x1d, 0x56, 1]);
  });
});
