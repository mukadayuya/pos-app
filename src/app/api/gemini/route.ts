export const dynamic = "force-dynamic";

// ─── AI APIプロキシ (OpenRouter優先、Gemini直結フォールバック) ──────────────
// 環境変数:
//   OPENROUTER_API_KEY=sk-or-v1-...  ← 優先
//   GEMINI_API_KEY=AIza...           ← 最終フォールバック

import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const GEMINI_API_KEY     = process.env.GEMINI_API_KEY ?? "";

const MODEL_CASCADE = [
  "google/gemini-2.0-flash-001",
  "anthropic/claude-3.5-haiku",
  "google/gemini-flash-1.5",
  "openai/gpt-4o-mini",
] as const;

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

// markdownコードブロックと装飾を除去してプレーンテキストに
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")   // コードブロック除去
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1)) // インラインコード
    .replace(/\*\*(.*?)\*\*/g, "$1")  // bold
    .replace(/\*(.*?)\*/g, "$1")      // italic
    .replace(/^#{1,6}\s+/gm, "")      // 見出し
    .replace(/^\s*[-*+]\s+/gm, "• ")  // リスト
    .replace(/\n{3,}/g, "\n\n")       // 連続改行を整理
    .trim();
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
      lang?: "ja" | "en" | "zh" | "ko";
    };

type SuccessResponse = { ok: true; result: string };
type ErrorResponse   = { ok: false; error: string };
type ApiResponse     = SuccessResponse | ErrorResponse;

// ── OpenRouter (OpenAI互換) — 単一モデル呼び出し ─────────────
async function callOpenRouterModel(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  model: string,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer":  "https://pos-app.vercel.app",
        "X-Title":       "FLOWS POS",
      },
      body: JSON.stringify({ model, messages, max_tokens: 1024 }),
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      if (isEndpointError(res.status, text)) {
        throw new EndpointError(`model unavailable: ${model} (${res.status})`);
      }
      throw new Error(`OpenRouter エラー ${res.status}`);
    }

    const data = JSON.parse(text) as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("応答が空でした");
    return stripMarkdown(content);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new EndpointError(`timeout: ${model}`);
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

class EndpointError extends Error {}

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
      if (e instanceof EndpointError) continue;
      throw e;
    }
  }
  throw lastErr;
}

// ── Gemini直結フォールバック ──────────────────────────────────
// system_instruction を使い、マークダウン出力を禁止する

type GeminiPart    = { text: string };
type GeminiContent = { parts: GeminiPart[]; role: string };
type GeminiApiResponse = {
  candidates: Array<{
    content?: GeminiContent;
    finishReason?: string;
  }>;
  error?: { message: string };
};

async function callGeminiFallback(
  systemPrompt: string,
  contents: GeminiContent[],
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const noMarkdownInstruction =
    "\n\nIMPORTANT: Reply in plain conversational text only. " +
    "Do NOT use markdown, code blocks, backticks, asterisks, or any special formatting. " +
    "Keep responses under 150 words.";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt + noMarkdownInstruction }],
        },
        contents,
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0.7,
        },
      }),
      signal: controller.signal,
    });

    const data = (await res.json()) as GeminiApiResponse;

    if (!res.ok || data.error) {
      throw new Error("AIサービスに接続できませんでした");
    }

    const text = data.candidates[0]?.content?.parts[0]?.text;
    if (!text) throw new Error("応答が空でした");
    return stripMarkdown(text);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("接続がタイムアウトしました");
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── POST ハンドラ ─────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const useOpenRouter = Boolean(OPENROUTER_API_KEY);
  const useGemini     = Boolean(GEMINI_API_KEY);

  if (!useOpenRouter && !useGemini) {
    return NextResponse.json(
      { ok: false, error: "AIサービスが設定されていません。" } satisfies ErrorResponse,
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

  const preferredModel = body.model;

  try {
    // ── translate ─────────────────────────────────────────────
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
        result = await callGeminiFallback("You are a professional translator.", [
          { role: "user", parts: [{ text: prompt }] },
        ]);
      }
      return NextResponse.json({ ok: true, result } satisfies SuccessResponse);
    }

    // ── chat ──────────────────────────────────────────────────
    if (body.action === "chat") {
      const langNames: Record<string, string> = {
        ja: "Japanese", en: "English", zh: "Simplified Chinese", ko: "Korean",
      };
      const replyLang = body.lang ? langNames[body.lang] ?? "Japanese" : null;
      const langInstruction = replyLang
        ? `IMPORTANT: Always reply in ${replyLang}, regardless of the language of the customer's message.`
        : "Detect the customer's language from their message and reply in that same language.";
      const systemPrompt = [
        "You are a friendly restaurant concierge for FLOWS, a Japanese restaurant.",
        langInstruction,
        "Answer questions about menu items, ingredients, allergens, and dining experience.",
        "Be warm, concise, and helpful.",
        body.menuContext ? `Customer's cart: ${body.menuContext}` : "",
        body.itemContext ? `Focused item: ${body.itemContext}` : "",
      ].filter(Boolean).join("\n");

      let result: string;

      if (useOpenRouter) {
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemPrompt + "\n\nReply in plain text only. No markdown, no code blocks." },
          ...(body.conversationHistory ?? []).map(turn => ({
            role: (turn.role === "model" ? "assistant" : "user") as "user" | "assistant",
            content: turn.content,
          })),
          { role: "user", content: body.message },
        ];
        result = await callOpenRouter(messages, preferredModel);
      } else {
        const contents: GeminiContent[] = [
          ...(body.conversationHistory ?? []).map(turn => ({
            role: turn.role,
            parts: [{ text: turn.content }],
          })),
          { role: "user", parts: [{ text: body.message }] },
        ];
        result = await callGeminiFallback(systemPrompt, contents);
      }

      return NextResponse.json({ ok: true, result } satisfies SuccessResponse);
    }

    return NextResponse.json(
      { ok: false, error: "不明な action です" } satisfies ErrorResponse,
      { status: 400 },
    );
  } catch (e) {
    const msg = (e as Error).message;
    // 技術的なエラー文をユーザー向けメッセージに変換
    const userMsg = msg.includes("timeout") || msg.includes("タイムアウト")
      ? "接続がタイムアウトしました。もう一度お試しください。"
      : msg.includes("接続") || msg.includes("AI")
        ? msg
        : "少し時間をおいてお試しください。";
    return NextResponse.json(
      { ok: false, error: userMsg } satisfies ErrorResponse,
      { status: 502 },
    );
  }
}
