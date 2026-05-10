"use client";

import { HoldEntry } from "@/types/pos";

interface Props {
  holds: HoldEntry[];
  onRecall: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function HoldRecallModal({ holds, onRecall, onDelete, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900">保留中の注文</h3>
            {holds.length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">{holds.length}件 · タップで呼び出し</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-50">
          {holds.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">保留中の注文はありません</p>
          ) : (
            holds.map(h => {
              const dt = new Date(h.heldAt);
              const timeLabel = dt.toLocaleTimeString("ja-JP", {
                timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit",
              });
              const totalQty  = h.items.reduce((s, i) => s + i.quantity, 0);
              const baseAmt   = h.items.reduce((s, i) =>
                s + Math.round(i.unitPrice * (1 + i.taxRate) * i.quantity), 0);
              const names     = h.items.slice(0, 2).map(i => `${i.menuItem.emoji ?? ""}${i.menuItem.name}`).join("・");
              const hasMore   = h.items.length > 2;
              const maleCount   = h.maleCount  ?? 0;
              const femaleCount = h.femaleCount ?? 0;
              const hasGuests   = maleCount > 0 || femaleCount > 0;
              const hasDiscount = !!(h.discount && h.discount.value > 0);

              // Compute discounted total for display
              const discountAmt = hasDiscount && h.discount ? (() => {
                const sub = h.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
                if (h.discount.type === "percent") return Math.round(baseAmt * Math.min(100, h.discount.value) / 100);
                if (h.discount.inclusive) return Math.min(baseAmt, h.discount.value);
                const factor = sub > 0 ? baseAmt / sub : 1;
                return Math.min(baseAmt, Math.round(h.discount.value * factor));
              })() : 0;
              const displayAmt = baseAmt - discountAmt;

              return (
                <div key={h.id} className="px-4 py-4">
                  {/* 時刻 + 商品名 */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-amber-600 mb-0.5">{timeLabel} 保留</p>
                      <p className="text-sm font-semibold text-slate-800 truncate leading-snug">
                        {names}{hasMore ? "…" : ""}
                      </p>
                    </div>
                    {/* 金額 */}
                    <div className="text-right flex-shrink-0">
                      {discountAmt > 0 && (
                        <p className="text-[10px] text-slate-300 line-through tabular-nums">¥{baseAmt.toLocaleString()}</p>
                      )}
                      <p className="text-sm font-black text-indigo-700 tabular-nums">¥{displayAmt.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* メタ情報バッジ行 */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                      {totalQty}品
                    </span>
                    {hasGuests && (
                      <span className="text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        {maleCount > 0 && <span>👨 {maleCount}</span>}
                        {maleCount > 0 && femaleCount > 0 && <span className="text-slate-300">/</span>}
                        {femaleCount > 0 && <span>👩 {femaleCount}</span>}
                      </span>
                    )}
                    {hasDiscount && (
                      <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                        🏷️ 割引あり
                      </span>
                    )}
                  </div>

                  {/* アクションボタン */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onDelete(h.id)}
                      className="flex-none px-3 py-1.5 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 text-xs font-semibold transition-colors"
                    >
                      削除
                    </button>
                    <button
                      onClick={() => { onRecall(h.id); onClose(); }}
                      className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors active:scale-95"
                    >
                      ▶ 呼び出す
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 text-center">
            最大20件まで保留可。呼び出すと現在の注文と入れ替わります。
          </p>
        </div>
      </div>
    </div>
  );
}
