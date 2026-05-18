"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { TaxRate } from "@/types/pos";

const TAX_OPTIONS: { rate: TaxRate; label: string; cls: string }[] = [
  { rate: 0.10, label: "10%", cls: "bg-indigo-600 text-white" },
  { rate: 0.08, label: "8%",  cls: "bg-teal-600 text-white" },
  { rate: 0.01, label: "1%",  cls: "bg-purple-600 text-white" },
  { rate: 0,    label: "0%",  cls: "bg-slate-600 text-white" },
];

const REASONS = ["サービス", "端数切捨", "その他"] as const;
type Reason = typeof REASONS[number];

interface EditingItem {
  itemKey: string;
  name: string;
  currentUnitPrice: number;
  taxRate: TaxRate;
}

export interface DiscountInputMode {
  label: string;
  type: "fixed" | "percent";
  onTypeChange: (t: "fixed" | "percent") => void;
  currentValue?: number;
  /** 固定割引の上限（商品合計など）。未指定なら上限なし。%は自動で100上限 */
  maxValue?: number;
  /** 税込ベースで割引するか（固定額のみ有効） */
  inclusive?: boolean;
  onInclusiveChange?: (v: boolean) => void;
}

interface FloatingNumpadProps {
  onAdd: (price: number, taxRate: TaxRate, label: string) => void;
  onEditConfirm?: (itemKey: string, price: number, taxRate: TaxRate, reason?: string) => void;
  onDiscountConfirm?: (value: number) => void;
  onDiscountClear?: () => void;
  onClose: () => void;
  editingItem?: EditingItem | null;
  defaultTaxRate?: TaxRate;
  discountInput?: DiscountInputMode;
}

