import { supabase } from "./supabase";

function isTableMissing(err: { code?: string; message?: string }): boolean {
  const msg = err.message?.toLowerCase() ?? "";
  return (
    err.code === "42P01" ||
    err.code === "PGRST116" ||
    msg.includes("does not exist") ||
    msg.includes("no such table") ||
    msg.includes("could not find")
  );
}

// ─── Types ────────────────────────────────────────────────────
export type StorePlan = "standard" | "pro" | "enterprise";
export type AlertFlag = "sales_drop" | "employee_increase";

export interface StoreRecord {
  id: string;
  name: string;
  location: string | null;
  plan: StorePlan;
  is_active: boolean;
  created_at: string;
}

export interface MonthSales {
  month: string;   // "2026-04"
  label: string;   // "4月"
  total: number;
  count: number;
}

export interface StoreDashboardItem extends StoreRecord {
  monthlySales: MonthSales[];     // [oldest, mid, current]
  employeeCount: number;
  newHiresThisMonth: number;
  alerts: AlertFlag[];
}

// ─── Helpers ──────────────────────────────────────────────────
function buildThreeMonths(): { month: string; label: string }[] {
  const now = new Date();
  return [2, 1, 0].reverse().map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { month, label: `${d.getMonth() + 1}月` };
  });
}

// ─── fetchDefaultStoreId ──────────────────────────────────────
// 最初に登録された店舗（Kitchen Kazu）の ID を返す。
// stores テーブルが存在しない場合は null を返し、呼び出し元は全データを対象にする。
export async function fetchDefaultStoreId(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (error) return null;
  return (data as { id: string } | null)?.id ?? null;
}

// ─── fetchStoreList ───────────────────────────────────────────
export async function fetchStoreList(): Promise<StoreRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, location, plan, is_active, created_at")
    .order("created_at", { ascending: true });
  if (error) {
    if (isTableMissing(error)) return [];
    throw error;
  }
  return (data ?? []) as StoreRecord[];
}

// ─── fetchStoreDashboard ──────────────────────────────────────
export async function fetchStoreDashboard(): Promise<StoreDashboardItem[]> {
  if (!supabase) return [];

  const stores = await fetchStoreList();
  if (stores.length === 0) return [];

  const months = buildThreeMonths();

  // Sales for the last 3 months (all stores in one query)
  const sinceMonth = months[0].month;
  const sinceDate = `${sinceMonth}-01T00:00:00.000Z`;

  const { data: salesRaw, error: salesErr } = await supabase
    .from("sales")
    .select("total_amount, created_at, store_id")
    .gte("created_at", sinceDate)
    .limit(20000);

  if (salesErr && !isTableMissing(salesErr)) throw salesErr;
  const sales = salesRaw ?? [];

  // Employee rows per store (optional table)
  type EmpRow = { store_id: string | null; joined_at: string | null; created_at: string };
  let empRows: EmpRow[] = [];
  const { data: empRaw, error: empErr } = await supabase
    .from("employees")
    .select("store_id, joined_at, created_at");
  if (!empErr && !isTableMissing(empErr ?? {})) {
    empRows = (empRaw ?? []) as EmpRow[];
  }

  // NULL store_id sales belong to the first registered store (Kitchen Kazu)
  const defaultStoreId = stores[0].id;
  const currentMonth = months[2].month;

  return stores.map(store => {
    const isDefault = store.id === defaultStoreId;

    const storeSales = sales.filter(s =>
      s.store_id === store.id || (isDefault && s.store_id === null)
    );

    const monthlySales: MonthSales[] = months.map(({ month, label }) => {
      const rows = storeSales.filter(s => s.created_at.slice(0, 7) === month);
      return {
        month,
        label,
        total: rows.reduce((sum, s) => sum + (s.total_amount ?? 0), 0),
        count: rows.length,
      };
    });

    const storeEmps = empRows.filter(e =>
      e.store_id === store.id || (isDefault && e.store_id === null)
    );
    const employeeCount = storeEmps.length;
    const newHiresThisMonth = storeEmps.filter(e => {
      const joinedMonth = e.joined_at?.slice(0, 7) ?? e.created_at?.slice(0, 7);
      return joinedMonth === currentMonth;
    }).length;

    const alerts: AlertFlag[] = [];
    const cur = monthlySales[2];
    const prev = monthlySales[1];
    if (prev.total > 0 && cur.total < prev.total * 0.95) {
      alerts.push("sales_drop");
    }
    if (newHiresThisMonth > 0) {
      alerts.push("employee_increase");
    }

    return { ...store, monthlySales, employeeCount, newHiresThisMonth, alerts };
  });
}
