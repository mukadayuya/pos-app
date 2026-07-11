// ESC/POS レシート生成
// 対象プリンター: Star mPOP / EPSON TM-m30 系（58mm/80mm感熱ロール）。
// 日本語は Shift_JIS(CP932) にエンコードして送出する（両社共通のデフォルト）。

import iconv from "iconv-lite";

// ─── 基本 ESC/POS コマンド ───────────────────────────────────
const ESC = 0x1b;
const GS  = 0x1d;

const INIT           = Uint8Array.of(ESC, 0x40);            // プリンタ初期化
const ALIGN_LEFT     = Uint8Array.of(ESC, 0x61, 0);
const ALIGN_CENTER   = Uint8Array.of(ESC, 0x61, 1);
const ALIGN_RIGHT    = Uint8Array.of(ESC, 0x61, 2);
const BOLD_ON        = Uint8Array.of(ESC, 0x45, 1);
const BOLD_OFF       = Uint8Array.of(ESC, 0x45, 0);
const SIZE_NORMAL    = Uint8Array.of(GS,  0x21, 0x00);
const SIZE_DOUBLE    = Uint8Array.of(GS,  0x21, 0x11);      // 縦横2倍
const CUT_PARTIAL    = Uint8Array.of(GS,  0x56, 1);
const LF             = Uint8Array.of(0x0a);
// Star mPOP のドロワーキック（コネクタ1・オンパルス50ms・オフパルス50ms）
const DRAWER_KICK    = Uint8Array.of(ESC, 0x70, 0, 50, 50);

class Builder {
  private chunks: Uint8Array[] = [];

  raw(b: Uint8Array | number[]): this {
    this.chunks.push(b instanceof Uint8Array ? b : Uint8Array.from(b));
    return this;
  }

  text(s: string): this {
    if (!s) return this;
    this.chunks.push(new Uint8Array(iconv.encode(s, "shift_jis")));
    return this;
  }

  line(s = ""): this { return this.text(s).raw(LF); }
  feed(n = 1): this { for (let i = 0; i < n; i++) this.raw(LF); return this; }

  init(): this   { return this.raw(INIT); }
  cut(): this    { return this.feed(3).raw(CUT_PARTIAL); }
  kick(): this   { return this.raw(DRAWER_KICK); }

  center(): this { return this.raw(ALIGN_CENTER); }
  left(): this   { return this.raw(ALIGN_LEFT); }
  right(): this  { return this.raw(ALIGN_RIGHT); }
  bold(on: boolean): this { return this.raw(on ? BOLD_ON : BOLD_OFF); }
  big(on: boolean): this  { return this.raw(on ? SIZE_DOUBLE : SIZE_NORMAL); }

  build(): Uint8Array {
    let total = 0;
    for (const c of this.chunks) total += c.length;
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of this.chunks) { out.set(c, o); o += c.length; }
    return out;
  }
}

// ─── レシート入力データ型 ────────────────────────────────────
export type ReceiptLine = {
  name: string;
  qty: number;
  unitPriceTaxIncl: number;
  taxRate: number; // 0.08 | 0.10
};

export type ReceiptInput = {
  storeName: string;
  storeAddress?: string;
  storeTel?: string;
  storeRegNo?: string;         // 適格請求書発行事業者登録番号（T1234...）
  createdAt: Date;
  tableLabel?: string;         // "1番テーブル" 等
  staff?: string;
  lines: ReceiptLine[];
  subtotalTaxIncl: number;     // 全品税込小計（値引前）
  discountTaxIncl?: number;    // 値引額（税込基準）
  totalTaxIncl: number;        // 支払合計
  tax8?: number;
  tax10?: number;
  paidAmount?: number;         // 現金の場合
  change?: number;
  paymentMethod?: string;      // "現金" | "クレジット" | ...
  footerNote?: string;         // "ありがとうございました" 等
  openDrawer?: boolean;        // 会計時にドロワーを開ける（現金決済で true）
  columns?: 32 | 42 | 48;      // レシート幅（半角桁数） 58mm=32桁, 80mm=42/48桁
};

// ─── 半角換算幅（日本語は2桁扱い） ───────────────────────────
function widthOf(s: string): number {
  let w = 0;
  for (const ch of s) {
    // ASCII/半角カナ相当は1、それ以外（漢字・ひらがな・カタカナ）は2
    w += /[\x00-\x7F｡-ﾟ]/.test(ch) ? 1 : 2;
  }
  return w;
}

// 右寄せ用の左パディング（left文字列＋right文字列で cols 桁に揃える）
function pad2col(left: string, right: string, cols: number): string {
  const gap = Math.max(1, cols - widthOf(left) - widthOf(right));
  return left + " ".repeat(gap) + right;
}

function fmtYen(n: number): string {
  return "\\" + Math.round(n).toLocaleString("en-US"); // \\ は Shift_JIS で¥として印字される
}

function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ─── 本体 ─────────────────────────────────────────────────────
export function buildReceipt(input: ReceiptInput): Uint8Array {
  const cols = input.columns ?? 42;
  const sep  = "-".repeat(cols);
  const b = new Builder();

  b.init().center().bold(true).big(true);
  b.line(input.storeName);
  b.big(false).bold(false);

  if (input.storeAddress) b.line(input.storeAddress);
  if (input.storeTel)     b.line(`TEL ${input.storeTel}`);
  b.feed(1).left();

  b.line(pad2col(fmtDate(input.createdAt), input.staff ? `担当 ${input.staff}` : "", cols));
  if (input.tableLabel) b.line(input.tableLabel);
  b.line(sep);

  // ─── 明細 ─────────────────────────────────────────
  for (const it of input.lines) {
    const total = it.qty * it.unitPriceTaxIncl;
    b.line(it.name);
    const detail = `  ${it.qty} × ${fmtYen(it.unitPriceTaxIncl)}`;
    b.line(pad2col(detail, fmtYen(total), cols));
  }
  b.line(sep);

  // ─── 金額 ─────────────────────────────────────────
  if (input.discountTaxIncl && input.discountTaxIncl !== 0) {
    b.line(pad2col("小計", fmtYen(input.subtotalTaxIncl), cols));
    b.line(pad2col("値引", fmtYen(-Math.abs(input.discountTaxIncl)), cols));
  }
  b.bold(true).big(true);
  b.line(pad2col("合計", fmtYen(input.totalTaxIncl), cols / 2)); // 倍サイズなので幅は半分扱い
  b.big(false).bold(false);

  if (input.tax8 || input.tax10) {
    if (input.tax8)  b.line(pad2col(" (8%内税)",  fmtYen(input.tax8),  cols));
    if (input.tax10) b.line(pad2col(" (10%内税)", fmtYen(input.tax10), cols));
  }

  if (input.paymentMethod) b.line(pad2col("お支払い", input.paymentMethod, cols));
  if (typeof input.paidAmount === "number")
    b.line(pad2col("お預り", fmtYen(input.paidAmount), cols));
  if (typeof input.change === "number" && input.change > 0)
    b.line(pad2col("お釣り", fmtYen(input.change), cols));

  b.line(sep);
  if (input.storeRegNo) b.line(`登録番号 ${input.storeRegNo}`);

  b.feed(1).center();
  b.line(input.footerNote ?? "ありがとうございました");
  b.feed(1);

  if (input.openDrawer) b.kick();
  b.cut();
  return b.build();
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
