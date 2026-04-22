import { supabase } from "./supabase";
import { SalesRecord, MenuItem, TaxRate } from "@/types/pos";

// ─── 売上保存 ──────────────────────────────────────────────────
export async function saveSaleRecord(record: SalesRecord): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const { error: saleError } = await supabase.from("sales").insert({
    id: record.id,
    total_amount: record.total,
    items: record.items.map(i => ({
      id: i.menuItem.id,
      name: i.menuItem.name,
      emoji: i.menuItem.emoji,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      tax_rate: i.taxRate,
    })),
    created_at: record.createdAt.toISOString(),
  });
  if (saleError) throw saleError;
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

export interface MonthlySummary {
  month: string; // "2026-04"
  label: string; // "4月"
  total: number;
  count: number;
}

export interface YearlySummary {
  year: string;
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

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("sales")
    .select("total_amount, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  const grouped = new Map<string, { total: number; count: number }>();
  for (const sale of data ?? []) {
    const date = new Date(sale.created_at).toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const prev = grouped.get(date) ?? { total: 0, count: 0 };
    grouped.set(date, { total: prev.total + (sale.total_amount ?? 0), count: prev.count + 1 });
  }

  return Array.from(grouped.entries())
    .map(([date, { total, count }]) => ({ date, total, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchMonthlySummaries(): Promise<MonthlySummary[]> {
  if (!supabase) throw new Error("Supabase not configured");

  const since = new Date();
  since.setMonth(since.getMonth() - 11);
  since.setDate(1);

  const { data, error } = await supabase
    .from("sales")
    .select("total_amount, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) throw error;

  const grouped = new Map<string, { total: number; count: number }>();
  for (const sale of data ?? []) {
    const d = new Date(sale.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const prev = grouped.get(key) ?? { total: 0, count: 0 };
    grouped.set(key, { total: prev.total + (sale.total_amount ?? 0), count: prev.count + 1 });
  }

  return Array.from(grouped.entries())
    .map(([month, { total, count }]) => ({
      month,
      label: `${parseInt(month.split("-")[1])}月`,
      total,
      count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function fetchYearlySummaries(): Promise<YearlySummary[]> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("sales")
    .select("total_amount, created_at")
    .order("created_at", { ascending: true })
    .limit(10000);
  if (error) throw error;

  const grouped = new Map<string, { total: number; count: number }>();
  for (const sale of data ?? []) {
    const year = String(new Date(sale.created_at).getFullYear());
    const prev = grouped.get(year) ?? { total: 0, count: 0 };
    grouped.set(year, { total: prev.total + (sale.total_amount ?? 0), count: prev.count + 1 });
  }

  return Array.from(grouped.entries())
    .map(([year, { total, count }]) => ({ year, total, count }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

export async function fetchItemRankings(): Promise<ItemRanking[]> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("sale_items")
    .select("menu_item_name, menu_item_emoji, quantity, unit_price");
  if (error) {
    if (error.code === "PGRST205" || error.message?.includes("sale_items")) return [];
    throw error;
  }

  const grouped = new Map<string, { emoji: string; qty: number; revenue: number }>();
  for (const item of data ?? []) {
    const prev = grouped.get(item.menu_item_name) ?? { emoji: item.menu_item_emoji, qty: 0, revenue: 0 };
    grouped.set(item.menu_item_name, {
      emoji: item.menu_item_emoji,
      qty: prev.qty + item.quantity,
      revenue: prev.revenue + item.unit_price * item.quantity,
    });
  }

  return Array.from(grouped.entries())
    .map(([name, { emoji, qty, revenue }]) => ({
      menuItemName: name, menuItemEmoji: emoji, totalQuantity: qty, totalRevenue: revenue,
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

// ─── カテゴリー管理 ───────────────────────────────────────────
export interface CategoryRecord {
  id: string;  // 必ず UUID v4 形式
  name: string;
  display_order: number;
}

// localStorage キー（オフライン / テーブル未作成時のフォールバック用）
const LS_KEY = "pos_categories";

function lsLoad(): CategoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? (JSON.parse(raw) as CategoryRecord[]) : [];
    // 非 UUID エントリは自動除去（古い cat_... / lunch などを排除）
    return parsed.filter(c => isValidUUID(c.id));
  } catch { return []; }
}

function lsSave(cats: CategoryRecord[]): void {
  if (typeof window !== "undefined")
    localStorage.setItem(LS_KEY, JSON.stringify(cats.filter(c => isValidUUID(c.id))));
}

/** localStorage の古いゴミデータをクリア（ページロード時に呼び出す） */
export function cleanupLegacyCategories(): void {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return;
  try {
    const all = JSON.parse(raw) as CategoryRecord[];
    const valid = all.filter(c => isValidUUID(c.id));
    if (valid.length !== all.length) {
      console.info(`[DB Cleanup] localStorage から ${all.length - valid.length} 件の非 UUID カテゴリーを削除しました。`);
      if (valid.length > 0) lsSave(valid);
      else localStorage.removeItem(LS_KEY);
    }
  } catch { localStorage.removeItem(LS_KEY); }
}

// UUID v4 フォーマット検証
export function isValidUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function assertUUID(field: string, value: string): void {
  if (!isValidUUID(value)) {
    const msg =
      `[DB Guard] "${field}" が有効な UUID ではありません: "${value}"\n` +
      `supabase/migrate_categories_to_uuid.sql を実行してDBを修正してください。`;
    console.error(msg);
    throw new Error(msg);
  }
}

/** テーブルが存在しない PostgreSQL エラーのみ true を返す（過剰マッチを排除） */
function isTableMissingError(error: { code?: string; message?: string }): boolean {
  const msg = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||           // undefined_table
    error.code === "PGRST116" ||        // PostgREST: resource not found
    msg.includes("does not exist") ||   // "relation ... does not exist"
    msg.includes("no such table")
  );
}

export async function fetchCategories(): Promise<CategoryRecord[]> {
  if (!supabase) return lsLoad();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, display_order")
    .order("display_order", { ascending: true });

  if (error) {
    if (isTableMissingError(error)) {
      console.warn("[fetchCategories] categories テーブルが存在しません。supabase/migrate_categories_to_uuid.sql を実行してください。");
      return lsLoad();
    }
    throw error;
  }

  const all = (data ?? []) as CategoryRecord[];

  // UUID 形式でない行を除外（旧 cat_.../lunch/dinner スラグ）
  const valid = all.filter(c => isValidUUID(c.id));
  const invalid = all.filter(c => !isValidUUID(c.id));

  if (invalid.length > 0) {
    console.warn(
      `[fetchCategories] ${invalid.length} 件のカテゴリーが非 UUID です:`,
      invalid.map(c => `${c.name}(${c.id})`).join(", "),
      "\n→ supabase/migrate_categories_to_uuid.sql を実行してください。"
    );
  }

  // DB の有効 UUID カテゴリー + localStorage のオフライン追加分をマージ
  const dbIds = new Set(valid.map(c => c.id));
  const lsExtra = lsLoad().filter(c => !dbIds.has(c.id));

  return [...valid, ...lsExtra].sort((a, b) => a.display_order - b.display_order);
}

// id は渡さず DB (gen_random_uuid) に生成させ、作成された行を返す
export async function saveCategory(
  cat: Omit<CategoryRecord, "id">
): Promise<CategoryRecord> {
  if (!supabase) {
    const newCat: CategoryRecord = { id: crypto.randomUUID(), ...cat };
    lsSave([...lsLoad(), newCat]);
    return newCat;
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({ name: cat.name, display_order: cat.display_order })
    .select("id, name, display_order")
    .single();

  if (error) {
    if (isTableMissingError(error)) {
      const newCat: CategoryRecord = { id: crypto.randomUUID(), ...cat };
      lsSave([...lsLoad(), newCat]);
      return newCat;
    }
    throw error;
  }

  return data as CategoryRecord;
}

export async function updateCategoryRecord(
  id: string,
  updates: { name?: string; display_order?: number }
): Promise<void> {
  if (!supabase) {
    lsSave(lsLoad().map(c => c.id === id ? { ...c, ...updates } : c));
    return;
  }

  const { error } = await supabase.from("categories").update(updates).eq("id", id);

  if (error) {
    if (isTableMissingError(error)) {
      lsSave(lsLoad().map(c => c.id === id ? { ...c, ...updates } : c));
      return;
    }
    throw error;
  }
}

export async function deleteCategoryRecord(id: string): Promise<void> {
  if (!supabase) {
    lsSave(lsLoad().filter(c => c.id !== id));
    return;
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    if (isTableMissingError(error)) {
      lsSave(lsLoad().filter(c => c.id !== id));
      return;
    }
    throw error;
  }
}

// ─── メニュー管理 ──────────────────────────────────────────────
export async function fetchMenuItems(): Promise<MenuItem[]> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("menus")
    .select("id, name, price, category, emoji")
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map(item => ({
    ...item,
    taxRate: 0.10 as TaxRate,
  })) as MenuItem[];
}

export async function saveMenuItem(item: MenuItem): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  // ─── UUID ガード ──────────────────────────────────────────────
  // category は categories テーブルの UUID でなければならない
  assertUUID("category", item.category);
  // id も UUID 形式でなければならない（menus.id が UUID 型の場合に備えて）
  assertUUID("id", item.id);

  const { error } = await supabase.from("menus").insert({
    id: item.id,
    name: item.name,
    price: item.price,
    category: item.category,
    emoji: item.emoji,
  });
  if (error) throw error;
}

export async function updateMenuItem(
  id: string,
  updates: { name?: string; price?: number; category?: string; emoji?: string }
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase.from("menus").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteMenuItem(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase.from("menus").delete().eq("id", id);
  if (error) throw error;
}
