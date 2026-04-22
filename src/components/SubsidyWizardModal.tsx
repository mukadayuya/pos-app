"use client";

import { useState } from "react";

const QUESTIONS = [
  "忙しい時間帯に洗い場に付きっきりになるのを解消するため、高性能な「自動洗浄機」の導入を検討されていますか？",
  "今の縦型冷蔵庫やコールドテーブルが手狭に感じていて、大型への買い替えや製氷機の新設で作業効率を上げたいですか？",
  "メニューの幅を広げたり売上を伸ばすために、オーブンガスレンジの刷新や、冷蔵ショーケースの導入を計画していますか？",
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function SubsidyWizardModal({ isOpen, onClose, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);

  if (!isOpen) return null;

  const handleAnswer = (yes: boolean) => {
    const next = [...answers, yes];
    setAnswers(next);
    if (step < 2) {
      setStep(step + 1);
    } else {
      setStep(3);
    }
  };

  const estimatedAmount = (answers[0] || answers[1] || answers[2]) ? 1000000 : 0;

  // 【重要】ここに作成したBotのURLを入れてください
  const BOT_URL = "https://your-dify-or-slack-link.com";

  const goToBot = () => {
    onComplete?.();
    window.open(BOT_URL, "_blank");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 pt-6 pb-5 text-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Kitchen Subsidy 診断</span>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">✕</button>
          </div>
          <h2 className="text-lg font-bold">厨房設備 助成金診断</h2>
        </div>

        <div className="px-6 py-6">
          {step < 3 ? (
            <>
              <p className="text-xs text-slate-400 mb-2">質問 {step + 1} / 3</p>
              <p className="text-slate-800 text-base font-bold leading-relaxed min-h-[80px]">
                {QUESTIONS[step]}
              </p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => handleAnswer(false)} className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold hover:bg-slate-50">いいえ</button>
                <button onClick={() => handleAnswer(true)} className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-200">はい</button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="text-4xl mb-3">💰</div>
              <p className="text-emerald-700 font-bold text-sm">受給のチャンスがあります！</p>
              <p className="text-4xl font-black text-slate-900 my-2">
                {estimatedAmount === 0 ? "要相談" : `${(estimatedAmount / 10000).toFixed(0)}万円`}
              </p>
              <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-800 text-left mb-6 leading-relaxed">
                {(answers[0] || answers[1] || answers[2]) && (
                  <p>✅ <b>働き方改革推進支援助成金</b>の対象となる可能性があります。最新設備の導入で、現場の負担を大幅に軽減できるかもしれません。</p>
                )}
                {answers[2] && (
                  <p className="mt-2 text-slate-500">※販路開拓（持続化補助金）としての申請も検討可能です。</p>
                )}
              </div>

              <button
                onClick={goToBot}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-base shadow-xl active:scale-95 transition-all"
              >
                専用Botで無料相談を始める →
              </button>
              <button onClick={onClose} className="mt-4 text-slate-400 text-sm">後で確認する</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
