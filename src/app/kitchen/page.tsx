"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  getKdsOrders,
  addKdsOrder,
  updateKdsOrderStatus,
  clearDoneOrders,
  seedDemoOrders,
  KdsOrder,
  KdsOrderItem,
} from "@/lib/kdsStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function elapsedMs(createdAt: number): number {
  return Date.now() - createdAt;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes === 0) return "今";
  return `${minutes}分前`;
}

function formatClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function urgencyClass(ms: number, status: KdsOrder["status"]): string {
  if (status === "done") return "border-slate-700 opacity-50";
  const minutes = ms / 60_000;
  if (minutes >= 10) return "border-rose-500 animate-pulse";
  if (minutes >= 5) return "border-amber-400";
  return "border-emerald-500";
}

function urgencyBadge(
  ms: number,
  status: KdsOrder["status"]
): { label: string; cls: string } {
  if (status === "done")
    return { label: "完了", cls: "bg-slate-700 text-slate-400" };
  const minutes = ms / 60_000;
  if (minutes >= 10)
    return { label: "緊急！", cls: "bg-rose-600 text-white font-bold" };
  if (minutes >= 5)
    return { label: "急いで！", cls: "bg-amber-500 text-slate-950 font-semibold" };
  return { label: "ON TIME", cls: "bg-emerald-600 text-white" };
}

const SERVING_SECTIONS: { key: KdsOrderItem["servingTime"]; label: string; icon: string }[] = [
  { key: "before", label: "先に", icon: "🥗" },
  { key: "with",   label: "メインと", icon: "🍽️" },
  { key: "after",  label: "後で", icon: "☕" },
];

// ---------------------------------------------------------------------------
// Demo order factory
// ---------------------------------------------------------------------------

function makeDemoOrder(): KdsOrder {
  return {
    id: "live-" + Math.random().toString(36).slice(2, 10),
    tableLabel: `テーブル${Math.floor(Math.random() * 12) + 1}`,
    lang: "ja",
    createdAt: Date.now(),
    status: "new",
    items: [
      {
        name: "唐揚げ",
        emoji: "🍗",
        options: ["量: 大盛"],
        qty: Math.floor(Math.random() * 3) + 1,
        servingTime: "with",
      },
      {
        name: "ビール",
        emoji: "🍺",
        options: [],
        qty: 1,
        servingTime: "before",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface CardProps {
  order: KdsOrder;
  elapsedMs: number;
  onStatusChange: (id: string, status: KdsOrder["status"]) => void;
}

function OrderCard({ order, elapsedMs: elapsed, onStatusChange }: CardProps) {
  const border = urgencyClass(elapsed, order.status);
  const badge = urgencyBadge(elapsed, order.status);
  const shortId = order.id.slice(-4).toUpperCase();

  return (
    <div
      className={`flex flex-col rounded-xl border-2 ${border} bg-slate-900 p-3 gap-2 transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-xs font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
            #{shortId}
          </span>
          {order.tableLabel && (
            <span className="text-xs text-slate-400 truncate">
              {order.tableLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-slate-400">{formatElapsed(elapsed)}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* Items — grouped by serving time */}
      <div className="flex flex-col gap-2 flex-1">
        {SERVING_SECTIONS.map(({ key, label, icon }) => {
          const sectionItems = order.items.filter(i => i.servingTime === key);
          if (sectionItems.length === 0) return null;
          return (
            <div key={key}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                {icon} {label}
              </p>
              <ul className="flex flex-col gap-1">
                {sectionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-base leading-none mt-0.5">
                      {item.emoji ?? "🍽️"}
                    </span>
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {item.name}
                        </span>
                        <span className="text-xs bg-slate-700 text-slate-300 rounded px-1 py-0.5 shrink-0">
                          ×{item.qty}
                        </span>
                      </div>
                      {item.options.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.options.map((opt, oi) => (
                            <span
                              key={oi}
                              className="text-xs bg-slate-800 text-slate-400 rounded px-1 py-0.5 border border-slate-700"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5 pt-1 border-t border-slate-800">
        {order.status === "new" && (
          <button
            onClick={() => onStatusChange(order.id, "preparing")}
            className="flex-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-2 py-1.5 transition-colors"
          >
            ▶ 調理開始
          </button>
        )}
        {order.status === "preparing" && (
          <button
            onClick={() => onStatusChange(order.id, "done")}
            className="flex-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-2 py-1.5 transition-colors"
          >
            ✓ 完了
          </button>
        )}
        {order.status === "done" && (
          <button
            onClick={() => onStatusChange(order.id, "new")}
            className="flex-1 text-xs text-slate-500 hover:text-slate-300 rounded-lg px-2 py-1.5 transition-colors"
          >
            ↩ 戻す
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KitchenPage() {
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [clock, setClock] = useState<string>("");

  // Seed demo data on first mount (client only)
  useEffect(() => {
    seedDemoOrders();
    setOrders(getKdsOrders());
  }, []);

  // Poll every 3 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setOrders(getKdsOrders());
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // 1-second tick for elapsed times + clock
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      setClock(formatClock(new Date()));
    }, 1000);
    setClock(formatClock(new Date()));
    return () => clearInterval(id);
  }, []);

  const handleStatusChange = useCallback(
    (id: string, status: KdsOrder["status"]) => {
      updateKdsOrderStatus(id, status);
      setOrders(getKdsOrders());
    },
    []
  );

  const handleClearDone = useCallback(() => {
    clearDoneOrders();
    setOrders(getKdsOrders());
  }, []);

  const handleAddDemo = useCallback(() => {
    addKdsOrder(makeDemoOrder());
    setOrders(getKdsOrders());
  }, []);

  const activeOrders = orders.filter((o) => o.status !== "done");
  const doneOrders = orders.filter((o) => o.status === "done");
  const displayOrders = [...activeOrders, ...doneOrders];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            ← 戻る
          </Link>
          <h1 className="text-base font-bold tracking-wide">
            🍳 FLOWS キッチン
          </h1>
          <span className="hidden sm:inline text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">
            {activeOrders.length} 件対応中
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-slate-400 tabular-nums">
            {clock}
          </span>
          <button
            onClick={handleClearDone}
            disabled={doneOrders.length === 0}
            className="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 rounded-lg px-3 py-1.5 transition-colors"
          >
            完了を消す
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-3 py-4">
        {displayOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-500">
            <div className="w-10 h-10 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
            <p className="text-sm">注文待ち中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {displayOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                elapsedMs={now - order.createdAt}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 py-3 border-t border-slate-900 flex justify-center">
        <button
          onClick={handleAddDemo}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          + デモ注文を追加
        </button>
      </footer>
    </div>
  );
}
