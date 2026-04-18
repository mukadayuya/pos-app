"use client";

import { Category } from "@/types/pos";
import { categoryLabels } from "@/data/menu";

interface CategoryBarProps {
  activeCategory: Category;
  onCategoryChange: (category: Category) => void;
}

const categories: { id: Category; emoji: string }[] = [
  { id: "lunch", emoji: "🌤️" },
  { id: "dinner", emoji: "🌙" },
];

export default function CategoryBar({ activeCategory, onCategoryChange }: CategoryBarProps) {
  return (
    <div className="w-24 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col py-4 gap-2 px-2">
      {categories.map(({ id, emoji }) => (
        <button
          key={id}
          onClick={() => onCategoryChange(id)}
          className={`flex flex-col items-center gap-1.5 py-5 rounded-2xl text-xs font-semibold transition-all ${
            activeCategory === id
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <span className="text-3xl">{emoji}</span>
          <span>{categoryLabels[id]}</span>
        </button>
      ))}
    </div>
  );
}
