"use client";

import { SaleDetailRow } from "@/lib/db";

function paymentInfo(method?: string): { icon: string; label: string; cls: string } {
  switch (method) {
    case "card":    return { icon: "💳", label: "カード",  cls: "bg-blue-50 text-blue-600 border-blue-200" };
    case "qr":      return { icon: "📱", label: "QR",      cls: "bg-emerald-50 text-emerald-600 border-emerald-200" };
    case "voucher": return { icon: "🎫", label: "商品券",  cls: "bg-amber-50 text-amber-600 border-amber-200" };
    default:        return { icon: "💴", label: "現金",    cls: "bg-slate-50 text-slate-500 border-slate-200" };
  }
}

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

interface Props {
  itemName:    string;
  emoji:       string;
  orders:      SaleDetailRow[];
  sourceTitle: string;
  onClose:     () => void;
  onViewDetail: (row: SaleDetailRow) => void;
}

export default function ItemReceiptsModal({
  itemName, emoji, orders, sourceTitle, onClose, onViewDetail,
}: Props) {
  const sorted      = [...orders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const totalRevenue = sorted.reduce((s, o) => s + safeNum(o.total_amount), 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[82vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-1">
                会計履歴 › {sourceTitle}
              </p>
              <h3 className="text-xl font-black text-slate-900 leading-snug flex items-center gap-2">
                <span className="text-2xl">{emoji}</span>
                <span>{itemName}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {sorted.length}件の会計 · 合計 ¥{totalRevenue.toLocaleString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex-shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 text-sm transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 会計リスト */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {sorted.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">データがありません</p>
          ) : (
            sorted.map(o => {
              const dt        = new Date(o.created_at);
              const datePart  = dt.toLocaleDateString("ja-JP", {
                timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit",
              });
              const timePart  = dt.toLocaleTimeString("sv-SE", {
                timeZone: "Asia/Tokyo",
              }).slice(0, 5);
              const m = safeNum(o.male_count);
              const f = safeNum(o.female_count);

              return (
                <div
                  key={o.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  {/* 日時 */}
                  <div className="flex-shrink-0 w-[3.75rem] text-right">
                    <p className="text-xs font-bold text-slate-700 tabular-nums">{datePart}</p>
                    <p className="text-[10px] text-slate-400 tabular-nums">{timePart}</p>
                  </div>

                  {/* 金額 + スタッフ + 客層 + 支払 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-violet-700 tabular-nums">
                      ¥{safeNum(o.total_amount).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {o.staff_name && (
                        <span className="text-[10px] font-semibold text-slate-500">
                          {o.staff_name}
                        </span>
                      )}
                      {m + f > 0 && (
                        <span className="text-[10px] text-slate-400">
                          {m > 0 ? `👨×${m}` : ""}
                          {m > 0 && f > 0 ? " " : ""}
                          {f > 0 ? `👩×${f}` : ""}
                        </span>
                      )}
                      {(() => { const p = paymentInfo(o.payment_method); return (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold border ${p.cls}`}>
                          {p.icon} {p.label}
                        </span>
                      ); })()}
                    </div>
                  </div>

                  {/* 詳細ボタン */}
                  <button
                    onClick={() => onViewDetail(o)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-600 text-[11px] font-bold transition-colors active:scale-95"
                  >
                    詳細 ›
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-slate-400">{sorted.length}件の会計</p>
          <p className="text-sm font-black text-violet-700 tabular-nums">
            合計 ¥{totalRevenue.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
