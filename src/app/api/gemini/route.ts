// ─── AI APIプロキシ (OpenRouter優先、Gemini直結フォールバック) ──────────────
// 環境変数:
//   OPENROUTER_API_KEY=sk-or-v1-...  ← 優先
//   GEMINI_API_KEY=AIza...           ← フォールバック
// モデル候補 (OpenRouter):
//   google/gemini-2.0-flash-exp:free  (無料)
//   anthropic/claude-3.7-sonnet       (高品質)
//   google/gemini-2.5-pro-exp-03-25:free

import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const GEMINI_API_KEY     = process.env.GEMINI_API_KEY ?? "";
const DEFAULT_MODEL      = "google/gemini-2.0-flash-exp:free";

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

// ── OpenRouter (OpenAI互換) 呼び出し ─────────────────────────

async function callOpenRouter(
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
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter エラー ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("OpenRouter レスポンスにテキストがありません");
  return content;
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

  const model = body.model ?? DEFAULT_MODEL;

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
        result = await callOpenRouter([{ role: "user", content: prompt }], model);
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
        result = await callOpenRouter(messages, model);
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
