"use client";

import { SalesRecord, OrderOptions } from "@/types/pos";
import { riceTypeLabels, riceSizeLabels } from "@/data/menu";
import { computeItemDiscountAmount, computeItemDiscountDisplay } from "@/lib/utils";

function optionLabel(opts: OrderOptions): string {
  if (opts.selections?.length > 0) return opts.selections.map(s => s.itemName).join(" / ");
  if (opts.riceSize === "none") return "";
  return `${riceTypeLabels[opts.riceType]} / ${riceSizeLabels[opts.riceSize]}`;
}

interface SalesHistoryProps {
  records: SalesRecord[];
  onClose: () => void;
}

function discountRow(record: SalesRecord) {
  const amt = record.subtotal + record.tax - record.total;
  if (amt <= 0) return null;
  const label = record.discount
    ? record.discount.type === "percent"
      ? `割引 (${record.discount.value}%)`
      : "割引"
    : "割引";
  return { label, amt };
}

export default function SalesHistory({ records, onClose }: SalesHistoryProps) {
  const grandTotal = records.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
        <h2 className="text-lg font-bold text-slate-800">売上集計</h2>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold transition-colors"
        >
          ✕
        </button>
      </div>

      {records.length > 0 && (
        <div className="px-5 py-4 bg-green-50 border-b border-green-100 flex-shrink-0">
          <div className="flex justify-between text-sm text-slate-600 mb-1">
            <span>会計件数</span>
            <span>{records.length}件</span>
          </div>
          <div className="flex justify-between font-bold text-green-700 text-lg">
            <span>本日の売上合計</span>
            <span>¥{grandTotal.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <span className="text-4xl">📋</span>
            <p className="text-sm">履歴がありません</p>
          </div>
        ) : (
          [...records].reverse().map((record, idx) => (
            <div
              key={record.id}
              className="border border-slate-200 rounded-2xl p-4 space-y-2 bg-white shadow-sm"
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-500">
                  #{records.length - idx}
                </span>
                <span className="text-xs text-slate-400">
                  {record.createdAt.toLocaleTimeString("ja-JP")}
                </span>
              </div>
              <div className="space-y-1.5">
                {record.items.map((item) => {
                  const label      = optionLabel(item.options);
                  const rawTotal      = item.unitPrice * item.quantity;
                  const discAmt       = item.itemDiscount
                    ? computeItemDiscountAmount(item.itemDiscount, rawTotal, item.taxRate) : 0;
                  const displayDiscAmt = item.itemDiscount
                    ? computeItemDiscountDisplay(item.itemDiscount, rawTotal, item.taxRate) : 0;
                  const effTotal      = rawTotal - discAmt;
                  const taxIncl       = effTotal + Math.floor(effTotal * item.taxRate);
                  return (
                    <div key={item.itemKey} className="text-sm text-slate-700">
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {item.menuItem.emoji} {item.menuItem.name} × {item.quantity}
                        </span>
                        <span className={discAmt > 0 ? "text-orange-600" : ""}>
                          ¥{taxIncl.toLocaleString()}
                        </span>
                      </div>
                      {label && (
                        <span className="text-xs text-slate-400 block">{label}</span>
                      )}
                      {item.priceAdjustReason && (
                        <span className="text-xs text-violet-500 block">※{item.priceAdjustReason}</span>
                      )}
                      {discAmt > 0 && item.itemDiscount && (
                        <span className="text-xs text-orange-500 block">
                          🏷️ {item.itemDiscount.type === "percent"
                            ? `${item.itemDiscount.value}%引き `
                            : ""}−¥{displayDiscAmt.toLocaleString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {(() => {
                const disc = discountRow(record);
                return disc ? (
                  <div className="flex justify-between text-sm text-red-500 font-medium">
                    <span>{disc.label}</span>
                    <span>-¥{disc.amt.toLocaleString()}</span>
                  </div>
                ) : null;
              })()}
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-100">
                <span>合計（税込）</span>
                <span className="text-indigo-600">¥{record.total.toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
