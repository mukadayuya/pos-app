import { NextRequest, NextResponse } from "next/server";

// ─── 補助金知識ベース ────────────────────────────────────────────────

interface SubsidyDefinition {
  id: string;
  name: string;
  maxAmount: number;
  subsidyRate: number;
  deadline: string;
  keywords: string[];
  employeeMin: number;
  requirements: string[];
}

const SUBSIDIES: SubsidyDefinition[] = [
  {
    id: "hatarakikata",
    name: "働き方改革推進支援助成金",
    maxAmount: 2000000,
    subsidyRate: 0.75,
    deadline: "2026年6月30日",
    keywords: ["洗浄機", "食洗機", "自動洗浄", "皿洗い", "洗い場"],
    employeeMin: 1,
    requirements: [
      "従業員1名以上",
      "労働時間短縮計画の提出",
      "設備導入による労働生産性の向上",
    ],
  },
  {
    id: "jizokuka",
    name: "小規模事業者持続化補助金",
    maxAmount: 2000000,
    subsidyRate: 0.667,
    deadline: "2026年8月31日",
    keywords: ["冷蔵庫", "冷凍庫", "製氷機", "ショーケース", "陳列", "オーブン", "レンジ", "厨房"],
    employeeMin: 0,
    requirements: [
      "小規模事業者（従業員5名以下）",
      "商工会・商工会議所の支援",
      "販路開拓・業務効率化",
    ],
  },
  {
    id: "monozukuri",
    name: "ものづくり・商業・サービス生産性向上促進補助金",
    maxAmount: 10000000,
    subsidyRate: 0.50,
    deadline: "2026年7月15日",
    keywords: ["オーブン", "スチームコンベクション", "真空調理", "急速冷凍", "フリーザー"],
    employeeMin: 1,
    requirements: [
      "付加価値額年率3%以上向上",
      "給与支給総額年率1.5%以上向上",
      "革新的サービス・試作品開発",
    ],
  },
  {
    id: "it_donyu",
    name: "IT導入補助金",
    maxAmount: 4500000,
    subsidyRate: 0.75,
    deadline: "2026年9月30日",
    keywords: ["POS", "レジ", "タブレット", "予約システム", "注文システム", "デジタル"],
    employeeMin: 0,
    requirements: [
      "IT導入支援事業者との契約",
      "SECURITY ACTIONの宣言",
      "生産性向上ツールの導入",
    ],
  },
  {
    id: "jigyou_saikou",
    name: "事業再構築補助金",
    maxAmount: 15000000,
    subsidyRate: 0.667,
    deadline: "2026年12月31日",
    keywords: ["新業態", "テイクアウト", "デリバリー", "EC", "キッチンカー"],
    employeeMin: 0,
    requirements: [
      "売上高10%以上減少",
      "新分野展開・業態転換",
      "認定経営革新等支援機関の確認書",
    ],
  },
];

// ─── 型定義 ──────────────────────────────────────────────────────────

interface DiagnosticInput {
  monthlySales: number[];
  menuKeywords: string[];
  employeeCount: number;
  storeDescription?: string;
}

interface SubsidyResult {
  name: string;
  maxAmount: number;
  subsidyRate: number;
  deadline: string;
  requirements: string[];
  matchReasons: string[];
  estimatedAmount: number;
  realCostRate: number;
}

interface DiagnosticOutput {
  subsidies: SubsidyResult[];
  summary: string;
  totalEstimated: number;
}

// ─── ルールベースマッチング ───────────────────────────────────────────

function matchSubsidies(
  menuKeywords: string[],
  employeeCount: number,
  monthlySales: number[],
): { subsidy: SubsidyDefinition; matchReasons: string[]; estimatedAmount: number }[] {
  const avgMonthlySales =
    monthlySales.length > 0
      ? monthlySales.reduce((a, b) => a + b, 0) / monthlySales.length
      : 0;

  const results: { subsidy: SubsidyDefinition; matchReasons: string[]; estimatedAmount: number }[] = [];

  for (const subsidy of SUBSIDIES) {
    if (employeeCount < subsidy.employeeMin) continue;

    const matchedKeywords = subsidy.keywords.filter((kw) =>
      menuKeywords.some((mk) => mk.includes(kw) || kw.includes(mk)),
    );

    if (matchedKeywords.length === 0) continue;

    const matchReasons: string[] = [];
    matchReasons.push(
      `「${matchedKeywords.join("」「")}」が補助対象機材に該当します`,
    );
    if (employeeCount >= subsidy.employeeMin && subsidy.employeeMin > 0) {
      matchReasons.push(`従業員${employeeCount}名で申請要件を満たします`);
    }

    // 推定受給額: 月商平均の3ヶ月分を投資額の目安とし、補助率を掛ける（上限あり）
    const estimatedInvestment = avgMonthlySales * 3 * 0.3; // 売上の30%を設備投資と仮定
    const rawEstimate = estimatedInvestment * subsidy.subsidyRate;
    const estimatedAmount = Math.min(rawEstimate, subsidy.maxAmount);

    results.push({ subsidy, matchReasons, estimatedAmount });
  }

  return results;
}

// ─── AI API 呼び出し ─────────────────────────────────────────────────

