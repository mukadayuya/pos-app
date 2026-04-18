"use client";

import { OrderItem, SalesRecord } from "@/types/pos";
import { TAX_RATE, riceTypeLabels, riceSizeLabels } from "@/data/menu";

interface OrderPanelProps {
  items: OrderItem[];
  onIncrement: (itemKey: string) => void;
  onDecrement: (itemKey: string) => void;
  onRemove: (itemKey: string) => void;
  onCheckout: (record: SalesRecord) => void;
  onClear: () => void;
}

export default function OrderPanel({
  items,
  onIncrement,
  onDecrement,
  onRemove,
  onCheckout,
  onClear,
}: OrderPanelProps) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  const tax = Math.floor(subtotal * TAX_RATE);
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (items.length === 0) return;
    const record: SalesRecord = {
      id: crypto.randomUUID(),
      items: [...items],
      subtotal,
      tax,
      total,
      createdAt: new Date(),
    };
    onCheckout(record);
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-800">注文リスト</h2>
          {items.length > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full px-2 py-0.5">
              {items.reduce((s, i) => s + i.quantity, 0)}点
            </span>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-red-400 hover:text-red-600 font-semibold transition-colors"
          >
            全削除
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <span className="text-5xl">🛒</span>
            <p className="text-sm">商品を選んでください</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.itemKey}
              className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100"
            >
              <span className="text-2xl flex-shrink-0">{item.menuItem.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-snug truncate">
                  {item.menuItem.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  [{riceTypeLabels[item.options.riceType]}/{riceSizeLabels[item.options.riceSize]}]
                </p>
                <p className="text-sm text-indigo-600 font-bold mt-0.5">
                  ¥{(item.unitPrice * item.quantity).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => onDecrement(item.itemKey)}
                  className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center hover:bg-slate-300 active:scale-90 transition-all text-base"
                >
                  −
                </button>
                <span className="w-5 text-center font-bold text-slate-800 text-sm">
                  {item.quantity}
                </span>
                <button
                  onClick={() => onIncrement(item.itemKey)}
                  className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center hover:bg-indigo-200 active:scale-90 transition-all text-base"
                >
                  ＋
                </button>
                <button
                  onClick={() => onRemove(item.itemKey)}
                  className="w-7 h-7 rounded-full bg-red-50 text-red-400 font-bold flex items-center justify-center hover:bg-red-100 active:scale-90 transition-all ml-0.5 text-xs"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0 space-y-2">
        <div className="flex justify-between text-sm text-slate-500">
          <span>小計</span>
          <span>¥{subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-500">
          <span>消費税（10%）</span>
          <span>¥{tax.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xl font-bold text-slate-900 pt-2 border-t border-slate-200">
          <span>合計</span>
          <span className="text-indigo-700">¥{total.toLocaleString()}</span>
        </div>
        <button
          onClick={handleCheckout}
          disabled={items.length === 0}
          className={`w-full py-5 rounded-2xl text-xl font-bold transition-all mt-1 ${
            items.length > 0
              ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-md"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          会計する
        </button>
      </div>
    </div>
  );
}
