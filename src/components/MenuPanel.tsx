"use client";

import { MenuItem, Category } from "@/types/pos";

interface MenuPanelProps {
  activeCategory: Category;
  menuItems: MenuItem[];
  onAddItem: (item: MenuItem) => void;
}

export default function MenuPanel({ activeCategory, menuItems, onAddItem }: MenuPanelProps) {
  const filtered = menuItems.filter((item) => item.category === activeCategory);

  return (
    <div className="grid grid-cols-3 gap-3">
      {filtered.map((item) => (
        <button
          key={item.id}
          onClick={() => onAddItem(item)}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-indigo-300 active:scale-95 transition-all text-left"
        >
          <span className="text-5xl">{item.emoji}</span>
          <span className="text-sm font-semibold text-slate-800 text-center leading-tight w-full">
            {item.name}
          </span>
          <span className="text-base font-bold text-indigo-600">
            ¥{item.price.toLocaleString()}
          </span>
        </button>
      ))}
    </div>
  );
}
