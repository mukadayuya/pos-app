"use client";

import { CategoryRecord } from "@/lib/db";

const KNOWN_STYLES: Record<string, { icon: string }> = {
  "夜部": { icon: "🌙" },
  "昼部": { icon: "☀️" },
};
const DEFAULT_STYLE = { icon: "🍽️" };

interface CategoryBarProps {
  categories: CategoryRecord[];
  activeCategoryId: string;
  onCategoryChange: (id: string) => void;
  isTakeout: boolean;
  onTakeoutSelect: () => void;
  /** false のとき区切り線・テイクアウトボタンを完全非表示にする（マスタースイッチ） */
  isTakeoutEnabled?: boolean;
  isManualInput?: boolean;
  onManualInputSelect?: () => void;
}

export default function CategoryBar({
  categories,
  activeCategoryId,
  onCategoryChange,
  isTakeout,
  onTakeoutSelect,
  isTakeoutEnabled = true,
  isManualInput = false,
  onManualInputSelect,
}: CategoryBarProps) {
  return (
    <nav className="w-[76px] flex-shrink-0 bg-white/80 backdrop-blur-xl border-r border-slate-100 flex flex-col py-4 gap-1.5 px-2.5">
      {/* 通常カテゴリー */}
      {categories.map(cat => {
        const { icon } = KNOWN_STYLES[cat.name] ?? DEFAULT_STYLE;
        const isActive = !isTakeout && activeCategoryId === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`flex flex-col items-center gap-2 py-5 rounded-2xl transition-all duration-200 active:scale-95 ${
              isActive
                ? "bg-indigo-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.38)]"
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            <span className="text-2xl leading-none">{icon}</span>
            <span
              className={`text-[9px] font-bold leading-none ${isActive ? "text-indigo-100" : "text-slate-400"}`}
              style={{ writingMode: "vertical-rl", textOrientation: "upright", letterSpacing: "0.12em" }}
            >
              {cat.name}
            </span>
          </button>
        );
      })}

      {/*
        テイクアウトセクション: categories.map() の「外側」に固定配置。
        isTakeoutEnabled が false のときは区切り線ごと完全に非表示にする。
        DB 取得後の再レンダリングで categories が変わっても消えない構造にするため、
        このブロックを map() 内に移動しないこと。
      */}
      {isTakeoutEnabled && (
        <>
          <div className="my-1 mx-1 border-t border-slate-100" />
          <button
            onClick={onTakeoutSelect}
            className={`flex flex-col items-center gap-2 py-5 rounded-2xl transition-all duration-200 active:scale-95 ${
              isTakeout
                ? "bg-teal-500 text-white shadow-[0_4px_14px_rgba(20,184,166,0.35)]"
                : "text-slate-400 hover:bg-slate-50 hover:text-teal-600"
            }`}
          >
            <span className="text-2xl leading-none">🥡</span>
            <span
              className={`text-[9px] font-bold leading-none ${isTakeout ? "text-teal-100" : "text-slate-400"}`}
              style={{ writingMode: "vertical-rl", textOrientation: "upright", letterSpacing: "0.12em" }}
            >
              テイクアウト
            </span>
          </button>
        </>
      )}

      {onManualInputSelect && (
        <>
          <div className="my-1 mx-1 border-t border-slate-100" />
          <button
            onClick={onManualInputSelect}
            className={`flex flex-col items-center gap-2 py-5 rounded-2xl transition-all duration-200 active:scale-95 ${
              isManualInput
                ? "bg-slate-700 text-white shadow-[0_4px_14px_rgba(51,65,85,0.35)]"
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            <span className="text-2xl leading-none">✏️</span>
            <span
              className={`text-[9px] font-bold leading-none ${isManualInput ? "text-slate-200" : "text-slate-400"}`}
              style={{ writingMode: "vertical-rl", textOrientation: "upright", letterSpacing: "0.12em" }}
            >
              テンキー入力
            </span>
          </button>
        </>
      )}
    </nav>
  );
}