export default function FloatingNumpad({
  onAdd, onEditConfirm, onDiscountConfirm, onDiscountClear, onClose,
  editingItem, defaultTaxRate = 0.10, discountInput,
}: FloatingNumpadProps) {
  const isEditMode     = !!editingItem;
  const isDiscountMode = !!discountInput;

  const [input, setInput]     = useState(
    isEditMode     ? String(editingItem!.currentUnitPrice) :
    isDiscountMode ? (discountInput!.currentValue ? String(discountInput!.currentValue) : "") :
    ""
  );
  const [taxRate, setTaxRate] = useState<TaxRate>(isEditMode ? editingItem!.taxRate : defaultTaxRate);
  const [label, setLabel]     = useState(isEditMode ? editingItem!.name : "");
  const [reason, setReason]   = useState<Reason | null>(null);
  const [taxInclInput, setTaxInclInput] = useState(false);
  const [pos, setPos]         = useState({ x: 80, y: 60 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const startDrag = useCallback((clientX: number, clientY: number) => {
    dragOffset.current = { x: clientX - pos.x, y: clientY - pos.y };
    setDragging(true);
  }, [pos]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  }, [startDrag]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => setPos({
      x: Math.max(0, e.clientX - dragOffset.current.x),
      y: Math.max(0, e.clientY - dragOffset.current.y),
    });
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      setPos({
        x: Math.max(0, t.clientX - dragOffset.current.x),
        y: Math.max(0, t.clientY - dragOffset.current.y),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging]);

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
    setInput(prev => String(Math.max(0, parseInt(prev || "0", 10) + delta)));
  };

  const rawValue = parseInt(input || "0", 10);

  // 割引モードでは実際に適用される値（上限キャップ後）を使う
  const effectiveDiscountValue = (() => {
    if (!isDiscountMode || rawValue <= 0) return rawValue;
    if (discountInput!.type === "percent") return Math.min(100, rawValue);
    if (discountInput!.maxValue != null)   return Math.min(rawValue, discountInput!.maxValue);
    return rawValue;
  })();
  const isCapped = isDiscountMode && effectiveDiscountValue < rawValue;

  const taxIncl  = rawValue > 0 ? Math.round(rawValue * (1 + taxRate)) : 0;
  const origIncl = isEditMode ? Math.round(editingItem!.currentUnitPrice * (1 + editingItem!.taxRate)) : 0;
  const diffIncl = isEditMode && rawValue > 0 ? taxIncl - origIncl : 0;

  // 税込入力モード: 入力値を税込として扱い、税抜に逆算
  const taxExclFromIncl = taxInclInput && rawValue > 0 && taxRate > 0
    ? Math.round(rawValue / (1 + taxRate))
    : rawValue;
  const displayTaxIncl = taxInclInput ? rawValue : taxIncl;
  const displayTaxExcl = taxInclInput ? taxExclFromIncl : rawValue;

  const handleConfirm = () => {
    if (rawValue <= 0) return;
    if (isDiscountMode && onDiscountConfirm) {
      onDiscountConfirm(effectiveDiscountValue);
    } else if (isEditMode && onEditConfirm) {
      onEditConfirm(editingItem!.itemKey, rawValue, taxRate, reason ?? undefined);
    } else {
      const priceToAdd = taxInclInput ? taxExclFromIncl : rawValue;
      onAdd(priceToAdd, taxRate, label.trim() || "手入力");
      setInput("");
      setLabel("");
    }
  };

  const headerBg = isDiscountMode ? "bg-orange-600"
    : isEditMode ? "bg-violet-700"
    : "bg-slate-800";

  const headerTitle = isDiscountMode ? "🏷️ 割引を入力"
    : isEditMode ? "✎ 価格を変更"
    : "✏️ 手入力";

  const headerSub = isDiscountMode ? discountInput!.label
    : isEditMode ? editingItem!.name
    : null;

  const headerSubCls = isDiscountMode ? "text-orange-200" : "text-violet-200";

  return (
    <div
      className="fixed z-40 select-none"
      style={{ left: pos.x, top: pos.y, width: 300 }}
    >
      <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] ring-1 ring-black/10 overflow-hidden">

        {/* ドラッグハンドル */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={`flex items-center justify-between px-4 py-3 cursor-grab active:cursor-grabbing ${headerBg}`}
        >
          <div className="min-w-0">
            <span className="text-white text-sm font-bold">{headerTitle}</span>
            {headerSub && (
              <p className={`text-[10px] truncate mt-0.5 ${headerSubCls}`}>{headerSub}</p>
            )}
          </div>
          <button
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onClick={onClose}
            className="w-7 h-7 ml-2 flex-shrink-0 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">

          {/* 品名入力（追加モードのみ） */}
          {!isEditMode && !isDiscountMode && (
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              autoFocus
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="品名を入力（例：コース料理）"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 transition-all"
            />
          )}

          {/* 割引モード: 種別トグル（円引き/％引き） */}
          {isDiscountMode && (
            <div className="flex gap-2">
              {(["fixed", "percent"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { discountInput!.onTypeChange(t); setInput(""); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    discountInput!.type === t
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {t === "fixed" ? "円引き" : "％引き"}
                </button>
              ))}
            </div>
          )}

          {/* 割引モード: 税込/税抜トグル（onInclusiveChange が渡された場合は円引き・%引き両方で表示） */}
          {isDiscountMode && discountInput!.onInclusiveChange && (
            <div className="flex gap-2">
              {([true, false] as const).map(inc => (
                <button
                  key={String(inc)}
                  onClick={() => { discountInput!.onInclusiveChange!(inc); setInput(""); }}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    discountInput!.inclusive === inc
                      ? "bg-orange-400 text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {inc ? "税込から" : "税抜から"}
                </button>
              ))}
            </div>
          )}

          {/* 割引モード: 金額表示 */}
          {isDiscountMode && (
            <div className="rounded-2xl bg-orange-50 px-4 py-3 text-center">
              <p className="text-3xl font-black text-orange-700 tabular-nums leading-none">
                {effectiveDiscountValue > 0 ? effectiveDiscountValue.toLocaleString() : "0"}
                <span className="text-sm font-normal text-orange-400 ml-1.5">
                  {discountInput!.type === "fixed" ? "円引き" : "% 引き"}
                </span>
              </p>
              {isCapped && (
                <p className="text-xs text-red-400 mt-1 font-bold">
                  ※ 上限 {discountInput!.type === "percent" ? "100%" : `¥${discountInput!.maxValue?.toLocaleString()}`} に丸めます
                </p>
              )}
              {!isCapped && discountInput!.currentValue != null && discountInput!.currentValue > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  現在: {discountInput!.currentValue.toLocaleString()}
                  {discountInput!.type === "fixed" ? "円" : "%"}引き
                </p>
              )}
            </div>
          )}

          {/* 編集モード: Before → After 比較 */}
          {isEditMode && (
            <div className="rounded-2xl bg-violet-50 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-center flex-1 min-w-0">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">変更前</p>
                  <p className="text-base font-black text-slate-400 tabular-nums line-through leading-none">
                    {origIncl.toLocaleString()}<span className="text-[9px] font-normal ml-0.5">円</span>
                  </p>
                </div>
                <span className="text-slate-300 text-xl flex-shrink-0">→</span>
                <div className="text-center flex-1 min-w-0">
                  <p className="text-[9px] text-violet-600 font-bold uppercase tracking-widest mb-1">変更後</p>
                  <p className="text-2xl font-black text-violet-700 tabular-nums leading-none">
                    {taxIncl > 0 ? taxIncl.toLocaleString() : "─"}
                    <span className="text-[9px] font-normal ml-0.5">円</span>
                  </p>
                </div>
              </div>
              {diffIncl !== 0 && (
                <p className={`text-center text-[10px] font-bold mt-2 tabular-nums ${diffIncl < 0 ? "text-red-500" : "text-emerald-600"}`}>
                  {diffIncl > 0 ? "+" : "−"}{Math.abs(diffIncl).toLocaleString()}円（税込）
                </p>
              )}
            </div>
          )}

          {/* 追加モード: 税込/税抜トグル + 金額表示 */}
          {!isEditMode && !isDiscountMode && (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => { setTaxInclInput(false); setInput(""); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    !taxInclInput ? "bg-slate-800 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  税抜で入力
                </button>
                <button
                  onClick={() => { setTaxInclInput(true); setInput(""); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    taxInclInput ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  税込で入力
                </button>
              </div>
              <div className="rounded-2xl px-4 py-3 text-center bg-slate-50">
                <p className="text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                  {rawValue > 0 ? rawValue.toLocaleString() : "0"}
                  <span className="text-base font-normal text-slate-400 ml-1">
                    円（{taxInclInput ? "税込" : "税抜"}）
                  </span>
                </p>
                {rawValue > 0 && taxRate > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {taxInclInput
                      ? `税抜換算 ${displayTaxExcl.toLocaleString()}円`
                      : `税込 ${displayTaxIncl.toLocaleString()}円`}
                  </p>
                )}
              </div>
            </>
          )}

          {/* 編集モード: クイック加減算 */}
          {isEditMode && (
            <div className="grid grid-cols-4 gap-1.5">
              {([+100, +10, -10, -100] as const).map(delta => (
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

          {/* 編集モード: リセットボタン */}
          {isEditMode && (
            <button
              onClick={() => setInput(String(editingItem!.currentUnitPrice))}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold transition-all active:scale-95"
            >
              ↩ 元の価格に戻す（{editingItem!.currentUnitPrice.toLocaleString()}円 税抜）
            </button>
          )}

          {/* 税率選択（割引モード以外） */}
          {!isDiscountMode && (
            <div className="grid grid-cols-4 gap-1.5">
              {TAX_OPTIONS.map(opt => (
                <button
                  key={opt.rate}
                  onClick={() => setTaxRate(opt.rate)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ring-2 ${
                    taxRate === opt.rate
                      ? `${opt.cls} ring-current`
                      : "bg-slate-50 text-slate-500 ring-transparent hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* 編集モード: 変更理由 */}
          {isEditMode && (
            <div className="space-y-1.5">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center">変更理由</p>
              <div className="flex gap-1.5">
                {REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setReason(prev => prev === r ? null : r)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95 ${
                      reason === r
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 割引解除ボタン（割引モードかつ既存割引あり時） */}
          {isDiscountMode && onDiscountClear && (
            <button
              onClick={onDiscountClear}
              className="w-full py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 text-xs font-bold transition-all active:scale-95 ring-1 ring-red-200"
            >
              ✕ この割引を解除する
            </button>
          )}

          {/* 確定ボタン */}
          <button
            onClick={handleConfirm}
            disabled={rawValue <= 0}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 ${
              rawValue > 0
                ? isDiscountMode
                  ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-200"
                  : isEditMode
                  ? "bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            }`}
          >
            {rawValue > 0
              ? isDiscountMode
                ? `割引を設定 → ${effectiveDiscountValue.toLocaleString()}${discountInput!.type === "fixed" ? "円引き" : "%引き"}`
                : isEditMode
                ? `価格を変更 → ${taxIncl.toLocaleString()}円 税込`
                : `注文に追加 ${displayTaxIncl.toLocaleString()}円 税込`
              : "金額を入力してください"
            }
          </button>

        </div>
      </div>
    </div>
  );
}
