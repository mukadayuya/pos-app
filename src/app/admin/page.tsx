"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchStoreDashboard,
  StoreDashboardItem,
  AlertFlag,
  MonthSales,
} from "@/lib/adminDb";

// ─── Mini bar chart (pure SVG, no dep) ─────────────────────────
function MiniBarChart({ months }: { months: MonthSales[] }) {
  const max = Math.max(...months.map(m => m.total), 1);
  const BAR_W = 34;
  const GAP   = 10;
  const H     = 50;
  const FILLS = ["#c7d2fe", "#818cf8", "#4f46e5"];
  const totalW = months.length * BAR_W + (months.length - 1) * GAP;

  return (
    <svg
      width={totalW} height={H + 16}
      viewBox={`0 0 ${totalW} ${H + 16}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {months.map((m, i) => {
        const barH = Math.max(4, Math.round((m.total / max) * H));
        const x = i * (BAR_W + GAP);
        return (
          <g key={m.month}>
            <rect
              x={x} y={H - barH} width={BAR_W} height={barH} rx={5}
              fill={FILLS[i]}
            />
            <text
              x={x + BAR_W / 2} y={H + 13}
              textAnchor="middle" fontSize={9} fontWeight={600}
              fill={i === 2 ? "#6366f1" : "#94a3b8"}
            >
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Subsidy alert chip ─────────────────────────────────────────
const ALERT_META: Record<AlertFlag, { label: string; cls: string; tip: string }> = {
  sales_drop: {
    label: "! 売上減少",
    cls: "bg-red-50 text-red-600 ring-red-200",
    tip: "前月比 -5% 以上 — 事業再構築補助金の対象候補",
  },
  employee_increase: {
    label: "! 雇用増",
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    tip: "今月新規雇用あり — キャリアアップ助成金の対象候補",
  },
};

function AlertChip({ flag }: { flag: AlertFlag }) {
  const { label, cls, tip } = ALERT_META[flag];
  return (
    <span title={tip} className={`text-[11px] px-2 py-0.5 rounded-full font-bold ring-1 cursor-help ${cls}`}>
      {label}
    </span>
  );
}

// ─── Plan badge ─────────────────────────────────────────────────
const PLAN_CLS: Record<string, string> = {
  pro:        "bg-indigo-50 text-indigo-700 ring-indigo-200",
  enterprise: "bg-violet-50 text-violet-700 ring-violet-200",
  standard:   "bg-slate-100 text-slate-500 ring-slate-200",
};

// ─── MoM delta ──────────────────────────────────────────────────
function MomBadge({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0) return null;
  const pct = ((cur - prev) / prev) * 100;
  const up  = pct >= 0;
  return (
    <span className={`text-xs font-bold ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─── Store card ─────────────────────────────────────────────────
function StoreCard({ store }: { store: StoreDashboardItem }) {
  const cur  = store.monthlySales[2];
  const prev = store.monthlySales[1];
  const planCls = PLAN_CLS[store.plan] ?? PLAN_CLS.standard;
  const hasAlert = store.alerts.length > 0;

  return (
    <div className={`bg-white rounded-2xl p-5 flex flex-col gap-3.5 transition-shadow duration-200
      ${hasAlert
        ? "ring-1 ring-amber-200 shadow-[0_4px_20px_rgba(251,191,36,0.14)] hover:shadow-[0_8px_32px_rgba(251,191,36,0.22)]"
        : "ring-1 ring-black/[0.06] shadow-[0_2px_16px_rgb(0,0,0,0.05)] hover:shadow-[0_8px_32px_rgb(0,0,0,0.09)]"}
      ${!store.is_active ? "opacity-55" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-black text-slate-900 truncate">{store.name}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ring-1 flex-shrink-0 ${planCls}`}>
              {store.plan.toUpperCase()}
            </span>
            {!store.is_active && (
              <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full font-semibold">
                停止中
              </span>
            )}
          </div>
          {store.location && (
            <p className="text-xs text-slate-400 mt-0.5">📍 {store.location}</p>
          )}
        </div>
      </div>

      {/* Alert chips */}
      {hasAlert && (
        <div className="flex gap-1.5 flex-wrap -mt-1">
          {store.alerts.map(f => <AlertChip key={f} flag={f} />)}
        </div>
      )}

      {/* 3-month chart + current revenue */}
      <div className="flex items-end gap-5">
        <MiniBarChart months={store.monthlySales} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-slate-400 font-medium mb-0.5">当月売上</p>
          <p className="text-xl font-black text-slate-900 tabular-nums leading-none">
            ¥{cur.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <MomBadge cur={cur.total} prev={prev.total} />
            <span className="text-[10px] text-slate-300">前月比</span>
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <span className="text-base">👤</span>
          <span className="font-bold">{store.employeeCount}<span className="text-xs font-normal text-slate-400 ml-0.5">名</span></span>
          {store.newHiresThisMonth > 0 && (
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              +{store.newHiresThisMonth} 今月
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-400">{cur.count} 回 / 当月</p>
          <Link
            href="/admin/sales"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            詳細 →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── KPI card ───────────────────────────────────────────────────
function KPICard({
  icon, label, value, sub, accent,
}: {
  icon: string; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl p-4 flex flex-col gap-1
      ${accent
        ? "ring-1 ring-amber-200 shadow-[0_2px_16px_rgba(251,191,36,0.15)]"
        : "ring-1 ring-black/[0.06] shadow-[0_2px_16px_rgb(0,0,0,0.05)]"}`}
    >
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
        {icon}&nbsp; {label}
      </p>
      <p className={`text-2xl font-black tabular-nums leading-none ${accent ? "text-amber-600" : "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// ─── Setup notice ───────────────────────────────────────────────
function SetupNotice({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl p-8 ring-1 ring-slate-200 text-center max-w-md mx-auto mt-10">
      <p className="text-2xl mb-3">🏗️</p>
      <p className="font-bold text-slate-700 mb-2">{message}</p>
      <p className="text-xs text-slate-400 leading-relaxed">
        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">supabase/setup_admin.sql</code> を<br />
        Supabase Dashboard → SQL Editor で実行してください。
      </p>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────
type Filter = "all" | "alerts";

export default function AdminDashboardPage() {
  const [stores, setStores]   = useState<StoreDashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<Filter>("all");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError("Supabase が設定されていません");
      setLoading(false);
      return;
    }
    fetchStoreDashboard()
      .then(setStores)
      .catch(e => setError(e.message ?? "データ取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => filter === "alerts" ? stores.filter(s => s.alerts.length > 0) : stores,
    [stores, filter]
  );

  const alertCount      = stores.filter(s => s.alerts.length > 0).length;
  const thisMonthTotal  = stores.reduce((sum, s) => sum + s.monthlySales[2].total, 0);
  const totalEmployees  = stores.reduce((sum, s) => sum + s.employeeCount, 0);

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur-xl border-b border-black/[0.05] shadow-[0_1px_0_rgb(0,0,0,0.04)] sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[10px] flex items-center justify-center shadow-[0_2px_8px_rgba(99,102,241,0.38)] group-hover:shadow-[0_4px_14px_rgba(99,102,241,0.5)] transition-shadow duration-200">
              <span className="text-white text-[10px] font-black tracking-tight">FL</span>
            </div>
            <div className="leading-none">
              <p className="text-sm font-black text-slate-900 tracking-tight leading-none">FLOWS</p>
              <p className="text-[9px] font-medium text-slate-400 tracking-[0.12em] uppercase mt-0.5">by Infotainment</p>
            </div>
          </Link>

          <div className="w-px h-5 bg-slate-200" />
          <h1 className="text-sm font-bold text-slate-600 tracking-tight">管理ダッシュボード</h1>
          <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-violet-50 text-violet-700 ring-1 ring-violet-200/60">
            コンサルタント専用
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/register"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-white ring-1 ring-black/[0.07] text-slate-600 hover:bg-slate-50 transition-all duration-200 shadow-sm">
            <span>🧾</span><span>レジへ</span>
          </Link>
          <Link href="/admin/sales"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-white ring-1 ring-black/[0.07] text-slate-600 hover:bg-slate-50 transition-all duration-200 shadow-sm">
            <span>📊</span><span>売上詳細</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 p-6 w-full max-w-6xl mx-auto">

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <KPICard icon="🏪" label="導入店舗数" value={`${stores.length} 店舗`} />
          <KPICard
            icon="⚠️" label="受給チャンスあり"
            value={`${alertCount} 店舗`}
            accent={alertCount > 0}
            sub={alertCount > 0 ? "助成金申請を検討" : undefined}
          />
          <KPICard
            icon="💴" label="当月総売上"
            value={`¥${thisMonthTotal.toLocaleString()}`}
            sub="全店舗合計"
          />
          <KPICard icon="👤" label="総従業員数" value={`${totalEmployees} 名`} sub="登録済み合計" />
        </div>

        {/* Filter + count bar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex bg-white rounded-xl ring-1 ring-black/[0.07] shadow-sm p-1 gap-0.5">
            {(
              [
                ["all",    "全店舗"],
                ["alerts", "⚠️ アラートあり"],
              ] as [Filter, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-150 ${
                  filter === v
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 font-medium">{filtered.length} 件表示</p>
        </div>

        {/* Content */}
        {loading && (
          <div className="text-center py-24 text-slate-300 text-sm animate-pulse">
            データを読み込んでいます…
          </div>
        )}

        {!loading && error && <SetupNotice message={error} />}

        {!loading && !error && stores.length === 0 && (
          <SetupNotice message="店舗が登録されていません" />
        )}

        {!loading && !error && stores.length > 0 && filtered.length === 0 && (
          <div className="bg-white rounded-2xl p-8 ring-1 ring-slate-200 text-center mt-4">
            <p className="text-slate-400 text-sm">
              アラートが発生している店舗はありません
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(store => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        )}

        {/* Legend */}
        {!loading && !error && stores.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-4 text-xs text-slate-400 border-t border-slate-200 pt-5">
            <span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 mr-1 align-middle" />
              売上減少 — 前月比 -5% 以上（事業再構築補助金 候補）
            </span>
            <span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 mr-1 align-middle" />
              雇用増 — 当月新規雇用あり（キャリアアップ / 雇用調整助成金 候補）
            </span>
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-slate-300 text-xs font-medium tracking-wide">
        © 2026 Infotainment · FLOWS Admin v1.0
      </footer>
    </div>
  );
}
