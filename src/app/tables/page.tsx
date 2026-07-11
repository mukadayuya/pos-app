"use client";

// テーブル管理ダッシュボード（Phase 1-⑩）
// レジ端末から店舗内の卓状況（使用中／会計待ち／空席／滞在時間）を一望する。
//
// 現在はハンディの localStorage(waraji_handy_orders) から読み取る簡易実装。
// 同一デバイス内でハンディ運用している店舗（iPad兼用）で機能する。
// Phase B: Supabase 同期による複数端末対応を予定。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type OrderRecord = {
  id: string;
  tableNo: string;
  staff: string;
  items: { name: string; emoji: string; qty: number; unitPrice: number }[];
  totalTaxIncl: number;
  sentAt: number;
  served: boolean;
  closed: boolean;
};

const LS_ORDERS_KEY = "waraji_handy_orders";
const REFRESH_INTERVAL_MS = 3000;

function loadOrders(): OrderRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OrderRecord[];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return parsed.filter(o => o.sentAt > cutoff);
  } catch { return []; }
}

interface TableState {
  tableNo: string;
  openOrders: OrderRecord[];
  itemCount: number;
  subtotal: number;
  firstSentAt: number;      // 最初の注文時刻＝滞在開始
  lastSentAt: number;
  hasUnserved: boolean;
  allServed: boolean;
  isEmpty: boolean;
}

function summarize(tableNo: string, orders: OrderRecord[]): TableState {
  const openOrders = orders.filter(o => !o.closed);
  const itemCount = openOrders.reduce((s, o) => s + o.items.reduce((n, i) => n + i.qty, 0), 0);
  const subtotal  = openOrders.reduce((s, o) => s + o.totalTaxIncl, 0);
  const times = openOrders.map(o => o.sentAt);
  const firstSentAt = times.length ? Math.min(...times) : 0;
  const lastSentAt  = times.length ? Math.max(...times) : 0;
  const hasUnserved = openOrders.some(o => !o.served);
  const allServed   = openOrders.length > 0 && openOrders.every(o => o.served);
  return {
    tableNo,
    openOrders,
    itemCount,
    subtotal,
    firstSentAt,
    lastSentAt,
    hasUnserved,
    allServed,
    isEmpty: openOrders.length === 0,
  };
}

