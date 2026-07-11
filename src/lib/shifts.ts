// シフト作成（Phase 2-④ 拡張）

import { supabase } from "./supabase";
import { STORE_ID } from "./db";

export type ShiftStatus = "draft" | "confirmed" | "cancelled";

export interface Shift {
  id: string;
  staff_id: string;
  work_date: string;      // YYYY-MM-DD
  start_time: string;     // "17:00"
  end_time: string;       // "23:00"
  role: string | null;
  note: string | null;
  status: ShiftStatus;
  created_at: string;
  updated_at: string;
}

export type ShiftInput = Omit<Shift, "id" | "created_at" | "updated_at">;

/** 週の始まりを月曜として YYYY-MM-DD を返す */
export function weekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=日, 1=月, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD を n 日進めた文字列を返す */
export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00+09:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 指定週(月曜〜日曜)のシフト一覧を取得 */
export async function fetchWeekShifts(mondayIso: string): Promise<Shift[]> {
  if (!supabase) return [];
  const sundayIso = addDaysIso(mondayIso, 6);
  const { data, error } = await supabase
    .from("shifts")
    .select("id, staff_id, work_date, start_time, end_time, role, note, status, created_at, updated_at")
    .eq("store_id", STORE_ID)
    .gte("work_date", mondayIso)
    .lte("work_date", sundayIso)
    .order("work_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) return [];
  return (data ?? []) as Shift[];
}

/** シフト upsert（同一staff+同日で置換） */
export async function upsertShift(input: ShiftInput): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("shifts")
    .upsert({
      ...input,
      store_id: STORE_ID,
      updated_at: new Date().toISOString(),
    }, { onConflict: "store_id,staff_id,work_date" });
  if (error) throw error;
}

/** シフト削除 */
export async function deleteShift(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) throw error;
}

/** 先週のシフトを今週にコピー */
export async function copyPreviousWeek(
  currentMondayIso: string,
): Promise<{ copied: number; skipped: number }> {
  if (!supabase) throw new Error("Supabase not configured");
  const prevMonday = addDaysIso(currentMondayIso, -7);
  const prevShifts = await fetchWeekShifts(prevMonday);
  const currentShifts = await fetchWeekShifts(currentMondayIso);

  // 今週に既にあるシフトはスキップ（重複防止）
  const existingSet = new Set(currentShifts.map(s => `${s.staff_id}::${s.work_date}`));

  let copied = 0, skipped = 0;
  for (const s of prevShifts) {
    const newDate = addDaysIso(s.work_date, 7);
    if (existingSet.has(`${s.staff_id}::${newDate}`)) { skipped++; continue; }
    try {
      await upsertShift({
        staff_id: s.staff_id, work_date: newDate,
        start_time: s.start_time, end_time: s.end_time,
        role: s.role, note: s.note, status: s.status,
      });
      copied++;
    } catch { skipped++; }
  }
  return { copied, skipped };
}
