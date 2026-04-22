"use client";

import { useState, useCallback } from "react";
import { OrderItem, SalesRecord, PaymentMethod, PaymentEntry, ServiceTab } from "@/types/pos";
import { riceTypeLabels, riceSizeLabels } from "@/data/menu";
import ReceiptIssueModal from "./ReceiptIssueModal";

interface CheckoutScreenProps {
  items: OrderItem[];
  serviceTab: ServiceTab;
  onComplete: (record: SalesRecord) => void;
  onCancel: () => void;
}

const METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: "cash",        label: "現金",          icon: "💴" },
  { id: "card",        label: "カード",         icon: "💳" },
  { id: "voucher",     label: "商品券",         icon: "🎫" },
  { id: "card_manual", label: "クレカ手入力",   icon: "🖊️" },
];

const NUMPAD_KEYS = ["7","8","9","4","5","6","1","2","3","C","0","⌫"] as const;

function printReceipt(record: SalesRecord) {
  const dateStr = record.createdAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const logoDataUrl = typeof window !== "undefined" ? localStorage.getItem("receipt_logo") : null;
  const storeName   = typeof window !== "undefined" ? (localStorage.getItem("store_name") || "Kitchen Kazu") : "Kitchen Kazu";

  const itemRows = record.items.map(item =>
    `<tr>
      <td>${item.menuItem.emoji} ${item.menuItem.name}<br>
        <small>${riceTypeLabels[item.options.riceType]}/${riceSizeLabels[item.options.riceSize]}</small>
      </td>
      <td class="r">${item.quantity}</td>
      <td class="r">¥${(item.unitPrice * item.quantity).toLocaleString()}</td>
    </tr>`
  ).join("");

  const payRows = (record.payments ?? []).map(p => {
    const label = METHODS.find(m => m.id === p.method)?.label ?? p.method;
    return `<tr><td>${label}</td><td class="r">¥${p.amount.toLocaleString()}</td></tr>`;
  }).join("");

  const cashPaid  = (record.payments ?? []).find(p => p.method === "cash")?.amount ?? 0;
  const otherPaid = (record.payments ?? []).filter(p => p.method !== "cash").reduce((s, p) => s + p.amount, 0);
  const change    = Math.max(0, cashPaid - Math.max(0, record.total - otherPaid));

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
  <tr><td>小計（税抜）</td><td class="r">¥${record.subtotal.toLocaleString()}</td></tr>
  ${record.tax10 > 0 ? `<tr><td>消費税 10%</td><td class="r">¥${record.tax10.toLocaleString()}</td></tr>` : ""}
  ${record.tax8  > 0 ? `<tr><td>消費税  8%（軽減）</td><td class="r">¥${record.tax8.toLocaleString()}</td></tr>` : ""}
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

export default function CheckoutScreen({ items, serviceTab, onComplete, onCancel }: CheckoutScreenProps) {
  const [selectedMethods, setSelectedMethods] = useState<Set<PaymentMethod>>(new Set(["cash"]));
  const [amounts, setAmounts] = useState<Record<PaymentMethod, string>>({
    cash: "", card: "", voucher: "", card_manual: "",
  });
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>("cash");
  const [step, setStep] = useState<"payment" | "complete">("payment");
  const [completedRecord, setCompletedRecord] = useState<SalesRecord | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // ── 税額計算 ──────────────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const tax10 = items
    .filter(i => i.taxRate === 0.10)
    .reduce((s, i) => s + Math.floor(i.unitPrice * i.quantity * 0.10), 0);
  const tax8 = items
    .filter(i => i.taxRate === 0.08)
    .reduce((s, i) => s + Math.floor(i.unitPrice * i.quantity * 0.08), 0);
  const total = subtotal + tax10 + tax8;
  const totalTax = tax8 + tax10;

  // ── 支払い計算 ────────────────────────────────────────────
  const getAmt = useCallback((m: PaymentMethod) => parseInt(amounts[m] || "0") || 0, [amounts]);
  const totalPaid   = Array.from(selectedMethods).reduce((s, m) => s + getAmt(m), 0);
  const nonCashPaid = Array.from(selectedMethods).filter(m => m !== "cash").reduce((s, m) => s + getAmt(m), 0);
  const cashNeeded  = Math.max(0, total - nonCashPaid);
  const cashChange  = selectedMethods.has("cash") ? Math.max(0, getAmt("cash") - cashNeeded) : 0;

  // お預かり = active method の入力額、差額 = totalPaid - total
  const activeAmt = getAmt(activeMethod);
  const diff = totalPaid - total; // + = お釣り, - = 不足額

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

  // ── ちょうど預かり ────────────────────────────────────────
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
      method: m,
      amount: getAmt(m),
    }));
    const record: SalesRecord = {
      id: crypto.randomUUID(),
      items: [...items],
      subtotal,
      tax8,
      tax10,
      tax: totalTax,
      total,
      payments,
      serviceTab,
      createdAt: new Date(),
    };
    setCompletedRecord(record);
    setStep("complete");
    onComplete(record);
  };

  // ── 完了画面 ──────────────────────────────────────────────
  if (step === "complete" && completedRecord) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center gap-6 p-8">
        <div className="text-8xl animate-bounce">✅</div>
        <h2 className="text-3xl font-bold text-white">会計完了</h2>

        <div className="bg-slate-800 rounded-3xl p-8 w-full max-w-sm space-y-4">
          <div className="text-center">
            <p className="text-slate-400 text-sm">お会計金額</p>
            <p className="text-5xl font-bold text-indigo-400 mt-1">
              ¥{completedRecord.total.toLocaleString()}
            </p>
          </div>

          {cashChange > 0 && (
            <div className="bg-emerald-900/50 rounded-2xl px-6 py-4 text-center">
              <p className="text-emerald-400 text-sm font-medium">お釣り</p>
              <p className="text-3xl font-bold text-emerald-300">
                ¥{cashChange.toLocaleString()}
              </p>
            </div>
          )}

          <div className="space-y-1 text-sm">
            {completedRecord.tax10 > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>内消費税 10%</span>
                <span>¥{completedRecord.tax10.toLocaleString()}</span>
              </div>
            )}
            {completedRecord.tax8 > 0 && (
              <div className="flex justify-between text-teal-400">
                <span>内消費税 8%（軽減）</span>
                <span>¥{completedRecord.tax8.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <p className="text-slate-500 text-sm">ありがとうございました</p>

        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={() => printReceipt(completedRecord)}
            className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl text-sm font-bold transition-all active:scale-95"
          >
            🖨️ レシート
          </button>
          <button
            onClick={() => setShowReceiptModal(true)}
            className="flex-1 py-4 bg-amber-700 hover:bg-amber-600 text-white rounded-2xl text-sm font-bold transition-all active:scale-95"
          >
            📄 領収書
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-lg"
          >
            次の注文へ
          </button>
        </div>

        {showReceiptModal && (
          <ReceiptIssueModal
            total={completedRecord.total}
            onClose={() => setShowReceiptModal(false)}
          />
        )}
      </div>
    );
  }

  // ── 支払い画面 ────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 flex-shrink-0">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          ← 戻る
        </button>
        <h1 className="text-white text-lg font-bold">会計</h1>
        <div className="w-16" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── 左：注文内容 ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 border-r border-slate-700">
          <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wide">注文内容</h2>
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.itemKey} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.menuItem.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-white leading-snug">{item.menuItem.name}</p>
                    <p className="text-xs text-slate-500">
                      {riceTypeLabels[item.options.riceType]}/{riceSizeLabels[item.options.riceSize]}
                      {" · "}×{item.quantity}
                      {" · "}
                      <span className={item.taxRate === 0.08 ? "text-teal-400" : "text-slate-400"}>
                        税{item.taxRate === 0.08 ? "8%" : "10%"}
                      </span>
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-indigo-400">
                  ¥{(item.unitPrice * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* 小計・税 */}
          <div className="bg-slate-900 rounded-2xl px-4 py-3 space-y-1.5 border border-slate-700 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>小計（税抜）</span><span>¥{subtotal.toLocaleString()}</span>
            </div>
            {tax10 > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>消費税 10%</span><span>¥{tax10.toLocaleString()}</span>
              </div>
            )}
            {tax8 > 0 && (
              <div className="flex justify-between text-teal-400">
                <span>消費税 8%（軽減）</span><span>¥{tax8.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── 右パネル ──────────────────────────────────────── */}
        <div className="w-[460px] flex-shrink-0 flex flex-col bg-slate-900 overflow-hidden">

          {/* 支払い方法 */}
          <div className="flex gap-2 px-4 pt-3 pb-2 border-b border-slate-700">
            {METHODS.map(({ id, label, icon }) => {
              const selected = selectedMethods.has(id);
              const active   = activeMethod === id && selected;
              return (
                <button
                  key={id}
                  onClick={() => toggleMethod(id)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
                    active   ? "border-indigo-500 bg-indigo-900/60 text-indigo-300" :
                    selected ? "border-slate-500 bg-slate-800 text-white" :
                               "border-slate-700 bg-slate-800 text-slate-500"
                  }`}
                >
                  <span className="text-base">{icon}</span>
                  <span>{label}</span>
                  {selected && getAmt(id) > 0 && (
                    <span className="text-[10px] text-indigo-400 font-mono">¥{getAmt(id).toLocaleString()}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── 金額表示（中央大表示）──────────────────────── */}
          <div className="px-4 py-3 space-y-1 border-b border-slate-700">
            <div className="flex items-baseline justify-between">
              <span className="text-slate-400 text-sm">合計（税込）</span>
              <span className="text-2xl font-bold text-white font-mono">¥{total.toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-slate-500 text-xs">うち消費税</span>
              <span className="text-slate-400 text-sm font-mono">¥{totalTax.toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between pt-1 border-t border-slate-700">
              <span className="text-slate-300 text-sm font-semibold">
                {METHODS.find(m => m.id === activeMethod)?.label} お預かり
              </span>
              <span className="text-3xl font-bold text-indigo-300 font-mono tracking-tight">
                {activeAmt > 0 ? `¥${activeAmt.toLocaleString()}` : <span className="text-slate-600">¥ ─</span>}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className={`text-sm font-bold ${diff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {diff >= 0 ? "お釣り" : "不足額"}
              </span>
              <span className={`text-2xl font-bold font-mono ${diff >= 0 ? "text-emerald-300" : "text-red-400"}`}>
                {diff === 0
                  ? <span className="text-slate-500">¥ 0</span>
                  : `¥${Math.abs(diff).toLocaleString()}`
                }
              </span>
            </div>
          </div>

          {/* ── テンキー ＋ 右ボタン列 ────────────────────── */}
          <div className="flex flex-1 gap-2 px-4 py-3 overflow-hidden">
            {/* テンキー */}
            <div className="flex flex-col flex-1 gap-1.5">
              <div className="grid grid-cols-3 gap-1.5 flex-1">
                {NUMPAD_KEYS.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleNumpad(key)}
                    className={`flex items-center justify-center rounded-xl text-xl font-bold transition-all active:scale-95 ${
                      key === "C"
                        ? "bg-red-900/60 text-red-300 hover:bg-red-900"
                        : key === "⌫"
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-slate-800 text-white hover:bg-slate-700"
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleNumpad("00")}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white text-xl font-bold rounded-xl transition-all active:scale-95"
              >
                00
              </button>
            </div>

            {/* 右ボタン列：ちょうど預かり ＋ ✓ */}
            <div className="flex flex-col gap-1.5 w-24">
              {/* ちょうど預かり */}
              <button
                onClick={handleJustRight}
                className="flex-1 flex flex-col items-center justify-center bg-amber-600 hover:bg-amber-500 active:scale-95 text-white rounded-xl font-bold transition-all shadow-md gap-1"
              >
                <span className="text-2xl">💰</span>
                <span className="text-xs leading-tight text-center px-1">ちょうど{"\n"}預かり</span>
              </button>

              {/* 会計確定 ✓ */}
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={`flex-1 flex flex-col items-center justify-center rounded-xl font-bold transition-all active:scale-95 gap-1 ${
                  canConfirm
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
                    : "bg-slate-800 text-slate-600 cursor-not-allowed"
                }`}
              >
                <span className="text-3xl">{canConfirm ? "✓" : "✗"}</span>
                <span className="text-xs">会計</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