// --- OpenRouter ---

interface OpenRouterMessage {
  role: string;
  content: string;
}

interface OpenRouterChoice {
  message: OpenRouterMessage;
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
}

const SUBSIDY_MODEL_CASCADE = [
  "google/gemini-2.0-flash-001",
  "anthropic/claude-3.5-haiku",
  "google/gemini-flash-1.5",
] as const;

async function callOpenRouter(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY_NOT_SET");

  for (const model of SUBSIDY_MODEL_CASCADE) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pos-app.vercel.app",
        "X-Title": "FLOWS POS",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
      }),
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const lower = text.toLowerCase();
      const isEndpointGone =
        res.status === 404 ||
        lower.includes("no endpoints found") ||
        lower.includes("model not found");
      if (isEndpointGone) continue;
      throw new Error(`OpenRouter API error ${res.status}: ${text}`);
    }

    const data = JSON.parse(text) as OpenRouterResponse;
    const content = data.choices[0]?.message?.content;
    if (content) return content;
  }
  return "";
}

// --- Gemini (fallback) ---

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content: GeminiContent;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_NOT_SET");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as GeminiResponse;
  return data.candidates[0]?.content?.parts[0]?.text ?? "";
}

// ─── Route Handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: DiagnosticInput;
  try {
    body = (await req.json()) as DiagnosticInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    monthlySales = [],
    menuKeywords = [],
    employeeCount = 0,
    storeDescription = "",
  } = body;

  // ── ルールベースマッチング ───────────────────────────────────────
  const matches = matchSubsidies(menuKeywords, employeeCount, monthlySales);

  const subsidies: SubsidyResult[] = matches.map(
    ({ subsidy, matchReasons, estimatedAmount }) => ({
      name: subsidy.name,
      maxAmount: subsidy.maxAmount,
      subsidyRate: subsidy.subsidyRate,
      deadline: subsidy.deadline,
      requirements: subsidy.requirements,
      matchReasons,
      estimatedAmount: Math.round(estimatedAmount),
      realCostRate: Math.round((1 - subsidy.subsidyRate) * 100) / 100,
    }),
  );

  const totalEstimated = subsidies.reduce((sum, s) => sum + s.estimatedAmount, 0);

  // ── AI による要約生成（OpenRouter → Gemini → 静的フォールバック）──
  let summary = "";
  let aiUsed = false;

  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);

  if (hasOpenRouter || hasGemini) {
    const avgSales =
      monthlySales.length > 0
        ? Math.round(monthlySales.reduce((a, b) => a + b, 0) / monthlySales.length)
        : 0;

    const subsidyList =
      subsidies.length > 0
        ? subsidies
            .map(
              (s) =>
                `・${s.name}（上限${(s.maxAmount / 10000).toFixed(0)}万円、補助率${Math.round(s.subsidyRate * 100)}%、期限: ${s.deadline}）`,
            )
            .join("\n")
        : "該当する補助金なし";

    const prompt = `あなたは日本の飲食店向け補助金コンサルタントです。以下の店舗情報と診断結果をもとに、店主に向けた日本語の要約コメントを150字以内で作成してください。励ましの言葉と具体的なアクションを含めてください。

【店舗情報】
- 従業員数: ${employeeCount}名
- 月商平均: ${avgSales.toLocaleString("ja-JP")}円
- 検討中の機材・設備: ${menuKeywords.join("、") || "未入力"}
- 店舗説明: ${storeDescription || "未入力"}

【マッチした補助金】
${subsidyList}

【推定総受給額】: ${(totalEstimated / 10000).toFixed(0)}万円

要約（150字以内、日本語）:`;

    // 1. OpenRouter を優先試行
    if (hasOpenRouter) {
      try {
        const text = await callOpenRouter(prompt);
        summary = text.trim();
        aiUsed = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[subsidy-diagnostic] OpenRouter error:", msg);
      }
    }

    // 2. OpenRouter が失敗した場合は Gemini にフォールバック
    if (!aiUsed && hasGemini) {
      try {
        const text = await callGemini(prompt);
        summary = text.trim();
        aiUsed = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("GEMINI_API_KEY_NOT_SET")) {
          console.error("[subsidy-diagnostic] Gemini error:", msg);
        }
      }
    }
  }

  // 3. どの AI も使えなかった場合の静的フォールバック要約
  if (!aiUsed) {
    if (subsidies.length === 0) {
      summary =
        "現在の情報では該当する補助金が見つかりませんでした。機材キーワードを追加するか、専門家にご相談ください。（※AIによる詳細分析はOPENROUTER_API_KEYまたはGEMINI_API_KEYを設定すると利用できます）";
    } else {
      summary = `${subsidies.length}件の補助金が見つかりました。推定総受給額は約${(totalEstimated / 10000).toFixed(0)}万円です。各補助金の申請期限をご確認の上、早めに手続きを進めましょう。（※AIによる詳細分析はOPENROUTER_API_KEYまたはGEMINI_API_KEYを設定すると利用できます）`;
    }
  }

  const output: DiagnosticOutput = { subsidies, summary, totalEstimated };
  return NextResponse.json(output);
}
