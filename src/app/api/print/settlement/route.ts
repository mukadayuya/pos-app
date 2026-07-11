// X/Zレポートをプリンターへ送るRoute Handler
// クライアントから SettlementReportInput を受け取り、サーバー側で
// ESC/POS生成 → print_jobs 投入 → CloudPRNTが引き取って印刷。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase_admin";
import { buildSettlementReport, toBase64, type SettlementReportInput } from "@/lib/printer/escpos";
import { normalizePrinterMac } from "@/lib/printer/mac";

type QueueRequest = {
  storeId: string;
  targetMac?: string | null;
  reportId?: string | null;         // daily_reports.id（Zレポートで印刷履歴を紐付ける場合）
  report: SettlementReportInput;
};

export async function POST(req: NextRequest) {
  let body: QueueRequest;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  if (!body.storeId || !body.report) {
    return NextResponse.json({ error: "storeId and report required" }, { status: 400 });
  }

  const report: SettlementReportInput = {
    ...body.report,
    reportDate: new Date(body.report.reportDate as unknown as string),
    createdAt:  new Date(body.report.createdAt  as unknown as string),
    from:       new Date(body.report.from       as unknown as string),
    to:         new Date(body.report.to         as unknown as string),
  };

  let bytes: Uint8Array;
  try {
    bytes = buildSettlementReport(report);
  } catch (err) {
    return NextResponse.json({ error: `report build failed: ${(err as Error).message}` }, { status: 500 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("print_jobs").insert({
    store_id:     body.storeId,
    target_mac:   normalizePrinterMac(body.targetMac ?? null) || null,
    kind:         report.kind === "X" ? "x_report" : "z_report",
    content_type: "application/vnd.star.starprnt",
    payload_b64:  toBase64(bytes),
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 印刷履歴があれば printed_at をタッチ
  if (body.reportId) {
    await sb.from("daily_reports")
      .update({ printed_at: new Date().toISOString() })
      .eq("id", body.reportId);
  }

  return NextResponse.json({ jobId: data!.id, payloadSize: bytes.length });
}
