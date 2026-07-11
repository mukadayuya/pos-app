// 勤怠管理（Phase 2-④）

import { supabase } from "./supabase";
import { STORE_ID } from "./db";

export interface StaffMember {
  id: string;
  name: string;
  role: string | null;
  hourly_wage: number;
  color: string | null;
  pin: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  staff_id: string;
  work_date: string;         // YYYY-MM-DD
  clock_in: string;          // ISO
  clock_out: string | null;
  break_min: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ─── スタッフ ──────────────────────────────────────────
export async function fetchActiveStaff(): Promise<StaffMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("staff_members")
    .select("id, name, role, hourly_wage, color, pin, is_active, note, created_at, updated_at")
    .eq("store_id", STORE_ID)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) return [];
  return (data ?? []) as StaffMember[];
}

export async function fetchAllStaff(): Promise<StaffMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("staff_members")
    .select("id, name, role, hourly_wage, color, pin, is_active, note, created_at, updated_at")
    .eq("store_id", STORE_ID)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });
  if (error) return [];
  return (data ?? []) as StaffMember[];
}

export type StaffInput = Omit<StaffMember, "id" | "created_at" | "updated_at">;

export async function createStaff(input: StaffInput): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("staff_members").insert({
    ...input,
    store_id: STORE_ID,
  });
  if (error) throw error;
}

export async function updateStaff(id: string, patch: Partial<StaffInput>): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("staff_members")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ─── 打刻 ──────────────────────────────────────────
export async function fetchOpenEntry(staffId: string): Promise<TimeEntry | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("time_entries")
    .select("id, staff_id, work_date, clock_in, clock_out, break_min, note, created_at, updated_at")
    .eq("store_id", STORE_ID)
    .eq("staff_id", staffId)
    .is("clock_out", null)
    .maybeSingle();
  return (data ?? null) as TimeEntry | null;
}

/** 出勤打刻 */
export async function clockIn(staffId: string): Promise<TimeEntry> {
  if (!supabase) throw new Error("Supabase not configured");
  const now = new Date();
  const workDate = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from("time_entries").insert({
    store_id: STORE_ID,
    staff_id: staffId,
    work_date: workDate,
    clock_in: now.toISOString(),
    break_min: 0,
  }).select().single();
  if (error) throw error;
  return data as TimeEntry;
}

/** 退勤打刻（現在開いているエントリを閉じる） */
export async function clockOut(entryId: string, breakMin: number = 0): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("time_entries").update({
    clock_out: new Date().toISOString(),
    break_min: breakMin,
    updated_at: new Date().toISOString(),
  }).eq("id", entryId);
  if (error) throw error;
}

// ─── 集計 ──────────────────────────────────────────
export interface WorkSummary {
  staff_id: string;
  staff_name: string;
  hourly_wage: number;
  total_minutes: number;      // 実労働時間（休憩除く）
  break_minutes: number;
  days_worked: number;
  estimated_wage: number;     // 概算給与
}

/**
 * 期間内のスタッフ別勤務集計。
 * fromIso/toIso はISO文字列。
 */
export async function computeWorkSummary(fromIso: string, toIso: string): Promise<WorkSummary[]> {
  if (!supabase) return [];
  const [{ data: staff }, { data: entries }] = await Promise.all([
    supabase.from("staff_members")
      .select("id, name, hourly_wage")
      .eq("store_id", STORE_ID),
    supabase.from("time_entries")
      .select("staff_id, work_date, clock_in, clock_out, break_min")
      .eq("store_id", STORE_ID)
      .gte("work_date", fromIso.slice(0, 10))
      .lte("work_date", toIso.slice(0, 10))
      .not("clock_out", "is", null),
  ]);
  const byStaff = new Map<string, WorkSummary>();
  for (const s of (staff ?? []) as { id: string; name: string; hourly_wage: number }[]) {
    byStaff.set(s.id, {
      staff_id: s.id, staff_name: s.name, hourly_wage: s.hourly_wage,
      total_minutes: 0, break_minutes: 0, days_worked: 0, estimated_wage: 0,
    });
  }
  const daysBy = new Map<string, Set<string>>();
  for (const e of (entries ?? []) as { staff_id: string; work_date: string; clock_in: string; clock_out: string; break_min: number }[]) {
    const sum = byStaff.get(e.staff_id);
    if (!sum) continue;
    const workMin = Math.max(0, (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 60000 - (e.break_min ?? 0));
    sum.total_minutes += workMin;
    sum.break_minutes += (e.break_min ?? 0);
    if (!daysBy.has(e.staff_id)) daysBy.set(e.staff_id, new Set());
    daysBy.get(e.staff_id)!.add(e.work_date);
  }
  for (const [staffId, sum] of byStaff) {
    sum.days_worked = daysBy.get(staffId)?.size ?? 0;
    sum.estimated_wage = Math.round(sum.total_minutes / 60 * sum.hourly_wage);
  }
  return Array.from(byStaff.values()).filter(s => s.total_minutes > 0 || s.days_worked > 0)
    .sort((a, b) => b.total_minutes - a.total_minutes);
}
