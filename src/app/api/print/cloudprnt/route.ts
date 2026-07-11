// Star CloudPRNT エンドポイント
// プリンター（Star mPOP等）が定期HTTPポーリングしてジョブを引き取る仕組み。
// ブラウザからは直接叩かず、レジ画面は /api/print/queue にジョブを積むだけ。
//
// プロトコル概要（Star公式仕様に準拠）:
//   POST  → プリンターの状態通知＋ジョブ有無問い合わせ
//     req  {printerMAC, statusCode, statusMessage, printingInProgress}
//     res  {jobReady:true, mediaTypes:["application/vnd.star.starprnt"], jobToken:"..."}
//          または {jobReady:false}
//   GET   → ジョブ本体（バイト列）を取得
//     query: mac, token
//     res:   Content-Type application/vnd.star.starprnt / raw bytes
//   DELETE → 印刷完了報告（引き取ったジョブを "done" にする）
//     query: mac, token, code, message
//
// セキュリティ:
//  - プリンター側は認証機構が弱いため、MAC照合＋登録済みプリンターのみ許可。
//  - PRINTER_ACCESS_TOKEN 環境変数を設定すると、クエリ ?t=<token> チェックを強制する。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase_admin";
import { normalizePrinterMac } from "@/lib/printer/mac";

const ACCESS_TOKEN = process.env.PRINTER_ACCESS_TOKEN ?? "";

function unauthorized(msg: string) {
  return NextResponse.json({ jobReady: false, error: msg }, { status: 401 });
}

function tokenOK(req: NextRequest): boolean {
  if (!ACCESS_TOKEN) return true; // 未設定なら省略（初期セットアップ時のみ）
  const q = req.nextUrl.searchParams.get("t");
  return q === ACCESS_TOKEN;
}

// MAC → 登録店舗の解決。未登録プリンターは最終的に store_id null 扱い（ジョブなし応答）
async function resolvePrinter(mac: string) {
  if (!mac) return null;
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("printer_devices")
    .select("mac_address, store_id, name")
    .eq("mac_address", mac)
    .maybeSingle();
  return data ?? null;
}

async function touchPrinterStatus(mac: string, statusMsg: string) {
  if (!mac) return;
  const sb = getSupabaseAdmin();
  // 存在すればステータス更新、未登録なら "unregistered" として1行だけ差し込んで
  // 管理画面で店舗に紐づけできるようにする（store_id は暫定で NULL 不可なので入れない）
  await sb
    .from("printer_devices")
    .update({ status_msg: statusMsg, last_seen_at: new Date().toISOString() })
    .eq("mac_address", mac);
}

// ─── POST: 状態通知 → ジョブ有無 ─────────────────────────────
export async function POST(req: NextRequest) {
  if (!tokenOK(req)) return unauthorized("bad token");

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* プリンターは JSON でない場合もあるため無視 */ }

  const macRaw =
    (typeof body.printerMAC === "string" && body.printerMAC) ||
    req.nextUrl.searchParams.get("mac") ||
    "";
  const mac = normalizePrinterMac(macRaw);
  const statusMsg = typeof body.statusMessage === "string" ? body.statusMessage : "";

  await touchPrinterStatus(mac, statusMsg);

  const printer = await resolvePrinter(mac);
  if (!printer) {
    // 未登録プリンター: ジョブなし応答（管理画面で登録するまで印刷しない）
    return NextResponse.json({ jobReady: false });
  }

  const sb = getSupabaseAdmin();
  const { data: job } = await sb
    .from("print_jobs")
    .select("id, content_type")
    .eq("store_id", printer.store_id)
    .eq("status", "queued")
    .or(`target_mac.is.null,target_mac.eq.${mac}`)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!job) return NextResponse.json({ jobReady: false });

  return NextResponse.json({
    jobReady: true,
    mediaTypes: [job.content_type ?? "application/vnd.star.starprnt"],
    jobToken: job.id, // GET/DELETE で参照させる
  });
}

// ─── GET: ジョブ本体（バイト列）を返す ───────────────────────
export async function GET(req: NextRequest) {
  if (!tokenOK(req)) return unauthorized("bad token");

  const mac = normalizePrinterMac(req.nextUrl.searchParams.get("mac"));
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const printer = await resolvePrinter(mac);
  if (!printer) return new NextResponse(null, { status: 404 });

  const sb = getSupabaseAdmin();
  // token 指定があれば ID 一致で、なければ先頭ジョブ
  const query = sb
    .from("print_jobs")
    .select("id, payload_b64, content_type, target_mac")
    .eq("store_id", printer.store_id)
    .eq("status", "queued")
    .gt("expires_at", new Date().toISOString());

  const { data: rows } = token
    ? await query.eq("id", token).limit(1)
    : await query.or(`target_mac.is.null,target_mac.eq.${mac}`)
        .order("created_at", { ascending: true }).limit(1);

  const job = rows?.[0];
  if (!job) return new NextResponse(null, { status: 404 });

  await sb.from("print_jobs")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      delivered_mac: mac,
    })
    .eq("id", job.id)
    .eq("status", "queued"); // 二重配布防止

  const bytes = Buffer.from(job.payload_b64, "base64");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": job.content_type || "application/vnd.star.starprnt",
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
    },
  });
}

// ─── DELETE: 印刷完了報告 ────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!tokenOK(req)) return unauthorized("bad token");

  const mac = normalizePrinterMac(req.nextUrl.searchParams.get("mac"));
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const message = req.nextUrl.searchParams.get("message") ?? "";

  if (!token) return new NextResponse(null, { status: 400 });

  const sb = getSupabaseAdmin();
  const isError = code && code !== "200";
  await sb.from("print_jobs")
    .update({
      status: isError ? "error" : "done",
      done_at: new Date().toISOString(),
      error_msg: isError ? `${code}: ${message}` : null,
      delivered_mac: mac || null,
    })
    .eq("id", token);

  return new NextResponse(null, { status: 200 });
}
