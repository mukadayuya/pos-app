// 進行中注文のクラウドスナップショット
//
// 注文中データは localStorage が一次保存先だが、ブラウザのキャッシュクリアや
// 端末故障で消える。入力から一定間隔で store_settings に退避しておき、
// localStorage が空のときだけ復元する（DDL不要で既存テーブルを利用）。

import { supabase } from "./supabase";
import { STORE_ID } from "./db";
import { OrderItem, OrderDiscount } from "@/types/pos";

const DRAFT_KEY = `draft_order_${STORE_ID}`;

export interface DraftOrder {
  items: OrderItem[];
  maleCount: number;
  femaleCount: number;
  discount: OrderDiscount | null;
  updatedAt: string; // ISO8601
}

export function buildDraft(
  items: OrderItem[],
  maleCount: number,
  femaleCount: number,
  discount: OrderDiscount | null,
): DraftOrder {
  return { items, maleCount, femaleCount, discount, updatedAt: new Date().toISOString() };
}

/** value が DraftOrder として最低限の形をしているか */
export function isValidDraft(value: unknown): value is DraftOrder {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<DraftOrder>;
  return Array.isArray(v.items) && typeof v.updatedAt === "string";
}

// store_settings.key に UNIQUE 制約がない環境でも動くよう
// UPDATE → 0件なら INSERT の2段階で書き込む（storeSettings.ts と同じ方式）
async function upsertDraftValue(value: DraftOrder | null): Promise<void> {
  if (!supabase) return;
  const ts = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabase
    .from("store_settings")
    .update({ value, updated_at: ts })
    .eq("key", DRAFT_KEY)
    .select("key");
  if (updateErr) throw updateErr;

  if (!updated || updated.length === 0) {
    const { error: insertErr } = await supabase
      .from("store_settings")
      .insert({ key: DRAFT_KEY, value, updated_at: ts });
    if (insertErr) throw insertErr;
  }
}

/** 進行中注文をクラウドへ退避する。失敗しても呼び出し元の操作は止めない */
export async function persistDraftOrder(draft: DraftOrder): Promise<void> {
  try {
    await upsertDraftValue(draft);
  } catch (e) {
    console.warn("[draftOrderSync] 退避失敗（次回の変更で再試行）:", e);
  }
}

/** 会計完了・注文クリア時に呼ぶ */
export async function clearDraftOrder(): Promise<void> {
  try {
    await upsertDraftValue(null);
  } catch (e) {
    console.warn("[draftOrderSync] クリア失敗:", e);
  }
}

/** クラウド上のスナップショットを取得。なければ null */
export async function fetchDraftOrder(): Promise<DraftOrder | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", DRAFT_KEY)
      .maybeSingle();
    if (error || !data) return null;
    return isValidDraft(data.value) ? data.value : null;
  } catch {
    return null;
  }
}
