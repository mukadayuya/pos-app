"use client";

import { useState, useCallback } from "react";
import { OrderItem, SalesRecord, PaymentMethod, PaymentEntry, ServiceTab, OrderDiscount } from "@/types/pos";
import { riceTypeLabels, riceSizeLabels } from "@/data/menu";
import { OrderOptions } from "@/types/pos";
import { computeTaxTotals, computeDiscountAmount, computeItemDiscountAmount, computeItemDiscountDisplay } from "@/lib/utils";
import ReceiptIssueModal from "./ReceiptIssueModal";

function optionLabel(opts: OrderOptions): string {
  if (opts.selections?.length > 0) return opts.selections.map(s => s.itemName).join(" / ");
  if (opts.riceSize === "none") return "";
  return `${riceTypeLabels[opts.riceType]}/${riceSizeLabels[opts.riceSize]}`;
}

interface CheckoutScreenProps {
  items: OrderItem[];
  serviceTab: ServiceTab;
  maleCount?: number;
  femaleCount?: number;
  staff?: string;
  discount?: OrderDiscount | null;
  onComplete: (record: SalesRecord) => void;
  onCancel: () => void;  // "← 戻る" — preserves the order
  onDone: () => void;    // "次の注文へ" — clears the order
}

const METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: "cash",    label: "現金",   icon: "💴" },
  { id: "card",    label: "カード", icon: "💳" },
  { id: "voucher", label: "商品券", icon: "🎫" },
  { id: "qr",      label: "QR決済", icon: "📱" },
];

const NUMPAD_KEYS = ["7","8","9","4","5","6","1","2","3","C","0","⌫"] as const;

