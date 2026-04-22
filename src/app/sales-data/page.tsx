"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ReceiptIssueModal from "@/components/ReceiptIssueModal";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchTodaySummary,
  fetchDailySummaries,
  fetchMonthlySummaries,
  fetchYearlySummaries,
  fetchItemRankings,
  fetchAllSalesForExport,
  TodaySummary,
  DailySummary,
  MonthlySummary,
  YearlySummary,
  ItemRanking,
} from "@/lib/db";

type ChartTab = "daily" | "monthly" | "yearly";

// ─── バーチャート ──────────────────────────────────────────────
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 px-1" style={{ height: "160px" }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full min-w-0">
          <div
            className="w-full bg-violet-500 hover:bg-violet-400 rounded-t transition-all cursor-default"
            style={{ height: `${Math.max(3, Math.round((d.value / maxVal) * 130))}px` }}
            title={`¥${d.value.toLocaleString()}`}
          />
          <span
            className="text-slate-500 text-center leading-none overflow-hidden"
            style={{ fontSize: "9px", maxHeight: "24px", writingMode: "vertical-rl" }}
          >
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── サマリーカード ──────────────────────────────────────────────
function Card({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function exportToCsv(rows: DailySummary[]) {
  const header = ["日付", "売上合計（税込）", "客数", "客単価"];
  const body = rows.map(r => [
    r.date, r.total, r.count,
    r.count > 0 ? Math.floor(r.total / r.count) : 0,
  ]);
  const bom = "\uFEFF";
  const csv = bom + [header, ...body]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kitchenkazu_sales_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SalesDataPage() {
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [today, setToday]               = useState<TodaySummary | null>(null);
  const [daily, setDaily]               = useState<DailySummary[]>([]);
  const [monthly, setMonthly]           = useState<MonthlySummary[]>([]);
  const [yearly, setYearly]             = useState<YearlySummary[]>([]);
  const [rankings, setRankings]         = useState<ItemRanking[]>([]);
  const [chartTab, setChartTab]         = useState<ChartTab>("daily");
  const [csvExporting, setCsvExporting]       = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const [t, d, m, y, r] = await Promise.all([
        fetchTodaySummary(),
        fetchDailySummaries(),
        fetchMonthlySummaries(),
        fetchYearlySummaries(),
        fetchItemRankings(),
      ]);
      setToday(t); setDaily(d); setMonthly(m); setYearly(y); setRankings(r);
    } catch {
      setError("データの取得に失敗しました。接続を確認してください。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
      const rows: DailySummary[] = Array.from(grouped.entries())
        .map(([date, { total, count }]) => ({ date, total, count }))
        .sort((a, b) => b.date.localeCompare(a.date));
      exportToCsv(rows);
    } catch {
      alert("CSVの書き出しに失敗しました。");
    } finally {
      setCsvExporting(false);
    }
  };

  const chartData = chartTab === "daily"
    ? daily.slice(-30).map(d => ({ label: d.date.slice(5), value: d.total }))
    : chartTab === "monthly"
    ? monthly.map(m => ({ label: m.label, value: m.total }))
    : yearly.map(y => ({ label: `${y.year}年`, value: y.total }));

  const periodTotal = chartTab === "daily"
    ? daily.reduce((s, d) => s + d.total, 0)
    : chartTab === "monthly"
    ? monthly.reduce((s, m) => s + m.total, 0)
    : yearly.reduce((s, y) => s + y.total, 0);

  const periodCount = chartTab === "daily"
    ? daily.reduce((s, d) => s + d.count, 0)
    : chartTab === "monthly"
    ? monthly.reduce((s, m) => s + m.count, 0)
    : yearly.reduce((s, y) => s + y.count, 0);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ヘッダー */}
      <header className="bg-violet-700 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-violet-300 hover:text-white text-sm font-medium transition-colors mr-1">
              ← HOME
            </Link>
            <span className="text-2xl">📊</span>
            <div>
              <h1 className="text-lg font-bold leading-tight">売上データ</h1>
              <p className="text-xs text-violet-300">Kitchen Kazu</p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading || !isSupabaseConfigured}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 border border-violet-500 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          >
            <span className={loading ? "animate-spin inline-block" : ""}>🔄</span>
            更新
          </button>
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

        {loading && isSupabaseConfigured ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
            <span className="animate-spin text-2xl">⏳</span>
            <span className="text-sm">データを読み込み中...</span>
          </div>
        ) : isSupabaseConfigured && (
          <>
            {/* 本日のサマリー */}
            <section>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">本日のサマリー</h2>
              <div className="grid grid-cols-3 gap-4">
                <Card icon="💴" color="bg-violet-50" label="売上合計（税込）"
                  value={`¥${(today?.totalRevenue ?? 0).toLocaleString()}`} sub="本日" />
                <Card icon="👥" color="bg-emerald-50" label="客数"
                  value={`${today?.count ?? 0}人`} sub="本日" />
                <Card icon="🧾" color="bg-amber-50" label="客単価"
                  value={`¥${(today?.avgSpend ?? 0).toLocaleString()}`} sub="1人あたり平均" />
              </div>
            </section>

            {/* 売上グラフ */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">売上グラフ</h2>
                <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
                  {(["daily", "monthly", "yearly"] as ChartTab[]).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setChartTab(tab)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        chartTab === tab
                          ? "bg-violet-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tab === "daily" ? "日別" : tab === "monthly" ? "月別" : "年別"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                {/* 集計数値 */}
                <div className="flex gap-8 mb-6">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">
                      {chartTab === "daily" ? "直近30日" : chartTab === "monthly" ? "直近12ヶ月" : "全期間"}の売上
                    </p>
                    <p className="text-3xl font-bold text-violet-700">¥{periodTotal.toLocaleString()}</p>
                  </div>
                  <div className="border-l border-slate-200 pl-8">
                    <p className="text-xs text-slate-400 mb-0.5">件数</p>
                    <p className="text-3xl font-bold text-slate-700">{periodCount}<span className="text-base font-normal text-slate-400 ml-1">件</span></p>
                  </div>
                  <div className="border-l border-slate-200 pl-8">
                    <p className="text-xs text-slate-400 mb-0.5">平均単価</p>
                    <p className="text-3xl font-bold text-slate-700">
                      ¥{periodCount > 0 ? Math.floor(periodTotal / periodCount).toLocaleString() : 0}
                    </p>
                  </div>
                </div>

                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-slate-300">
                    <p className="text-sm">データがありません</p>
                  </div>
                ) : (
                  <BarChart data={chartData} />
                )}
              </div>
            </section>

            {/* 日別テーブル + ランキング */}
            <div className="grid grid-cols-2 gap-6">
              <section>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                  {chartTab === "yearly" ? "年別" : chartTab === "monthly" ? "月別" : "日別"}売上一覧
                </h2>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {daily.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-10">データがありません</p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">
                              {chartTab === "yearly" ? "年" : chartTab === "monthly" ? "月" : "日付"}
                            </th>
                            <th className="text-right px-4 py-3 font-semibold text-slate-600">売上</th>
                            <th className="text-right px-4 py-3 font-semibold text-slate-600">件数</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(chartTab === "daily"
                            ? [...daily].reverse()
                            : chartTab === "monthly"
                            ? [...monthly].reverse().map(m => ({ date: m.label, total: m.total, count: m.count }))
                            : [...yearly].reverse().map(y => ({ date: `${y.year}年`, total: y.total, count: y.count }))
                          ).map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-slate-700 font-medium">{row.date}</td>
                              <td className="px-4 py-3 text-right font-bold text-violet-700">¥{row.total.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right text-slate-500">{row.count}件</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">メニュー別ランキング</h2>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {rankings.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-10">データがありません</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {rankings.map((item, idx) => (
                        <div key={item.menuItemName} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            idx === 0 ? "bg-yellow-400 text-yellow-900"
                            : idx === 1 ? "bg-slate-300 text-slate-700"
                            : idx === 2 ? "bg-amber-600 text-white"
                            : "bg-slate-100 text-slate-500"
                          }`}>{idx + 1}</span>
                          <span className="text-xl flex-shrink-0">{item.menuItemEmoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{item.menuItemName}</p>
                            <p className="text-xs text-slate-400">¥{item.totalRevenue.toLocaleString()}</p>
                          </div>
                          <span className="text-sm font-bold text-violet-700 flex-shrink-0">{item.totalQuantity}食</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* 補助金サポート・会計事務 */}
            <section>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">補助金サポート・会計事務処理</h2>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleCsvExport}
                    disabled={csvExporting}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                  >
                    {csvExporting ? <span className="animate-spin">⏳</span> : <span>📥</span>}
                    確定申告・補助金報告用データの出力
                  </button>
                  <button
                    onClick={() => setShowReceiptModal(true)}
                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-sm"
                  >
                    <span>📄</span>
                    領収書を発行する
                  </button>
                  <a
                    href={`mailto:?subject=${encodeURIComponent("【売上報告書】Kitchen Kazu")}&body=${encodeURIComponent("税理士の先生\n\nお世話になっております。\nKitchen Kazuの売上報告書をお送りします。\nCSVファイルを別途添付いたします。\n\nよろしくお願いいたします。")}`}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-sm"
                  >
                    <span>✉️</span>
                    税理士へメール送信
                  </a>
                </div>

                {showReceiptModal && (
                  <ReceiptIssueModal onClose={() => setShowReceiptModal(false)} />
                )}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">補助金申請・事後報告に使えるデータ</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">✅ 日別・月別・年別売上実績</div>
                    <div className="flex items-center gap-1.5">✅ BOM付きUTF-8（Excelで開ける）</div>
                    <div className="flex items-center gap-1.5">✅ 客数・客単価の記録</div>
                    <div className="flex items-center gap-1.5">✅ 税理士提出用フォーマット</div>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  ※ 税理士への提出や補助金の事後報告用データとしてそのままお使いいただけます
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
