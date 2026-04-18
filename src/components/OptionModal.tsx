"use client";

import { useState } from "react";
import { MenuItem, OrderOptions, RiceType, RiceSize } from "@/types/pos";
import {
  riceTypeLabels,
  riceSizeLabels,
  riceSizeAdjustments,
} from "@/data/menu";

interface OptionModalProps {
  item: MenuItem;
  onConfirm: (options: OrderOptions) => void;
  onClose: () => void;
}

const riceTypes: RiceType[] = ["white", "mochi"];
const riceSizes: RiceSize[] = ["small", "regular", "large", "extra"];

export default function OptionModal({ item, onConfirm, onClose }: OptionModalProps) {
  const [riceType, setRiceType] = useState<RiceType>("white");
  const [riceSize, setRiceSize] = useState<RiceSize>("regular");

  const adjustment = riceSizeAdjustments[riceSize];
  const unitPrice = item.price + adjustment;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <span className="text-4xl leading-none mt-0.5">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-800 text-sm leading-snug">
                {item.name}
              </h3>
              <p className="text-indigo-600 font-bold text-lg mt-0.5">
                ¥{item.price.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ご飯の種類 */}
          <div>
            <p className="text-sm font-semibold text-slate-600 mb-2">ご飯の種類</p>
            <div className="flex gap-2">
              {riceTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setRiceType(type)}
                  className={`flex-1 py-3.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    riceType === type
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {riceTypeLabels[type]}
                  {type === "mochi" && (
                    <span className="block text-xs font-normal text-orange-500 mt-0.5">
                      数量限定
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ご飯の量 */}
          <div>
            <p className="text-sm font-semibold text-slate-600 mb-2">ご飯の量</p>
            <div className="grid grid-cols-2 gap-2">
              {riceSizes.map((size) => {
                const adj = riceSizeAdjustments[size];
                return (
                  <button
                    key={size}
                    onClick={() => setRiceSize(size)}
                    className={`py-3.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      riceSize === size
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {riceSizeLabels[size]}
                    <span
                      className={`block text-xs font-normal mt-0.5 ${
                        adj < 0
                          ? "text-red-500"
                          : adj > 0
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    >
                      {adj === 0 ? "±0円" : adj > 0 ? `+${adj}円` : `${adj}円`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 pb-6 space-y-3">
          <div className="flex justify-between items-center bg-slate-50 rounded-2xl px-4 py-3">
            <span className="text-sm font-semibold text-slate-600">単価</span>
            <span className="text-xl font-bold text-indigo-700">
              ¥{unitPrice.toLocaleString()}
            </span>
          </div>
          <button
            onClick={() => onConfirm({ riceType, riceSize })}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-base font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md"
          >
            注文に追加
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 text-slate-400 text-sm font-semibold hover:text-slate-600 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
