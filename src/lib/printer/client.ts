// クライアント側の印刷ジョブ投入ヘルパー
// レジ画面のレシートボタン等から呼ぶ。SalesRecordを受け取り、
// /api/print/queue に POST してサーバー側で ESC/POS 生成→ print_jobs 投入させる。

import { supabase } from "@/lib/supabase";
import { STORE_ID } from "@/lib/db";
import { SalesRecord, PaymentMethod } from "@/types/pos";
import type { ReceiptInput, ReceiptLine } from "@/lib/printer/escpos";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash:    "現金",
  card:    "カード",
  voucher: "商品券",
  qr:      "QR決済",
};

/** 店舗に少なくとも1台プリンターが登録されているか */
export async function hasRegisteredPrinter(): Promise<boolean> {
  if (!supabase) return false;
  const { count, error } = await supabase
    .from("printer_devices")
    .select("mac_address", { count: "exact", head: true })
    .eq("store_id", STORE_ID);
  if (error) return false;
  return (count ?? 0) > 0;
}

type StoreInfo = {
  storeName: string;
  storeAddress?: string;
  storeTel?: string;
  storeRegNo?: string;
};

/** SalesRecord をレシート印刷用データに整形 */
function toReceiptInput(record: SalesRecord, store: StoreInfo, tableLabel?: string): ReceiptInput {
  const lines: ReceiptLine[] = record.items.map(it => ({
    name: it.menuItem.name,
    qty: it.quantity,
    unitPriceTaxIncl: Math.round(it.unitPrice * (1 + it.taxRate)),
    taxRate: it.taxRate,
  }));

  const subtotalTaxIncl = lines.reduce((s, l) => s + l.qty * l.unitPriceTaxIncl, 0);
  const discountTaxIncl = Math.max(0, subtotalTaxIncl - record.total);

  // 支払い方法（複数なら最初のもの＋"他"）
  const methodLabels = record.payments.map(p => PAYMENT_LABEL[p.method] ?? p.method);
  const paymentMethod = methodLabels.length === 0
    ? undefined
    : methodLabels.length === 1
      ? methodLabels[0]
      : `${methodLabels[0]} 他`;

  // 現金決済の場合のみ お預り・お釣り・ドロワーキック
  const cashEntry = record.payments.find(p => p.method === "cash");
  const paidAmount = cashEntry?.amount;
  const change = typeof paidAmount === "number" ? Math.max(0, paidAmount - record.total) : undefined;
  const openDrawer = !!cashEntry;

  return {
    storeName: store.storeName,
    storeAddress: store.storeAddress,
    storeTel: store.storeTel,
    storeRegNo: store.storeRegNo,
    createdAt: record.createdAt,
    tableLabel,
    staff: record.staff,
    lines,
    subtotalTaxIncl,
    discountTaxIncl,
    totalTaxIncl: record.total,
    tax8: record.tax8 || undefined,
    tax10: record.tax10 || undefined,
    paidAmount,
    change,
    paymentMethod,
    openDrawer,
    columns: 42,
  };
}

export type EnqueueResult =
  | { ok: true; jobId: string; payloadSize: number }
  | { ok: false; error: string };

/** レシート印刷ジョブを積む。プリンターが登録されている場合のみ効く */
export async function enqueueReceipt(
  record: SalesRecord,
  store: StoreInfo,
  opts?: { tableLabel?: string; kind?: "receipt" | "reprint"; targetMac?: string | null },
): Promise<EnqueueResult> {
  const receipt = toReceiptInput(record, store, opts?.tableLabel);
  try {
    const res = await fetch("/api/print/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: STORE_ID,
        kind: opts?.kind ?? "receipt",
        targetMac: opts?.targetMac ?? null,
        saleId: record.id,
        receipt: {
          ...receipt,
          createdAt: receipt.createdAt.toISOString(),
        },
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => String(res.status));
      return { ok: false, error: msg };
    }
    const json = await res.json() as { jobId: string; payloadSize: number };
    return { ok: true, ...json };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
