"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MenuItem } from "@/types/pos";
import { categoryLabels } from "@/data/menu";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchTodaySummary,
  fetchDailySummaries,
  fetchItemRankings,
  fetchMenuItems,
  deleteMenuItem,
  TodaySummary,
  DailySummary,
  ItemRanking,
} from "@/lib/db";

// ─── サマリーカード ──────────────────────────────────────────────
function SummaryCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string; sub?: string; icon: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Supabase未設定ガイド ──────────────────────────────────────
function SetupGuide() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 max-w-lg mx-auto mt-4">
      <h3 className="font-bold text-amber-800 text-base mb-3">⚙️ Supabase のセットアップが必要です</h3>
      <ol className="space-y-2 text-sm text-amber-700 list-decimal list-inside">
        <li>
          <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">
            supabase.com
          </a>{" "}でプロジェクトを作成
        </li>
        <li>
          <code className="bg-amber-100 px-1 rounded">supabase/setup.sql</code> をSQL Editorで実行
        </li>
        <li>
          <code className="bg-amber-100 px-1 rounded">.env.local.example</code> を{" "}
          <code className="bg-amber-100 px-1 rounded">.env.local</code> にコピーしてURL・ANON KEYを設定
        </li>
        <li>開発サーバーを再起動（<code className="bg-amber-100 px-1 rounded">npm run dev</code>）</li>
      </ol>
    </div>
  );
}

// ─── メニュー管理セクション ────────────────────────────────────
function MenuManagement() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMenuItems()
      .then(setMenus)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (item: MenuItem) => {
    const confirmed = window.confirm(
      `「${item.name}」を削除しますか？\nこの操作は取り消せません。`
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    try {
      await deleteMenuItem(item.id);
      setMenus((prev) => prev.filter((m) => m.id !== item.id));
    } catch {
      alert("削除に失敗しました。再度お試しください。");
    } finally {
      setDeletingId(null);
    }
  };

  const grouped = {
    lunch: menus.filter((m) => m.category === "lunch"),
    dinner: menus.filter((m) => m.category === "dinner"),
  } as const;

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        メニュー管理
      </h2>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="text-center text-slate-400 text-sm py-8">読み込み中...</p>
        ) : menus.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">メニューがありません</p>
        ) : (
          (["lunch", "dinner"] as const).map((cat) => (
            grouped[cat].length > 0 && (
              <div key={cat}>
                <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {categoryLabels[cat]}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {grouped[cat].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-2xl flex-shrink-0">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                        <p className="text-xs text-slate-400">¥{item.price.toLocaleString()}</p>
                      </div>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-400 text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        {deletingId === item.id ? (
                          <span className="animate-spin">⏳</span>
                        ) : (
                          <>🗑️ 削除</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))
        )}
      </div>
    </section>
  );
}

// ─── ダッシュボード ────────────────────────────────────────────
export default function AdminSalesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [itemRankings, setItemRankings] = useState<ItemRanking[]>([]);
  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const [today, daily, rankings] = await Promise.all([
        fetchTodaySummary(),
        fetchDailySummaries(),
        fetchItemRankings(),
      ]);
      setTodaySummary(today);
      setDailySummaries(daily);
      setItemRankings(rankings);
    } catch {
      setError("データの取得に失敗しました。接続を確認してください。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ヘッダー */}
      <header className="bg-indigo-700 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h1 className="text-lg font-bold leading-tight">売上レポート</h1>
              <p className="text-xs text-indigo-300">kitchenkazu</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading || !isSupabaseConfigured}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              <span className={loading ? "animate-spin inline-block" : ""}>🔄</span>
              更新
            </button>
            <Link
              href="/"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            >
              ← POSに戻る
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {!isSupabaseConfigured && <SetupGuide />}

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
        ) : (
          isSupabaseConfigured && (
            <>
              {/* 本日のサマリー */}
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  本日のサマリー
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <SummaryCard
                    icon="💴"
                    color="bg-indigo-50"
                    label="売上合計（税込）"
                    value={`¥${(todaySummary?.totalRevenue ?? 0).toLocaleString()}`}
                    sub="本日"
                  />
                  <SummaryCard
                    icon="👥"
                    color="bg-emerald-50"
                    label="客数"
                    value={`${todaySummary?.count ?? 0}人`}
                    sub="本日"
                  />
                  <SummaryCard
                    icon="🧾"
                    color="bg-amber-50"
                    label="客単価"
                    value={`¥${(todaySummary?.avgSpend ?? 0).toLocaleString()}`}
                    sub="1人あたり平均"
                  />
                </div>
              </section>

              {/* 日別 + ランキング */}
              <div className="grid grid-cols-2 gap-6">
                {/* 日別売上 */}
                <section>
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    日別売上（直近30日）
                  </h2>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {dailySummaries.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-10">データがありません</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-5 py-3 font-semibold text-slate-600">日付</th>
                            <th className="text-right px-5 py-3 font-semibold text-slate-600">売上</th>
                            <th className="text-right px-5 py-3 font-semibold text-slate-600">客数</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dailySummaries.map((row) => (
                            <tr key={row.date} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 text-slate-700 font-medium">{row.date}</td>
                              <td className="px-5 py-3 text-right font-bold text-indigo-700">
                                ¥{row.total.toLocaleString()}
                              </td>
                              <td className="px-5 py-3 text-right text-slate-500">{row.count}人</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </section>

                {/* メニュー別ランキング */}
                <section>
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    メニュー別売上ランキング
                  </h2>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {itemRankings.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-10">データがありません</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {itemRankings.map((item, idx) => (
                          <div
                            key={item.menuItemName}
                            className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                          >
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                idx === 0
                                  ? "bg-yellow-400 text-yellow-900"
                                  : idx === 1
                                  ? "bg-slate-300 text-slate-700"
                                  : idx === 2
                                  ? "bg-amber-600 text-white"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="text-xl flex-shrink-0">{item.menuItemEmoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {item.menuItemName}
                              </p>
                              <p className="text-xs text-slate-400">
                                ¥{item.totalRevenue.toLocaleString()}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-indigo-700 flex-shrink-0">
                              {item.totalQuantity}食
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* メニュー管理 */}
              <MenuManagement />

              {/* 会計・事務処理 */}
              <section className="pb-2">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  会計・事務処理
                </h2>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                  <a
                    href={`mailto:?subject=${encodeURIComponent("【売上報告書】Kitchen Kazu")}&body=${encodeURIComponent("税理士の先生\n\nお世話になっております。\nKitchen Kazuの売上報告書をお送りします。\nCSVファイルを別途添付いたします。\n\nよろしくお願いいたします。")}`}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-sm"
                  >
                    <span>✉️</span>
                    税理士へメール送信（CSV添付）
                  </a>
                  <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                    ※税理士への提出や、補助金の事後報告用データとしてそのままお使いいただけます
                  </p>
                </div>
              </section>
            </>
          )
        )}
      </main>
    </div>
  );
}
