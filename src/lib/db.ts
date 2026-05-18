import { supabase } from "./supabase";
import { SalesRecord, MenuItem, MenuItemOptions, TaxRate, OptionGroup, PaymentEntry, OrderDiscount } from "@/types/pos";

function derivePaymentMethod(payments: PaymentEntry[]): string {
  if (payments.length === 0) return "cash";
  if (payments.length === 1) return payments[0].method;
  // 複数手段: card > qr > voucher > cash の優先順位
  for (const m of ["card", "qr", "voucher", "cash"] as const) {
    if (payments.some(e => e.method === m)) return m;
  }
  return payments[0].method;
}

// ─── 売上保存 ──────────────────────────────────────────────────
export async function saveSaleRecord(record: SalesRecord): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const basePayload = {
    id: record.id,
    total_amount: record.total,
    items: record.items.map(i => ({
      id: i.menuItem.id,
      name: i.menuItem.name,
      emoji: i.menuItem.emoji,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      tax_rate: i.taxRate,
      ...(i.priceAdjustReason ? { reason: i.priceAdjustReason } : {}),
      ...(i.itemDiscount     ? { item_discount: i.itemDiscount } : {}),
    })),
    created_at: record.createdAt.toISOString(),
  };

  // discount_amount は total と tax の差分から導出（tax8+tax10+... = record.tax）
  const discountAmount = Math.max(0, record.subtotal + record.tax - record.total);

  // 拡張カラム付きで保存を試みる
  const { error } = await supabase.from("sales").insert({
    ...basePayload,
    male_count:      record.maleCount   ?? 0,
    female_count:    record.femaleCount ?? 0,
    staff_name:      record.staff       ?? null,
    payment_method:  derivePaymentMethod(record.payments),
    discount_amount:      discountAmount,
    discount:             record.discount ?? null,
    tax8:                 record.tax8,
    tax10:                record.tax10,
    tax:                  record.tax,
    item_discount_total:  record.itemDiscountTotal ?? 0,
  });

  if (error) {
    // カラムが未作成の場合は基本カラムのみで再試行
    const colMissing =
      error.code === "42703" ||
      error.message?.toLowerCase().includes("column") ||
      error.message?.toLowerCase().includes("does not exist");
    if (colMissing) {
      const { error: e2 } = await supabase.from("sales").insert(basePayload);
      if (e2) throw e2;
    } else {
      throw error;
    }
  }
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

// ─── 時間別売上（本日） ────────────────────────────────────────
export interface HourlySales {
  hour: number;
  total: number;
  count: number;
}

export async function fetchTodayHourlySales(): Promise<HourlySales[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("sales")
    .select("total_amount, created_at")
    .gte("created_at", from.toISOString());
  if (error) throw error;
  const map = new Map<number, { total: number; count: number }>();
  for (const s of data ?? []) {
    const h = new Date(s.created_at).getHours();
    const prev = map.get(h) ?? { total: 0, count: 0 };
    map.set(h, { total: prev.total + s.total_amount, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .map(([hour, { total, count }]) => ({ hour, total, count }))
    .sort((a, b) => a.hour - b.hour);
}

// ─── 期間サマリー（先月・昨日・今月など） ─────────────────────
export interface PeriodSummary {
  total: number;
  count: number;
  avgSpend: number;
}

export async function fetchPeriodSummary(
  from: Date,
  to: Date,
): Promise<PeriodSummary> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("sales")
    .select("total_amount")
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString());
  if (error) throw error;
  const total = (data ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0);
  const count = (data ?? []).length;
  return { total, count, avgSpend: count > 0 ? Math.floor(total / count) : 0 };
}

// ─── 注文履歴詳細（月別） ──────────────────────────────────────
export interface SaleDetailItem {
  name: string;
  emoji: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  reason?: string;
  item_discount?: import("@/types/pos").OrderDiscount;
}

export interface SaleDetailRow {
  id: string;
  created_at: string;
  total_amount: number;
  items: SaleDetailItem[];
  male_count?: number;
  female_count?: number;
  staff_name?: string;
  payment_method?: string;
  discount_amount?: number;
  discount?: OrderDiscount | null;
  tax8?: number;
  tax10?: number;
  tax?: number;
  item_discount_total?: number;
}

export interface SaleRecordUpdate {
  total_amount: number;
  items: SaleDetailItem[];
  male_count?: number;
  female_count?: number;
}

export async function fetchSalesDetail(
  from: Date,
  to: Date,
): Promise<SaleDetailRow[]> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("sales")
    .select("id, total_amount, items, created_at, male_count, female_count, staff_name, payment_method, discount_amount, discount, tax8, tax10, tax, item_discount_total")
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    const colMissing =
      error.code === "42703" ||
      error.message?.toLowerCase().includes("column") ||
      error.message?.toLowerCase().includes("does not exist");
    if (colMissing) {
      const { data: data2, error: err2 } = await supabase
        .from("sales")
        .select("id, total_amount, items, created_at")
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(5000);
      if (err2) throw err2;
      return (data2 ?? []) as unknown as SaleDetailRow[];
    }
    throw error;
  }
  return (data ?? []) as unknown as SaleDetailRow[];
}

