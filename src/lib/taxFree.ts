// 免税販売記録（Phase 1-⑬）

import { supabase } from "./supabase";
import { STORE_ID } from "./db";

export type TaxFreeCategory = "general" | "consumable" | "mixed";

export interface TaxFreeRecord {
  id: string;
  sale_id: string | null;
  passport_no: string;
  nationality: string;
  customer_name: string;
  entry_date: string | null;
  category: TaxFreeCategory;
  tax_excluded_total: number;
  tax_amount: number;
  staff: string | null;
  note: string | null;
  created_at: string;
}

export const CATEGORY_LABEL: Record<TaxFreeCategory, string> = {
  general:    "一般物品",
  consumable: "消耗品",
  mixed:      "一般＋消耗品",
};

// 免税販売の下限額（税抜5,000円以上）
export const TAX_FREE_MIN = 5000;
// 上限額（消耗品は50万円まで）
export const TAX_FREE_MAX_CONSUMABLE = 500000;

/** 税抜金額から税額を算出（10%固定・食品持ち帰りでも本質は10%取扱い） */
export function estimateTaxAmount(taxExcluded: number): number {
  return Math.round(taxExcluded * 0.10);
}

export async function fetchTaxFreeRecords(limit = 100): Promise<TaxFreeRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tax_free_records")
    .select("id, sale_id, passport_no, nationality, customer_name, entry_date, category, tax_excluded_total, tax_amount, staff, note, created_at")
    .eq("store_id", STORE_ID)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as TaxFreeRecord[];
}

export type TaxFreeInput = Omit<TaxFreeRecord, "id" | "created_at">;

export async function createTaxFreeRecord(input: TaxFreeInput): Promise<TaxFreeRecord> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("tax_free_records").insert({
    ...input,
    store_id: STORE_ID,
  }).select().single();
  if (error) throw error;
  return data as TaxFreeRecord;
}

export async function deleteTaxFreeRecord(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("tax_free_records").delete().eq("id", id);
  if (error) throw error;
}
