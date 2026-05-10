// ─── Gemini API プロキシ ──────────────────────────────────────
// 目的: APIキーをブラウザに露出させずに Gemini を呼び出す。
//
// 環境変数（.env.local に設定）:
//   GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxx

import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ── 型定義 ────────────────────────────────────────────────────

type ConversationTurn = {
  role: "user" | "model";
  content: string;
};

type GeminiRequestBody =
  | {
      action: "translate";
      text: string;
      targetLang: "en" | "zh" | "ko" | "ja";
    }
  | {
      action: "chat";
      message: string;
      menuContext?: string;
      conversationHistory?: ConversationTurn[];
    };

type GeminiSuccessResponse = { ok: true; result: string };
type GeminiErrorResponse   = { ok: false; error: string };
type GeminiResponse        = GeminiSuccessResponse | GeminiErrorResponse;

// Gemini REST API のレスポンス型（必要最小限）
type GeminiApiContent = {
  parts: Array<{ text: string }>;
  role: string;
};
type GeminiApiResponse = {
  candidates: Array<{
    content: GeminiApiContent;
  }>;
};

// ── ヘルパー: Gemini REST API を呼び出す ─────────────────────

async function callGemini(contents: GeminiApiContent[]): Promise<string> {
  const url = `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`;

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
  if (text === undefined) throw new Error("Gemini レスポンスにテキストがありません");
  return text;
}

// ── POST ハンドラ ─────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<GeminiResponse>> {
  // ── 設定チェック ──────────────────────────────────────────
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "GEMINI_API_KEY が未設定です。.env.local を確認してください。" } satisfies GeminiErrorResponse,
      { status: 503 },
    );
  }

  // ── リクエスト解析 ────────────────────────────────────────
  let body: GeminiRequestBody;
  try {
    body = (await req.json()) as GeminiRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" } satisfies GeminiErrorResponse,
      { status: 400 },
    );
  }

  try {
    // ── translate ────────────────────────────────────────────
    if (body.action === "translate") {
      const langNames: Record<string, string> = {
        en: "English",
        zh: "Chinese (Simplified)",
        ko: "Korean",
        ja: "Japanese",
      };
      const targetName = langNames[body.targetLang] ?? body.targetLang;

      const contents: GeminiApiContent[] = [
        {
          role: "user",
          parts: [
            {
              text: `Translate the following text to ${targetName}. Output only the translated text, nothing else.\n\nText: ${body.text}`,
            },
          ],
        },
      ];

      const result = await callGemini(contents);
      return NextResponse.json({ ok: true, result } satisfies GeminiSuccessResponse);
    }

    // ── chat ─────────────────────────────────────────────────
    if (body.action === "chat") {
      const systemInstruction = `You are a friendly restaurant assistant for FLOWS, a Japanese restaurant by Infotainment.
Your role is to help customers in their own language, answer questions about the menu, ingredients, allergens, and dining experience.
Be warm, concise, and helpful. If asked about prices or menu items, refer to the menu context provided.
Always respond in the same language the customer uses.
${body.menuContext ? `\nCurrent menu context:\n${body.menuContext}` : ""}`;

      // 会話履歴を Gemini の contents 形式に変換
      const history: GeminiApiContent[] = (body.conversationHistory ?? []).map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.content }],
      }));

      // システムプロンプトを最初のユーザーターンに埋め込む（Gemini REST は systemInstruction をサポート）
      const contents: GeminiApiContent[] = [
        // システム指示を model の先頭ターンとして注入
        {
          role: "user",
          parts: [{ text: `[System instruction - follow these throughout the conversation]: ${systemInstruction}` }],
        },
        {
          role: "model",
          parts: [{ text: "Understood. I'm ready to assist customers at FLOWS restaurant." }],
        },
        ...history,
        {
          role: "user",
          parts: [{ text: body.message }],
        },
      ];

      const result = await callGemini(contents);
      return NextResponse.json({ ok: true, result } satisfies GeminiSuccessResponse);
    }

    return NextResponse.json(
      { ok: false, error: "不明な action です" } satisfies GeminiErrorResponse,
      { status: 400 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message } satisfies GeminiErrorResponse,
      { status: 502 },
    );
  }
}
