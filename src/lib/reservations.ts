// 予約・取り置き（Phase 1-⑪）

import { supabase } from "./supabase";
import { STORE_ID } from "./db";

export type ReservationStatus =
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Reservation {
  id: string;
  reserved_at: string;
  customer_name: string;
  phone: string | null;
  party_size: number;
  table_pref: string | null;
  course_name: string | null;
  course_price: number | null;
  deposit: number;
  status: ReservationStatus;
  note: string | null;
  staff: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  confirmed:  "確定",
  checked_in: "来店中",
  completed:  "完了",
  cancelled:  "キャンセル",
  no_show:    "無断キャンセル",
};

export const STATUS_COLOR: Record<ReservationStatus, string> = {
  confirmed:  "bg-blue-100 text-blue-800",
  checked_in: "bg-emerald-100 text-emerald-800",
  completed:  "bg-slate-100 text-slate-500",
  cancelled:  "bg-slate-100 text-slate-400 line-through",
  no_show:    "bg-red-100 text-red-800",
};

export async function fetchReservationsForDay(dateIso: string): Promise<Reservation[]> {
  if (!supabase) return [];
  const fromIso = new Date(`${dateIso}T00:00:00+09:00`).toISOString();
  const toIso   = new Date(new Date(`${dateIso}T00:00:00+09:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("reservations")
    .select("id, reserved_at, customer_name, phone, party_size, table_pref, course_name, course_price, deposit, status, note, staff, created_at, updated_at")
    .eq("store_id", STORE_ID)
    .gte("reserved_at", fromIso)
    .lt("reserved_at", toIso)
    .order("reserved_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as Reservation[];
}

export type ReservationInput = Omit<Reservation, "id" | "created_at" | "updated_at" | "status"> & {
  status?: ReservationStatus;
};

export async function createReservation(input: ReservationInput): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("reservations").insert({
    ...input,
    store_id: STORE_ID,
    status: input.status ?? "confirmed",
  });
  if (error) throw error;
}

export async function updateReservationStatus(id: string, status: ReservationStatus): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("reservations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteReservation(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) throw error;
}
