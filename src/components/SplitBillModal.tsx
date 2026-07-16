"use client";

// 割り勘計算モーダル（Phase 1-⑨）
// 総額 total を人数 N で割った金額を計算し、端数処理を選ばせる。
// 実際の会計フロー（支払方法の入力）とは独立した計算補助ツール。

import { useState, useMemo } from "react";

type RoundMode = "ceil_organizer" | "floor_extra" | "ceil_even";

const MODE_LABELS: Record<RoundMode, { label: string; desc: string }> = {
  ceil_organizer: {
    label: "幹事引受け",
    desc: "1人あたりを切り捨てて計算。端数は幹事が引き受けます（推奨）",
  },
  floor_extra: {
    label: "1円単位で均等",
    desc: "1円未満は無理なので、切り上げて全員が同額。合計は元金額を上回ります",
  },
  ceil_even: {
    label: "100円単位で切り上げ",
    desc: "100円単位で切り上げて全員が同額。集金しやすい額に調整",
  },
};

interface Props {
  total: number;
  onClose: () => void;
  /** モーダルから会計画面へ「現金にセット」を伝える。呼ぶと現金支払で amount 円セット＋モーダル閉じる */
  onApplyToCash?: (amount: number) => void;
}

export default function SplitBillModal({ total, onClose, onApplyToCash }: Props) {
  const [people, setPeople] = useState(2);
  const [mode, setMode]     = useState<RoundMode>("ceil_organizer");

  const result = useMemo(() => {
    if (people < 1) return null;
    if (mode === "ceil_organizer") {
      // 1人あたり切り捨て、幹事が差額を引き受け
      const each = Math.floor(total / people);
      const organizer = total - each * (people - 1);
      return { each, organizer, note: `幹事は¥${organizer.toLocaleString()}、他${people - 1}人が¥${each.toLocaleString()}` };
    }
    if (mode === "floor_extra") {
      const each = Math.ceil(total / people);
      const collected = each * people;
      const extra = collected - total;
      return { each, organizer: each, note: `全員¥${each.toLocaleString()}。合計¥${collected.toLocaleString()}（元金額より¥${extra.toLocaleString()}多く集まります）` };
    }
    // ceil_even: 100円単位で切り上げ
    const each = Math.ceil(total / people / 100) * 100;
    const collected = each * people;
    const extra = collected - total;
    return { each, organizer: each, note: `全員¥${each.toLocaleString()}（100円単位）。集金合計¥${collected.toLocaleString()}・+¥${extra.toLocaleString()}` };
  }, [total, people, mode]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍽️</span>
            <h2 className="text-base font-bold text-slate-800">割り勘計算</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 text-sm font-bold">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 元金額 */}
          <div>
            <p className="text-xs text-slate-500">お会計金額（税込）</p>
            <p className="text-3xl font-black text-slate-900 tabular-nums mt-1">¥{total.toLocaleString()}</p>
          </div>

          {/* 人数 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">人数</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPeople(p => Math.max(1, p - 1))}
                className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-lg font-bold"
              >−</button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-black text-slate-900 tabular-nums">{people}</span>
                <span className="text-sm text-slate-400 ml-1">人</span>
              </div>
              <button
                onClick={() => setPeople(p => Math.min(50, p + 1))}
                className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-lg font-bold"
              >＋</button>
            </div>
            <div className="mt-2 flex gap-2 flex-wrap">
              {[2, 3, 4, 5, 6, 8, 10].map(n => (
                <button key={n}
                  onClick={() => setPeople(n)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    people === n
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}
                >{n}人</button>
              ))}
            </div>
          </div>

          {/* 端数処理モード */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">端数処理</label>
            <div className="space-y-2">
              {(Object.keys(MODE_LABELS) as RoundMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                    mode === m
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <p className="text-sm font-bold text-slate-800">{MODE_LABELS[m].label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{MODE_LABELS[m].desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 結果 */}
          {result && (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl px-4 py-4 space-y-1">
              <p className="text-xs text-emerald-800 font-bold">💡 集金方法</p>
              <p className="text-2xl font-black text-emerald-900 tabular-nums">
                ¥{result.each.toLocaleString()} <span className="text-sm font-normal">/ 人</span>
              </p>
              <p className="text-xs text-emerald-700 leading-relaxed">{result.note}</p>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 pb-5 space-y-2">
          {onApplyToCash && result && (
            <button
              onClick={() => {
                onApplyToCash(result.each * people);
                onClose();
              }}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black transition-colors active:scale-95"
            >
              💴 現金 ¥{(result.each * people).toLocaleString()}（{people}人分）を会計にセット
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors active:scale-95"
          >
            計算だけ閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