function printReceipt(record: SalesRecord) {
  const dateStr = record.createdAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const logoDataUrl = typeof window !== "undefined" ? localStorage.getItem("receipt_logo") : null;
  const IS_BRONCO = process.env.NEXT_PUBLIC_STORE_ID === "bronco";
  const IS_ABC = process.env.NEXT_PUBLIC_STORE_ID === "yakitori-abc";
  const IS_WARAJI = process.env.NEXT_PUBLIC_STORE_ID === "waraji";
const IS_SHOTEN = process.env.NEXT_PUBLIC_STORE_ID === "shoten";
  const defaultStoreName = IS_BRONCO ? "メキシコダイニングレストラン ブロンコ" : IS_ABC ? "焼鳥居酒屋ABC" : IS_WARAJI ? "炭火やきとり 笑路" : IS_SHOTEN ? "居食屋 笑点" : "Kitchen Kazu";
  const storeName   = typeof window !== "undefined" ? (localStorage.getItem("store_name") || defaultStoreName) : defaultStoreName;

  const itemDiscountTotalForReceipt = record.itemDiscountTotal ?? 0;

  const itemRows = record.items.map(item => {
    const opts        = optionLabel(item.options);
    const rawTotal       = item.unitPrice * item.quantity;
    const itemDiscAmt    = item.itemDiscount ? computeItemDiscountAmount(item.itemDiscount, rawTotal, item.taxRate) : 0;
    const displayDiscAmt = item.itemDiscount ? computeItemDiscountDisplay(item.itemDiscount, rawTotal, item.taxRate) : 0;
    const effTotal       = rawTotal - itemDiscAmt;
    const taxInclEff     = effTotal + Math.floor(effTotal * item.taxRate);
    const reason         = item.priceAdjustReason
      ? `<br><small style="color:#7c3aed;">※${item.priceAdjustReason}</small>` : "";
    const discNote       = itemDiscAmt > 0
      ? `<br><small style="color:#ea580c;">🏷️ ${
          item.itemDiscount!.type === "percent"
            ? `${item.itemDiscount!.value}%引き`
            : ""
        }−¥${displayDiscAmt.toLocaleString()}</small>` : "";
    return `<tr>
      <td>${item.menuItem.emoji} ${item.menuItem.name}${opts ? `<br><small>${opts}</small>` : ""}${reason}${discNote}
      </td>
      <td class="r">${item.quantity}</td>
      <td class="r">¥${taxInclEff.toLocaleString()}</td>
    </tr>`;
  }).join("");

  const payRows = (record.payments ?? []).map(p => {
    const label = METHODS.find(m => m.id === p.method)?.label ?? p.method;
    return `<tr><td>${label}</td><td class="r">¥${p.amount.toLocaleString()}</td></tr>`;
  }).join("");

  const cashPaid      = (record.payments ?? []).find(p => p.method === "cash")?.amount ?? 0;
  const otherPaid     = (record.payments ?? []).filter(p => p.method !== "cash").reduce((s, p) => s + p.amount, 0);
  const change        = Math.max(0, cashPaid - Math.max(0, record.total - otherPaid));
  const discountAmount = Math.max(0, record.subtotal + record.tax - record.total);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>レシート</title>
<style>
  body{font-family:'MS Gothic',monospace;font-size:12px;width:300px;margin:0 auto;padding:12px;}
  h1{text-align:center;font-size:16px;margin:0 0 4px;}
  p.sub{text-align:center;font-size:11px;color:#666;margin:0 0 8px;}
  .logo{display:block;margin:0 auto 8px;max-width:120px;max-height:60px;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  td{padding:3px 2px;vertical-align:top;}
  td.r{text-align:right;white-space:nowrap;}
  .div{border:none;border-top:1px dashed #666;margin:6px 0;}
  .total td{font-weight:bold;font-size:13px;}
  .discount td{color:#dc2626;font-weight:bold;}
  .item-disc td{color:#ea580c;font-size:10px;}
  .change td{font-weight:bold;font-size:13px;color:#1d4ed8;}
  @media print{button{display:none;}}
</style></head><body>
${logoDataUrl ? `<img src="${logoDataUrl}" class="logo" alt="logo">` : ""}
<h1>${storeName}</h1>
<p class="sub">${dateStr}</p>
<hr class="div">
<table>${itemRows}</table>
<hr class="div">
<table>
  ${itemDiscountTotalForReceipt > 0 ? `
    <tr><td>明細合計（税抜）</td><td class="r">¥${(record.subtotal + itemDiscountTotalForReceipt).toLocaleString()}</td></tr>
    <tr class="item-disc"><td>商品値引合計</td><td class="r">−¥${itemDiscountTotalForReceipt.toLocaleString()}</td></tr>
    <tr><td>課税対象（税抜）</td><td class="r">¥${record.subtotal.toLocaleString()}</td></tr>
  ` : `<tr><td>小計（税抜）</td><td class="r">¥${record.subtotal.toLocaleString()}</td></tr>`}
  ${record.tax10 > 0 ? `<tr><td>消費税 10%</td><td class="r">¥${record.tax10.toLocaleString()}</td></tr>` : ""}
  ${record.tax8  > 0 ? `<tr><td>消費税  8%（軽減）</td><td class="r">¥${record.tax8.toLocaleString()}</td></tr>` : ""}
  ${(record.tax - record.tax8 - record.tax10) > 0 ? `<tr><td>消費税（その他）</td><td class="r">¥${(record.tax - record.tax8 - record.tax10).toLocaleString()}</td></tr>` : ""}
  ${discountAmount > 0 ? `<tr class="discount"><td>全体割引</td><td class="r">−¥${discountAmount.toLocaleString()}</td></tr>` : ""}
  <tr class="total"><td>合計（税込）</td><td class="r">¥${record.total.toLocaleString()}</td></tr>
</table>
<hr class="div">
<table>${payRows}${change > 0 ? `<tr class="change"><td>お釣り</td><td class="r">¥${change.toLocaleString()}</td></tr>` : ""}</table>
<hr class="div">
<p style="text-align:center;font-size:11px;">ありがとうございました</p>
<br>
<button onclick="window.print()" style="width:100%;padding:8px;font-size:14px;cursor:pointer;">🖨️ 印刷</button>
</body></html>`;

  const win = window.open("", "_blank", "width=380,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export default function CheckoutScreen({ items, serviceTab, maleCount = 0, femaleCount = 0, staff, discount, onComplete, onCancel, onDone }: CheckoutScreenProps) {
  const [selectedMethods, setSelectedMethods] = useState<Set<PaymentMethod>>(new Set(["cash"]));
  const [amounts, setAmounts] = useState<Record<PaymentMethod, string>>({
    cash: "", card: "", voucher: "", qr: "",
  });
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>("cash");
  const [step, setStep] = useState<"payment" | "complete">("payment");
  const [completedRecord, setCompletedRecord] = useState<SalesRecord | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // ── 税額計算 ──────────────────────────────────────────────
  const { subtotal, itemDiscountTotal, tax8, tax10, taxOther, totalTax, baseTotal } = computeTaxTotals(items);
  const effectiveSubtotal = subtotal - itemDiscountTotal;
  const discountAmount = discount ? computeDiscountAmount(discount, effectiveSubtotal, baseTotal) : 0;
  const total = Math.max(0, baseTotal - discountAmount);

  // ── 支払い計算 ────────────────────────────────────────────
  const getAmt = useCallback((m: PaymentMethod) => parseInt(amounts[m] || "0") || 0, [amounts]);
  const totalPaid   = Array.from(selectedMethods).reduce((s, m) => s + getAmt(m), 0);
  const nonCashPaid = Array.from(selectedMethods).filter(m => m !== "cash").reduce((s, m) => s + getAmt(m), 0);
  const cashNeeded  = Math.max(0, total - nonCashPaid);
  const diff = totalPaid - total;
  const canConfirm = totalPaid >= total;

  // ── テンキー ──────────────────────────────────────────────
  const handleNumpad = (key: string) => {
    setAmounts(prev => {
      const cur = prev[activeMethod] || "";
      if (key === "C")  return { ...prev, [activeMethod]: "" };
      if (key === "⌫") return { ...prev, [activeMethod]: cur.slice(0, -1) };
      if (key === "00") return cur ? { ...prev, [activeMethod]: cur + "00" } : prev;
      if (cur.length >= 7) return prev;
      return { ...prev, [activeMethod]: cur + key };
    });
  };

  const handleJustRight = () => {
    const needed = Math.max(0, total - Array.from(selectedMethods)
      .filter(m => m !== activeMethod)
      .reduce((s, m) => s + getAmt(m), 0));
    setAmounts(prev => ({ ...prev, [activeMethod]: String(needed) }));
  };

  const toggleMethod = (m: PaymentMethod) => {
    setSelectedMethods(prev => {
      const next = new Set(prev);
      if (next.has(m)) { if (next.size > 1) next.delete(m); }
      else next.add(m);
      return next;
    });
    setActiveMethod(m);
  };

  // ── 会計確定 ──────────────────────────────────────────────
  const handleConfirm = () => {
    const payments: PaymentEntry[] = Array.from(selectedMethods).map(m => ({
      method: m, amount: getAmt(m),
    }));
    const record: SalesRecord = {
      id: crypto.randomUUID(),
      items: [...items],
      subtotal: effectiveSubtotal,   // post-item-discount taxable base
      itemDiscountTotal,
      tax8, tax10,
      tax: totalTax,
      total,
      payments,
      serviceTab,
      maleCount,
      femaleCount,
      staff,
      discount: discount ?? null,
      createdAt: new Date(),
    };
    setCompletedRecord(record);
    setStep("complete");
    onComplete(record);
  };

  // ── 完了画面 ──────────────────────────────────────────────
  if (step === "complete" && completedRecord) {
    const cashPaid = (completedRecord.payments ?? []).find(p => p.method === "cash")?.amount ?? 0;
    const otherPaid = (completedRecord.payments ?? []).filter(p => p.method !== "cash").reduce((s, p) => s + p.amount, 0);
    const cashChange = Math.max(0, cashPaid - Math.max(0, completedRecord.total - otherPaid));
    return (
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col items-center justify-center gap-6 p-8">
        <div className="text-8xl">✅</div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">会計完了</h2>
        <div className="bg-white ring-1 ring-slate-200 shadow-sm rounded-3xl p-8 w-full max-w-sm space-y-4">
          <div className="text-center">
            <p className="text-slate-500 text-base font-bold">お会計金額</p>
            <p className="text-5xl font-black text-indigo-700 mt-1 font-mono tracking-tight tabular-nums">
              {completedRecord.total.toLocaleString()}
              <span className="text-2xl font-bold ml-1">円</span>
            </p>
          </div>
          {cashChange > 0 && (
            <div className="bg-emerald-50 ring-2 ring-emerald-300 rounded-2xl px-6 py-5 text-center">
              <p className="text-emerald-600 text-base font-bold tracking-widest mb-1">お 釣 り</p>
              <p className="text-6xl font-black text-emerald-700 font-mono tabular-nums leading-none flex items-baseline justify-center gap-1">
                {cashChange.toLocaleString()}
                <span className="text-2xl font-bold">円</span>
              </p>
            </div>
          )}
        </div>
        <p className="text-slate-400 text-sm">ありがとうございました</p>
        <div className="flex gap-3 w-full max-w-sm">
          <button onClick={() => printReceipt(completedRecord)}
            className="flex-1 py-4 bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-sm">
            🖨️ レシート
          </button>
          <button onClick={() => setShowReceiptModal(true)}
            className="flex-1 py-4 bg-white ring-1 ring-amber-200 hover:bg-amber-50 text-amber-700 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-sm">
            📄 領収書
          </button>
          <button onClick={onDone}
            className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-md shadow-indigo-200">
            次の注文へ
          </button>
        </div>
        {showReceiptModal && (
          <ReceiptIssueModal total={completedRecord.total} onClose={() => setShowReceiptModal(false)} />
        )}
      </div>
    );
  }

  // ── 支払い画面 ────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 flex-shrink-0 bg-white shadow-sm">
        <button onClick={onCancel}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-semibold">
          ← 戻る
        </button>
        <h1 className="text-slate-900 text-lg font-bold tracking-tight">会計</h1>
        <div className="w-16" />
      </div>

      {/* 3カラムメイン */}
      <div className="flex flex-1 overflow-hidden bg-slate-50">

        {/* ── 左：注文内容＋支払い方法 ─────────────────── */}
        <div className="w-1/3 flex flex-col bg-white border-r border-slate-200">
          {/* 支払い方法 */}
          <div className="p-4 border-b border-slate-100 flex-shrink-0">
            <p className="text-slate-700 text-base font-black mb-3">支払い方法</p>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(({ id, label, icon }) => {
                const selected = selectedMethods.has(id);
                const active   = activeMethod === id && selected;
                return (
                  <button key={id} onClick={() => toggleMethod(id)}
                    className={`flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-2xl font-semibold transition-all active:scale-95 ${
                      active
                        ? "bg-indigo-50 ring-2 ring-indigo-400 text-indigo-700 shadow-sm"
                        : selected
                        ? "bg-slate-50 ring-1 ring-slate-300 text-slate-700"
                        : "bg-white ring-1 ring-slate-200 text-slate-400"
                    }`}>
                    <span className="text-3xl leading-none">{icon}</span>
                    <span className="text-sm font-bold">{label}</span>
                    {selected && getAmt(id) > 0 && (
                      <span className="text-xs text-indigo-600 font-mono font-bold">¥{getAmt(id).toLocaleString()}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 注文内容 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <p className="text-slate-700 text-base font-black mb-2">注文内容</p>
            {items.map(item => (
              <div key={item.itemKey} className="bg-slate-50 ring-1 ring-slate-100 rounded-xl px-3 py-3 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="text-2xl flex-shrink-0">{item.menuItem.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-800 leading-normal truncate">{item.menuItem.name}</p>
                    <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                      {optionLabel(item.options)} ×{item.quantity}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${item.itemDiscount?.value ? "text-orange-600" : "text-indigo-600"}`}>
                  {(() => {
                    const rawTotal = item.unitPrice * item.quantity;
                    const discAmt  = item.itemDiscount ? computeItemDiscountAmount(item.itemDiscount, rawTotal, item.taxRate) : 0;
                    const effTotal = rawTotal - discAmt;
                    return `¥${(effTotal + Math.floor(effTotal * item.taxRate)).toLocaleString()}`;
                  })()}
                </span>
              </div>
            ))}
          </div>

          {/* 小計・税・割引 */}
          <div className="p-4 border-t border-slate-200 space-y-2.5 flex-shrink-0 bg-slate-50">
            {itemDiscountTotal > 0 ? (
              <>
                <div className="flex justify-between items-center text-slate-500 text-base font-semibold">
                  <span>明細合計（税抜）</span>
                  <span className="tabular-nums font-bold">¥{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-orange-600 text-base font-semibold">
                  <span>商品値引合計</span>
                  <span className="tabular-nums font-bold">−¥{itemDiscountTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 text-xl font-semibold border-t border-slate-200 pt-2">
                  <span>課税対象（税抜）</span>
                  <span className="tabular-nums font-bold">¥{effectiveSubtotal.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center text-slate-600 text-xl font-semibold">
                <span>小計（税抜）</span>
                <span className="tabular-nums font-bold">¥{effectiveSubtotal.toLocaleString()}</span>
              </div>
            )}
            {tax10 > 0 && (
              <div className="flex justify-between items-center text-slate-600 text-xl font-semibold">
                <span>消費税 10%</span><span className="tabular-nums font-bold">¥{tax10.toLocaleString()}</span>
              </div>
            )}
            {tax8 > 0 && (
              <div className="flex justify-between items-center text-teal-600 text-xl font-semibold">
                <span>消費税 8%（軽減）</span><span className="tabular-nums font-bold">¥{tax8.toLocaleString()}</span>
              </div>
            )}
            {taxOther > 0 && (
              <div className="flex justify-between items-center text-purple-600 text-xl font-semibold">
                <span>消費税（その他）</span><span className="tabular-nums font-bold">¥{taxOther.toLocaleString()}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-orange-600 text-base font-semibold border-t border-orange-100 pt-2">
                <span>全体割引</span><span className="tabular-nums font-bold">−¥{discountAmount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── 中央：金額サマリー ────────────────────────── */}
        <div className="w-1/3 min-w-0 flex flex-col items-stretch justify-center bg-indigo-200 border-r border-indigo-300 px-4 py-6 gap-4 overflow-hidden">

          {/* 合計金額 */}
          <div className="text-center bg-slate-900 rounded-2xl px-4 py-4">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">合計金額</p>
            {discountAmount > 0 && (
              <p className="text-slate-500 text-lg font-bold line-through tabular-nums">{baseTotal.toLocaleString()}</p>
            )}
            <p className="text-[clamp(1.75rem,4.5vw,3.5rem)] font-black text-white font-mono leading-none tracking-tight tabular-nums truncate">
              {total.toLocaleString()}
            </p>
            <p className="text-slate-500 text-[10px] mt-1">
              うち税 {totalTax.toLocaleString()}
              {discountAmount > 0 && <span className="text-orange-400 ml-2">割引 −{discountAmount.toLocaleString()}</span>}
            </p>
          </div>

          <div className="border-t-2 border-indigo-200" />

          {/* お預かり */}
          <div className="text-center bg-white rounded-2xl px-4 py-3 shadow-sm">
            <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mb-1">
              {METHODS.find(m => m.id === activeMethod)?.label}　お預かり
            </p>
            <p className={`text-[clamp(1.75rem,4.5vw,3.5rem)] font-black font-mono leading-none tracking-tight tabular-nums truncate ${
              getAmt(activeMethod) > 0 ? "text-indigo-700" : "text-slate-300"
            }`}>
              {getAmt(activeMethod) > 0 ? getAmt(activeMethod).toLocaleString() : "─"}
            </p>
          </div>

          <div className="border-t-2 border-indigo-200" />

          {/* お釣り / 不足額 */}
          <div className={`text-center rounded-2xl px-4 py-3 shadow-sm ${
            diff > 0 ? "bg-emerald-100" : diff < 0 ? "bg-red-100" : "bg-white"
          }`}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${
              diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-500" : "text-slate-400"
            }`}>
              {diff >= 0 ? "お釣り" : "不足額"}
            </p>
            <p className={`text-[clamp(1.75rem,5vw,4rem)] font-black font-mono leading-none tracking-tight tabular-nums truncate ${
              diff > 0 ? "text-emerald-600"
              : diff < 0 ? "text-red-500"
              : "text-slate-300"
            }`}>
              {Math.abs(diff).toLocaleString()}
            </p>
          </div>

          <div className="border-t-2 border-indigo-200" />

          {/* ちょうど預かり ＋ 会計確定 */}
          <div className="space-y-2.5">
            <button onClick={handleJustRight}
              className="w-full py-3.5 bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100 text-amber-700 rounded-xl font-bold text-sm transition-all active:scale-95">
              💰 ちょうど預かり
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={`w-full py-5 rounded-xl font-black text-xl transition-all active:scale-95 ${
                canConfirm
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              {canConfirm ? "✓　会計確定" : "✗　金額不足"}
            </button>
          </div>
        </div>

        {/* ── 右：テンキー ─────────────────────────────── */}
        <div className="w-1/3 bg-slate-50 p-4 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3 flex-1">
            {NUMPAD_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => handleNumpad(key)}
                className={`flex items-center justify-center rounded-2xl text-5xl font-black transition-all duration-100 active:scale-95 shadow-sm ${
                  key === "C"
                    ? "bg-red-50 ring-1 ring-red-200 text-red-500 hover:bg-red-100"
                    : key === "⌫"
                    ? "bg-white ring-1 ring-slate-200 text-slate-500 hover:bg-slate-50"
                    : "bg-white ring-1 ring-slate-200 text-slate-900 hover:bg-slate-50"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
          <button
            onClick={() => handleNumpad("00")}
            className="w-full py-5 bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-900 text-5xl font-black rounded-2xl transition-all active:scale-95 flex-shrink-0 shadow-sm"
          >
            00
          </button>
        </div>
      </div>
    </div>
  );
}
