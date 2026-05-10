"use client";

import { useState } from "react";

interface NumpadModalProps {
  label: string;
  subtitle?: string;
  initialValue?: number;
  quickAdjusts?: number[];
  min?: number;
  confirmLabel?: string;
  onConfirm: (value: number) => void;
  onClose: () => void;
}

export default function NumpadModal({
  label,
  subtitle,
  initialValue = 0,
  quickAdjusts = [],
  min = 0,
  confirmLabel = "確定",
  onConfirm,
  onClose,
}: NumpadModalProps) {
  const [input, setInput] = useState(initialValue > 0 ? String(initialValue) : "");

  const handleKey = (key: string) => {
    setInput(prev => {
      if (key === "C")  return "";
      if (key === "⌫") return prev.slice(0, -1);
      if (key === "00") return prev ? prev + "00" : prev;
      if (prev.length >= 7) return prev;
      return prev + key;
    });
  };

  const adjust = (delta: number) => {
    setInput(prev => String(Math.max(min, parseInt(prev || "0", 10) + delta)));
  };

  const rawValue   = parseInt(input || "0", 10);
  const canConfirm = rawValue >= min;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] ring-1 ring-black/10 w-full max-w-xs overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-base font-black text-slate-900">{label}</p>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* 数値表示 */}
          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
            <p className="text-5xl font-black text-slate-900 tabular-nums leading-none tracking-tight">
              {rawValue > 0 ? rawValue.toLocaleString() : "0"}
            </p>
          </div>

          {/* クイック調整 */}
          {quickAdjusts.length > 0 && (
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${quickAdjusts.length}, 1fr)` }}
            >
              {quickAdjusts.map(delta => (
                <button
                  key={delta}
                  onClick={() => adjust(delta)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    delta > 0
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-200"
                      : "bg-red-50 text-red-600 hover:bg-red-100 ring-1 ring-red-200"
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
          )}

          {/* テンキー */}
          <div className="grid grid-cols-3 gap-2">
            {["7","8","9","4","5","6","1","2","3","C","0","⌫"].map(k => (
              <button
                key={k}
                onClick={() => handleKey(k)}
                className={`h-12 rounded-xl font-bold text-lg transition-all active:scale-95 ${
                  k === "C"
                    ? "bg-red-100 text-red-600 hover:bg-red-200 font-black"
                    : k === "⌫"
                    ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    : "bg-slate-50 text-slate-900 hover:bg-slate-100"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <button
            onClick={() => handleKey("00")}
            className="w-full h-10 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-xl font-bold text-lg transition-all active:scale-95"
          >
            00
          </button>

          {/* 確定ボタン */}
          <button
            onClick={() => { if (canConfirm) onConfirm(rawValue); }}
            disabled={!canConfirm}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 ${
              canConfirm
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
