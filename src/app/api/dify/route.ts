export const dynamic = "force-dynamic";

// ─── Dify API プロキシ ────────────────────────────────────────
// 目的: APIキーをブラウザに露出させずに Dify を呼び出す。
//
// 環境変数（.env.local に設定）:
//   DIFY_API_KEY=app-xxxxxxxxxxxxxxxx   ← Dify アプリの API キー
//   DIFY_BASE_URL=https://api.dify.ai/v1  ← セルフホスト時は変更
//   DIFY_APP_TYPE=workflow                ← workflow | chat | completion

import { NextRequest, NextResponse } from "next/server";
import {
  DifyProxyRequest,
  DifyProxyResponse,
  DifyProxyErrorResponse,
  DifyWorkflowRequest,
  DifyChatRequest,
} from "@/lib/dify";

const DIFY_API_KEY  = process.env.DIFY_API_KEY  ?? "";
const DIFY_BASE_URL = process.env.DIFY_BASE_URL  ?? "https://api.dify.ai/v1";
const DIFY_APP_TYPE = process.env.DIFY_APP_TYPE  ?? "workflow";

function endpointFor(appType: string): string {
  if (appType === "chat")       return `${DIFY_BASE_URL}/chat-messages`;
  if (appType === "completion") return `${DIFY_BASE_URL}/completion-messages`;
  return `${DIFY_BASE_URL}/workflows/run`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 設定チェック ──────────────────────────────────────────
  if (!DIFY_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "DIFY_API_KEY が未設定です。.env.local を確認してください。" } satisfies DifyProxyErrorResponse,
      { status: 503 },
    );
  }

  // ── リクエスト解析 ────────────────────────────────────────
  let body: DifyProxyRequest;
  try {
    body = await req.json() as DifyProxyRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" } satisfies DifyProxyErrorResponse,
      { status: 400 },
    );
  }

  const appType = body.appType ?? DIFY_APP_TYPE;
  const user    = body.user ?? "pos-app";

  // ── Dify へのリクエストボディ組み立て ────────────────────
  let difyBody: DifyWorkflowRequest | DifyChatRequest;

  if (appType === "chat") {
    difyBody = {
      inputs:          body.inputs ?? {},
      query:           body.query  ?? "",
      response_mode:   "blocking",
      conversation_id: body.conversationId,
      user,
    } satisfies DifyChatRequest;
  } else {
    // workflow / completion
    difyBody = {
      inputs:        body.inputs ?? {},
      response_mode: "blocking",
      user,
    } satisfies DifyWorkflowRequest;
  }

  // ── Dify API 呼び出し ─────────────────────────────────────
  let difyRes: Response;
  try {
    difyRes = await fetch(endpointFor(appType), {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${DIFY_API_KEY}`,
      },
      body: JSON.stringify(difyBody),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Dify への接続に失敗しました: ${(e as Error).message}` } satisfies DifyProxyErrorResponse,
      { status: 502 },
    );
  }

  if (!difyRes.ok) {
    const text = await difyRes.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: `Dify API エラー ${difyRes.status}: ${text}` } satisfies DifyProxyErrorResponse,
      { status: difyRes.status },
    );
  }

  // ── レスポンス整形 ────────────────────────────────────────
  const raw = await difyRes.json() as Record<string, unknown>;

  // Workflow レスポンスの正規化
  if (appType === "workflow") {
    const data = (raw.data ?? {}) as Record<string, unknown>;
    const outputs = (data.outputs ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      ok:      true,
      appType: "workflow",
      data:    outputs,
      usage:   {
        total_tokens:  (data.total_tokens as number | undefined) ?? 0,
        elapsed_time:  (data.elapsed_time as number | undefined) ?? 0,
      },
    } satisfies DifyProxyResponse);
  }

  // Chat / Completion レスポンスの正規化
  return NextResponse.json({
    ok:      true,
    appType,
    data:    { answer: (raw.answer as string | undefined) ?? "" },
    usage:   {
      total_tokens: ((raw.metadata as Record<string, Record<string, number>> | undefined)?.usage?.total_tokens) ?? 0,
    },
  } satisfies DifyProxyResponse);
}
