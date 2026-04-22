"use client";

import { ServiceTab } from "@/types/pos";

interface CategoryBarProps {
  activeTab: ServiceTab;
  onTabChange: (tab: ServiceTab) => void;
}

const tabs: { id: ServiceTab; label: string; icon: string; accent: string }[] = [
  { id: "dinner",  label: "夜部",      icon: "🌙", accent: "bg-indigo-600" },
  { id: "lunch",   label: "昼部",      icon: "☀️", accent: "bg-amber-500"  },
  { id: "takeout", label: "テイクアウト", icon: "🥡", accent: "bg-teal-600"  },
];

export default function CategoryBar({ activeTab, onTabChange }: CategoryBarProps) {
  return (
    <div className="w-20 flex-shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col py-3 gap-2 px-2">
      {tabs.map(({ id, label, icon, accent }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all active:scale-95 ${
            activeTab === id
              ? `${accent} text-white shadow-lg`
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <span className="text-2xl leading-none">{icon}</span>
          <span
            className="text-xs font-bold leading-none"
            style={{ writingMode: "vertical-rl", textOrientation: "upright", letterSpacing: "0.05em" }}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
