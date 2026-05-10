"use client";

import { ItemBreakdown } from "@/lib/analysisUtils";

function fmt(n: number) {
  return `¥${Math.round(isFinite(n) ? n : 0).toLocaleString()}`;
}

interface Props {
  title: string;
  subtitle?: string;
  items: ItemBreakdown[];
  onClose: () => void;
  onItemClick?: (itemName: string, emoji: string) => void;
}

export default function AnalysisDetailModal({ title, subtitle, items, onClose, onItemClick }: Props) {
  const grandTotal = items.reduce((s, i) => s + i.totalIncTax, 0);
  const totalQty   = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[82vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-1">商品別内訳</p>
            <h3 className="text-xl font-black text-slate-900 leading-snug">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex-shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 商品リスト */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">データがありません</p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_70px_44px_90px] gap-2 px-6 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>商品</span>
                <span className="text-right">単価（税込）</span>
                <span className="text-right">数量</span>
                <span className="text-right">小計（税込）</span>
              </div>
              {items.map((item, idx) => {
                const unitIncTax = Math.round(item.unitPriceExTax * (1 + item.taxRate));
                return (
                  <div
                    key={item.name}
                    onClick={() => onItemClick?.(item.name, item.emoji)}
                    className={`grid grid-cols-[1fr_70px_44px_90px] gap-2 items-center px-6 py-3.5 border-b border-slate-50 transition-colors ${
                      onItemClick ? "cursor-pointer hover:bg-violet-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl flex-shrink-0">{item.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate leading-snug">{item.name}</p>
                        {idx === 0 && (
                          <span className="text-[9px] font-black text-amber-500 uppercase tracking-wide">▲ No.1</span>
                        )}
                        <p className="text-[9px] text-slate-400 mt-0.5">{(item.taxRate * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 text-right tabular-nums">{fmt(unitIncTax)}</p>
                    <p className="text-sm text-slate-700 text-right tabular-nums font-semibold">{item.quantity}</p>
                    <p className="text-sm font-black text-violet-700 text-right tabular-nums">{fmt(item.totalIncTax)}</p>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* フッター合計 */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-xs text-slate-400">{items.length}種 · {totalQty}食</p>
            {onItemClick && (
              <p className="text-[10px] text-violet-400 mt-0.5">商品をタップすると会計履歴を表示 ›</p>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-slate-500">合計（税込）</span>
            <span className="text-xl font-black text-violet-700 tabular-nums">{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
