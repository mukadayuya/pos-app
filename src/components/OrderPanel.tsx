"use client";

import { useState } from "react";
import { OrderItem, OrderOptions, OrderDiscount } from "@/types/pos";
import { riceTypeLabels, riceSizeLabels } from "@/data/menu";
import { computeTaxTotals, computeDiscountAmount, computeItemDiscountAmount, computeItemDiscountDisplay } from "@/lib/utils";
import NumpadModal from "./NumpadModal";
import FloatingNumpad from "./FloatingNumpad";

function optionLabel(opts: OrderOptions): string {
  if (opts.selections?.length > 0) return opts.selections.map(s => s.itemName).join(" / ");
  if (opts.riceSize === "none") return "";
  return `${riceTypeLabels[opts.riceType]} / ${riceSizeLabels[opts.riceSize]}`;
}

function TrashIcon({ sm }: { sm?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={sm ? "w-3 h-3" : "w-3.5 h-3.5"}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

interface OrderPanelProps {
  items: OrderItem[];
  maleCount: number;
  femaleCount: number;
  discount: OrderDiscount | null;
  holdCount: number;
  onMaleChange: (n: number) => void;
  onFemaleChange: (n: number) => void;
  onIncrement: (itemKey: string) => void;
  onDecrement: (itemKey: string) => void;
  onRemove: (itemKey: string) => void;
  onCheckout: () => void;
  onClear: () => void;
  onDiscountChange: (d: OrderDiscount | null) => void;
  onItemDiscountChange: (itemKey: string, discount: OrderDiscount | null) => void;
  onHold: () => void;
  onRecallOpen: () => void;
  onEditPrice?: (itemKey: string) => void;
}

function GenderCounter({
  icon, label, count, onDecrement, onIncrement, color, onEdit,
}: {
  icon: string; label: string; count: number;
  onDecrement: () => void; onIncrement: () => void;
  color: "blue" | "pink";
  onEdit?: () => void;
}) {
  const incrCls = color === "blue"
    ? "bg-blue-600 hover:bg-blue-700 shadow-[0_2px_8px_rgba(37,99,235,0.45)]"
    : "bg-pink-600 hover:bg-pink-700 shadow-[0_2px_8px_rgba(219,39,119,0.45)]";

  return (
    <div className="flex-1 flex flex-col items-center gap-2 bg-white rounded-2xl py-3 ring-1 ring-slate-200 shadow-sm">
      <p className="text-[10px] text-slate-600 font-bold tracking-wide">{icon} {label}</p>
      <div className="flex items-center gap-1.5">
        {/* デクリメント */}
        <button
          onClick={onDecrement}
          className="w-7 h-7 rounded-full bg-slate-100 ring-2 ring-slate-300 text-slate-800 flex items-center justify-center font-black text-base hover:bg-slate-200 active:scale-90 transition-all duration-150"
        >
          −
        </button>

        {/* 数値 ＋ ペンアイコン → クリックでテンキー */}
        <button
          onClick={onEdit}
          className="flex items-center gap-1 px-2.5 min-h-[40px] bg-slate-50 ring-2 ring-slate-300 rounded-xl hover:bg-indigo-50 hover:ring-indigo-400 active:scale-95 transition-all duration-150 group"
          title="タップして直接入力"
        >
          <span className="font-black text-slate-900 text-xl tabular-nums leading-none">{count}</span>
          <span className="text-indigo-600 group-hover:text-indigo-700 transition-colors flex-shrink-0">
            <PenIcon />
          </span>
        </button>

        {/* インクリメント */}
        <button
          onClick={onIncrement}
          className={`w-7 h-7 rounded-full text-white flex items-center justify-center font-black text-base active:scale-90 transition-all duration-150 ${incrCls}`}
        >
          ＋
        </button>
      </div>
    </div>
  );
}

export default function OrderPanel({
  items, maleCount, femaleCount, discount, holdCount,
  onMaleChange, onFemaleChange, onIncrement, onDecrement, onRemove,
  onCheckout, onClear, onDiscountChange, onItemDiscountChange, onHold, onRecallOpen, onEditPrice,
}: OrderPanelProps) {
  const [discountOpen, setDiscountOpen]               = useState(false);
  const [numpadTarget, setNumpadTarget]               = useState<"male" | "female" | null>(null);
  const [showDiscountNumpad, setShowDiscountNumpad]   = useState(false);
  const [itemDiscountKey, setItemDiscountKey]         = useState<string | null>(null);
  const [itemDiscountType, setItemDiscountType]       = useState<"fixed" | "percent">("fixed");
  const [itemDiscountInclusive, setItemDiscountInclusive] = useState(false);
  const [showClearConfirm, setShowClearConfirm]       = useState(false);

  const { subtotal, itemDiscountTotal, tax8, tax10, taxOther, baseTotal } = computeTaxTotals(items);
  const effectiveSubtotal = subtotal - itemDiscountTotal;
  const discountAmount = discount ? computeDiscountAmount(discount, effectiveSubtotal, baseTotal) : 0;
  const total      = Math.max(0, baseTotal - discountAmount);
  const totalQty   = items.reduce((s, i) => s + i.quantity, 0);
  const totalGuests = maleCount + femaleCount;

  const openItemDiscount = (item: OrderItem) => {
    setItemDiscountKey(item.itemKey);
    setItemDiscountType(item.itemDiscount?.type ?? "fixed");
    setItemDiscountInclusive(item.itemDiscount?.inclusive ?? false);
  };

  const handleDiscountTypeToggle = (t: "fixed" | "percent") => {
    if (!discount) return;
    onDiscountChange({ ...discount, type: t, value: 0 });
  };

  const handleDiscountInclusiveToggle = () => {
    if (!discount) return;
    onDiscountChange({ ...discount, inclusive: !discount.inclusive });
  };

  const openDiscount = () => {
    if (!discount) onDiscountChange({ type: "fixed", value: 0, inclusive: true });
    setDiscountOpen(o => !o);
  };

  const clearDiscount = () => {
    onDiscountChange(null);
    setDiscountOpen(false);
  };

  const discountTargetItem = itemDiscountKey ? items.find(i => i.itemKey === itemDiscountKey) : null;

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-100 shadow-[-6px_0_20px_rgb(0,0,0,0.03)] relative">

      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">注文リスト</h2>
          {totalQty > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-[0_2px_6px_rgba(99,102,241,0.4)]">
              {totalQty}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {holdCount > 0 && (
            <button
              onClick={onRecallOpen}
              className="text-[11px] font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg transition-colors"
            >
              保留 {holdCount}件
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-lg transition-all duration-150 active:scale-95 shadow-sm"
            >
              <TrashIcon sm />
              全削除
            </button>
          )}
        </div>
      </div>

      {/* ── アイテムリスト ── */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-1.5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 pb-16">
            <span className="text-5xl opacity-20">🛒</span>
            <p className="text-xs text-slate-300 font-medium">商品を選んでください</p>
          </div>
        ) : (
          items.map((item) => {
            const rawTotal      = item.unitPrice * item.quantity;
            const discAmt       = item.itemDiscount ? computeItemDiscountAmount(item.itemDiscount, rawTotal, item.taxRate) : 0;
            const displayDiscAmt = item.itemDiscount ? computeItemDiscountDisplay(item.itemDiscount, rawTotal, item.taxRate) : 0;
            const effTotal      = rawTotal - discAmt;
            const taxIncl       = effTotal + Math.floor(effTotal * item.taxRate);
            const hasItemDisc   = !!(item.itemDiscount && item.itemDiscount.value > 0);

            return (
              <div
                key={item.itemKey}
                className="flex items-center gap-1 bg-slate-50 rounded-2xl px-2 py-2.5 ring-1 ring-slate-100"
              >
                {/* 左：タップで価格変更 */}
                <button
                  onClick={() => onEditPrice?.(item.itemKey)}
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left group rounded-xl px-1 hover:bg-indigo-50 active:bg-indigo-100 transition-colors duration-150"
                  title="タップして価格を変更"
                >
                  <span className="text-lg flex-shrink-0 leading-none">{item.menuItem.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 leading-snug truncate tracking-tight">
                      {item.menuItem.name}
                    </p>
                    {optionLabel(item.options) && (
                      <p className="text-[9px] text-slate-400 font-medium truncate">
                        {optionLabel(item.options)}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className={`text-sm font-black tracking-tight tabular-nums ${hasItemDisc ? "text-orange-600" : "text-indigo-600"}`}>
                        {taxIncl.toLocaleString()}
                        <span className="text-[9px] font-normal text-slate-400 ml-0.5">円</span>
                      </p>
                      {/* 価格編集ペンアイコン */}
                      <span className="text-slate-500 group-hover:text-indigo-600 transition-colors leading-none">
                        <PenIcon />
                      </span>
                    </div>
                    {item.priceAdjustReason && (
                      <span className="inline-block mt-0.5 text-[8px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
                        {item.priceAdjustReason}
                      </span>
                    )}
                    {hasItemDisc && (
                      <span className="inline-block mt-0.5 text-[8px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                        🏷️ {item.itemDiscount!.type === "percent"
                          ? `${item.itemDiscount!.value}%引 −¥${displayDiscAmt.toLocaleString()}`
                          : `−¥${displayDiscAmt.toLocaleString()}`}
                      </span>
                    )}
                  </div>
                </button>

                {/* 右：割引 + 数量 + 削除（最小幅・最大コントラスト） */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {/* 割引タグ：常にオレンジで存在感を示す */}
                  <button
                    onClick={() => openItemDiscount(item)}
                    title="商品割引"
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 ${
                      hasItemDisc
                        ? "bg-orange-500 text-white ring-1 ring-orange-600 hover:bg-orange-600"
                        : "bg-orange-50 ring-1 ring-orange-400 text-orange-500 hover:bg-orange-100"
                    }`}
                  >
                    <TagIcon />
                  </button>

                  {/* 減算 */}
                  <button
                    onClick={() => onDecrement(item.itemKey)}
                    className="w-6 h-6 rounded-full bg-slate-100 ring-1 ring-slate-300 text-slate-700 font-black flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-all duration-150 text-sm"
                  >
                    −
                  </button>

                  {/* 数量 */}
                  <span className="w-5 text-center font-black text-slate-900 text-sm tabular-nums">
                    {item.quantity}
                  </span>

                  {/* 加算 */}
                  <button
                    onClick={() => onIncrement(item.itemKey)}
                    className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center hover:bg-indigo-700 active:scale-90 transition-all duration-150 text-sm shadow-[0_2px_6px_rgba(99,102,241,0.4)]"
                  >
                    ＋
                  </button>

                  {/* 削除：常に赤・ひと目で「消す」と分かる */}
                  <button
                    onClick={() => onRemove(item.itemKey)}
                    className="w-6 h-6 rounded-full bg-red-50 ring-1 ring-red-400 text-red-500 flex items-center justify-center hover:bg-red-100 hover:text-red-600 active:scale-90 transition-all duration-150"
                  >
                    <TrashIcon sm />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── フッター ── */}
      <div className="px-4 pt-3 pb-4 border-t border-slate-100 flex-shrink-0">
        {/* 税内訳 */}
        <div className="space-y-1 mb-2">
          {itemDiscountTotal > 0 && (
            <>
              <div className="flex justify-between text-xs text-slate-400 font-medium">
                <span>明細合計（税抜）</span>
                <span className="tabular-nums">¥{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-orange-500 font-medium">
                <span>商品値引</span>
                <span className="tabular-nums">−¥{itemDiscountTotal.toLocaleString()}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-xs text-slate-400 font-medium">
            <span>{itemDiscountTotal > 0 ? "課税対象（税抜）" : "小計（税抜）"}</span>
            <span className="tabular-nums">¥{effectiveSubtotal.toLocaleString()}</span>
          </div>
          {tax10 > 0 && (
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>消費税 10%</span>
              <span className="tabular-nums">¥{tax10.toLocaleString()}</span>
            </div>
          )}
          {tax8 > 0 && (
            <div className="flex justify-between text-xs text-teal-600 font-medium">
              <span>消費税 8%（軽減）</span>
              <span className="tabular-nums">¥{tax8.toLocaleString()}</span>
            </div>
          )}
          {taxOther > 0 && (
            <div className="flex justify-between text-xs text-purple-600 font-medium">
              <span>消費税（その他）</span>
              <span className="tabular-nums">¥{taxOther.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* 合計 */}
        <div className="flex justify-between items-baseline pt-2.5 border-t border-slate-100 mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">合計</span>
          <div className="text-right">
            {discountAmount > 0 && (
              <p className="text-xs text-slate-300 line-through tabular-nums">¥{baseTotal.toLocaleString()}</p>
            )}
            <span className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
              ¥{total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 客層カウンター */}
        <div className="mb-3">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest text-center mb-2">客層</p>
          <div className="flex gap-2">
            <GenderCounter
              icon="👨" label="男性" count={maleCount} color="blue"
              onDecrement={() => onMaleChange(Math.max(0, maleCount - 1))}
              onIncrement={() => onMaleChange(maleCount + 1)}
              onEdit={() => setNumpadTarget("male")}
            />
            <GenderCounter
              icon="👩" label="女性" count={femaleCount} color="pink"
              onDecrement={() => onFemaleChange(Math.max(0, femaleCount - 1))}
              onIncrement={() => onFemaleChange(femaleCount + 1)}
              onEdit={() => setNumpadTarget("female")}
            />
          </div>
          <p className="text-center mt-2">
            <span className="text-[11px] text-slate-400 font-medium">
              合計{" "}
              <span className={`font-black text-sm ${totalGuests > 0 ? "text-slate-700" : "text-slate-300"}`}>
                {totalGuests}
              </span>
              {" "}名
            </span>
          </p>
        </div>

        {/* 保留 + 会計ボタン */}
        <div className="space-y-2">
          {items.length > 0 && (
            <button
              onClick={onHold}
              className="w-full py-2 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300 transition-all active:scale-[0.98]"
            >
              ⏸ 保留する
            </button>
          )}
          <button
            onClick={onCheckout}
            disabled={items.length === 0}
            className={`w-full py-4 rounded-2xl text-sm font-bold transition-all duration-200 ${
              items.length > 0
                ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-[0_4px_16px_rgba(99,102,241,0.35)]"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            }`}
          >
            {items.length > 0 ? "会計に進む →" : "商品を選んでください"}
          </button>
        </div>
      </div>

      {/* ── 客数テンキー ── */}
      {numpadTarget && (
        <NumpadModal
          label={numpadTarget === "male" ? "👨 男性客数" : "👩 女性客数"}
          subtitle="人数をテンキーで入力"
          initialValue={numpadTarget === "male" ? maleCount : femaleCount}
          quickAdjusts={[+10, +5, +1, -1, -5, -10]}
          min={0}
          confirmLabel="人数を確定"
          onConfirm={value => {
            if (numpadTarget === "male") onMaleChange(value);
            else onFemaleChange(value);
            setNumpadTarget(null);
          }}
          onClose={() => setNumpadTarget(null)}
        />
      )}

      {/* ── 全体割引 FloatingNumpad ── */}
      {showDiscountNumpad && discount && (
        <FloatingNumpad
          key="order-discount"
          onAdd={() => {}}
          discountInput={{
            label: "全体割引",
            type: discount.type,
            onTypeChange: (t) => { onDiscountChange({ ...discount, type: t, value: 0 }); },
            currentValue: discount.value || undefined,
            maxValue: discount.type === "percent" ? 100 : baseTotal,
          }}
          onDiscountConfirm={(value) => {
            onDiscountChange({ ...discount, value });
            setShowDiscountNumpad(false);
          }}
          onClose={() => setShowDiscountNumpad(false)}
        />
      )}

      {/* ── 商品別割引 FloatingNumpad ── */}
      {itemDiscountKey && discountTargetItem && (
        <FloatingNumpad
          key={`item-discount-${itemDiscountKey}`}
          onAdd={() => {}}
          discountInput={{
            label: `${discountTargetItem.menuItem.emoji} ${discountTargetItem.menuItem.name}`,
            type: itemDiscountType,
            onTypeChange: setItemDiscountType,
            currentValue: discountTargetItem.itemDiscount?.value || undefined,
            inclusive: itemDiscountInclusive,
            onInclusiveChange: setItemDiscountInclusive,
            maxValue: itemDiscountType === "percent" ? 100
              : itemDiscountInclusive
              ? Math.round(discountTargetItem.unitPrice * discountTargetItem.quantity * (1 + discountTargetItem.taxRate))
              : discountTargetItem.unitPrice * discountTargetItem.quantity,
          }}
          onDiscountConfirm={(value) => {
            onItemDiscountChange(itemDiscountKey, { type: itemDiscountType, value, inclusive: itemDiscountInclusive });
            setItemDiscountKey(null);
          }}
          onDiscountClear={discountTargetItem.itemDiscount ? () => {
            onItemDiscountChange(itemDiscountKey, null);
            setItemDiscountKey(null);
          } : undefined}
          onClose={() => setItemDiscountKey(null)}
        />
      )}

      {/* ── 全削除 確認ダイアログ ── */}
      {showClearConfirm && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/10 p-5 w-[85%] max-w-[230px]"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-red-600"><TrashIcon /></span>
              </div>
              <p className="text-sm font-black text-slate-900">注文を全て削除</p>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                全ての商品が削除されます。<br />この操作は元に戻せません。
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={() => { onClear(); setShowClearConfirm(false); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 active:scale-95 transition-all shadow-sm"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