export async function updateSaleRecord(id: string, patch: SaleRecordUpdate): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("sales").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSale(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("sales").delete().eq("id", id);
  if (error) throw error;
}

// ─── 年別月次サマリー（RPC — 件数制限なし） ────────────────────
export interface YearlySummaryMonth {
  month:     number; // 1-12
  total_rev: number;
  cnt:       number;
  guests:    number;
  rev_10:    number; // 10% 税込売上
  rev_8:     number; // 8% 税込売上
}

export async function fetchYearlySummary(
  year: number,
): Promise<YearlySummaryMonth[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("get_yearly_summary", { p_year: year });
  if (error) throw error;
  return (data ?? []) as YearlySummaryMonth[];
}

export async function fetchMonthOrdersForAnalysis(
  year: number,
  month: number,
): Promise<SaleDetailRow[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month, 1);
  const { data, error } = await supabase
    .from("sales")
    .select("id, total_amount, items, created_at, male_count, female_count, staff_name, payment_method, discount_amount, discount, tax8, tax10, tax, item_discount_total")
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) {
    const colMissing = error.code === "42703" || error.message?.toLowerCase().includes("column");
    if (colMissing) {
      const { data: d2, error: e2 } = await supabase
        .from("sales")
        .select("id, total_amount, items, created_at")
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(5000);
      if (e2) throw e2;
      return (d2 ?? []) as unknown as SaleDetailRow[];
    }
    throw error;
  }
  return (data ?? []) as unknown as SaleDetailRow[];
}

