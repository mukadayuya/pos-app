// 現金入出金イベント（Phase 1-⑤）
// - 釣銭準備金 (opening_float)
// - 仮払い     (petty_cash: 現金支出はマイナス金額)
// - 入金       (deposit)
// - 出金       (withdrawal: マイナス金額)
// - 両替       (change: 金額は 0 or 差額)

import { supabase } from "./supabase";
import { STORE_ID } from "./db";

export type CashEventKind =
  | "opening_float"
  | "petty_cash"
  | "deposit"
  | "withdrawal"
  | "change";

export interface CashEvent {
  id: string;
  event_date: string;   // YYYY-MM-DD
  kind: CashEventKind;
  amount: number;       // 符号付き（+入 / -出）
  note?: string | null;
  staff?: string | null;
  created_at: string;
}

export const KIND_LABEL: Record<CashEventKind, string> = {
  opening_float: "釣銭準備金",
  petty_cash:    "仮払い",
  deposit:       "入金",
  withdrawal:    "出金",
  change:        "両替",
};

export async function fetchTodayCashEvents(dateIso: string): Promise<CashEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cash_events")
    .select("id, event_date, kind, amount, note, staff, created_at")
    .eq("store_id", STORE_ID)
    .eq("event_date", dateIso)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as CashEvent[];
}

export async function createCashEvent(input: Omit<CashEvent, "id" | "created_at">): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("cash_events").insert({
    ...input,
    store_id: STORE_ID,
  });
  if (error) throw error;
}

export async function deleteCashEvent(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("cash_events").delete().eq("id", id);
  if (error) throw error;
}

/** 期待レジ金 = 釣銭準備金 + 現金売上 + 入金 - 出金 - 仮払い */
export function computeExpectedCash(
  events: CashEvent[],
  cashSales: number,
): number {
  const eventsSum = events.reduce((s, e) => s + e.amount, 0);
  return eventsSum + cashSales;
}
