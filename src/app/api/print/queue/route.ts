// レジ画面から印刷ジョブを積むための Route Handler。
// クライアントは JSON でレシートデータを送り、サーバー側で ESC/POS 生成→ print_jobs に投入する。
// これにより iconv-lite やバイナリ生成をブラウザバンドルに含めずに済む。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase_admin";
import { buildReceipt, toBase64, type ReceiptInput } from "@/lib/printer/escpos";
import { normalizePrinterMac } from "@/lib/printer/mac";

type QueueRequest = {
  storeId: string;
  kind: "receipt" | "kitchen" | "x_report" | "z_report" | "reprint" | "test";
  targetMac?: string | null;   // 特定プリンター宛にする場合のみ
  saleId?: string;
  receipt: ReceiptInput;       // ReceiptInput（createdAtはISO文字列でOK）
};

export async function POST(req: NextRequest) {
  let body: QueueRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.storeId || !body.receipt) {
    return NextResponse.json({ error: "storeId and receipt required" }, { status: 400 });
  }

  const receipt: ReceiptInput = {
    ...body.receipt,
    createdAt: new Date(body.receipt.createdAt as unknown as string),
  };

  let bytes: Uint8Array;
  try {
    bytes = buildReceipt(receipt);
  } catch (err) {
    return NextResponse.json({ error: `receipt build failed: ${(err as Error).message}` }, { status: 500 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("print_jobs")
    .insert({
      store_id:     body.storeId,
      target_mac:   normalizePrinterMac(body.targetMac ?? null) || null,
      kind:         body.kind,
      content_type: "application/vnd.star.starprnt",
      payload_b64:  toBase64(bytes),
      sale_id:      body.saleId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ jobId: data!.id, payloadSize: bytes.length });
}