function fmtElapsed(ms: number): string {
  if (ms <= 0) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}分`;
  return `${Math.floor(mins / 60)}時間${mins % 60}分`;
}

function statusOf(t: TableState): { label: string; color: string; bg: string; border: string; icon: string } {
  if (t.isEmpty)      return { label: "空席",     icon: "🟢", color: "text-emerald-800", bg: "bg-emerald-50",  border: "border-emerald-200" };
  if (t.allServed)    return { label: "会計待ち", icon: "💰", color: "text-amber-800",   bg: "bg-amber-50",    border: "border-amber-300" };
  if (t.hasUnserved)  return { label: "調理中",   icon: "🍳", color: "text-blue-800",    bg: "bg-blue-50",     border: "border-blue-200" };
  return                     { label: "使用中",   icon: "🍽️", color: "text-slate-800",   bg: "bg-white",        border: "border-slate-200" };
}

export default function TablesDashboard() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [now, setNow]       = useState(Date.now());
  const [detailTable, setDetailTable] = useState<TableState | null>(null);

  useEffect(() => {
    setOrders(loadOrders());
    setNow(Date.now());
    const t = setInterval(() => {
      setOrders(loadOrders());
      setNow(Date.now());
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  // 使用中卓 + よく使う卓のスケルトン
  const knownTables = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => set.add(o.tableNo));
    ["1", "2", "3", "4", "5", "6", "座敷1", "座敷2", "カウンター1", "カウンター2"].forEach(t => set.add(t));
    // 卓番号順(数字優先)にソート
    return Array.from(set).sort((a, b) => {
      const na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      if (!isNaN(na)) return -1;
      if (!isNaN(nb)) return 1;
      return a.localeCompare(b);
    });
  }, [orders]);

  const tables = useMemo(
    () => knownTables.map(t => summarize(t, orders.filter(o => o.tableNo === t))),
    [knownTables, orders],
  );

  // 集計
  const usedCount     = tables.filter(t => !t.isEmpty).length;
  const waitingCount  = tables.filter(t => t.allServed).length;
  const cookingCount  = tables.filter(t => t.hasUnserved).length;
  const openSubtotal  = tables.reduce((s, t) => s + t.subtotal, 0);

  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-slate-600 text-sm">← HOME</Link>
        <h1 className="text-lg font-bold text-slate-900">🍽️ テーブル管理</h1>
        <div className="ml-auto text-xs text-slate-500 flex items-center gap-3">
          <span>使用中 <b className="text-slate-800">{usedCount}</b></span>
          <span>調理中 <b className="text-blue-700">{cookingCount}</b></span>
          <span>会計待ち <b className="text-amber-700">{waitingCount}</b></span>
          <span>未会計合計 <b className="text-slate-900 tabular-nums">¥{openSubtotal.toLocaleString()}</b></span>
        </div>
      </header>

      <main className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {tables.map(t => {
            const st = statusOf(t);
            const elapsed = t.firstSentAt ? now - t.firstSentAt : 0;
            const overdue = elapsed > 90 * 60 * 1000; // 90分超で強調
            return (
              <button
                key={t.tableNo}
                onClick={() => t.isEmpty ? null : setDetailTable(t)}
                disabled={t.isEmpty}
                className={`text-left rounded-2xl border-2 ${st.border} ${st.bg} p-4 transition-transform active:scale-[0.98] ${
                  t.isEmpty ? "cursor-default opacity-70" : "hover:shadow-md cursor-pointer"
                } ${overdue ? "ring-2 ring-red-400" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-base font-black ${st.color}`}>{t.tableNo}</span>
                  <span className={`text-xs font-bold ${st.color}`}>{st.icon} {st.label}</span>
                </div>
                {t.isEmpty ? (
                  <p className="text-xs text-slate-400">利用可</p>
                ) : (
                  <>
                    <p className="text-2xl font-black text-slate-900 tabular-nums leading-tight">
                      ¥{t.subtotal.toLocaleString()}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500">{t.openOrders.length}件 / {t.itemCount}品</span>
                      <span className={overdue ? "text-red-600 font-bold" : "text-slate-500"}>
                        ⏱ {fmtElapsed(elapsed)}
                      </span>
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          ※ 同一端末上のハンディが受けた注文を表示（更新間隔: 3秒）。<br />
          複数端末の同時運用は次の段階で Supabase 同期を予定。
        </p>
      </main>

      {/* 詳細モーダル */}
      {detailTable && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDetailTable(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">卓 {detailTable.tableNo}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {detailTable.openOrders.length}件の注文・{fmtElapsed(now - detailTable.firstSentAt)}経過
                </p>
              </div>
              <button onClick={() => setDetailTable(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {detailTable.openOrders.map(o => (
                <div key={o.id} className={`rounded-xl p-3 border ${o.served ? "bg-slate-50 border-slate-200" : "bg-blue-50 border-blue-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-600">
                      {new Date(o.sentAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                      {" "}{o.staff}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${o.served ? "bg-slate-200 text-slate-600" : "bg-blue-600 text-white"}`}>
                      {o.served ? "提供済" : "調理中"}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {o.items.map((it, idx) => (
                      <li key={idx} className="text-sm text-slate-700 flex items-center justify-between">
                        <span>{it.emoji} {it.name} × {it.qty}</span>
                        <span className="text-slate-500 tabular-nums">¥{(it.unitPrice * it.qty).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-right text-sm font-bold text-slate-900 mt-1 tabular-nums">¥{o.totalTaxIncl.toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <p className="text-sm text-slate-600">未会計合計</p>
              <p className="text-xl font-black text-slate-900 tabular-nums">¥{detailTable.subtotal.toLocaleString()}</p>
            </div>
            <div className="px-5 pb-5 pt-3 flex gap-2">
              <Link href="/handy" className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold text-center">
                ハンディで確認
              </Link>
              <Link href="/register" className="flex-1 py-3 bg-slate-900 hover:bg-slate-700 text-white rounded-xl text-sm font-bold text-center">
                レジで会計
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
