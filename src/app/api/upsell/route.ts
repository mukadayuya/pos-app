export const dynamic = "force-dynamic";

// ─── AI プロアクティブ・アップセル API ──────────────────────────
// カート内容を分析し、ペアリング提案 + 補助金ストーリー + 希少性フックを生成

import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const GEMINI_API_KEY     = process.env.GEMINI_API_KEY ?? "";

const MODEL_CASCADE = [
  "google/gemini-2.0-flash-001",
  "anthropic/claude-3.5-haiku",
  "google/gemini-flash-1.5",
] as const;

// ── 型定義 ────────────────────────────────────────────────────

interface CartItemInput {
  name: string;
  emoji?: string;
  category: string;
  price: number;
}

interface UpsellRequestBody {
  cartItems: CartItemInput[];
  lang: "ja" | "en" | "zh" | "ko";
  allMenuItems?: CartItemInput[]; // 全メニュー（提案候補）
}

export interface UpsellSuggestion {
  targetItemName: string;   // 提案アイテム名
  targetItemEmoji: string;  // 絵文字
  pairingText: string;      // ペアリング説明
  sizzleText: string;       // シズル感テキスト（味・香り・こだわり）
  scarcityText: string;     // 希少性テキスト
  ctaText: string;          // CTAボタン
}

type UpsellResponse =
  | { ok: true;  suggestion: UpsellSuggestion }
  | { ok: false; error: string };

// ── 言語設定 ──────────────────────────────────────────────────

const LANG_NAME: Record<string, string> = {
  ja: "Japanese", en: "English", zh: "Simplified Chinese", ko: "Korean",
};

// ── OpenRouterモデルカスケード ─────────────────────────────────

function isEndpointGone(status: number, body: string): boolean {
  if (status === 404) return true;
  const l = body.toLowerCase();
  return l.includes("no endpoints found") || l.includes("model not found") || l.includes("does not exist");
}

async function callWithCascade(prompt: string): Promise<string> {
  for (const model of MODEL_CASCADE) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7秒でタイムアウト
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer":  "https://pos-app.vercel.app",
          "X-Title":       "FLOWS POS",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
        }),
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        if (isEndpointGone(res.status, text)) continue;
        throw new Error(`OpenRouter ${res.status}: ${text}`);
      }
      const data = JSON.parse(text) as { choices: Array<{ message: { content: string } }> };
      const content = data.choices[0]?.message?.content;
      if (content) return content;
    } catch (e) {
      if ((e as Error).name === "AbortError") continue; // タイムアウト→次のモデルへ
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error("All OpenRouter models unavailable");
}

type GeminiContent = { parts: Array<{ text: string }>; role: string };
async function callGeminiFallback(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] as GeminiContent[] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json() as { candidates: Array<{ content: GeminiContent }> };
  return data.candidates[0]?.content?.parts[0]?.text ?? "";
}

// ── プロンプト生成 ────────────────────────────────────────────

function buildPrompt(cartItems: CartItemInput[], lang: string, allMenu: CartItemInput[]): string {
  const cartList = cartItems.map(i => `- ${i.emoji ?? ""} ${i.name} (${i.category})`).join("\n");
  const menuList = allMenu.slice(0, 20).map(i => `${i.emoji ?? ""} ${i.name}`).join(", ");
  const langName = LANG_NAME[lang] ?? "Japanese";

  return `You are a smart restaurant upsell AI for FLOWS restaurant in Japan.

CRITICAL: All text fields in your JSON response MUST be written in ${langName}. Do not use any other language.

A customer has these items in their cart:
${cartList}

Available menu items: ${menuList || "various dishes"}

Your task: Generate ONE compelling upsell suggestion. ALL text must be in ${langName}.
- Suggest a complementary item (drink, side dish, or dessert) that pairs perfectly with the cart items
- Make it feel natural and beneficial, not pushy

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "targetItemName": "<item name to suggest in ${langName}, max 15 chars>",
  "targetItemEmoji": "<1 emoji for the item>",
  "pairingText": "<why this item pairs perfectly in ${langName}, max 40 chars>",
  "sizzleText": "<1 evocative sentence about the taste or aroma in ${langName}, max 40 chars>",
  "scarcityText": "<urgency hook in ${langName} like 'Tonight only', max 15 chars>",
  "ctaText": "<call to action button text in ${langName}, max 8 chars>"
}`;
}

// ── フォールバック提案（AI不使用）─────────────────────────────

function fallbackSuggestion(lang: string): UpsellSuggestion {
  const suggestions: Record<string, UpsellSuggestion> = {
    ja: {
      targetItemName: "本日の特選ドリンク",
      targetItemEmoji: "🍷",
      pairingText: "料理との相性抜群の一杯",
      sizzleText: "芳醇な香りが口いっぱいに広がる至福の一杯",
      scarcityText: "本日限定",
      ctaText: "追加する",
    },
    en: {
      targetItemName: "Chef's Special Drink",
      targetItemEmoji: "🍷",
      pairingText: "Perfect pairing for your meal",
      sizzleText: "Rich aroma and velvety finish — pure bliss",
      scarcityText: "Tonight only",
      ctaText: "Add",
    },
    zh: {
      targetItemName: "今日特选饮品",
      targetItemEmoji: "🍷",
      pairingText: "与您的餐点完美搭配",
      sizzleText: "香气馥郁，每一口都是享受",
      scarcityText: "今日限定",
      ctaText: "添加",
    },
    ko: {
      targetItemName: "오늘의 특선 음료",
      targetItemEmoji: "🍷",
      pairingText: "요리와 완벽한 페어링",
      sizzleText: "풍부한 향과 부드러운 여운, 완벽한 한 잔",
      scarcityText: "오늘만 특별",
      ctaText: "추가",
    },
  };
  return suggestions[lang] ?? suggestions.ja;
}

// ── POST ハンドラ ─────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<UpsellResponse>> {
  let body: UpsellRequestBody;
  try {
    body = (await req.json()) as UpsellRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.cartItems || body.cartItems.length === 0) {
    return NextResponse.json({ ok: false, error: "Cart is empty" }, { status: 400 });
  }

  const prompt = buildPrompt(body.cartItems, body.lang, body.allMenuItems ?? []);

  let rawText = "";
  try {
    if (OPENROUTER_API_KEY) {
      rawText = await callWithCascade(prompt);
    } else if (GEMINI_API_KEY) {
      rawText = await callGeminiFallback(prompt);
    } else {
      return NextResponse.json({
        ok: true,
        suggestion: fallbackSuggestion(body.lang),
      });
    }

    // JSON抽出（マークダウンコードブロック対応）
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const suggestion = JSON.parse(jsonMatch[0]) as UpsellSuggestion;

    return NextResponse.json({ ok: true, suggestion });
  } catch {
    return NextResponse.json({
      ok: true,
      suggestion: fallbackSuggestion(body.lang),
    });
  }
}
