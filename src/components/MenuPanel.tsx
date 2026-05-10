"use client";

import { MenuItem } from "@/types/pos";

interface MenuPanelProps {
  activeCategoryId: string;
  isTakeout: boolean;
  menuItems: MenuItem[];
  onAddItem: (item: MenuItem) => void;
}

export default function MenuPanel({ activeCategoryId, isTakeout, menuItems, onAddItem }: MenuPanelProps) {
  const filtered = isTakeout
    ? menuItems.filter(item => item.isTakeoutAvailable !== false)
    : menuItems.filter(item => item.category === activeCategoryId);

  return (
    <div className="grid grid-cols-3 gap-4">
      {filtered.map((item) => {
        const effectiveTaxRate = isTakeout ? 0.08 : item.taxRate;
        const taxIncludedPrice = Math.round(item.price * (1 + effectiveTaxRate));
        return (
          <button
            key={item.id}
            onClick={() => onAddItem(item)}
            className="group bg-white rounded-3xl p-5 flex flex-col items-center gap-3
              shadow-[0_2px_12px_rgb(0,0,0,0.06)] ring-1 ring-black/[0.04]
              hover:shadow-[0_8px_32px_rgb(0,0,0,0.10)] hover:-translate-y-0.5
              active:scale-[0.97] active:shadow-sm transition-all duration-200 text-left"
          >
            {item.emoji && (
              <span className="text-5xl leading-none group-hover:scale-110 transition-transform duration-200">
                {item.emoji}
              </span>
            )}
            <div className="w-full text-center space-y-0.5">
              <p className="text-sm font-semibold text-slate-800 tracking-tight leading-snug">
                {item.name}
              </p>
              <p className="text-2xl font-black text-indigo-600 tracking-tight">
                ¥{taxIncludedPrice.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1.5 mt-0.5">
                <span>税抜 ¥{item.price.toLocaleString()}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
                  isTakeout
                    ? "bg-teal-50 text-teal-600 ring-1 ring-teal-100"
                    : "bg-slate-50 text-slate-400 ring-1 ring-slate-100"
                }`}>
                  {isTakeout ? "8%" : "10%"}
                </span>
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
