// 未会計注文の Supabase 同期（Phase 1-⑩ 拡張）
// LocalStorage は一次保存、Supabase はミラー。テーブル管理ダッシュボードは
// Supabase から fetch して複数端末で同じ卓状況を共有できるようにする。

import { supabase } from "./supabase";
import { STORE_ID } from "./db";

export interface OpenOrderRow {
  id: string;
  table_no: string;
  staff: string | null;
  items: { name: string; emoji?: string; qty: number; unitPrice: number }[];
  total_tax_incl: number;
  sent_at: string;
  served: boolean;
  closed: boolean;
  updated_at?: string;
}

export interface OpenOrderPayload {
  id: string;
  tableNo: string;
  staff: string;
  items: { name: string; emoji: string; qty: number; unitPrice: number }[];
  totalTaxIncl: number;
  sentAt: number;
  served: boolean;
  closed: boolean;
}

/** ハンディからの注文送信時に呼ぶ（LocalStorage書込後にfire-and-forget） */
export async function upsertOpenOrder(order: OpenOrderPayload): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("open_orders").upsert({
      id: order.id,
      store_id: STORE_ID,
      table_no: order.tableNo,
      staff: order.staff || null,
      items: order.items,
      total_tax_incl: order.totalTaxIncl,
      sent_at: new Date(order.sentAt).toISOString(),
      served: order.served,
      closed: order.closed,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
  } catch { /* オフライン耐性 — LSが本命なので失敗しても続行 */ }
}

/** 指定卓の未会計注文（closed=false）を全て取得。レジ画面での会計引継ぎ用 */
export async function fetchOpenOrdersForTable(tableNo: string): Promise<OpenOrderRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("open_orders")
    .select("id, table_no, staff, items, total_tax_incl, sent_at, served, closed, updated_at")
    .eq("store_id", STORE_ID)
    .eq("closed", false)
    .eq("table_no", tableNo)
    .order("sent_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as OpenOrderRow[];
}

/** 卓の全 open_orders を一括クローズ（レジ会計完了時に呼ぶ） */
export async function closeOpenOrdersForTable(tableNo: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("open_orders").update({
      closed: true,
      served: true,
      updated_at: new Date().toISOString(),
    }).eq("store_id", STORE_ID).eq("table_no", tableNo).eq("closed", false);
  } catch { /* fire-and-forget */ }
}

/** テーブル管理ダッシュボードから呼ぶ。未クローズのみ */
export async function fetchActiveOpenOrders(): Promise<OpenOrderRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("open_orders")
    .select("id, table_no, staff, items, total_tax_incl, sent_at, served, closed, updated_at")
    .eq("store_id", STORE_ID)
    .eq("closed", false)
    .order("sent_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as OpenOrderRow[];
}

/** 状態変更（提供済み・会計完了）を Supabase に反映 */
export async function updateOpenOrderStatus(
  id: string, patch: { served?: boolean; closed?: boolean },
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("open_orders").update({
      ...patch,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
  } catch { /* fire-and-forget */ }
}
