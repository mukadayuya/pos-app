"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import ReceiptIssueModal from "@/components/ReceiptIssueModal";
import { isSupabaseConfigured } from "@/lib/supabase";
import { fetchAnalysisMode, AnalysisMode } from "@/lib/storeSettings";
import { padHourlyData } from "@/lib/hourlyAnalysis";
import { buildItemBreakdown, ItemBreakdown } from "@/lib/analysisUtils";
import AnalysisDetailModal from "@/components/AnalysisDetailModal";
import ItemReceiptsModal from "@/components/ItemReceiptsModal";
import {
  fetchPeriodSummary,
  fetchTodayHourlySales,
  fetchSalesDetail,
  fetchYearOrders,
  fetchYearlySummary,
  fetchMonthOrdersForAnalysis,
  fetchAllSalesForExport,
  updateSaleRecord,
  deleteSale,
  HourlySales,
  SaleDetailRow,
  SaleDetailItem,
  SaleRecordUpdate,
  YearlySummaryMonth,
} from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────
type MainTab = "today" | "orders" | "category" | "items" | "gender" | "staff" | "hourly" | "yearly";
interface PeriodData { total: number; count: number; avgSpend: number }

// ─── Nav config ───────────────────────────────────────────────
const NAV_TABS: { key: MainTab; icon: string; label: string }[] = [
  { key: "today",    icon: "📊", label: "この日の売上" },
  { key: "orders",   icon: "🧾", label: "会計一覧" },
  { key: "category", icon: "📂", label: "カテゴリー別" },
  { key: "items",    icon: "🍽️", label: "商品別" },
  { key: "gender",   icon: "👥", label: "男女別" },
  { key: "staff",    icon: "👤", label: "担当者別" },
  { key: "hourly",   icon: "🕐", label: "時間帯別" },
  { key: "yearly",   icon: "📅", label: "年別売上" },
];

// ─── Helpers ──────────────────────────────────────────────────
// JSONB items can arrive with undefined/null fields — always use safeNum
function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

// Normalise tax_rate from JSONB: handles both decimal (0.08) and integer-% (8) formats.
// DB rows saved by the POS app use 0.08/0.10; seed / legacy rows may use 8/10.
function taxDecimal(v: unknown): number {
  const n = safeNum(v, 0.1);
  return n > 1 ? n / 100 : n;
}

function fmtYen(n: number) {
  const v = isFinite(n) ? Math.round(n) : 0;
  return `¥${v.toLocaleString()}`;
}

function paymentInfo(method?: string): { icon: string; label: string; cls: string } {
  switch (method) {
    case "card":    return { icon: "💳", label: "カード",  cls: "bg-blue-50 text-blue-600 border-blue-200" };
    case "qr":      return { icon: "📱", label: "QR",      cls: "bg-emerald-50 text-emerald-600 border-emerald-200" };
    case "voucher": return { icon: "🎫", label: "商品券",  cls: "bg-amber-50 text-amber-600 border-amber-200" };
    default:        return { icon: "💴", label: "現金",    cls: "bg-slate-50 text-slate-500 border-slate-200" };
  }
}

function fmtShort(n: number): string {
  if (!isFinite(n) || n === 0) return "0";
  if (n >= 10000) { const v = n / 10000; return `${v % 1 === 0 ? v : v.toFixed(1)}万`; }
  if (n >= 1000)  { const v = n / 1000;  return `${v % 1 === 0 ? v : v.toFixed(1)}千`; }
  return String(Math.round(n));
}

function niceScale(dataMax: number, targetTicks = 4): { ticks: number[]; niceMax: number } {
  if (dataMax <= 0) return { ticks: [0, 1], niceMax: 1 };
  const rawStep = dataMax / targetTicks;
  const mag     = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm    = rawStep / mag;
  const step    = norm <= 1 ? mag : norm <= 2 ? 2 * mag : norm <= 2.5 ? 2.5 * mag : norm <= 5 ? 5 * mag : 10 * mag;
  const niceMax = Math.ceil(dataMax / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= niceMax + step * 0.01; t += step) ticks.push(Math.round(t));
  return { ticks, niceMax };
}

function calcTotal(items: SaleDetailItem[]): number {
  return items
    .filter(it => safeNum(it.quantity) > 0)
    .reduce((s, it) => {
      const qty   = safeNum(it.quantity);
      const price = safeNum(it.unit_price);
      const tax   = taxDecimal(it.tax_rate);
      return s + Math.round(price * qty * (1 + tax));
    }, 0);
}

function getMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  const earliest = new Date(2024, 0, 1); // Jan 2024 (seed data start)
  while (d >= earliest) {
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
    });
    d.setMonth(d.getMonth() - 1);
  }
  return options;
}

function exportToCsv(rows: { date: string; total: number; count: number }[]) {
  const header = ["日付", "売上合計（税込）", "客数", "客単価"];
  const body = rows.map(r => [r.date, r.total, r.count, r.count > 0 ? Math.floor(r.total / r.count) : 0]);
  const csv = "﻿" + [header, ...body]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url; a.download = `flows_sales_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = "violet" }: {
  label: string; value: string; sub?: string; color?: "violet" | "indigo" | "emerald" | "slate";
}) {
  const cls = { violet: "text-violet-700", indigo: "text-indigo-700", emerald: "text-emerald-700", slate: "text-slate-700" }[color];
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{label}</p>
      <p className={`text-2xl font-black tabular-nums ${cls}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
    </div>
  );
}

