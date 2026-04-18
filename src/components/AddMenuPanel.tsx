"use client";

import { useState } from "react";
import { MenuItem, Category } from "@/types/pos";
import { categoryLabels } from "@/data/menu";

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
      id: `custom_${Date.now()}`,
      name: name.trim(),
      price: p,
      category,
      emoji,
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
    </div>
  );
}
