"use client";

import { useState } from "react";
import { MenuItem, OrderOptions, TaxRate, OptionGroup, OptionItem } from "@/types/pos";
import { DEFAULT_RICE_OPTION_GROUPS } from "@/data/menu";

interface OptionModalProps {
  item: MenuItem;
  taxRate: TaxRate;
  onConfirm: (options: OrderOptions) => void;
  onClose: () => void;
}

function defaultSelected(groups: OptionGroup[]): Record<string, string> {
  const init: Record<string, string> = {};
  for (const g of groups) {
    // Default to "regular" if it exists, else first item
    const preferred = g.items.find(i => i.id === "regular") ?? g.items[0];
    if (preferred) init[g.id] = preferred.id;
  }
  return init;
}

export default function OptionModal({ item, taxRate, onConfirm, onClose }: OptionModalProps) {
  // Use per-item groups, or fall back to default rice groups
  const groups: OptionGroup[] =
    item.options?.optionGroups !== undefined
      ? item.options.optionGroups
      : DEFAULT_RICE_OPTION_GROUPS;

  const hasGroups = groups.length > 0;
  const [selected, setSelected] = useState<Record<string, string>>(() => defaultSelected(groups));

  // "None" logic: if first group has "none" selected, disable subsequent groups
  const firstGroupId = groups[0]?.id;
  const noFirstItem  = !!(firstGroupId && selected[firstGroupId] === "none");

  // option prices are tax-exclusive → sum them, then convert to tax-inclusive
  const optTaxExcl = groups.reduce((sum, group, idx) => {
    if (idx > 0 && noFirstItem) return sum;
    const selId   = selected[group.id];
    const selItem = group.items.find(i => i.id === selId);
    return sum + (selItem?.price ?? 0);
  }, 0);

  const baseTaxInc  = Math.round(item.price * (1 + taxRate));
  const optTaxIncl  = Math.round(optTaxExcl * (1 + taxRate));
  const totalTaxInc = hasGroups ? baseTaxInc + optTaxIncl : baseTaxInc;
  const taxExcl     = item.price + optTaxExcl; // direct addition avoids rounding error
  const hasAdj      = optTaxExcl !== 0;

  const handleConfirm = () => {
    const selections = groups
      .filter((_, idx) => !(idx > 0 && noFirstItem))
      .map(group => {
        const selId   = selected[group.id] ?? group.items[0]?.id ?? "";
        const selItem = group.items.find(i => i.id === selId) ?? group.items[0];
        return {
          groupId:   group.id,
          groupName: group.name,
          itemId:    selItem?.id ?? "",
          itemName:  selItem?.name ?? "",
          price:     selItem?.price ?? 0,
        };
      });

    onConfirm({
      riceType: "white",   // legacy compat
      riceSize: "regular", // legacy compat
      selections,
    });
  };

  // ── Cell component for option buttons ─────────────────────────
  function OptionButton({ groupId, item: optItem, disabled }: { groupId: string; item: OptionItem; disabled: boolean }) {
    const isNone    = optItem.id === "none";
    const isSelected = selected[groupId] === optItem.id;
    // Display price as tax-inclusive (optItem.price is tax-exclusive)
    const displayPrice = Math.round(optItem.price * (1 + taxRate));
    return (
      <button
        onClick={() => !disabled && setSelected(prev => ({ ...prev, [groupId]: optItem.id }))}
        disabled={disabled}
        className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
          disabled
            ? "opacity-30 cursor-not-allowed border-slate-200 text-slate-400"
            : isSelected
            ? isNone
              ? "border-red-400 bg-red-50 text-red-700"
              : "border-indigo-500 bg-indigo-50 text-indigo-700"
            : "border-slate-200 text-slate-600 hover:border-slate-300 active:scale-95"
        }`}
      >
        <span className="block">{optItem.name}</span>
        {!isNone && (
          <span className={`block text-xs font-normal mt-0.5 ${
            optItem.price < 0 ? "text-red-500"
            : optItem.price > 0 ? "text-emerald-600"
            : "text-slate-400"
          }`}>
            {displayPrice === 0 ? "±¥0" : displayPrice > 0 ? `+¥${displayPrice} (税込)` : `¥${displayPrice} (税込)`}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────── */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start gap-3">
            <span className="text-4xl leading-none mt-0.5">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-800 text-sm leading-snug">{item.name}</h3>
              <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
                {hasAdj && (
                  <p className="text-slate-300 font-semibold text-sm line-through tabular-nums">
                    ¥{baseTaxInc.toLocaleString()}
                  </p>
                )}
                <p className="font-black text-2xl text-indigo-600 tabular-nums leading-none">
                  ¥{totalTaxInc.toLocaleString()}
                </p>
                <span className="text-xs font-normal text-slate-400">税込</span>
                {hasAdj && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                    optTaxIncl > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                  }`}>
                    {optTaxIncl > 0 ? `+${optTaxIncl}` : optTaxIncl}円
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Option groups ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {!hasGroups ? (
            <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-2">
              <span className="text-3xl">✅</span>
              <p className="text-sm font-medium">オプションはありません</p>
            </div>
          ) : (
            groups.map((group, idx) => {
              const isDisabled = idx > 0 && noFirstItem;
              const cols = group.items.length <= 2 ? 2 : group.items.length <= 4 ? 2 : 3;
              return (
                <div key={group.id} className={isDisabled ? "opacity-30 pointer-events-none" : ""}>
                  <p className="text-sm font-semibold text-slate-600 mb-2">{group.name}</p>
                  <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                    {group.items.map(optItem => (
                      <OptionButton
                        key={optItem.id}
                        groupId={group.id}
                        item={optItem}
                        disabled={isDisabled}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ──────────────────────────────────── */}
        <div className="px-6 pb-6 pt-2 space-y-3 border-t border-slate-100 flex-shrink-0">
          <div className="flex justify-between items-center bg-slate-50 rounded-2xl px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">単価（税抜）</span>
            <span className="text-base font-bold text-slate-700 tabular-nums">
              {(hasGroups && noFirstItem) ? "─" : `¥${taxExcl.toLocaleString()}`}
            </span>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-base font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>注文に追加</span>
            {hasGroups && !noFirstItem && (
              <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-sm font-black tabular-nums">
                ¥{totalTaxInc.toLocaleString()} 税込
              </span>
            )}
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
