"use client";

import { useState } from "react";
import { MenuItem, Category } from "@/types/pos";
import { categoryLabels } from "@/data/menu";
import SubsidyWizardModal from "@/components/SubsidyWizardModal";

// 補助金対象となりうる機材キーワード
const SUBSIDY_EQUIPMENT_KEYWORDS = [
  "洗浄機", "食洗機", "冷蔵庫", "冷凍庫", "製氷機", "ショーケース",
  "オーブン", "レンジ", "スチコン", "POS", "タブレット", "コンロ", "フリーザー",
] as const;

function detectEquipmentKeyword(name: string): string | null {
  return SUBSIDY_EQUIPMENT_KEYWORDS.find((kw) => name.includes(kw)) ?? null;
}

interface AddMenuPanelProps {
  onAdd: (item: MenuItem) => void;
  onClose: () => void;
}

const categories: Category[] = ["lunch", "dinner"];

const emojiOptions = [
  "🍔", "🍕", "🍜", "🍣", "🍱", "🥗", "🍗", "🍟",
  "🍰", "🍦", "🍮", "🎂", "☕", "🥤", "🍺", "🍵",
  "🫖", "🍊", "🧃", "🍶",
];

export default function AddMenuPanel({ onAdd, onClose }: AddMenuPanelProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<Category>("lunch");
  const [emoji, setEmoji] = useState("🍔");
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [subsidyModalOpen, setSubsidyModalOpen] = useState(false);
  const [subsidyKeyword, setSubsidyKeyword] = useState<string | null>(null);

  const detectedKeyword = detectEquipmentKeyword(name);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("名前を入力してください");
      return;
    }
    const p = parseInt(price, 10);
    if (isNaN(p) || p <= 0) {
      setError("正しい価格を入力してください");
      return;
    }
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      price: p,
      category,
      emoji,
      taxRate: 0.10,
    });
    setName("");
    setPrice("");
    setError("");
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
        <h2 className="text-lg font-bold text-slate-800">メニュー追加</h2>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">絵文字</label>
          <div className="flex flex-wrap gap-2">
            {emojiOptions.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`w-11 h-11 text-2xl rounded-xl border-2 transition-all ${
                  emoji === e
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：抹茶ラテ"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          {detectedKeyword && (
            <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <span className="text-amber-500 text-base shrink-0">⚡</span>
              <p className="text-xs text-amber-800 leading-snug flex-1">
                この機材は補助金で実質75%OFFになる可能性があります
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubsidyKeyword(detectedKeyword);
                  setSubsidyModalOpen(true);
                }}
                className="shrink-0 text-xs font-bold text-amber-700 underline underline-offset-2 hover:text-amber-900 transition-colors whitespace-nowrap"
              >
                詳細を確認
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">価格（円）</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="例：450"
            min="1"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">カテゴリ</label>
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                  category === cat
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
        {added && (
          <p className="text-sm text-green-600 font-semibold">✓ メニューを追加しました</p>
        )}
      </div>

      <div className="px-5 py-4 border-t border-slate-200 flex-shrink-0">
        <button
          onClick={handleSubmit}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-base font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md"
        >
          追加する
        </button>
      </div>

      <SubsidyWizardModal
        isOpen={subsidyModalOpen}
        onClose={() => setSubsidyModalOpen(false)}
        menuKeywords={subsidyKeyword ? [subsidyKeyword] : []}
      />
    </div>
  );
}