// ─── Hourly bar chart ─────────────────────────────────────────
function HourlyChart({
  data,
  onBarClick,
}: {
  data: HourlySales[];
  onBarClick?: (hour: number) => void;
}) {
  const [hovered, setHovered] = useState<HourlySales | null>(null);
  const [pinned,  setPinned]  = useState<HourlySales | null>(null);

  const displayed = pinned ?? hovered;
  const isEmpty   = data.length === 0 || data.every(d => d.count === 0);

  if (isEmpty)
    return <div className="flex items-center justify-center h-32 text-slate-300 text-sm">データがありません</div>;

  const CHART_H           = 110;
  const dataMax           = Math.max(...data.map(d => d.total), 1);
  const { ticks, niceMax} = niceScale(dataMax);

  const handleTap = (d: HourlySales) => {
    if (!d.count) return;
    if (pinned?.hour === d.hour) {
      onBarClick?.(d.hour);
      setPinned(null);
    } else {
      setPinned(d);
    }
  };

  return (
    <div>
      {/* Info panel — hover (desktop) or pinned (touch) */}
      <div
        className={`flex items-center gap-2 mb-2 rounded-xl px-3 transition-colors ${
          pinned ? "py-2 bg-violet-50 border border-violet-200" : "py-1.5"
        }`}
        style={{ minHeight: "40px" }}
      >
        {displayed && displayed.count > 0 ? (
          <>
            <span className="text-[11px] font-bold text-violet-700 tabular-nums flex-shrink-0">
              {String(displayed.hour).padStart(2, "0")}:00〜{String(displayed.hour).padStart(2, "0")}:59
            </span>
            <span className="text-sm font-black text-slate-800 tabular-nums">{fmtYen(displayed.total)}</span>
            <span className="text-xs text-slate-400">{displayed.count}件</span>
            {pinned && onBarClick && (
              <button
                onClick={() => { onBarClick(pinned.hour); setPinned(null); }}
                className="ml-auto flex-shrink-0 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors active:scale-95 min-w-[80px] min-h-[36px]"
              >
                内訳を表示 ›
              </button>
            )}
            {pinned && !onBarClick && (
              <button onClick={() => setPinned(null)} className="ml-auto text-slate-400 hover:text-slate-600 text-sm px-2">✕</button>
            )}
          </>
        ) : (
          <span className="text-xs text-slate-500">
            {onBarClick ? "棒をタップで詳細 / 2度目で内訳" : "棒にホバーで詳細を表示"}
          </span>
        )}
      </div>

      <div className="flex gap-2 pt-10">
        {/* Y-axis */}
        <div className="flex-shrink-0 relative" style={{ width: "36px", height: `${CHART_H}px` }}>
          {ticks.map(t => (
            <span
              key={t}
              className="absolute right-0 text-slate-500 tabular-nums leading-none text-right"
              style={{ fontSize: "10px", top: `${Math.round((1 - t / niceMax) * CHART_H) - 5}px` }}
            >
              {fmtShort(t)}
            </span>
          ))}
        </div>

        {/* Bars area */}
        <div className="flex-1 overflow-x-auto">
          <div className="relative" style={{ height: `${CHART_H + 16}px` }}>
            {/* Gridlines — only over bar area (top CHART_H px) */}
            <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: `${CHART_H}px` }}>
              {ticks.map(t => (
                <div
                  key={t}
                  className="absolute left-0 right-0 border-t border-slate-200"
                  style={{ top: `${Math.round((1 - t / niceMax) * CHART_H)}px` }}
                />
              ))}
            </div>

            {/* Bar columns */}
            <div className="absolute inset-0 flex gap-[2px]">
              {data.map(d => {
                const clickable = !!onBarClick && d.count > 0;
                const isPinned  = pinned?.hour === d.hour;
                const barH      = d.total > 0 ? Math.max(3, Math.round((d.total / niceMax) * CHART_H)) : 2;
                return (
                  <div
                    key={d.hour}
                    className={`flex flex-col flex-shrink-0 ${clickable ? "cursor-pointer" : ""}`}
                    style={{ minWidth: "calc((100% - 8px) / 24)" }}
                    onClick={() => handleTap(d)}
                    onMouseEnter={() => { if (!pinned) setHovered(d); }}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {/* Bar */}
                    <div className="flex-1 flex flex-col justify-end">
                      <div
                        className={`w-full rounded-t transition-all ${
                          d.total > 0
                            ? isPinned
                              ? "bg-violet-600 shadow-[0_0_0_2px_theme(colors.violet.400)]"
                              : clickable
                                ? "bg-violet-500 hover:bg-violet-400"
                                : "bg-violet-400"
                            : "bg-slate-100"
                        }`}
                        style={{ height: `${barH}px` }}
                      />
                    </div>
                    {/* Hour label */}
                    <div className="h-4 flex items-center justify-center">
                      <span className="text-slate-600 font-mono leading-none" style={{ fontSize: "9px" }}>
                        {d.hour}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────
function EditModal({ row, onSave, onClose }: {
  row: SaleDetailRow;
  onSave: (id: string, patch: SaleRecordUpdate) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems]             = useState<SaleDetailItem[]>(
    row.items.map(it => ({
      ...it,
      quantity:   safeNum(it.quantity),
      unit_price: safeNum(it.unit_price),
      tax_rate:   taxDecimal(it.tax_rate),
    }))
  );
  const [maleCount, setMaleCount]     = useState(row.male_count   ?? 0);
  const [femaleCount, setFemaleCount] = useState(row.female_count ?? 0);
  const [saving, setSaving]           = useState(false);
  const [saveErr, setSaveErr]         = useState<string | null>(null);
  const total = calcTotal(items);

  const setQty = (i: number, delta: number) =>
    setItems(prev => prev.map((it, j) => j === i ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it));

  const handleSave = async () => {
    setSaving(true); setSaveErr(null);
    try {
      await onSave(row.id, {
        total_amount: total,
        items: items.filter(it => it.quantity > 0),
        male_count: maleCount,
        female_count: femaleCount,
      });
      onClose();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "保存に失敗しました");
    } finally { setSaving(false); }
  };

  const timeLabel = new Date(row.created_at).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-violet-700 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">注文訂正</p>
            <p className="text-violet-300 text-xs mt-0.5">{timeLabel}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-sm transition-colors">✕</button>
        </div>

        <div className="px-5 pt-4 pb-2 max-h-60 overflow-y-auto space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">注文明細</p>
          {items.map((item, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${item.quantity === 0 ? "opacity-35" : "bg-slate-50"}`}>
              <span className="text-xl flex-shrink-0">{item.emoji || "🍽️"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                <p className="text-[11px] text-slate-400">{fmtYen(item.unit_price)} × {item.quantity}{item.tax_rate === 0.08 ? " (8%)" : " (10%)"}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setQty(i, -1)} className="w-7 h-7 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 font-bold transition-colors">−</button>
                <span className="w-6 text-center text-sm font-black text-slate-900 tabular-nums">{item.quantity}</span>
                <button onClick={() => setQty(i, +1)} className="w-7 h-7 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 font-bold transition-colors">＋</button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">客層</p>
          <div className="flex gap-6">
            {([
              { label: "👨 男性", count: maleCount, set: setMaleCount, cls: "bg-blue-100 text-blue-700" },
              { label: "👩 女性", count: femaleCount, set: setFemaleCount, cls: "bg-pink-100 text-pink-700" },
            ] as { label: string; count: number; set: (fn: (n: number) => number) => void; cls: string }[]).map(({ label, count, set, cls }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">{label}</span>
                <button onClick={() => set(n => Math.max(0, n - 1))} className="w-6 h-6 bg-slate-100 hover:bg-slate-200 rounded-md text-xs font-bold transition-colors">−</button>
                <span className={`w-7 h-7 rounded-md flex items-center justify-center text-sm font-black tabular-nums ${cls}`}>{count}</span>
                <button onClick={() => set(n => n + 1)} className="w-6 h-6 bg-slate-100 hover:bg-slate-200 rounded-md text-xs font-bold transition-colors">＋</button>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200">
          {saveErr && <p className="text-xs text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-lg">⚠️ {saveErr}</p>}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">訂正後合計</p>
              <p className="text-2xl font-black text-slate-900 tabular-nums">{fmtYen(total)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">キャンセル</button>
              <button
                onClick={handleSave}
                disabled={saving || total === 0}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存する"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Order Row ────────────────────────────────────────────────
function OrderRow({ row, onEdit, onDelete }: {
  row: SaleDetailRow;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const rawItems  = Array.isArray(row.items) ? row.items : [];
  const itemCount = rawItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const preview   = rawItems.slice(0, 2).map(it => `${it.emoji ?? ""}${it.name}`).join("・");
  const timeLabel = new Date(row.created_at).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const guestLabel = (() => {
    const m = row.male_count ?? 0, f = row.female_count ?? 0;
    return m === 0 && f === 0 ? "—" : `👨${m} 👩${f}`;
  })();

  const doDelete = async () => {
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  };

  if (confirm) {
    return (
      <div className="px-5 py-3.5 bg-red-50 border-b border-red-100 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-red-700">この注文を完全に削除しますか？</p>
        <div className="flex gap-2">
          <button onClick={() => setConfirm(false)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">キャンセル</button>
          <button onClick={doDelete} disabled={deleting} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50">
            {deleting ? "削除中…" : "削除する"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[110px_1fr_80px_80px_90px_130px] gap-2 items-center px-4 py-3.5 border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <span className="text-xs font-mono text-slate-600 tabular-nums">{timeLabel}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {preview || "—"}
          {rawItems.length > 2 && <span className="text-slate-400 ml-1">他{rawItems.length - 2}品</span>}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">{itemCount}品</p>
      </div>
      <span className="text-xs text-slate-500 text-center">{guestLabel}</span>
      <div className="text-center">
        <p className="text-xs text-slate-500 truncate">{row.staff_name || "—"}</p>
        {(() => { const p = paymentInfo(row.payment_method); return (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold border ${p.cls} mt-0.5`}>
            {p.icon} {p.label}
          </span>
        ); })()}
      </div>
      <span className="text-sm font-bold text-violet-700 text-right tabular-nums">{fmtYen(row.total_amount)}</span>
      <div className="flex gap-1.5 justify-end">
        <button onClick={onEdit} className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-600 hover:text-violet-700 text-xs font-semibold transition-all active:scale-95">修正</button>
        <button onClick={() => setConfirm(true)} className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-500 hover:text-red-600 text-xs font-semibold transition-all active:scale-95">削除</button>
      </div>
    </div>
  );
}

