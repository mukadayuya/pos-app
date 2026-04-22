"use client";

import { MenuItem, ServiceTab } from "@/types/pos";

interface MenuPanelProps {
  activeTab: ServiceTab;
  menuItems: MenuItem[];
  onAddItem: (item: MenuItem) => void;
}

export default function MenuPanel({ activeTab, menuItems, onAddItem }: MenuPanelProps) {
  const filtered =
    activeTab === "takeout"
      ? menuItems
      : menuItems.filter((item) => item.category === activeTab);

  return (
    <div className="grid grid-cols-3 gap-3">
      {filtered.map((item) => (
        <button
          key={item.id}
          onClick={() => onAddItem(item)}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col items-center gap-2
            hover:bg-slate-700 hover:border-indigo-500 active:scale-95 transition-all text-left"
        >
          <span className="text-5xl leading-none">{item.emoji}</span>
          <span className="text-sm font-semibold text-white text-center leading-tight w-full">
            {item.name}
          </span>
          <span className="text-base font-bold text-indigo-400">
            ¥{item.price.toLocaleString()}
          </span>
          {activeTab === "takeout" && (
            <span className="text-xs bg-teal-900 text-teal-300 px-2 py-0.5 rounded-full font-medium">
              軽減税率 8%
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
