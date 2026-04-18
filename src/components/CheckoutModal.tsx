"use client";

import { SalesRecord } from "@/types/pos";
import { useEffect } from "react";

interface CheckoutModalProps {
  record: SalesRecord;
  onDone: () => void;
}

export default function CheckoutModal({ record, onDone }: CheckoutModalProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 4000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-8 flex flex-col items-center gap-5 shadow-2xl text-center">
        <div className="text-7xl animate-bounce">✅</div>
        <h2 className="text-2xl font-bold text-slate-800">会計完了</h2>
        <div className="bg-indigo-50 rounded-2xl px-8 py-5 w-full">
          <p className="text-sm text-slate-500 mb-1">お会計金額</p>
          <p className="text-4xl font-bold text-indigo-600">
            ¥{record.total.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            （内消費税 ¥{record.tax.toLocaleString()}）
          </p>
        </div>
        <p className="text-sm text-slate-400">ありがとうございました</p>
        <button
          onClick={onDone}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-lg font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md"
        >
          次の注文へ
        </button>
      </div>
    </div>
  );
}
