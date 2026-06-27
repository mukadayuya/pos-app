// 未送信売上キュー
//
// saveSaleRecord が自動リトライ後も失敗した売上を localStorage に退避し、
// 通信回復時（online イベント・レジ画面マウント時）に再送する。
// アプリを閉じても売上データが消えないことを保証するのが目的。

import { SalesRecord } from "@/types/pos";

export const UNSENT_SALES_KEY = "pos_unsent_sales_v1";

// 異常肥大の保険。通常運用で到達することはない（1件=会計1回分）
const MAX_QUEUE_LENGTH = 500;

type SerializedSalesRecord = Omit<SalesRecord, "createdAt"> & { createdAt: string };

// テストから注入できるよう Storage 互換の最小型を受け取る
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function serializeRecord(record: SalesRecord): SerializedSalesRecord {
  return { ...record, createdAt: record.createdAt.toISOString() };
}

export function deserializeRecord(s: SerializedSalesRecord): SalesRecord {
  return { ...s, createdAt: new Date(s.createdAt) };
}

export function loadQueue(storage: StorageLike | null = defaultStorage()): SalesRecord[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(UNSENT_SALES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as SerializedSalesRecord[]).map(deserializeRecord);
  } catch {
    return [];
  }
}

function saveQueue(records: SalesRecord[], storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.setItem(UNSENT_SALES_KEY, JSON.stringify(records.map(serializeRecord)));
  } catch {
    // localStorage 満杯等。ここで例外を投げると会計フローが止まるため握りつぶす
  }
}

/** キューに追加して新しいキュー長を返す。同一IDは重複追加しない */
export function enqueueUnsentSale(
  record: SalesRecord,
  storage: StorageLike | null = defaultStorage(),
): number {
  const queue = loadQueue(storage);
  if (!queue.some(r => r.id === record.id)) {
    queue.push(record);
    if (queue.length > MAX_QUEUE_LENGTH) queue.shift();
    saveQueue(queue, storage);
  }
  return queue.length;
}

export function queueLength(storage: StorageLike | null = defaultStorage()): number {
  return loadQueue(storage).length;
}

/** 主キー重複（= 実は保存済み）かどうか */
export function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "23505" || (e.message ?? "").toLowerCase().includes("duplicate key");
}

export interface FlushResult {
  sent: number;
  remaining: number;
}

/**
 * キュー内の売上を順に再送する。
 * - 成功 or 主キー重複（保存済み）→ キューから除去
 * - それ以外の失敗 → そこで中断（通信断のまま全件試すのを避ける）
 */
export async function flushUnsentSales(
  send: (record: SalesRecord) => Promise<void>,
  storage: StorageLike | null = defaultStorage(),
): Promise<FlushResult> {
  const queue = loadQueue(storage);
  let sent = 0;

  for (const record of [...queue]) {
    try {
      await send(record);
      sent++;
    } catch (err) {
      if (!isDuplicateKeyError(err)) break;
      // 重複 = 前回送信が実は成功していた。除去対象として扱う
    }
    queue.shift();
    saveQueue(queue, storage);
  }

  return { sent, remaining: queue.length };
}
