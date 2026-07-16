"use client";

// 現金入出金 履歴閲覧画面
// 日付ナビ・月間サマリ・CSVエクスポート

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchCashEventsBetween, KIND_LABEL, type CashEvent, type CashEventKind } from "@/lib/cashEvents";

function monthOptions(n = 12): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: `${d.getFullYear()}年${d.getMonth() + 1}月` });
  }
  return out;
}

function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0); // 月末
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(from), to: iso(to) };
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00+09:00`);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}（${wd}）`;
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
}
function fmtYen(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}

const KIND_COLOR: Record<CashEventKind, string> = {
  opening_float: "bg-blue-100 text-blue-800",
  petty_cash:    "bg-orange-100 text-orange-800",
  deposit:       "bg-emerald-100 text-emerald-800",
  withdrawal:    "bg-red-100 text-red-800",
  change:        "bg-slate-100 text-slate-600",
};

function exportCsv(events: CashEvent[], month: string): void {
  const rows = [
    ["日付", "時刻", "種別", "金額(符号付)", "メモ", "担当"],
    ...events.map(e => [
      e.event_date,
      fmtTime(e.created_at),
      KIND_LABEL[e.kind],
      String(e.amount),
      (e.note ?? "").replace(/[\r\n,]/g, " "),
      e.staff ?? "",
    ]),
  ];
  // BOM 付き UTF-8 で Excel の文字化けを防ぐ
  const csv = "﻿" + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cash_events_${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CashHistoryPage() {
  const options = useMemo(() => monthOptions(), []);
  const [month, setMonth]     = useState(options[0].value);
  const [events, setEvents]   = useState<CashEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = monthRange(month);
    setEvents(await fetchCashEventsBetween(from, to));
    setLoading(false);
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  // 日別グルーピング
  const grouped = useMemo(() => {
    const map = new Map<string, CashEvent[]>();
    for (const e of events) {
      if (!map.has(e.event_date)) map.set(e.event_date, []);
      map.get(e.event_date)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [events]);

  // 月間サマリ
  const summary = useMemo(() => {
    const s: Record<CashEventKind, { count: number; total: number }> = {
      opening_float: { count: 0, total: 0 },
      petty_cash:    { count: 0, total: 0 },
      deposit:       { count: 0, total: 0 },
      withdrawal:    { count: 0, total: 0 },
      change:        { count: 0, total: 0 },
    };
    let net = 0;
    for (const e of events) {
      s[e.kind].count += 1;
      s[e.kind].total += e.amount;
      net += e.amount;
    }
    return { s, net, days: grouped.length };
  }, [events, grouped.length]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/settings" className="text-slate-600 text-sm">← 設定・精算</Link>
          <h1 className="text-lg font-bold text-slate-900">🪙 現金入出金 履歴</h1>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="ml-auto px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={() => exportCsv(events, month)} disabled={events.length === 0}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg">
            📥 CSV
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* 月間サマリ */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-3">📊 月間サマリ</h2>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">記録件数</p>
              <p className="text-lg font-black text-slate-800 tabular-nums">{events.length}件</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">記録日数</p>
              <p className="text-lg font-black text-slate-800 tabular-nums">{summary.days}日</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${summary.net >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
              <p className={`text-xs ${summary.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>純増減</p>
              <p className={`text-lg font-black tabular-nums ${summary.net >= 0 ? "text-emerald-800" : "text-red-800"}`}>
                {summary.net >= 0 ? "+" : ""}{fmtYen(summary.net)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(Object.keys(KIND_LABEL) as CashEventKind[]).map(k => (
              <div key={k} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${KIND_COLOR[k]}`}>{KIND_LABEL[k]}</span>
                <span className="text-slate-500 tabular-nums">
                  {summary.s[k].count}件 / {summary.s[k].total >= 0 ? "+" : ""}{fmtYen(summary.s[k].total)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 日別履歴 */}
        {loading ? (
          <p className="text-center text-slate-400 py-10">読み込み中…</p>
        ) : grouped.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-sm text-slate-500">この月の入出金記録はありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(([date, list]) => {
              const dayNet = list.reduce((s, e) => s + e.amount, 0);
              return (
                <section key={date} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">{fmtDate(date)}</p>
                    <p className={`text-sm font-bold tabular-nums ${dayNet >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      日計 {dayNet >= 0 ? "+" : ""}{fmtYen(dayNet)}
                    </p>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {list.map(e => (
                      <li key={e.id} className="px-5 py-3 flex items-center gap-3">
                        <span className="text-[10px] text-slate-400 tabular-nums w-10">{fmtTime(e.created_at)}</span>
                        <span className={`text-[10px] font-bold w-20 text-center px-2 py-0.5 rounded ${KIND_COLOR[e.kind]}`}>
                          {KIND_LABEL[e.kind]}
                        </span>
                        <span className={`text-sm font-bold tabular-nums w-24 text-right ${e.amount >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {e.amount >= 0 ? "+" : ""}{fmtYen(e.amount)}
                        </span>
                        <span className="text-xs text-slate-500 flex-1 truncate">
                          {e.note ?? "—"}{e.staff ? ` · ${e.staff}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