// ─── Payment Summary Card ─────────────────────────────────────
function PaymentSummaryCard({
  title,
  orders,
  sourceTitle,
  onDrillDown,
}: {
  title: string;
  orders: SaleDetailRow[];
  sourceTitle: string;
  onDrillDown: (info: { itemName: string; emoji: string; orders: SaleDetailRow[]; sourceTitle: string }) => void;
}) {
  const pmCounts: Record<string, number> = {};
  const pmRevs:   Record<string, number> = {};
  for (const o of orders) {
    const m = o.payment_method ?? "cash";
    pmCounts[m] = (pmCounts[m] ?? 0) + 1;
    pmRevs[m]   = (pmRevs[m]   ?? 0) + safeNum(o.total_amount);
  }
  // Always show all 4 methods regardless of data
  const allMethods = (["cash", "card", "qr", "voucher"] as const)
    .map(key => ({ key, ...paymentInfo(key) }));
  const activeMethods = allMethods.filter(m => (pmCounts[m.key] ?? 0) > 0);

  const totalRev = Object.values(pmRevs).reduce((s, v) => s + v, 0);
  const barColor: Record<string, string> = {
    cash: "bg-slate-400", card: "bg-blue-500", qr: "bg-emerald-500", voucher: "bg-amber-500",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{title}</p>
        {totalRev > 0 ? (
          <>
            {/* Stacked proportion bar */}
            <div className="flex h-8 rounded-xl overflow-hidden gap-0.5 mb-2">
              {activeMethods.map(m => {
                const pct  = (pmRevs[m.key] ?? 0) / totalRev * 100;
                const pctR = Math.round(pct);
                if (pctR === 0) return null;
                return (
                  <div
                    key={m.key}
                    className={`${barColor[m.key]} flex items-center justify-center text-white font-bold overflow-hidden`}
                    style={{ width: `${pct}%`, fontSize: pct >= 8 ? "11px" : "10px" }}
                  >
                    {/* Wide: icon + %; Medium: icon only; Narrow: nothing (shown in legend) */}
                    {pct >= 8 ? `${m.icon} ${pctR}%` : pct >= 3 ? m.icon : ""}
                  </div>
                );
              })}
            </div>
            {/* Always-visible per-method legend (ensures small segments are labelled) */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {activeMethods.map(m => {
                const pct = (pmRevs[m.key] ?? 0) / totalRev * 100;
                return (
                  <span key={m.key} className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                    <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${barColor[m.key]}`} />
                    {m.icon} {Math.round(pct)}%
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <div className="h-8 rounded-xl bg-slate-100 flex items-center justify-center">
            <span className="text-[10px] text-slate-400">データがありません</span>
          </div>
        )}
      </div>
      <div className="border-t border-slate-100">
        <div className="grid grid-cols-[1fr_72px_116px] gap-2 px-5 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
          <span>決済手段</span>
          <span className="text-right">件数</span>
          <span className="text-right">売上合計</span>
        </div>
        {allMethods.map(m => {
          const count   = pmCounts[m.key] ?? 0;
          const rev     = pmRevs[m.key]   ?? 0;
          const hasData = count > 0;
          return (
            <div
              key={m.key}
              onClick={hasData ? () => onDrillDown({
                itemName: m.label, emoji: m.icon,
                orders:   orders.filter(o => (o.payment_method ?? "cash") === m.key),
                sourceTitle,
              }) : undefined}
              className={`grid grid-cols-[1fr_72px_116px] gap-2 items-center px-5 py-3 border-b border-slate-50 last:border-0 transition-colors ${
                hasData ? "hover:bg-violet-50 cursor-pointer active:scale-[0.99]" : "opacity-40"
              }`}
            >
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold border w-fit ${m.cls}`}>
                {m.icon} {m.label}
              </span>
              <span className="text-sm font-bold text-slate-700 tabular-nums text-right">
                {count.toLocaleString()}件
              </span>
              <span className={`text-sm font-black tabular-nums text-right ${hasData ? "text-violet-700" : "text-slate-400"}`}>
                {fmtYen(rev)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function SalesDataPage() {
  const now          = new Date();
  const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd     = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const yestStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const thisMonStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonEnd   = new Date(now.getFullYear(), now.getMonth(), 1);

  const [activeTab, setActiveTab]       = useState<MainTab>("today");

  // カテゴリー別タブ専用フィルター
  const [categoryPeriod, setCategoryPeriod] = useState<"day" | "month" | "year">("month");
  const [categoryDay, setCategoryDay] = useState<string>(() =>
    new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
  );

  // 時間帯別タブ専用フィルター
  const [hourlyMode, setHourlyMode]     = useState<"day" | "month" | "year">("month");
  const [hourlyDay, setHourlyDay]       = useState<string>(() =>
    new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
  );
  const [hoveredYearMonth, setHoveredYearMonth] = useState<{ month: number; total: number; count: number } | null>(null);
  const [pinnedYearMonth,  setPinnedYearMonth]  = useState<{ month: number; total: number; count: number } | null>(null);

  // 共通ドリルダウンモーダル（全タブ共有）
  const [analysisModal, setAnalysisModal] = useState<{
    title: string;
    subtitle?: string;
    orders: SaleDetailRow[];
  } | null>(null);
  const [itemReceiptsModal, setItemReceiptsModal] = useState<{
    itemName: string;
    emoji: string;
    orders: SaleDetailRow[];
    sourceTitle: string;
  } | null>(null);
  // undefined = storeId not yet fetched; null = no stores table; string = actual ID
  const [storeId, setStoreId]           = useState<string | null | undefined>(undefined);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // "この日の売上" data
  const [today, setToday]               = useState<PeriodData | null>(null);
  const [yesterday, setYesterday]       = useState<PeriodData | null>(null);
  const [thisMonth, setThisMonth]       = useState<PeriodData | null>(null);
  const [lastMonth, setLastMonth]       = useState<PeriodData | null>(null);
  const [hourly, setHourly]             = useState<HourlySales[]>([]);

  // Shared order list
  const monthOptions                    = useMemo(getMonthOptions, []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [monthOrders, setMonthOrders]   = useState<SaleDetailRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Modals
  const [editRow, setEditRow]           = useState<SaleDetailRow | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);

  // Yearly tab
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [yearOrders, setYearOrders]     = useState<SaleDetailRow[]>([]);
  const [yearlySummary, setYearlySummary] = useState<YearlySummaryMonth[]>([]);
  const [yearLoading, setYearLoading]   = useState(false);

  // Order list filter / pagination
  const [filterFrom, setFilterFrom]     = useState<Date | null>(null);
  const [filterTo, setFilterTo]         = useState<Date | null>(null);
  const [quickFilter, setQuickFilter]   = useState<"all" | "today" | "yesterday" | "week" | "custom">("all");
  const [customDate, setCustomDate]     = useState("");
  const [ordersPage, setOrdersPage]     = useState(1);
  const ORDERS_PAGE_SIZE = 30;

  // 客層分析モード
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("SIMPLE");

  useEffect(() => {
    fetchAnalysisMode().then(setAnalysisMode).catch(() => {});
  }, []);

  // ── Loaders ───────────────────────────────────────────────
  const loadSummaries = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const [t, y, tm, lm, h] = await Promise.all([
        fetchPeriodSummary(todayStart, todayEnd),
        fetchPeriodSummary(yestStart, todayStart),
        fetchPeriodSummary(thisMonStart, todayEnd),
        fetchPeriodSummary(lastMonStart, lastMonEnd),
        fetchTodayHourlySales(),
      ]);
      setToday(t); setYesterday(y); setThisMonth(tm); setLastMonth(lm);
      setHourly(padHourlyData(h));
    } catch { /* swallow refresh errors */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadYearOrders = useCallback(async (year: number) => {
    if (!isSupabaseConfigured) return;
    try {
      setYearOrders(await fetchYearOrders(year));
    } catch { setYearOrders([]); }
  }, []);

  const loadYearlySummary = useCallback(async (year: number) => {
    if (!isSupabaseConfigured) return;
    setYearLoading(true);
    try {
      setYearlySummary(await fetchYearlySummary(year));
    } catch { setYearlySummary([]); }
    finally { setYearLoading(false); }
  }, []);

  const loadMonthOrders = useCallback(async (ym: string) => {
    if (!isSupabaseConfigured) return;
    setOrdersLoading(true);
    const [y, m] = ym.split("-").map(Number);
    const from = new Date(y, m - 1, 1);
    const to   = new Date(y, m, 1);
    try {
      setMonthOrders(await fetchSalesDetail(from, to));
    } catch { setMonthOrders([]); }
    finally { setOrdersLoading(false); }
  }, []);

  const loadAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      setStoreId(null); // sales テーブルに store_id カラムがないため使用しない
      await loadSummaries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally { setLoading(false); }
  }, [loadSummaries]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Load month orders whenever month or storeId is known (storeId gate: waits for loadAll)
  useEffect(() => {
    if (storeId === undefined) return;
    loadMonthOrders(selectedMonth);
  }, [selectedMonth, storeId, loadMonthOrders]);

  // Yearly tab: aggregated summary via RPC + raw orders for PaymentSummaryCard
  useEffect(() => {
    if (storeId === undefined || activeTab !== "yearly") return;
    loadYearlySummary(selectedYear);
    loadYearOrders(selectedYear);
  }, [activeTab, selectedYear, storeId, loadYearlySummary, loadYearOrders]);

  // Hourly tab year mode: raw orders for hourly distribution
  useEffect(() => {
    if (storeId === undefined) return;
    if (activeTab !== "hourly" || hourlyMode !== "year") return;
    loadYearOrders(selectedYear);
  }, [activeTab, hourlyMode, selectedYear, storeId, loadYearOrders]);

  // Category tab year mode
  useEffect(() => {
    if (storeId === undefined) return;
    if (activeTab !== "category" || categoryPeriod !== "year") return;
    loadYearOrders(selectedYear);
  }, [activeTab, categoryPeriod, selectedYear, storeId, loadYearOrders]);

  // 日別モード: hourlyDay の「年-月」と selectedMonth を常に同期させる
  // （別タブで月を変更してから日別に切り替えると monthOrders がズレてフィルタが0件になるバグ対策）
  useEffect(() => {
    if (hourlyMode !== "day") return;
    const ym = hourlyDay.slice(0, 7);
    setSelectedMonth(prev => (monthOptions.some(o => o.value === ym) ? ym : prev));
  }, [hourlyMode, hourlyDay, monthOptions]);

  // カテゴリー日別モード: categoryDay の年月と selectedMonth を同期
  useEffect(() => {
    if (categoryPeriod !== "day") return;
    const ym = categoryDay.slice(0, 7);
    setSelectedMonth(prev => (monthOptions.some(o => o.value === ym) ? ym : prev));
  }, [categoryPeriod, categoryDay, monthOptions]);

  // ── Edit / Delete ──────────────────────────────────────────
  const handleSave = useCallback(async (id: string, patch: SaleRecordUpdate) => {
    await updateSaleRecord(id, patch);
    setMonthOrders(prev => prev.map(r =>
      r.id !== id ? r : { ...r, total_amount: patch.total_amount, items: patch.items, male_count: patch.male_count, female_count: patch.female_count }
    ));
    await loadSummaries();
  }, [loadSummaries]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSale(id);
    setMonthOrders(prev => prev.filter(r => r.id !== id));
    await loadSummaries();
  }, [loadSummaries]);

  // ── Analytics computed client-side from monthOrders ───────
  const todayJst = useMemo(
    () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }),
    [],
  );
  const todayOrders = useMemo(
    () => monthOrders.filter(o =>
      new Date(o.created_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) === todayJst
    ),
    [monthOrders, todayJst],
  );

  const categoryOrders = useMemo((): SaleDetailRow[] => {
    if (categoryPeriod === "day") {
      return monthOrders.filter(o =>
        new Date(o.created_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) === categoryDay
      );
    }
    if (categoryPeriod === "year") return yearOrders;
    return monthOrders;
  }, [categoryPeriod, categoryDay, monthOrders, yearOrders]);

  const categoryData = useMemo(() => {
    let takeout = 0, takeoutCount = 0, dinein = 0, dineinCount = 0;
    for (const o of categoryOrders) {
      const items = Array.isArray(o.items) ? o.items : [];
      let toAmt = 0, diAmt = 0;
      for (const it of items) {
        const qty   = safeNum(it.quantity);
        const price = safeNum(it.unit_price);
        const taxD  = taxDecimal(it.tax_rate);
        const amt   = Math.round(price * qty * (1 + taxD));
        if (taxD < 0.09) toAmt += amt;
        else             diAmt += amt;
      }
      // itemsが空またはすべて¥0の場合はtotal_amountを店内飲食として補填
      if (toAmt === 0 && diAmt === 0) {
        const fb = safeNum(o.total_amount);
        if (fb > 0) diAmt = fb;
      }
      takeout += toAmt; if (toAmt > 0) takeoutCount++;
      dinein  += diAmt; if (diAmt > 0) dineinCount++;
    }
    return [
      { label: "🍽️ 店内飲食（10%）", total: dinein,  count: dineinCount  },
      { label: "🥡 テイクアウト（8%）", total: takeout, count: takeoutCount },
    ];
  }, [categoryOrders]);

  const itemRankings = useMemo(() => {
    const map = new Map<string, { emoji: string; qty: number; revenue: number }>();
    for (const o of monthOrders) {
      for (const it of o.items ?? []) {
        const name  = it.name  ?? "（不明）";
        const emoji = it.emoji ?? "🍽️";
        const qty   = safeNum(it.quantity);
        const price = safeNum(it.unit_price);
        const tax   = taxDecimal(it.tax_rate);
        const prev  = map.get(name) ?? { emoji, qty: 0, revenue: 0 };
        map.set(name, {
          emoji,
          qty:     prev.qty + qty,
          revenue: prev.revenue + Math.round(price * qty * (1 + tax)),
        });
      }
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty);
  }, [monthOrders]);

  const staffData = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const o of monthOrders) {
      const key  = o.staff_name || "（未設定）";
      const prev = map.get(key) ?? { total: 0, count: 0 };
      map.set(key, { total: prev.total + safeNum(o.total_amount), count: prev.count + 1 });
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [monthOrders]);

  // 時間帯別タブで使うオーダーソース（モードに応じて切り替え）
  const hourlyTabOrders = useMemo((): SaleDetailRow[] => {
    if (hourlyMode === "day") {
      return monthOrders.filter(o => {
        const jst = new Date(o.created_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
        return jst === hourlyDay;
      });
    }
    if (hourlyMode === "year") return yearOrders;
    return monthOrders;
  }, [hourlyMode, hourlyDay, monthOrders, yearOrders]);

  const hourlyData = useMemo((): HourlySales[] => {
    const map = new Map<number, { total: number; count: number }>();
    for (const o of hourlyTabOrders) {
      const h    = parseInt(
        new Date(o.created_at).toLocaleTimeString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 2),
        10,
      );
      const prev = map.get(h) ?? { total: 0, count: 0 };
      map.set(h, { total: prev.total + safeNum(o.total_amount), count: prev.count + 1 });
    }
    const raw = Array.from(map.entries()).map(([hour, v]) => ({ hour, ...v }));
    return padHourlyData(raw);
  }, [hourlyTabOrders]);

  const analysisModalItems = useMemo((): ItemBreakdown[] => {
    if (!analysisModal) return [];
    return buildItemBreakdown(analysisModal.orders);
  }, [analysisModal]);

  const filteredOrders = useMemo(() => {
    if (!filterFrom && !filterTo) return monthOrders;
    return monthOrders.filter(o => {
      const ts = new Date(o.created_at).getTime();
      return ts >= (filterFrom?.getTime() ?? -Infinity) && ts < (filterTo?.getTime() ?? Infinity);
    });
  }, [monthOrders, filterFrom, filterTo]);

  const genderData = useMemo(() => {
    let maleCnt = 0, femaleCnt = 0, revenueWithGuests = 0, ordersWithGuests = 0;
    for (const o of monthOrders) {
      const m = safeNum(o.male_count);
      const f = safeNum(o.female_count);
      maleCnt   += m;
      femaleCnt += f;
      if (m + f > 0) { revenueWithGuests += safeNum(o.total_amount); ordersWithGuests++; }
    }
    const total        = maleCnt + femaleCnt;
    const malePct      = total > 0 ? Math.round((maleCnt / total) * 100) : 50;
    const femalePct    = 100 - malePct;
    const avgPerPerson = total > 0 ? Math.floor(revenueWithGuests / total) : 0;

    // ── 統計推測モード ──────────────────────────────────────────
    // お一人様会計（男性1名のみ / 女性1名のみ）をサンプルとし
    // グループ客の売上を男女の推定単価比で按分する。
    const soloMale   = monthOrders.filter(o => safeNum(o.male_count) === 1 && safeNum(o.female_count) === 0);
    const soloFemale = monthOrders.filter(o => safeNum(o.female_count) === 1 && safeNum(o.male_count) === 0);
    const MIN_SAMPLE = 5;

    let avgMalePerPerson   = avgPerPerson;
    let avgFemalePerPerson = avgPerPerson;
    let isFallback         = false;

    if (analysisMode === "STATISTICAL") {
      if (soloMale.length >= MIN_SAMPLE && soloFemale.length >= MIN_SAMPLE) {
        const avgMaleUnit   = soloMale.reduce((s, o) => s + safeNum(o.total_amount), 0) / soloMale.length;
        const avgFemaleUnit = soloFemale.reduce((s, o) => s + safeNum(o.total_amount), 0) / soloFemale.length;

        let totalMaleRev = 0, totalFemaleRev = 0;
        for (const o of monthOrders) {
          const m = safeNum(o.male_count);
          const f = safeNum(o.female_count);
          if (m + f === 0) continue;
          const tot  = safeNum(o.total_amount);
          const mW   = m * avgMaleUnit;
          const fW   = f * avgFemaleUnit;
          const wSum = mW + fW;
          if (wSum === 0) continue;
          totalMaleRev   += tot * mW / wSum;
          totalFemaleRev += tot * fW / wSum;
        }

        avgMalePerPerson   = maleCnt   > 0 ? Math.floor(totalMaleRev   / maleCnt)   : 0;
        avgFemalePerPerson = femaleCnt > 0 ? Math.floor(totalFemaleRev / femaleCnt) : 0;
      } else {
        isFallback = true;
      }
    }

    return {
      maleCnt, femaleCnt, total, malePct, femalePct,
      avgPerPerson, avgMalePerPerson, avgFemalePerPerson,
      revenueWithGuests, ordersWithGuests, isFallback,
      soloMaleSamples: soloMale.length, soloFemaleSamples: soloFemale.length,
    };
  }, [monthOrders, analysisMode]);

  const yearlyData = useMemo(() => {
    const monthlyMap = new Map<number, { total: number; count: number }>();
    for (let m = 1; m <= 12; m++) monthlyMap.set(m, { total: 0, count: 0 });
    let totalRev = 0, totalCount = 0, totalGuests = 0, rev10 = 0, rev8 = 0;
    for (const row of yearlySummary) {
      totalRev   += row.total_rev;
      totalCount += row.cnt;
      totalGuests += row.guests;
      rev10 += row.rev_10;
      rev8  += row.rev_8;
      monthlyMap.set(row.month, { total: row.total_rev, count: row.cnt });
    }
    return {
      totalRev, totalCount, totalGuests,
      rev10, rev8,
      tax10: Math.round(rev10 / 11),
      tax8:  Math.round(rev8 * 8 / 108),
      avgPerOrder:  totalCount  > 0 ? Math.floor(totalRev / totalCount)  : 0,
      avgPerPerson: totalGuests > 0 ? Math.floor(totalRev / totalGuests) : 0,
      monthly: Array.from(monthlyMap.entries()).map(([month, v]) => ({ month, ...v })),
    };
  }, [yearlySummary]);

  // ── CSV ───────────────────────────────────────────────────
  const handleCsvExport = async () => {
    setCsvExporting(true);
    try {
      const all = await fetchAllSalesForExport();
      const grouped = new Map<string, { total: number; count: number }>();
      for (const s of all) {
        const date = new Date(s.created_at).toLocaleDateString("ja-JP", {
          timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
        });
        const prev = grouped.get(date) ?? { total: 0, count: 0 };
        grouped.set(date, { total: prev.total + s.total_amount, count: prev.count + 1 });
      }
      exportToCsv(
        Array.from(grouped.entries())
          .map(([date, v]) => ({ date, ...v }))
          .sort((a, b) => b.date.localeCompare(a.date))
      );
    } catch { alert("CSVの書き出しに失敗しました。"); }
    finally { setCsvExporting(false); }
  };

  const monthLabel = monthOptions.find(o => o.value === selectedMonth)?.label ?? selectedMonth;

  const hourlyTabLabel = (() => {
    if (hourlyMode === "day") {
      return new Date(hourlyDay + "T12:00:00+09:00").toLocaleDateString("ja-JP", {
        year: "numeric", month: "long", day: "numeric", weekday: "short",
      });
    }
    if (hourlyMode === "year") return `${selectedYear}年`;
    return monthLabel;
  })();

  // ─────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      {/* ── Header ─────────────────────────────────────── */}
      <header className="bg-violet-800 text-white shadow-lg flex-shrink-0">
        <div className="px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-violet-300 hover:text-white text-sm font-medium transition-colors">
              ← HOME
            </Link>
            <div className="w-8 h-8 bg-white/20 rounded-[10px] flex items-center justify-center">
              <span className="text-[10px] font-black tracking-tight">FL</span>
            </div>
            <div className="leading-none">
              <p className="text-sm font-bold leading-tight">売上管理</p>
              <p className="text-[11px] text-violet-300 mt-0.5">Kitchen Kazu · FLOWS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAll}
              disabled={loading || !isSupabaseConfigured}
              className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-600 border border-violet-600 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              <span className={loading ? "animate-spin inline-block" : ""}>🔄</span>更新
            </button>
            <button
              onClick={handleCsvExport}
              disabled={csvExporting}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              {csvExporting ? "⏳" : "📥"} CSV
            </button>
            <button
              onClick={() => setShowReceiptModal(true)}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
            >
              📄 領収書
            </button>
            <Link href="/register"
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all">
              🧾 レジへ
            </Link>
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ──────────────────────────────────── */}
        <nav className="w-52 flex-shrink-0 bg-violet-900 flex flex-col">
          <div className="pt-5 pb-2 px-3 space-y-0.5">
            {NAV_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? "bg-white text-violet-900 shadow-sm"
                    : "text-violet-200 hover:bg-violet-800 hover:text-white"
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Month selector — hidden for today/yearly tabs and category day/year modes */}
          {activeTab !== "today" && activeTab !== "yearly" &&
           !(activeTab === "category" && categoryPeriod !== "month") && (
            <div className="mt-5 px-3">
              <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 px-1">対象月</p>
              <select
                value={selectedMonth}
                onChange={e => {
                  setSelectedMonth(e.target.value);
                  setQuickFilter("all"); setFilterFrom(null); setFilterTo(null);
                  setCustomDate(""); setOrdersPage(1);
                }}
                className="w-full text-xs bg-violet-800 border border-violet-700 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500"
              >
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Day picker — category day mode only */}
          {activeTab === "category" && categoryPeriod === "day" && (
            <div className="mt-5 px-3">
              <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 px-1">対象日</p>
              <input
                type="date"
                value={categoryDay}
                onChange={e => e.target.value && setCategoryDay(e.target.value)}
                className="w-full text-xs bg-violet-800 border border-violet-700 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500"
              />
            </div>
          )}

          {/* Year selector — yearly tab or category year mode */}
          {(activeTab === "yearly" || (activeTab === "category" && categoryPeriod === "year")) && (
            <div className="mt-5 px-3">
              <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 px-1">対象年</p>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full text-xs bg-violet-800 border border-violet-700 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500"
              >
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1" />

          {/* Bottom links */}
          <div className="p-3 border-t border-violet-800 space-y-0.5">
            <Link href="/settings"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-violet-300 hover:text-white hover:bg-violet-800 text-xs font-semibold transition-all">
              ⚙️ 設定・精算
            </Link>
            <a
              href={`mailto:?subject=${encodeURIComponent("【売上報告書】Kitchen Kazu")}&body=${encodeURIComponent("税理士の先生\n\nお世話になっております。\nKitchen Kazuの売上報告書をお送りします。\n\nよろしくお願いいたします。")}`}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-violet-300 hover:text-white hover:bg-violet-800 text-xs font-semibold transition-all"
            >
              ✉️ 税理士へ送信
            </a>
          </div>
        </nav>

        {/* ── Content ──────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">

          {!isSupabaseConfigured && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm">
              ⚠️ Supabase が未設定です。<code className="bg-amber-100 px-1 rounded">.env.local</code> を確認してください。
            </div>
          )}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
              ⚠️ {error}
            </div>
          )}

          {loading && isSupabaseConfigured ? (
            <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
              <span className="animate-spin text-2xl">⏳</span>
              <span className="text-sm">データを読み込み中...</span>
            </div>
          ) : (
            <>
              {/* ════ Tab: この日の売上 ════════════════════ */}
              {activeTab === "today" && (
                <div className="space-y-5">
                  <h2 className="text-lg font-black text-slate-800">この日の売上</h2>

                  <div className="grid grid-cols-2 gap-4">
                    <KpiCard label="本日 売上"  value={fmtYen(today?.total    ?? 0)} sub={`${today?.count    ?? 0}件の会計`} color="violet" />
                    <KpiCard label="本日 客単価" value={fmtYen(today?.avgSpend ?? 0)} color="indigo" />
                    <KpiCard label="今月 累計"  value={fmtYen(thisMonth?.total ?? 0)} sub={`${thisMonth?.count ?? 0}件`}       color="emerald" />
                    <KpiCard label="先月 売上"  value={fmtYen(lastMonth?.total ?? 0)} sub={`${lastMonth?.count ?? 0}件`}       color="slate" />
                  </div>

                  {/* 昨日 → 本日 比較 */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">昨日との比較</p>
                    <div className="flex items-end gap-8">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">昨日</p>
                        <p className="text-xl font-bold text-slate-400 tabular-nums">{fmtYen(yesterday?.total ?? 0)}</p>
                        <p className="text-xs text-slate-400">{yesterday?.count ?? 0}件</p>
                      </div>
                      <span className="text-slate-300 text-2xl pb-2">→</span>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">本日</p>
                        <p className="text-2xl font-black text-violet-700 tabular-nums">{fmtYen(today?.total ?? 0)}</p>
                        <p className="text-xs text-slate-400">{today?.count ?? 0}件</p>
                      </div>
                      {today && yesterday && yesterday.total > 0 && (() => {
                        const pct = Math.round((today.total / yesterday.total - 1) * 100);
                        return (
                          <div className="ml-auto">
                            <p className="text-xs text-slate-400 mb-1">前日比</p>
                            <p className={`text-2xl font-black tabular-nums ${pct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {pct >= 0 ? "+" : ""}{pct}%
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 支払方法別 */}
                  <PaymentSummaryCard
                    title="本日の決済手段"
                    orders={todayOrders}
                    sourceTitle="本日の決済手段"
                    onDrillDown={setItemReceiptsModal}
                  />

                  {/* 時間別 */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">本日の時間別売上</p>
                      {hourly.some(h => h.count > 0) && (
                        <p className="text-xs text-violet-600 font-semibold">棒をクリックで商品内訳 ›</p>
                      )}
                    </div>
                    <HourlyChart
                      data={hourly}
                      onBarClick={hour => {
                        const hStr = String(hour).padStart(2, "0");
                        const cnt  = hourly.find(d => d.hour === hour)?.count ?? 0;
                        setAnalysisModal({
                          title: `🕐 ${hStr}:00 〜 ${hStr}:59`,
                          subtitle: `${cnt}会計 · 本日`,
                          orders: todayOrders.filter(o =>
                            parseInt(new Date(o.created_at).toLocaleTimeString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 2), 10) === hour
                          ),
                        });
                      }}
                    />
                  </div>
                </div>
              )}

              {/* ════ Tab: 会計一覧 ════════════════════════ */}
              {activeTab === "orders" && (() => {
                const applyQuick = (q: "all" | "today" | "yesterday" | "week") => {
                  const n = new Date();
                  const d0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
                  setQuickFilter(q); setCustomDate(""); setOrdersPage(1);
                  if (q === "all")       { setFilterFrom(null); setFilterTo(null); }
                  else if (q === "today")     { setFilterFrom(d0); setFilterTo(new Date(d0.getTime() + 86400000)); }
                  else if (q === "yesterday") { setFilterFrom(new Date(d0.getTime() - 86400000)); setFilterTo(d0); }
                  else if (q === "week")      { setFilterFrom(new Date(d0.getTime() - 6 * 86400000)); setFilterTo(new Date(d0.getTime() + 86400000)); }
                };
                const handleDate = (v: string) => {
                  setCustomDate(v); setQuickFilter("custom"); setOrdersPage(1);
                  if (!v) { setFilterFrom(null); setFilterTo(null); return; }
                  const [y, m, d] = v.split("-").map(Number);
                  setFilterFrom(new Date(y, m - 1, d));
                  setFilterTo(new Date(y, m - 1, d + 1));
                };
                const shown = filteredOrders.slice(0, ordersPage * ORDERS_PAGE_SIZE);
                const hasMore = shown.length < filteredOrders.length;
                const QUICK: { key: "all" | "today" | "yesterday" | "week"; label: string }[] = [
                  { key: "all",       label: "全表示" },
                  { key: "today",     label: "今日" },
                  { key: "yesterday", label: "昨日" },
                  { key: "week",      label: "直近7日" },
                ];
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h2 className="text-lg font-black text-slate-800">会計一覧 — {monthLabel}</h2>
                      <div className="flex flex-col items-end gap-0.5">
                        <p className="text-sm text-slate-400">
                          {filteredOrders.length !== monthOrders.length
                            ? `${filteredOrders.length} / ${monthOrders.length}件`
                            : `${monthOrders.length}件`}
                        </p>
                        {monthOrders.length >= 5000 && (
                          <p className="text-[10px] text-amber-500 font-semibold">最大5000件表示（月全体の一部）</p>
                        )}
                      </div>
                    </div>

                    {/* フィルターバー */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-2">
                      {/* クイックフィルター */}
                      <div className="flex gap-1.5">
                        {QUICK.map(q => (
                          <button
                            key={q.key}
                            onClick={() => applyQuick(q.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              quickFilter === q.key
                                ? "bg-violet-600 text-white shadow-sm"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>

                      <div className="w-px h-5 bg-slate-200 mx-1" />

                      {/* 日付ピッカー */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium">日付</span>
                        <input
                          type="date"
                          value={customDate}
                          onChange={e => handleDate(e.target.value)}
                          className={`text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none transition-colors ${
                            quickFilter === "custom" && customDate
                              ? "border-violet-400 bg-violet-50 text-violet-700"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                        />
                        {quickFilter === "custom" && customDate && (
                          <button
                            onClick={() => applyQuick("all")}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors px-1"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* テーブル */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      {ordersLoading ? (
                        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                          <span className="animate-spin">⏳</span> 読込中…
                        </div>
                      ) : filteredOrders.length === 0 ? (
                        <p className="text-center text-slate-400 text-sm py-12">
                          {monthOrders.length === 0 ? "この月のデータはありません" : "条件に一致するデータがありません"}
                        </p>
                      ) : (
                        <>
                          {/* Sticky ヘッダー */}
                          <div className="grid grid-cols-[110px_1fr_80px_80px_90px_130px] gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide sticky top-0 z-10">
                            <span>日時</span><span>商品</span>
                            <span className="text-center">客層</span><span className="text-center">担当</span>
                            <span className="text-right">金額</span><span className="text-right">操作</span>
                          </div>
                          {shown.map(row => (
                            <OrderRow
                              key={row.id}
                              row={row}
                              onEdit={() => setEditRow(row)}
                              onDelete={() => handleDelete(row.id)}
                            />
                          ))}
                          {/* もっと見る */}
                          {hasMore && (
                            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                              <p className="text-xs text-slate-400">
                                {shown.length}件表示 / 全{filteredOrders.length}件
                              </p>
                              <button
                                onClick={() => setOrdersPage(p => p + 1)}
                                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl transition-all active:scale-95 shadow-sm"
                              >
                                もっと見る（+{Math.min(ORDERS_PAGE_SIZE, filteredOrders.length - shown.length)}件）
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ════ Tab: カテゴリー別 ═════════════════════ */}
              {activeTab === "category" && (() => {
                const catPeriodLabel =
                  categoryPeriod === "day" ?
                    new Date(categoryDay + "T12:00:00+09:00").toLocaleDateString("ja-JP", {
                      month: "long", day: "numeric", weekday: "short",
                    }) :
                  categoryPeriod === "year" ? `${selectedYear}年` :
                  monthLabel;
                const catSourceTitle = `カテゴリー別 · ${catPeriodLabel}`;
                const PERIOD_OPTS: { key: "day" | "month" | "year"; label: string }[] = [
                  { key: "day",   label: "日別" },
                  { key: "month", label: "月別" },
                  { key: "year",  label: "年別" },
                ];
                const isCatLoading = ordersLoading || (categoryPeriod === "year" && yearLoading);
                return (
                  <div className="space-y-5">
                    {/* ヘッダー + トグル */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <h2 className="text-lg font-black text-slate-800">カテゴリー別 — {catPeriodLabel}</h2>
                      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                        {PERIOD_OPTS.map(opt => (
                          <button
                            key={opt.key}
                            onClick={() => setCategoryPeriod(opt.key)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              categoryPeriod === opt.key
                                ? "bg-violet-600 text-white shadow-sm"
                                : "text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {isCatLoading ? (
                      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                        <span className="animate-spin text-xl">⏳</span>
                        <span className="text-sm">読込中…</span>
                      </div>
                    ) : (<>

                    {/* KPI カード */}
                    <div className="grid grid-cols-2 gap-4">
                      {categoryData.map((cat, catIdx) => (
                        <div
                          key={cat.label}
                          onClick={() => {
                            if (cat.total === 0) return;
                            const isTakeout = catIdx === 1;
                            const orders = categoryOrders.map(o => ({
                              ...o,
                              items: (o.items ?? []).filter(i => {
                                const t = taxDecimal(i.tax_rate);
                                return isTakeout ? t < 0.09 : t >= 0.09;
                              }),
                            })).filter(o => o.items.length > 0);
                            setAnalysisModal({ title: cat.label, subtitle: catPeriodLabel, orders });
                          }}
                          className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 transition-all ${
                            cat.total > 0 ? "cursor-pointer hover:border-violet-300 hover:shadow-md hover:bg-violet-50/30" : ""
                          }`}
                        >
                          <p className="text-sm font-bold text-slate-700 mb-3">{cat.label}</p>
                          <p className="text-3xl font-black text-violet-700 tabular-nums">{fmtYen(cat.total)}</p>
                          <p className="text-xs text-slate-400 mt-2">{cat.count}件の会計に含む</p>
                          {cat.total > 0 && <p className="text-[9px] text-violet-400 mt-2 font-semibold">クリックで商品内訳 ›</p>}
                        </div>
                      ))}
                    </div>

                    {/* 売上構成比バー */}
                    {(() => {
                      const grand = categoryData.reduce((s, c) => s + c.total, 0);
                      const colors = ["bg-violet-500", "bg-indigo-400"];
                      const dotCls  = ["bg-violet-500", "bg-indigo-400"];
                      return (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">売上構成比</p>
                          {grand === 0 ? (
                            <div className="h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                              <span className="text-xs text-slate-400">データなし</span>
                            </div>
                          ) : (
                            <div className="flex h-8 rounded-xl overflow-hidden gap-0.5">
                              {categoryData.map((cat, i) => {
                                const pctRaw = (cat.total / grand) * 100;
                                return (
                                  <div
                                    key={cat.label}
                                    onClick={() => {
                                      if (cat.total === 0) return;
                                      const isTakeout = i === 1;
                                      const orders = categoryOrders.map(o => ({
                                        ...o,
                                        items: (o.items ?? []).filter(it => {
                                          const t = taxDecimal(it.tax_rate);
                                          return isTakeout ? t < 0.09 : t >= 0.09;
                                        }),
                                      })).filter(o => o.items.length > 0);
                                      setAnalysisModal({ title: cat.label, subtitle: catPeriodLabel, orders });
                                    }}
                                    className={`${colors[i]} flex items-center justify-center text-white text-xs font-bold min-w-0 transition-opacity ${cat.total > 0 ? "cursor-pointer hover:opacity-85" : ""}`}
                                    style={{ flex: cat.total }}
                                    title={`${cat.label}: ${pctRaw.toFixed(1)}% — クリックで内訳`}
                                  >
                                    {pctRaw >= 5 ? `${pctRaw.toFixed(1)}%` : ""}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {grand > 0 && <p className="text-[9px] text-violet-400 font-semibold mt-2">クリックで商品内訳 ›</p>}
                          <div className="flex gap-6 mt-3">
                            {categoryData.map((cat, i) => {
                              const pctRaw = grand > 0 ? (cat.total / grand) * 100 : 0;
                              const pctLabel = pctRaw === 0 ? "0%" : pctRaw < 0.1 ? "<0.1%" : `${pctRaw.toFixed(1)}%`;
                              return (
                                <div key={cat.label} className="flex items-center gap-2 text-xs text-slate-600">
                                  <span className={`w-2.5 h-2.5 rounded-sm ${dotCls[i]}`} />
                                  {cat.label}: {pctLabel}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 決済手段サマリー */}
                    <PaymentSummaryCard
                      title={`${catPeriodLabel}の決済手段`}
                      orders={categoryOrders}
                      sourceTitle={catSourceTitle}
                      onDrillDown={setItemReceiptsModal}
                    />

                    </>)}
                  </div>
                );
              })()}

              {/* ════ Tab: 商品別 ══════════════════════════ */}
              {activeTab === "items" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-black text-slate-800">商品別ランキング — {monthLabel}</h2>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {itemRankings.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-12">データがありません</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-[44px_44px_1fr_90px_110px] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          <span>#</span><span></span><span>商品名</span>
                          <span className="text-right">数量</span><span className="text-right">売上</span>
                        </div>
                        {itemRankings.map((item, idx) => (
                          <div
                            key={item.name}
                            onClick={() => {
                              const filtered = monthOrders.filter(o =>
                                (o.items ?? []).some(i => i.name === item.name)
                              );
                              setItemReceiptsModal({
                                itemName: item.name,
                                emoji: item.emoji,
                                orders: filtered,
                                sourceTitle: `商品別 · ${monthLabel}`,
                              });
                            }}
                            className="grid grid-cols-[44px_44px_1fr_90px_110px] gap-3 items-center px-5 py-3.5 border-b border-slate-100 cursor-pointer hover:bg-violet-50 transition-colors"
                          >
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? "bg-yellow-400 text-yellow-900"
                              : idx === 1 ? "bg-slate-300 text-slate-700"
                              : idx === 2 ? "bg-amber-600 text-white"
                              : "bg-slate-100 text-slate-500"
                            }`}>{idx + 1}</span>
                            <span className="text-xl">{item.emoji}</span>
                            <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                            <p className="text-sm font-bold text-violet-700 text-right tabular-nums">{isFinite(item.qty) ? item.qty : 0}食</p>
                            <p className="text-sm font-bold text-slate-700 text-right tabular-nums">{fmtYen(item.revenue)}</p>
                          </div>
                        ))}
                        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100">
                          <p className="text-[10px] text-violet-400 font-semibold">商品をタップすると会計履歴を表示 ›</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ════ Tab: 男女別 ══════════════════════════ */}
              {activeTab === "gender" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-800">男女別 — {monthLabel}</h2>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      analysisMode === "STATISTICAL"
                        ? "bg-teal-100 text-teal-700 border border-teal-200"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}>
                      {analysisMode === "STATISTICAL" ? "統計推測モード" : "単純平均モード"}
                    </span>
                  </div>
                  {analysisMode === "STATISTICAL" && genderData.isFallback && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
                      お一人様データが不足（男性 {genderData.soloMaleSamples}件 / 女性 {genderData.soloFemaleSamples}件、最低{5}件必要）のため単純平均にフォールバックしています
                    </div>
                  )}
                  {analysisMode === "STATISTICAL" && !genderData.isFallback && (
                    <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 text-xs text-teal-700">
                      お一人様サンプル：男性 {genderData.soloMaleSamples}件 · 女性 {genderData.soloFemaleSamples}件 を使って按分推定しています
                    </div>
                  )}

                  {/* 比率バー */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">客層構成比</p>
                    {genderData.total === 0 ? (
                      <p className="text-slate-300 text-sm text-center py-4">客層データがありません</p>
                    ) : (
                      <>
                        <div className="flex h-10 rounded-xl overflow-hidden gap-0.5 mb-3">
                          <div
                            onClick={() => {
                              if (genderData.maleCnt === 0) return;
                              setAnalysisModal({
                                title: "👨 男性客の注文内訳",
                                subtitle: `${genderData.maleCnt}名 · ${monthLabel}`,
                                orders: monthOrders.filter(o => safeNum(o.male_count) > 0),
                              });
                            }}
                            className={`bg-blue-500 flex items-center justify-center text-white text-sm font-bold transition-all ${genderData.maleCnt > 0 ? "cursor-pointer hover:bg-blue-400" : ""}`}
                            style={{ width: `${genderData.malePct}%` }}
                            title="男性客の注文内訳を表示"
                          >
                            {genderData.malePct >= 15 ? `👨 ${genderData.malePct}%` : ""}
                          </div>
                          <div
                            onClick={() => {
                              if (genderData.femaleCnt === 0) return;
                              setAnalysisModal({
                                title: "👩 女性客の注文内訳",
                                subtitle: `${genderData.femaleCnt}名 · ${monthLabel}`,
                                orders: monthOrders.filter(o => safeNum(o.female_count) > 0),
                              });
                            }}
                            className={`bg-pink-400 flex items-center justify-center text-white text-sm font-bold transition-all ${genderData.femaleCnt > 0 ? "cursor-pointer hover:bg-pink-300" : ""}`}
                            style={{ width: `${genderData.femalePct}%` }}
                            title="女性客の注文内訳を表示"
                          >
                            {genderData.femalePct >= 15 ? `👩 ${genderData.femalePct}%` : ""}
                          </div>
                        </div>
                        <p className="text-[9px] text-violet-400 font-semibold mt-2">クリックで商品内訳 ›</p>
                        <div className="flex gap-6">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
                            男性: {genderData.maleCnt}名 ({genderData.malePct}%)
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="w-3 h-3 rounded-sm bg-pink-400 inline-block" />
                            女性: {genderData.femaleCnt}名 ({genderData.femalePct}%)
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* KPI カード */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div
                      onClick={() => genderData.maleCnt > 0 && setAnalysisModal({
                        title: "👨 男性客の注文内訳",
                        subtitle: `${genderData.maleCnt}名 · ${monthLabel}`,
                        orders: monthOrders.filter(o => safeNum(o.male_count) > 0),
                      })}
                      className={`bg-white rounded-2xl border border-blue-100 shadow-sm p-5 transition-all ${genderData.maleCnt > 0 ? "cursor-pointer hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30" : ""}`}
                    >
                      <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">👨 男性客数</p>
                      <p className="text-3xl font-black text-blue-600 tabular-nums">{genderData.maleCnt}<span className="text-base font-semibold ml-1">名</span></p>
                      {genderData.maleCnt > 0 && <p className="text-[9px] text-blue-400 mt-2 font-semibold">クリックで商品内訳 ›</p>}
                    </div>
                    <div
                      onClick={() => genderData.femaleCnt > 0 && setAnalysisModal({
                        title: "👩 女性客の注文内訳",
                        subtitle: `${genderData.femaleCnt}名 · ${monthLabel}`,
                        orders: monthOrders.filter(o => safeNum(o.female_count) > 0),
                      })}
                      className={`bg-white rounded-2xl border border-pink-100 shadow-sm p-5 transition-all ${genderData.femaleCnt > 0 ? "cursor-pointer hover:border-pink-300 hover:shadow-md hover:bg-pink-50/30" : ""}`}
                    >
                      <p className="text-xs font-bold text-pink-400 uppercase tracking-widest mb-3">👩 女性客数</p>
                      <p className="text-3xl font-black text-pink-500 tabular-nums">{genderData.femaleCnt}<span className="text-base font-semibold ml-1">名</span></p>
                      {genderData.femaleCnt > 0 && <p className="text-[9px] text-pink-400 mt-2 font-semibold">クリックで商品内訳 ›</p>}
                    </div>
                    <div className="bg-white rounded-2xl border border-blue-50 shadow-sm p-5">
                      <p className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-3">👨 推定単価</p>
                      <p className="text-2xl font-black text-blue-600 tabular-nums">{fmtYen(genderData.avgMalePerPerson)}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {analysisMode === "STATISTICAL" && !genderData.isFallback ? "統計按分" : "単純平均"}
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl border border-pink-50 shadow-sm p-5">
                      <p className="text-xs font-bold text-pink-300 uppercase tracking-widest mb-3">👩 推定単価</p>
                      <p className="text-2xl font-black text-pink-500 tabular-nums">{fmtYen(genderData.avgFemalePerPerson)}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {analysisMode === "STATISTICAL" && !genderData.isFallback ? "統計按分" : "単純平均"}
                      </p>
                    </div>
                  </div>

                  {/* 比較テーブル */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <span>項目</span>
                      <span className="text-center text-blue-500">👨 男性</span>
                      <span className="text-center text-pink-500">👩 女性</span>
                    </div>
                    {[
                      {
                        label: "客数",
                        male: `${genderData.maleCnt}名`,
                        female: `${genderData.femaleCnt}名`,
                      },
                      {
                        label: "客数比率",
                        male: `${genderData.malePct}%`,
                        female: `${genderData.femalePct}%`,
                      },
                      {
                        label: analysisMode === "STATISTICAL" && !genderData.isFallback
                          ? "推定単価（統計按分）"
                          : "1人あたり単価（単純平均）",
                        male: fmtYen(genderData.avgMalePerPerson),
                        female: fmtYen(genderData.avgFemalePerPerson),
                      },
                    ].map(row => (
                      <div key={row.label} className="grid grid-cols-3 px-5 py-3.5 border-b border-slate-100 hover:bg-slate-50">
                        <p className="text-sm text-slate-600 font-medium">{row.label}</p>
                        <p className="text-sm font-bold text-blue-600 text-center tabular-nums">{row.male}</p>
                        <p className="text-sm font-bold text-pink-500 text-center tabular-nums">{row.female}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ════ Tab: 担当者別 ════════════════════════ */}
              {activeTab === "staff" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-black text-slate-800">担当者別ランキング — {monthLabel}</h2>

                  {/* Top performer highlight */}
                  {staffData.length > 0 && staffData[0].name !== "（未設定）" && (
                    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 shadow-sm p-5 flex items-center gap-4">
                      <span className="text-4xl">🏆</span>
                      <div>
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">今月のトップスタッフ</p>
                        <p className="text-2xl font-black text-amber-900">{staffData[0].name}</p>
                        <p className="text-sm text-amber-700 mt-0.5">
                          {fmtYen(staffData[0].total)} · {staffData[0].count}件の会計
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {staffData.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-12">データがありません</p>
                    ) : (() => {
                      const maxTotal = staffData[0]?.total ?? 1;
                      return (
                        <>
                          <div className="grid grid-cols-[44px_1fr_80px_130px_100px] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            <span>#</span><span>担当者</span>
                            <span className="text-right">件数</span>
                            <span className="text-right">売上合計</span>
                            <span className="text-right">客単価</span>
                          </div>
                          {staffData.map((s, idx) => (
                            <div
                              key={s.name}
                              onClick={() => {
                                const staffOrders = monthOrders.filter(o => (o.staff_name || "（未設定）") === s.name);
                                setAnalysisModal({
                                  title: `👤 ${s.name}`,
                                  subtitle: `${s.count}件の会計 · ${monthLabel}`,
                                  orders: staffOrders,
                                });
                              }}
                              className="grid grid-cols-[44px_1fr_80px_130px_100px] gap-3 items-center px-5 py-4 border-b border-slate-100 hover:bg-violet-50 cursor-pointer transition-colors"
                            >
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                idx === 0 ? "bg-yellow-400 text-yellow-900"
                                : idx === 1 ? "bg-slate-300 text-slate-700"
                                : idx === 2 ? "bg-amber-600 text-white"
                                : "bg-slate-100 text-slate-500"
                              }`}>{idx + 1}</span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2.5 mb-1.5">
                                  <div className="w-8 h-8 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                                    {s.name === "（未設定）" ? "?" : s.name[0]}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-800">{s.name}</p>
                                    <p className="text-[9px] text-violet-400 font-semibold leading-none mt-0.5">クリックで商品内訳 ›</p>
                                  </div>
                                </div>
                                {/* 売上シェアバー */}
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-violet-500 rounded-full"
                                    style={{ width: `${Math.round((s.total / maxTotal) * 100)}%` }}
                                  />
                                </div>
                              </div>
                              <p className="text-sm text-slate-600 text-right tabular-nums">{s.count}件</p>
                              <p className="text-sm font-bold text-violet-700 text-right tabular-nums">{fmtYen(s.total)}</p>
                              <p className="text-sm text-slate-600 text-right tabular-nums">
                                {fmtYen(s.count > 0 ? Math.floor(s.total / s.count) : 0)}
                              </p>
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ════ Tab: 年別売上 ════════════════════════ */}
              {activeTab === "yearly" && (
                <div className="space-y-5">
                  <h2 className="text-lg font-black text-slate-800">年別売上 — {selectedYear}年</h2>

                  {yearLoading ? (
                    <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
                      <span className="animate-spin text-2xl">⏳</span>
                      <span className="text-sm">年間データを読み込み中...</span>
                    </div>
                  ) : (
                    <>
                      {/* KPI カード */}
                      <div className="grid grid-cols-2 gap-4">
                        <KpiCard label="純売上（税込）" value={fmtYen(yearlyData.totalRev)} sub={`${yearlyData.totalCount}件の会計`} color="violet" />
                        <KpiCard label="会計数" value={`${yearlyData.totalCount}件`} sub={`月平均 ${Math.floor(yearlyData.totalCount / 12)}件`} color="indigo" />
                        <KpiCard label="客数（記録あり）" value={`${yearlyData.totalGuests}名`} sub="来店人数の合計" color="emerald" />
                        <KpiCard
                          label="客単価（会計ベース）"
                          value={fmtYen(yearlyData.avgPerOrder)}
                          sub={yearlyData.totalGuests > 0 ? `人単価 ${fmtYen(yearlyData.avgPerPerson)}` : undefined}
                          color="slate"
                        />
                      </div>

                      {/* 支払方法別 */}
                      <PaymentSummaryCard
                        title={`${selectedYear}年の決済手段`}
                        orders={yearOrders}
                        sourceTitle={`${selectedYear}年の決済手段`}
                        onDrillDown={setItemReceiptsModal}
                      />

                      {/* 消費税率別集計（リキッドレジ準拠） */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">消費税率別集計</p>
                        <div className="grid grid-cols-2 gap-4">
                          {/* 10% */}
                          <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                            <p className="text-xs font-bold text-violet-500 uppercase tracking-widest mb-3">消費税率 10%（標準税率）</p>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">売上（10%対象）</span>
                                <span className="text-sm font-black text-violet-700 tabular-nums">{fmtYen(yearlyData.rev10)}</span>
                              </div>
                              <div className="h-px bg-violet-100" />
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">うち消費税</span>
                                <span className="text-base font-black text-violet-800 tabular-nums">{fmtYen(yearlyData.tax10)}</span>
                              </div>
                            </div>
                          </div>
                          {/* 8% */}
                          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">消費税率 8%（軽減税率）</p>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">売上（8%対象）</span>
                                <span className="text-sm font-black text-indigo-700 tabular-nums">{fmtYen(yearlyData.rev8)}</span>
                              </div>
                              <div className="h-px bg-indigo-100" />
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">うち消費税</span>
                                <span className="text-base font-black text-indigo-800 tabular-nums">{fmtYen(yearlyData.tax8)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 月別トレンド */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">月別売上トレンド</p>
                          {yearlyData.totalCount > 0 && <p className="text-xs text-violet-600 font-semibold">タップで内訳 ›</p>}
                        </div>
                        {yearlyData.totalCount === 0 ? (
                          <p className="text-center text-slate-300 text-sm py-8">データがありません</p>
                        ) : (() => {
                          const maxM  = Math.max(...yearlyData.monthly.map(m => m.total), 1);
                          const CHART_H_Y = 144;
                          const { ticks, niceMax } = niceScale(maxM);
                          const displayedM = pinnedYearMonth ?? hoveredYearMonth;
                          return (
                            <>
                              {/* Info panel */}
                              <div
                                className={`flex items-center gap-2 mb-2 rounded-xl px-3 transition-colors ${
                                  pinnedYearMonth ? "py-2 bg-violet-50 border border-violet-200" : "py-1.5"
                                }`}
                                style={{ minHeight: "40px" }}
                              >
                                {displayedM && displayedM.count > 0 ? (
                                  <>
                                    <span className="text-[11px] font-bold text-violet-700 flex-shrink-0">{displayedM.month}月</span>
                                    <span className="text-sm font-black text-slate-800 tabular-nums">{fmtYen(displayedM.total)}</span>
                                    <span className="text-xs text-slate-400">{displayedM.count}件</span>
                                    {pinnedYearMonth && (
                                      <button
                                        onClick={() => {
                                          void fetchMonthOrdersForAnalysis(selectedYear, pinnedYearMonth.month)
                                            .then(orders => setAnalysisModal({
                                              title: `${selectedYear}年${pinnedYearMonth.month}月`,
                                              subtitle: `${pinnedYearMonth.count}件の会計 · 商品内訳`,
                                              orders,
                                            }))
                                            .catch(() => {});
                                          setPinnedYearMonth(null);
                                        }}
                                        className="ml-auto flex-shrink-0 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors active:scale-95 min-w-[80px] min-h-[36px]"
                                      >
                                        内訳を表示 ›
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-500">棒をタップで詳細 / 2度目で内訳</span>
                                )}
                              </div>

                              <div className="flex gap-2 pt-10">
                                {/* Y-axis */}
                                <div className="flex-shrink-0 relative" style={{ width: "36px", height: `${CHART_H_Y}px` }}>
                                  {ticks.map(t => (
                                    <span
                                      key={t}
                                      className="absolute right-0 text-slate-500 tabular-nums leading-none text-right"
                                      style={{ fontSize: "10px", top: `${Math.round((1 - t / niceMax) * CHART_H_Y) - 5}px` }}
                                    >
                                      {fmtShort(t)}
                                    </span>
                                  ))}
                                </div>

                                {/* Bar area */}
                                <div className="flex-1">
                                  <div className="relative" style={{ height: `${CHART_H_Y + 16}px` }}>
                                    {/* Gridlines */}
                                    <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: `${CHART_H_Y}px` }}>
                                      {ticks.map(t => (
                                        <div
                                          key={t}
                                          className="absolute left-0 right-0 border-t border-slate-200"
                                          style={{ top: `${Math.round((1 - t / niceMax) * CHART_H_Y)}px` }}
                                        />
                                      ))}
                                    </div>

                                    {/* Bar columns */}
                                    <div className="absolute inset-0 flex gap-[3px]">
                                      {yearlyData.monthly.map(m => {
                                        const isPinned  = pinnedYearMonth?.month === m.month;
                                        const barH      = m.total > 0 ? Math.max(3, Math.round((m.total / niceMax) * CHART_H_Y)) : 2;
                                        const clickable = m.total > 0;
                                        return (
                                          <div
                                            key={m.month}
                                            className={`flex flex-col flex-1 min-w-0 ${clickable ? "cursor-pointer" : ""}`}
                                            onClick={() => {
                                              if (!clickable) return;
                                              if (isPinned) {
                                                void fetchMonthOrdersForAnalysis(selectedYear, m.month)
                                                  .then(orders => setAnalysisModal({
                                                    title: `${selectedYear}年${m.month}月`,
                                                    subtitle: `${m.count}件の会計 · 商品内訳`,
                                                    orders,
                                                  }))
                                                  .catch(() => {});
                                                setPinnedYearMonth(null);
                                              } else {
                                                setPinnedYearMonth(m);
                                              }
                                            }}
                                            onMouseEnter={() => { if (!pinnedYearMonth) setHoveredYearMonth(m); }}
                                            onMouseLeave={() => setHoveredYearMonth(null)}
                                          >
                                            {/* Bar */}
                                            <div className="flex-1 flex flex-col justify-end">
                                              <div
                                                className={`w-full rounded-t transition-all ${
                                                  m.total > 0
                                                    ? isPinned
                                                      ? "bg-violet-600 shadow-[0_0_0_2px_theme(colors.violet.400)]"
                                                      : "bg-violet-500 hover:bg-violet-400"
                                                    : "bg-slate-100"
                                                }`}
                                                style={{ height: `${barH}px` }}
                                              />
                                            </div>
                                            {/* Month label */}
                                            <div className="h-4 flex items-center justify-center">
                                              <span className="text-slate-600 font-mono leading-none" style={{ fontSize: "10px" }}>{m.month}月</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* 月別テーブル */}
                              <div className="mt-4 border-t border-slate-100 overflow-hidden">
                                <div className="grid grid-cols-[60px_1fr_110px] gap-2 px-2 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                  <span>月</span><span>構成比</span>
                                  <span className="text-right">売上 / 件数</span>
                                </div>
                                {yearlyData.monthly.filter(m => m.total > 0).map(m => (
                                  <div
                                    key={m.month}
                                    onClick={() => {
                                      void fetchMonthOrdersForAnalysis(selectedYear, m.month)
                                        .then(orders => setAnalysisModal({
                                          title: `${selectedYear}年${m.month}月`,
                                          subtitle: `${m.count}件の会計 · 商品内訳`,
                                          orders,
                                        }))
                                        .catch(() => {});
                                    }}
                                    className="grid grid-cols-[60px_1fr_110px] gap-2 items-center px-2 py-2.5 border-t border-slate-50 hover:bg-violet-50 cursor-pointer transition-colors"
                                  >
                                    <div>
                                      <p className="text-sm font-bold text-slate-700 tabular-nums">{m.month}月</p>
                                      <p className="text-[9px] text-violet-500 font-semibold leading-none mt-0.5">内訳 ›</p>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.round((m.total / maxM) * 100)}%` }} />
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-violet-700 tabular-nums">{fmtYen(m.total)}</p>
                                      <p className="text-[10px] text-slate-400 tabular-nums leading-none mt-0.5">{m.count}件</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ════ Tab: 時間帯別 ════════════════════════ */}
              {activeTab === "hourly" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-lg font-black text-slate-800">時間帯別 — {hourlyTabLabel}</h2>
                    {/* 期間モード切替 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex rounded-xl overflow-hidden border border-slate-200 text-xs font-semibold shadow-sm">
                        {(["day", "month", "year"] as const).map(m => (
                          <button
                            key={m}
                            onClick={() => setHourlyMode(m)}
                            className={`px-3.5 py-2 transition-colors ${
                              hourlyMode === m
                                ? "bg-violet-600 text-white"
                                : "bg-white text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                            }`}
                          >
                            {m === "day" ? "日別" : m === "month" ? "月別" : "年別"}
                          </button>
                        ))}
                      </div>
                      {hourlyMode === "day" && (
                        <input
                          type="date"
                          value={hourlyDay}
                          max={new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })}
                          onChange={e => {
                            setHourlyDay(e.target.value);
                            // 月データが変わる場合は selectedMonth を同期
                            const ym = e.target.value.slice(0, 7);
                            if (monthOptions.some(o => o.value === ym)) setSelectedMonth(ym);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 shadow-sm"
                        />
                      )}
                      {hourlyMode === "month" && (
                        <select
                          value={selectedMonth}
                          onChange={e => setSelectedMonth(e.target.value)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 shadow-sm"
                        >
                          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      )}
                      {hourlyMode === "year" && (
                        <select
                          value={selectedYear}
                          onChange={e => setSelectedYear(Number(e.target.value))}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 shadow-sm"
                        >
                          {Array.from({ length: 4 }, (_, i) => now.getFullYear() - i).map(y => (
                            <option key={y} value={y}>{y}年</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* グラフ */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                      時間別売上グラフ
                      {hourlyData.some(h => h.count > 0) && (
                        <span className="ml-2 text-violet-600 normal-case font-normal">棒をクリックで商品内訳を確認</span>
                      )}
                    </p>
                    <HourlyChart
                      data={hourlyData}
                      onBarClick={hour => {
                        const hStr = String(hour).padStart(2, "0");
                        const cnt  = hourlyData.find(d => d.hour === hour)?.count ?? 0;
                        setAnalysisModal({
                          title: `🕐 ${hStr}:00 〜 ${hStr}:59`,
                          subtitle: `${cnt}会計 · ${hourlyTabLabel}`,
                          orders: hourlyTabOrders.filter(o =>
                            parseInt(new Date(o.created_at).toLocaleTimeString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 2), 10) === hour
                          ),
                        });
                      }}
                    />
                  </div>

                  {/* 一覧リスト */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {hourlyData.every(h => h.count === 0) ? (
                      <p className="text-center text-slate-400 text-sm py-12">データがありません</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-[80px_1fr_70px_100px_32px] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          <span>時間帯</span><span>構成比</span>
                          <span className="text-right">件数</span>
                          <span className="text-right">売上</span>
                          <span />
                        </div>
                        {(() => {
                          const maxT = Math.max(...hourlyData.map(h => h.total), 1);
                          return hourlyData.map(h => (
                            <div
                              key={h.hour}
                              onClick={() => {
                                if (h.count === 0) return;
                                const hStr = String(h.hour).padStart(2, "0");
                                setAnalysisModal({
                                  title: `🕐 ${hStr}:00 〜 ${hStr}:59`,
                                  subtitle: `${h.count}会計 · ${hourlyTabLabel}`,
                                  orders: hourlyTabOrders.filter(o => new Date(o.created_at).getHours() === h.hour),
                                });
                              }}
                              className={`grid grid-cols-[80px_1fr_70px_100px_32px] gap-3 items-center px-5 py-3.5 border-b border-slate-100 transition-colors ${
                                h.count > 0
                                  ? "hover:bg-violet-50 cursor-pointer"
                                  : "opacity-35"
                              }`}
                            >
                              <p className="text-sm font-mono font-semibold text-slate-700">
                                {String(h.hour).padStart(2, "0")}:00
                              </p>
                              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-violet-500 rounded-full transition-all"
                                  style={{ width: `${Math.round((h.total / maxT) * 100)}%` }}
                                />
                              </div>
                              <p className="text-sm text-slate-600 text-right tabular-nums">
                                {h.count > 0 ? `${h.count}件` : "—"}
                              </p>
                              <p className={`text-sm font-bold text-right tabular-nums ${h.count > 0 ? "text-violet-700" : "text-slate-300"}`}>
                                {h.count > 0 ? fmtYen(h.total) : "—"}
                              </p>
                              <span className="text-violet-400 text-[9px] text-center font-semibold">
                                {h.count > 0 ? "内訳 ›" : ""}
                              </span>
                            </div>
                          ));
                        })()}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {analysisModal && (
        <AnalysisDetailModal
          title={analysisModal.title}
          subtitle={analysisModal.subtitle}
          items={analysisModalItems}
          onClose={() => setAnalysisModal(null)}
          onItemClick={(name, emoji) => {
            const filtered = (analysisModal.orders ?? []).filter(o =>
              (o.items ?? []).some(i => i.name === name)
            );
            setItemReceiptsModal({
              itemName: name,
              emoji,
              orders: filtered,
              sourceTitle: analysisModal.title,
            });
          }}
        />
      )}
      {itemReceiptsModal && (
        <ItemReceiptsModal
          itemName={itemReceiptsModal.itemName}
          emoji={itemReceiptsModal.emoji}
          orders={itemReceiptsModal.orders}
          sourceTitle={itemReceiptsModal.sourceTitle}
          onClose={() => setItemReceiptsModal(null)}
          onViewDetail={row => {
            setItemReceiptsModal(null);
            setAnalysisModal(null);
            setEditRow(row);
          }}
        />
      )}
      {editRow && (
        <EditModal row={editRow} onSave={handleSave} onClose={() => setEditRow(null)} />
      )}
      {showReceiptModal && (
        <ReceiptIssueModal onClose={() => setShowReceiptModal(false)} />
      )}
    </div>
  );
}