// ─── 年別売上（時間帯分析用・最大10000件） ─────────────────────
export async function fetchYearOrders(
  year: number,
): Promise<SaleDetailRow[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const from = new Date(year, 0, 1);
  const to   = new Date(year + 1, 0, 1);
  const { data, error } = await supabase
    .from("sales")
    .select("id, total_amount, items, created_at, male_count, female_count, staff_name, payment_method, discount_amount, discount, tax8, tax10, tax, item_discount_total")
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: true })
    .limit(10000);
  if (error) {
    const colMissing =
      error.code === "42703" ||
      error.message?.toLowerCase().includes("column") ||
      error.message?.toLowerCase().includes("does not exist");
    if (colMissing) {
      const { data: d2, error: e2 } = await supabase
        .from("sales")
        .select("id, total_amount, items, created_at")
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString())
        .order("created_at", { ascending: true })
        .limit(10000);
      if (e2) throw e2;
      return (d2 ?? []) as unknown as SaleDetailRow[];
    }
    throw error;
  }
  return (data ?? []) as unknown as SaleDetailRow[];
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
    msg.includes("no such table") ||
    msg.includes("could not find")      // "Could not find the table 'public.xxx'"
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

  const toItem = (item: Record<string, unknown>): MenuItem => ({
    id:                 item.id as string,
    name:               item.name as string,
    name_en:            (item.name_en as string | null | undefined) || undefined,
    name_zh:            (item.name_zh as string | null | undefined) || undefined,
    name_ko:            (item.name_ko as string | null | undefined) || undefined,
    price:              item.price as number,
    category:           item.category as string,
    emoji:              (item.emoji as string | null | undefined) || undefined,
    imageUrl:           (item.image_url as string | null | undefined) || undefined,
    taxRate:            ((item.tax_rate as number) ?? 0.10) as TaxRate,
    options:            item.options as MenuItemOptions | undefined,
    isTakeoutAvailable: (item.is_takeout_available as boolean | undefined) !== false,
  });

  // Try 1: all columns including translations
  {
    const { data, error } = await supabase
      .from("menus")
      .select("id, name, name_en, name_zh, name_ko, price, category, emoji, image_url, tax_rate, options, is_takeout_available")
      .order("created_at", { ascending: true });
    if (!error) return (data ?? []).map(toItem);
    if (isTableMissingError(error)) return [];
    if (error.code !== "42703") throw error;
  }

  // Try 2: without translation columns
  {
    const { data, error } = await supabase
      .from("menus")
      .select("id, name, price, category, emoji, image_url, tax_rate, options, is_takeout_available")
      .order("created_at", { ascending: true });
    if (!error) return (data ?? []).map(toItem);
    if (isTableMissingError(error)) return [];
    if (error.code !== "42703") throw error;
  }

  // Try 3: without options column
  {
    const { data, error } = await supabase
      .from("menus")
      .select("id, name, price, category, emoji, image_url, tax_rate")
      .order("created_at", { ascending: true });
    if (!error) return (data ?? []).map(toItem);
    if (isTableMissingError(error)) return [];
    if (error.code !== "42703") throw error;
  }

  // Try 4: without tax_rate either
  {
    const { data, error } = await supabase
      .from("menus")
      .select("id, name, price, category, emoji, image_url")
      .order("created_at", { ascending: true });
    if (!error) return (data ?? []).map(toItem);
    if (isTableMissingError(error)) return [];
    if (error.code !== "42703") throw error;
  }

  // Try 5: base columns only (no image_url)
  {
    const { data, error } = await supabase
      .from("menus")
      .select("id, name, price, category, emoji")
      .order("created_at", { ascending: true });
    if (error) { if (isTableMissingError(error)) return []; throw error; }
    return (data ?? []).map(toItem);
  }
}

export async function saveMenuItem(item: MenuItem): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  assertUUID("category", item.category);
  assertUUID("id", item.id);

  const base = { id: item.id, name: item.name, price: item.price, category: item.category, emoji: item.emoji ?? null };
  const { error } = await supabase.from("menus").insert({
    ...base,
    tax_rate: item.taxRate,
    is_takeout_available: item.isTakeoutAvailable ?? true,
    ...(item.options ? { options: item.options } : {}),
  });
  if (error) {
    if (error.code === "42703") {
      const { error: e2 } = await supabase.from("menus").insert(base);
      if (e2) throw e2;
    } else {
      throw error;
    }
  }
}

export async function updateMenuItem(
  id: string,
  updates: { name?: string; name_en?: string; name_zh?: string; name_ko?: string; price?: number; category?: string; emoji?: string | null; tax_rate?: number; options?: MenuItemOptions; is_takeout_available?: boolean }
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase.from("menus").update(updates).eq("id", id);
  if (error) {
    // 新カラムが存在しない場合はそれらを除いてリトライ
    if (error.code === "42703") {
      const { options: _o, is_takeout_available: _t, ...rest } = updates;
      const { error: e2 } = await supabase.from("menus").update(rest).eq("id", id);
      if (e2) throw e2;
    } else {
      throw error;
    }
  }
}

export async function deleteMenuItem(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase.from("menus").delete().eq("id", id);
  if (error) throw error;
}

// ─── オプションテンプレート ─────────────────────────────────────

export interface OptionTemplate {
  id: string;
  name: string;
  groups: OptionGroup[];
}

const OPT_TMPL_LS_KEY = "pos_option_templates";

