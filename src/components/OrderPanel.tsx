"use client";

import { OrderItem } from "@/types/pos";
import { riceTypeLabels, riceSizeLabels } from "@/data/menu";

interface OrderPanelProps {
  items: OrderItem[];
  onIncrement: (itemKey: string) => void;
  onDecrement: (itemKey: string) => void;
  onRemove: (itemKey: string) => void;
  onCheckout: () => void;
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
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const tax8  = items.filter(i => i.taxRate === 0.08)
    .reduce((s, i) => s + Math.floor(i.unitPrice * i.quantity * 0.08), 0);
  const tax10 = items.filter(i => i.taxRate === 0.10)
    .reduce((s, i) => s + Math.floor(i.unitPrice * i.quantity * 0.10), 0);
  const total = subtotal + tax8 + tax10;

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-white">注文リスト</h2>
          {items.length > 0 && (
            <span className="bg-indigo-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
              {items.reduce((s, i) => s + i.quantity, 0)}点
            </span>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors"
          >
            全削除
          </button>
        )}
      </div>

      {/* アイテムリスト */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
            <span className="text-5xl">🛒</span>
            <p className="text-sm">商品を選んでください</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.itemKey}
              className="flex items-center gap-2 bg-slate-800 rounded-xl p-3 border border-slate-700"
            >
              <span className="text-xl flex-shrink-0">{item.menuItem.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white leading-snug truncate">
                  {item.menuItem.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  [{riceTypeLabels[item.options.riceType]}/{riceSizeLabels[item.options.riceSize]}]
                </p>
                <p className="text-sm text-indigo-400 font-bold mt-0.5">
                  ¥{(item.unitPrice * item.quantity).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onDecrement(item.itemKey)}
                  className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 font-bold flex items-center justify-center hover:bg-slate-600 active:scale-90 transition-all text-sm"
                >
                  −
                </button>
                <span className="w-5 text-center font-bold text-white text-sm">
                  {item.quantity}
                </span>
                <button
                  onClick={() => onIncrement(item.itemKey)}
                  className="w-6 h-6 rounded-full bg-indigo-700 text-white font-bold flex items-center justify-center hover:bg-indigo-600 active:scale-90 transition-all text-sm"
                >
                  ＋
                </button>
                <button
                  onClick={() => onRemove(item.itemKey)}
                  className="w-6 h-6 rounded-full bg-red-900/50 text-red-400 font-bold flex items-center justify-center hover:bg-red-900 active:scale-90 transition-all ml-0.5 text-xs"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* フッター：合計 + 会計ボタン */}
      <div className="px-4 py-4 border-t border-slate-700 bg-slate-950 flex-shrink-0 space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span>小計（税抜）</span>
          <span>¥{subtotal.toLocaleString()}</span>
        </div>
        {tax10 > 0 && (
          <div className="flex justify-between text-xs text-slate-500">
            <span>消費税 10%</span>
            <span>¥{tax10.toLocaleString()}</span>
          </div>
        )}
        {tax8 > 0 && (
          <div className="flex justify-between text-xs text-teal-400">
            <span>消費税 8%（軽減）</span>
            <span>¥{tax8.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-slate-700">
          <span>合計（税込）</span>
          <span className="text-indigo-400">¥{total.toLocaleString()}</span>
        </div>
        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className={`w-full py-5 rounded-2xl text-lg font-bold transition-all mt-1 ${
            items.length > 0
              ? "bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 shadow-lg"
              : "bg-slate-800 text-slate-600 cursor-not-allowed"
          }`}
        >
          会計に進む →
        </button>
      </div>
    </div>
  );
}
