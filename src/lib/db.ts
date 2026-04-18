import { supabase } from "./supabase";
import { SalesRecord, MenuItem } from "@/types/pos";

// ─── 売上保存 ──────────────────────────────────────────────────
export async function saveSaleRecord(record: SalesRecord): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const { error: saleError } = await supabase.from("sales").insert({
    id: record.id,
    total_amount: record.total,
    created_at: record.createdAt.toISOString(),
  });
  if (saleError) throw saleError;

  const { error: itemsError } = await supabase.from("sale_items").insert(
    record.items.map((item) => ({
      sale_id: record.id,
      menu_item_id: item.menuItem.id,
      menu_item_name: item.menuItem.name,
      menu_item_emoji: item.menuItem.emoji,
      category: item.menuItem.category,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      rice_type: item.options.riceType,
      rice_size: item.options.riceSize,
    }))
  );
  if (itemsError) throw itemsError;
}

// ─── 売上集計 ──────────────────────────────────────────────────
export interface TodaySummary {
  totalRevenue: number;
  count: number;
  avgSpend: number;
}

export interface DailySummary {
  date: string;
  total: number;
  count: number;
}

export interface ItemRanking {
  menuItemName: string;
  menuItemEmoji: string;
  totalQuantity: number;
  totalRevenue: number;
}

export async function fetchTodaySummary(): Promise<TodaySummary> {
  if (!supabase) throw new Error("Supabase not configured");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("sales")
    .select("total_amount")
    .gte("created_at", todayStart.toISOString());
  if (error) throw error;

  const totalRevenue = (data ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0);
  const count = (data ?? []).length;
  const avgSpend = count > 0 ? Math.floor(totalRevenue / count) : 0;
  return { totalRevenue, count, avgSpend };
}

export async function fetchDailySummaries(): Promise<DailySummary[]> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("sales")
    .select("total_amount, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const grouped = new Map<string, { total: number; count: number }>();
  for (const sale of data ?? []) {
    const date = new Date(sale.created_at).toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const amount = sale.total_amount ?? 0;
    const prev = grouped.get(date) ?? { total: 0, count: 0 };
    grouped.set(date, {
      total: prev.total + amount,
      count: prev.count + 1,
    });
  }

  return Array.from(grouped.entries())
    .map(([date, { total, count }]) => ({ date, total, count }))
    .slice(0, 30);
}

export async function fetchItemRankings(): Promise<ItemRanking[]> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("sale_items")
    .select("menu_item_name, menu_item_emoji, quantity, unit_price");
  if (error) {
    // sale_items テーブルが未作成の場合は空配列を返す
    if (error.code === "PGRST205" || error.message?.includes("sale_items")) return [];
    throw error;
  }

  const grouped = new Map<
    string,
    { emoji: string; qty: number; revenue: number }
  >();
  for (const item of data ?? []) {
    const prev = grouped.get(item.menu_item_name) ?? {
      emoji: item.menu_item_emoji,
      qty: 0,
      revenue: 0,
    };
    grouped.set(item.menu_item_name, {
      emoji: item.menu_item_emoji,
      qty: prev.qty + item.quantity,
      revenue: prev.revenue + item.unit_price * item.quantity,
    });
  }

  return Array.from(grouped.entries())
    .map(([name, { emoji, qty, revenue }]) => ({
      menuItemName: name,
      menuItemEmoji: emoji,
      totalQuantity: qty,
      totalRevenue: revenue,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity);
}

// ─── CSV エクスポート用 ────────────────────────────────────────
export interface SaleExportRow {
  id: string;
  created_at: string;
  total_amount: number;
}

export async function fetchAllSalesForExport(): Promise<SaleExportRow[]> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("sales")
    .select("id, total_amount, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []) as SaleExportRow[];
}

// ─── メニュー管理 ──────────────────────────────────────────────
export async function fetchMenuItems(): Promise<MenuItem[]> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("menus")
    .select("id, name, price, category, emoji")
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []) as MenuItem[];
}

export async function saveMenuItem(item: MenuItem): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase.from("menus").insert({
    id: item.id,
    name: item.name,
    price: item.price,
    category: item.category,
    emoji: item.emoji,
  });
  if (error) throw error;
}

export async function deleteMenuItem(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase.from("menus").delete().eq("id", id);
  if (error) throw error;
}