function lsLoadTemplates(): OptionTemplate[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(OPT_TMPL_LS_KEY) ?? "[]"); }
  catch { return []; }
}
function lsSaveTemplates(list: OptionTemplate[]): void {
  if (typeof window !== "undefined") localStorage.setItem(OPT_TMPL_LS_KEY, JSON.stringify(list));
}

export async function fetchOptionTemplates(): Promise<OptionTemplate[]> {
  if (!supabase) return lsLoadTemplates();
  const { data, error } = await supabase
    .from("option_templates")
    .select("id, name, groups")
    .order("created_at", { ascending: true });
  if (error) {
    if (isTableMissingError(error)) return lsLoadTemplates();
    throw error;
  }
  return (data ?? []).map(r => ({ id: r.id as string, name: r.name as string, groups: r.groups as OptionGroup[] }));
}

export async function saveOptionTemplate(tmpl: { name: string; groups: OptionGroup[] }): Promise<OptionTemplate> {
  if (!supabase) {
    const newTmpl: OptionTemplate = { id: crypto.randomUUID(), ...tmpl };
    lsSaveTemplates([...lsLoadTemplates(), newTmpl]);
    return newTmpl;
  }
  const { data, error } = await supabase
    .from("option_templates")
    .insert({ name: tmpl.name, groups: tmpl.groups })
    .select("id, name, groups")
    .single();
  if (error) {
    if (isTableMissingError(error)) {
      const newTmpl: OptionTemplate = { id: crypto.randomUUID(), ...tmpl };
      lsSaveTemplates([...lsLoadTemplates(), newTmpl]);
      return newTmpl;
    }
    throw error;
  }
  return { id: data.id as string, name: data.name as string, groups: data.groups as OptionGroup[] };
}

export async function updateOptionTemplate(id: string, updates: { name?: string; groups?: OptionGroup[] }): Promise<void> {
  if (!supabase) {
    lsSaveTemplates(lsLoadTemplates().map(t => t.id === id ? { ...t, ...updates } : t));
    return;
  }
  const { error } = await supabase.from("option_templates").update(updates).eq("id", id);
  if (error) {
    if (isTableMissingError(error)) {
      lsSaveTemplates(lsLoadTemplates().map(t => t.id === id ? { ...t, ...updates } : t));
      return;
    }
    throw error;
  }
}

/**
 * テンプレートが0件の場合のみデフォルト2件を保存して返す。
 * 既にデータがあれば何もせず existing をそのまま返す。
 */
export async function seedDefaultOptionTemplates(existing: OptionTemplate[]): Promise<OptionTemplate[]> {
  if (existing.length > 0) return existing;
  const [t1, t2] = await Promise.all([
    saveOptionTemplate({
      name: "ご飯の量",
      groups: [{
        id: crypto.randomUUID(),
        name: "ご飯の量",
        items: [
          { id: crypto.randomUUID(), name: "ご飯なし", price: 0 },
          { id: crypto.randomUUID(), name: "小ライス", price: -20 },
          { id: crypto.randomUUID(), name: "普通",     price: 0 },
          { id: crypto.randomUUID(), name: "大盛",     price: 0 },
          { id: crypto.randomUUID(), name: "特盛",     price: 80 },
        ],
      }],
    }),
    saveOptionTemplate({
      name: "ご飯の種類",
      groups: [{
        id: crypto.randomUUID(),
        name: "ご飯の種類",
        items: [
          { id: crypto.randomUUID(), name: "白米",     price: 0 },
          { id: crypto.randomUUID(), name: "十五穀米", price: 0 },
        ],
      }],
    }),
  ]);
  return [t1, t2];
}

export async function deleteOptionTemplate(id: string): Promise<void> {
  if (!supabase) {
    lsSaveTemplates(lsLoadTemplates().filter(t => t.id !== id));
    return;
  }
  const { error } = await supabase.from("option_templates").delete().eq("id", id);
  if (error) {
    if (isTableMissingError(error)) {
      lsSaveTemplates(lsLoadTemplates().filter(t => t.id !== id));
      return;
    }
    throw error;
  }
}
