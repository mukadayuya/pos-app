"use client";

import { useState } from "react";

// ─── 型定義 ──────────────────────────────────────────────────────────

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

interface DiagnosticResponse {
  subsidies: SubsidyResult[];
  summary: string;
  totalEstimated: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  menuKeywords?: string[];
}

// ─── SubsidyCard ─────────────────────────────────────────────────────

function SubsidyCard({ subsidy }: { subsidy: SubsidyResult }) {
  const [expanded, setExpanded] = useState(false);

  const subsidyPct = Math.round(subsidy.subsidyRate * 100);
  const realPct = Math.round(subsidy.realCostRate * 100);
  const maxAmountMan = Math.round(subsidy.maxAmount / 10000);
  const estimatedMan = Math.round(subsidy.estimatedAmount / 10000);

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* ヘッダー */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-bold text-slate-800 leading-snug flex-1">
            {subsidy.name}
          </p>
          <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
            補助率 {subsidyPct}%
          </span>
        </div>

        {/* 実質OFFハイライト */}
        <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 mb-3">
          <span className="text-amber-500 text-base">⚡</span>
          <span className="text-sm font-black text-amber-700">
            実質 {realPct}% OFF
          </span>
          <span className="text-xs text-amber-600">で導入できます</span>
        </div>

        {/* 金額行 */}
        <div className="flex gap-3">
          <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-center">
            <p className="text-xs text-slate-500 mb-0.5">上限金額</p>
            <p className="text-base font-black text-slate-800">{maxAmountMan}万円</p>
          </div>
          <div className="flex-1 bg-emerald-50 rounded-xl px-3 py-2 text-center">
            <p className="text-xs text-emerald-600 mb-0.5">推定受給額</p>
            <p className="text-base font-black text-emerald-700">
              {estimatedMan > 0 ? `約${estimatedMan}万円` : "要相談"}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-2">申請期限: {subsidy.deadline}</p>
      </div>

      {/* マッチ理由 */}
      {subsidy.matchReasons.length > 0 && (
        <div className="px-4 pb-3">
          {subsidy.matchReasons.map((r, i) => (
            <p key={i} className="text-xs text-emerald-700 flex gap-1">
              <span>✓</span>
              <span>{r}</span>
            </p>
          ))}
        </div>
      )}

      {/* 要件トグル */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 font-semibold hover:bg-slate-100 transition-colors"
      >
        <span>申請要件を{expanded ? "隠す" : "確認する"}</span>
        <span className="text-slate-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-slate-100 space-y-1.5">
          {subsidy.requirements.map((req, i) => (
            <p key={i} className="text-xs text-slate-600 flex gap-1.5">
              <span className="text-slate-400 shrink-0">•</span>
              <span>{req}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────

type FlowStep = "input" | "loading" | "results" | "no-match";

export default function SubsidyWizardModal({
  isOpen,
  onClose,
  onComplete,
  menuKeywords = [],
}: Props) {
  const [step, setStep] = useState<FlowStep>("input");

  // Step 0 フォーム
  const [employeeCount, setEmployeeCount] = useState("");
  const [avgMonthlySales, setAvgMonthlySales] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [formError, setFormError] = useState("");

  // Step 2 結果
  const [result, setResult] = useState<DiagnosticResponse | null>(null);
  const [apiError, setApiError] = useState("");

  const resetModal = () => {
    setStep("input");
    setEmployeeCount("");
    setAvgMonthlySales("");
    setStoreDescription("");
    setFormError("");
    setResult(null);
    setApiError("");
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleDiagnose = async () => {
    setFormError("");
    const empNum = parseInt(employeeCount, 10);
    if (isNaN(empNum) || empNum < 0) {
      setFormError("従業員数を正しく入力してください（0以上の整数）");
      return;
    }
    const salesNum = parseInt(avgMonthlySales.replace(/,/g, ""), 10);
    if (isNaN(salesNum) || salesNum <= 0) {
      setFormError("月商平均を正しく入力してください（1以上の数値）");
      return;
    }

    setStep("loading");
    setApiError("");

    try {
      const res = await fetch("/api/subsidy-diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlySales: [salesNum, salesNum, salesNum],
          menuKeywords,
          employeeCount: empNum,
          storeDescription: storeDescription.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }

      const data = (await res.json()) as DiagnosticResponse;
      setResult(data);
      onComplete?.();
      setStep(data.subsidies.length > 0 ? "results" : "no-match");
    } catch (e) {
      setApiError(
        e instanceof Error ? e.message : "診断に失敗しました。もう一度お試しください。",
      );
      setStep("input");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90dvh] flex flex-col">

        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 pt-6 pb-5 text-white flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Kitchen Subsidy 診断</span>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              ✕
            </button>
          </div>
          <h2 className="text-lg font-bold">厨房設備 補助金診断</h2>
          {step === "results" && result && (
            <p className="text-emerald-100 text-sm mt-1">
              {result.subsidies.length}件の補助金が見つかりました
            </p>
          )}
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">

          {/* ─── Step 0: 入力フォーム ─────────────────────────────── */}
          {step === "input" && (
            <div className="px-6 py-6 space-y-5">
              {menuKeywords.length > 0 && (
                <div className="bg-emerald-50 rounded-xl px-4 py-3 text-xs text-emerald-800">
                  <p className="font-semibold mb-1">検出されたキーワード:</p>
                  <p>{menuKeywords.join("、")}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  従業員数
                </label>
                <input
                  type="number"
                  min="0"
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(e.target.value)}
                  placeholder="例: 3"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  月商平均（円）
                </label>
                <input
                  type="number"
                  min="1"
                  value={avgMonthlySales}
                  onChange={(e) => setAvgMonthlySales(e.target.value)}
                  placeholder="例: 1500000"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  店舗の説明
                  <span className="text-slate-400 font-normal ml-1">（任意）</span>
                </label>
                <textarea
                  value={storeDescription}
                  onChange={(e) => setStoreDescription(e.target.value)}
                  placeholder="例: 居酒屋で20席、ランチも提供中"
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all resize-none"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-500 font-medium">{formError}</p>
              )}
              {apiError && (
                <p className="text-sm text-red-500 font-medium">{apiError}</p>
              )}
            </div>
          )}

          {/* ─── Step 1: ローディング ────────────────────────────── */}
          {step === "loading" && (
            <div className="px-6 py-16 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-slate-600 text-sm font-semibold">補助金を診断中...</p>
              <p className="text-slate-400 text-xs text-center">
                AIが最新の補助金情報と照合しています
              </p>
            </div>
          )}

          {/* ─── Step 2: 結果 ───────────────────────────────────── */}
          {step === "results" && result && (
            <div className="px-6 py-6 space-y-4">
              {/* 総額サマリー */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl px-4 py-4 text-center">
                <p className="text-xs text-emerald-600 font-semibold mb-1">推定総受給額</p>
                <p className="text-3xl font-black text-emerald-700">
                  約{Math.round(result.totalEstimated / 10000)}万円
                </p>
              </div>

              {/* AI要約 */}
              {result.summary && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-700 leading-relaxed">
                  {result.summary}
                </div>
              )}

              {/* 各補助金カード */}
              {result.subsidies.map((s, i) => (
                <SubsidyCard key={i} subsidy={s} />
              ))}
            </div>
          )}

          {/* ─── Step 3: マッチなし ─────────────────────────────── */}
          {step === "no-match" && (
            <div className="px-6 py-10 text-center space-y-4">
              <div className="text-5xl">🔍</div>
              <p className="text-slate-700 font-bold text-base">
                現在の条件では<br />該当する補助金が見つかりませんでした
              </p>
              {result?.summary && (
                <p className="text-sm text-slate-500 leading-relaxed">{result.summary}</p>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 text-left">
                <p className="font-semibold mb-1">こんな設備の導入を検討しませんか？</p>
                <p className="text-xs text-amber-700">
                  洗浄機・冷蔵庫・POS・タブレットなど、補助金対象となる設備は多数あります。
                  専門家に相談することで、新たな補助金の可能性が広がります。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          {step === "input" && (
            <button
              onClick={handleDiagnose}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-base shadow-xl active:scale-95 transition-all hover:bg-emerald-700"
            >
              無料で補助金を診断する →
            </button>
          )}
          {(step === "results" || step === "no-match") && (
            <div className="flex gap-3">
              <button
                onClick={() => { resetModal(); }}
                className="flex-1 py-3 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-all text-sm"
              >
                再診断
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-200 text-sm hover:bg-emerald-700 transition-all"
              >
                閉じる
              </button>
            </div>
          )}
          {step === "loading" && (
            <button
              disabled
              className="w-full py-4 bg-slate-200 text-slate-400 rounded-2xl font-bold text-base cursor-not-allowed"
            >
              診断中...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
