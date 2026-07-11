// 日次締めレポート（X/Zレポート）用の集計＆保存ロジック
// - fetchDailySettlement(): 指定期間の売上を税率別／支払方法別／時間帯別で束ねる
// - saveZReport():           Zレポート実行時に daily_reports に保存

import { supabase } from "./supabase";
import { STORE_ID } from "./db";
import { PaymentMethod } from "@/types/pos";

export type PaymentBreakdown = Record<PaymentMethod, { total: number; count: number }>;

export interface HourlyEntry {
  hour: number;   // 0..23
  total: number;  // 税込合計
  count: number;
}

export interface DailySettlement {
  from: string;                 // ISO
  to: string;                   // ISO
  totalTaxIncl: number;         // 期間合計（税込）
  count: number;                // 会計件数
  guests: number;               // 男女合算
  discountTotal: number;        // 値引合計
  tax8: number;                 // 8% 税額
  tax10: number;                // 10% 税額
  sub8: number;                 // 8% 対象の税抜小計（逆算）
  sub10: number;                // 10% 対象の税抜小計（逆算）
  byPayment: PaymentBreakdown;  // 支払方法別
  byHour: HourlyEntry[];        // 時間帯別（0-23全て埋める）
}

const EMPTY_PAYMENT: PaymentBreakdown = {
  cash:    { total: 0, count: 0 },
  card:    { total: 0, count: 0 },
  voucher: { total: 0, count: 0 },
  qr:      { total: 0, count: 0 },
};

function emptyByHour(): HourlyEntry[] {
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0, count: 0 }));
}

/** 支払方法名の正規化（DB内で 'cash'/'card'/'qr'/'voucher' 以外の値も来うる） */
function normalizePaymentMethod(v: string | null | undefined): PaymentMethod | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s === "cash" || s === "現金")   return "cash";
  if (s === "card" || s === "カード" || s === "credit") return "card";
  if (s === "qr"   || s === "qr決済" || s === "paypay") return "qr";
  if (s === "voucher" || s === "商品券")                 return "voucher";
  return null;
}

export async function fetchDailySettlement(from: Date, to: Date): Promise<DailySettlement> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("sales")
    .select("total_amount, tax8, tax10, tax, payment_method, discount_amount, male_count, female_count, created_at")
    .eq("store_id", STORE_ID)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString());
  if (error) throw error;

  const result: DailySettlement = {
    from: from.toISOString(),
    to:   to.toISOString(),
    totalTaxIncl: 0,
    count: 0,
    guests: 0,
    discountTotal: 0,
    tax8: 0, tax10: 0,
    sub8: 0, sub10: 0,
    byPayment: JSON.parse(JSON.stringify(EMPTY_PAYMENT)) as PaymentBreakdown,
    byHour: emptyByHour(),
  };

  for (const row of data ?? []) {
    const amount = row.total_amount as number ?? 0;
    result.totalTaxIncl += amount;
    result.count        += 1;
    result.guests       += (row.male_count as number ?? 0) + (row.female_count as number ?? 0);
    result.discountTotal += (row.discount_amount as number ?? 0);
    result.tax8  += (row.tax8  as number ?? 0);
    result.tax10 += (row.tax10 as number ?? 0);

    const method = normalizePaymentMethod(row.payment_method as string);
    if (method) {
      result.byPayment[method].total += amount;
      result.byPayment[method].count += 1;
    }

    const hour = new Date(row.created_at as string).getHours();
    result.byHour[hour].total += amount;
    result.byHour[hour].count += 1;
  }

  // 税抜小計は逆算（税額 ÷ 税率）— インボイスレシートに合わせる
  result.sub8  = Math.round(result.tax8  / 0.08);
  result.sub10 = Math.round(result.tax10 / 0.10);

  return result;
}

// ─── daily_reports 保存 ──────────────────────────────────────
export interface SaveZReportInput {
  reportDate: Date;         // 対象営業日（JST）
  from: Date;               // 期間開始（例: 前日22時など柔軟に対応可）
  to: Date;                 // 期間終了
  settlement: DailySettlement;
  cashDeclared?: number;    // レジ金実測合計
  cashDiff?: number;        // 差異（cashDeclared − 売上現金合計）
  staff?: string;
  note?: string;
}

export interface SavedReport {
  id: string;
  report_date: string;
  kind: "x" | "z";
  totals_json: SettlementJson;
  created_at: string;
  printed_at: string | null;
}

// Supabase 保存用 JSON 形。DBはJSONBなので構造はここで固定
export interface SettlementJson extends DailySettlement {
  cashDeclared?: number | null;
  cashDiff?: number | null;
  staff?: string | null;
  note?: string | null;
}

export async function saveZReport(input: SaveZReportInput): Promise<SavedReport> {
  if (!supabase) throw new Error("Supabase not configured");
  const totals_json: SettlementJson = {
    ...input.settlement,
    cashDeclared: input.cashDeclared ?? null,
    cashDiff:     input.cashDiff ?? null,
    staff:        input.staff ?? null,
    note:         input.note ?? null,
  };
  const isoDate = input.reportDate.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_reports")
    .insert({
      store_id:    STORE_ID,
      report_date: isoDate,
      kind:        "z",
      period_from: input.from.toISOString(),
      period_to:   input.to.toISOString(),
      totals_json,
    })
    .select("id, report_date, kind, totals_json, created_at, printed_at")
    .single();
  if (error) throw error;
  return data as SavedReport;
}

export async function fetchRecentZReports(limit = 20): Promise<SavedReport[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("daily_reports")
    .select("id, report_date, kind, totals_json, created_at, printed_at")
    .eq("store_id", STORE_ID)
    .eq("kind", "z")
    .order("report_date", { ascending: false })
    .order("created_at",  { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SavedReport[];
}

export async function markReportPrinted(reportId: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from("daily_reports")
    .update({ printed_at: new Date().toISOString() })
    .eq("id", reportId);
}

// ─── 便利関数：本日の JST 期間 ───────────────────────────────
export function todayJstRange(): { from: Date; to: Date; reportDate: Date } {
  // JST基準の当日0時〜次日0時。ローカル時刻がJSTでない環境でも整合するように
  // UTCで計算してからJST補正する。
  const now = new Date();
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const jst = new Date(jstMs);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth();
  const d = jst.getUTCDate();
  // JST 0:00 == UTC 前日 15:00
  const fromUtc = Date.UTC(y, m, d, 0, 0, 0) - 9 * 60 * 60 * 1000;
  const toUtc   = fromUtc + 24 * 60 * 60 * 1000;
  return {
    from: new Date(fromUtc),
    to:   new Date(toUtc),
    reportDate: new Date(Date.UTC(y, m, d)),
  };
}
