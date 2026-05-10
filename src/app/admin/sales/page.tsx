"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchTodaySummary,
  fetchPeriodSummary,
  fetchTodayHourlySales,
  fetchSalesDetail,
  deleteSale,
  PeriodSummary,
  HourlySales,
  SaleDetailRow,
} from "@/lib/db";

// ─── 月オプション生成 ──────────────────────────────────────────
function getMonthOptions(): { value: string; label: string }[] {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    opts.push({ value, label });
  }
  return opts;
}

// ─── 4期間サマリーカード ──────────────────────────────────────
function PeriodCard({
  period, data, loading,
}: {
  period: string;
  data: PeriodSummary | null;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{period}</p>
      {loading ? (
        <p className="text-slate-300 text-sm">読込中…</p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">純売上</p>
            <p className="text-2xl font-black text-slate-900">
              ¥{(data?.total ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-slate-400">客数</p>
              <p className="text-lg font-bold text-indigo-700">{data?.count ?? 0}<span className="text-sm font-normal text-slate-400 ml-0.5">人</span></p>
            </div>
            <div>
              <p className="text-xs text-slate-400">客単価</p>
              <p className="text-lg font-bold text-emerald-700">¥{(data?.avgSpend ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 時間別棒グラフ ───────────────────────────────────────────
function HourlyBarChart({ data }: { data: HourlySales[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-300 text-sm">
        本日の売上データがありません
      </div>
    );
  }
  const maxVal = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="flex items-end gap-1.5 h-36 px-1 pb-1">
      {data.map(d => (
        <div key={d.hour} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="w-full flex flex-col justify-end" style={{ height: "110px" }}>
            <div
              className="w-full bg-indigo-500 hover:bg-indigo-400 transition-all rounded-t cursor-default"
              style={{ height: `${Math.max(4, Math.round((d.total / maxVal) * 110))}px` }}
              title={`${d.hour}時 ¥${d.total.toLocaleString()} (${d.count}件)`}
            />
          </div>
          <span className="text-slate-500 text-center font-mono" style={{ fontSize: "9px" }}>
            {d.hour}時
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── 注文詳細モーダル ─────────────────────────────────────────
function OrderDetailModal({
  row,
  onClose,
}: {
  row: SaleDetailRow;
  onClose: () => void;
}) {
  const dt = new Date(row.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const items = Array.isArray(row.items) ? row.items : [];
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-indigo-700 text-white px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold">注文詳細</h3>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400">{dt}</p>
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-slate-400 text-sm">明細データがありません</p>
            ) : (
              items.map((it, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-slate-50 rounded-xl px-3 py-2.5">
                  <span>{it.emoji} {it.name} ×{Number(it.quantity) || 1}</span>
                  <span className="font-bold text-indigo-700">¥{((Number(it.unit_price) || 0) * (Number(it.quantity) || 1)).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-base">
            <span>合計</span>
            <span className="text-indigo-700">¥{row.total_amount.toLocaleString()}</span>
          </div>
          <p className="text-xs text-slate-400 bg-amber-50 border border-amber-200 rounded-xl p-3">
            内容を変更する場合は一度削除して再入力してください。
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── ダッシュボード ────────────────────────────────────────────
export default function AdminSalesPage() {
  const now = new Date();

  // 4期間の日付範囲
  const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd     = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const yestStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const thisMonStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonEnd   = new Date(now.getFullYear(), now.getMonth(), 1);

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [today, setToday]           = useState<PeriodSummary | null>(null);
  const [yesterday, setYesterday]   = useState<PeriodSummary | null>(null);
  const [thisMonth, setThisMonth]   = useState<PeriodSummary | null>(null);
  const [lastMonth, setLastMonth]   = useState<PeriodSummary | null>(null);
  const [hourly, setHourly]         = useState<HourlySales[]>([]);
  const [orders, setOrders]         = useState<SaleDetailRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [detailRow, setDetailRow]   = useState<SaleDetailRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const monthOptions = getMonthOptions();

  const loadSummaries = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true); setError(null);
    try {
      const [t, y, tm, lm, h] = await Promise.all([
        fetchPeriodSummary(todayStart, todayEnd),
        fetchPeriodSummary(yestStart, todayStart),
        fetchPeriodSummary(thisMonStart, todayEnd),
        fetchPeriodSummary(lastMonStart, lastMonEnd),
        fetchTodayHourlySales(),
      ]);
      setToday(t); setYesterday(y); setThisMonth(tm); setLastMonth(lm);
      setHourly(h);
    } catch {
      setError("データの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOrders = useCallback(async (yearMonth: string) => {
    if (!isSupabaseConfigured) return;
    const [y, m] = yearMonth.split("-").map(Number);
    const from = new Date(y, m - 1, 1);
    const to   = new Date(y, m, 1);
    try {
      const rows = await fetchSalesDetail(from, to);
      setOrders(rows);
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => { loadSummaries(); }, [loadSummaries]);
  useEffect(() => { loadOrders(selectedMonth); }, [selectedMonth, loadOrders]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("この注文データを削除しますか？（取消後は元に戻せません）")) return;
    setDeletingId(id);
    try {
      await deleteSale(id);
      setOrders(prev => prev.filter(r => r.id !== id));
    } catch {
      alert("削除に失敗しました。");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ヘッダー */}
      <header className="bg-indigo-700 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h1 className="text-lg font-bold leading-tight">売上管理ダッシュボード</h1>
              <p className="text-xs text-indigo-300">Kitchen Kazu</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { loadSummaries(); loadOrders(selectedMonth); }}
              disabled={loading || !isSupabaseConfigured}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              <span className={loading ? "animate-spin inline-block" : ""}>🔄</span>
              更新
            </button>
            <Link href="/register"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
              ← レジへ
            </Link>
            <Link href="/"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
              🏠 HOME
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {!isSupabaseConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-800 text-sm">
            ⚠️ Supabase が未設定です。<code className="bg-amber-100 px-1 rounded">.env.local</code> を確認してください。
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* ── 4期間サマリーカード ──────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">期間別サマリー</h2>
          <div className="grid grid-cols-4 gap-4">
            <PeriodCard period="先月" data={lastMonth}  loading={loading} />
            <PeriodCard period="昨日" data={yesterday}  loading={loading} />
            <PeriodCard period="今月" data={thisMonth}  loading={loading} />
            <PeriodCard period="本日" data={today}      loading={loading} />
          </div>
        </section>

        {/* ── 本日 時間別売上グラフ ─────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">本日の時間別売上</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-6 mb-4">
              <div>
                <p className="text-xs text-slate-400">本日の合計</p>
                <p className="text-2xl font-bold text-indigo-700">¥{(today?.total ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">件数</p>
                <p className="text-2xl font-bold text-slate-700">{today?.count ?? 0}件</p>
              </div>
            </div>
            <HourlyBarChart data={hourly} />
          </div>
        </section>

        {/* ── 注文履歴と訂正 ───────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">注文履歴</h2>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold shadow-sm focus:outline-none focus:border-indigo-400"
            >
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {orders.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-10">
                {isSupabaseConfigured ? "この月のデータはありません" : "Supabase 未設定"}
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* ヘッダー行 */}
                <div className="grid grid-cols-[1fr_120px_80px_140px] gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <span>日時</span>
                  <span className="text-right">金額</span>
                  <span className="text-right">件数</span>
                  <span className="text-center">操作</span>
                </div>
                {orders.map(row => {
                  const dt = new Date(row.created_at).toLocaleString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                    month: "2-digit", day: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                  });
                  const rawItems = Array.isArray(row.items) ? row.items : [];
                  const itemCount = rawItems.reduce((s: number, it) => {
                    const q = Number(it.quantity);
                    return s + (isNaN(q) ? 1 : q);
                  }, 0) || 0;
                  return (
                    <div key={row.id}
                      className="grid grid-cols-[1fr_120px_80px_140px] gap-2 px-5 py-3.5 items-center hover:bg-slate-50 transition-colors">
                      <span className="text-sm text-slate-700 font-medium tabular-nums">{dt}</span>
                      <span className="text-right font-bold text-indigo-700">¥{row.total_amount.toLocaleString()}</span>
                      <span className="text-right text-slate-500 text-sm">{itemCount}品</span>
                      <div className="flex gap-1.5 justify-center">
                        <button
                          onClick={() => setDetailRow(row)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 text-xs font-semibold border border-slate-200 hover:border-indigo-300 transition-all active:scale-95"
                        >
                          内容修正
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 text-xs font-semibold border border-red-200 hover:border-red-400 transition-all active:scale-95 disabled:opacity-40"
                        >
                          {deletingId === row.id ? "⏳" : "削除"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 注文詳細モーダル */}
      {detailRow && (
        <OrderDetailModal row={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </div>
  );
}
