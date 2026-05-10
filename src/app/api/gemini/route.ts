// ─── AI APIプロキシ (OpenRouter優先、Gemini直結フォールバック) ──────────────
// 環境変数:
//   OPENROUTER_API_KEY=sk-or-v1-...  ← 優先
//   GEMINI_API_KEY=AIza...           ← 最終フォールバック

import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const GEMINI_API_KEY     = process.env.GEMINI_API_KEY ?? "";

// モデルカスケード: 上から順に試み、エンドポイント不在/廃止なら次へ
const MODEL_CASCADE = [
  "google/gemini-2.0-flash-001",   // 安定版・低コスト
  "anthropic/claude-3.5-haiku",    // 高速・低コスト
  "google/gemini-flash-1.5",       // 旧安定版フォールバック
  "openai/gpt-4o-mini",            // 最終OpenRouterフォールバック
] as const;

// 「エンドポイント不在」系エラーかどうかを判定
function isEndpointError(status: number, body: string): boolean {
  if (status === 404) return true;
  const lower = body.toLowerCase();
  return (
    lower.includes("no endpoints found") ||
    lower.includes("model not found") ||
    lower.includes("provider returned error") ||
    lower.includes("does not exist")
  );
}

// ── 型定義 ────────────────────────────────────────────────────

type ConversationTurn = {
  role: "user" | "model";
  content: string;
};

type RequestBody =
  | {
      action: "translate";
      text: string;
      targetLang: "en" | "zh" | "ko" | "ja";
      model?: string;
    }
  | {
      action: "chat";
      message: string;
      menuContext?: string;
      itemContext?: string;
      conversationHistory?: ConversationTurn[];
      model?: string;
    };

type SuccessResponse = { ok: true; result: string };
type ErrorResponse   = { ok: false; error: string };
type ApiResponse     = SuccessResponse | ErrorResponse;

// ── OpenRouter (OpenAI互換) — 単一モデル呼び出し ─────────────

async function callOpenRouterModel(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  model: string,
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer":  "https://pos-app.vercel.app",
      "X-Title":       "FLOWS POS",
    },
    body: JSON.stringify({ model, messages, max_tokens: 1024 }),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    if (isEndpointError(res.status, text)) {
      throw new EndpointError(`model unavailable: ${model} (${res.status})`);
    }
    throw new Error(`OpenRouter エラー ${res.status}: ${text}`);
  }

  const data = JSON.parse(text) as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("OpenRouter レスポンスにテキストがありません");
  return content;
}

// エンドポイント廃止を示す専用エラークラス
class EndpointError extends Error {}

// ── OpenRouter — カスケードフォールバック ────────────────────

async function callOpenRouter(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  preferredModel?: string,
): Promise<string> {
  const queue = preferredModel
    ? [preferredModel, ...MODEL_CASCADE.filter(m => m !== preferredModel)]
    : [...MODEL_CASCADE];

  let lastErr: Error = new Error("No models available");
  for (const model of queue) {
    try {
      return await callOpenRouterModel(messages, model);
    } catch (e) {
      lastErr = e as Error;
      if (e instanceof EndpointError) continue; // 次のモデルへ
      throw e;                                   // 認証エラー等は即座に上位へ
    }
  }
  throw lastErr;
}

// ── Gemini直結フォールバック ──────────────────────────────────

type GeminiContent = { parts: Array<{ text: string }>; role: string };
type GeminiApiResponse = { candidates: Array<{ content: GeminiContent }> };

async function callGeminiFallback(contents: GeminiContent[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini API エラー ${res.status}: ${text}`);
  }
  const data = (await res.json()) as GeminiApiResponse;
  const text = data.candidates[0]?.content?.parts[0]?.text;
  if (!text) throw new Error("Gemini レスポンスにテキストがありません");
  return text;
}

// ── POST ハンドラ ─────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const useOpenRouter = Boolean(OPENROUTER_API_KEY);
  const useGemini     = Boolean(GEMINI_API_KEY);

  if (!useOpenRouter && !useGemini) {
    return NextResponse.json(
      { ok: false, error: "OPENROUTER_API_KEY または GEMINI_API_KEY を設定してください。" } satisfies ErrorResponse,
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  const preferredModel = body.model; // undefined なら CASCADE の先頭から

  try {
    // ── translate ────────────────────────────────────────────
    if (body.action === "translate") {
      const langNames: Record<string, string> = {
        en: "English", zh: "Chinese (Simplified)", ko: "Korean", ja: "Japanese",
      };
      const targetName = langNames[body.targetLang] ?? body.targetLang;
      const prompt = `Translate the following text to ${targetName}. Output only the translated text, nothing else.\n\nText: ${body.text}`;

      let result: string;
      if (useOpenRouter) {
        result = await callOpenRouter([{ role: "user", content: prompt }], preferredModel);
      } else {
        result = await callGeminiFallback([{ role: "user", parts: [{ text: prompt }] }]);
      }
      return NextResponse.json({ ok: true, result } satisfies SuccessResponse);
    }

    // ── chat ─────────────────────────────────────────────────
    if (body.action === "chat") {
      const systemPrompt = [
        "You are a friendly restaurant concierge for FLOWS, a Japanese restaurant by Infotainment.",
        "Help customers in their own language. Answer questions about menu items, ingredients, allergens, and dining experience.",
        "Be warm, concise (under 150 words), and helpful.",
        body.menuContext ? `\nMenu context:\n${body.menuContext}` : "",
        body.itemContext ? `\nFocused item:\n${body.itemContext}` : "",
      ].filter(Boolean).join("\n");

      let result: string;

      if (useOpenRouter) {
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemPrompt },
          ...(body.conversationHistory ?? []).map(t => ({
            role: (t.role === "model" ? "assistant" : "user") as "user" | "assistant",
            content: t.content,
          })),
          { role: "user", content: body.message },
        ];
        result = await callOpenRouter(messages, preferredModel);
      } else {
        const contents: GeminiContent[] = [
          { role: "user",  parts: [{ text: `[System]: ${systemPrompt}` }] },
          { role: "model", parts: [{ text: "Understood." }] },
          ...(body.conversationHistory ?? []).map(t => ({
            role: t.role,
            parts: [{ text: t.content }],
          })),
          { role: "user", parts: [{ text: body.message }] },
        ];
        result = await callGeminiFallback(contents);
      }
      return NextResponse.json({ ok: true, result } satisfies SuccessResponse);
    }

    return NextResponse.json(
      { ok: false, error: "不明な action です" } satisfies ErrorResponse,
      { status: 400 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message } satisfies ErrorResponse,
      { status: 502 },
    );
  }
}
