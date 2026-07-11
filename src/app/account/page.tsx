"use client";

// SaaS 契約者向けアカウント画面（Phase 5 課金）
// 現在の契約状態を表示し、Customer Portal で支払方法・解約を管理する。

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { STORE_ID } from "@/lib/db";

interface Subscription {
  plan_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  updated_at: string;
}

const PLAN_LABEL: Record<string, string> = {
  basic:    "Basic",
  standard: "Standard",
  pro:      "Pro",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  trialing:            { label: "無料試用中", color: "bg-blue-100 text-blue-800" },
  active:              { label: "有効",       color: "bg-emerald-100 text-emerald-800" },
  past_due:            { label: "支払遅延",   color: "bg-amber-100 text-amber-800" },
  canceled:            { label: "解約済",     color: "bg-slate-100 text-slate-600" },
  incomplete:          { label: "未完了",     color: "bg-amber-100 text-amber-800" },
  incomplete_expired:  { label: "期限切れ",   color: "bg-slate-100 text-slate-500" },
  unpaid:              { label: "未払い",     color: "bg-red-100 text-red-800" },
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

export default function AccountPage() {
  const [sub, setSub]       = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [flash, setFlash]   = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("checkout") === "success") {
        setFlash("🎉 ご契約ありがとうございます！反映まで数分お待ちください。");
      }
    }
    void (async () => {
      if (!supabase) { setLoading(false); return; }
      const { data } = await supabase
        .from("subscriptions")
        .select("plan_id, status, current_period_end, cancel_at_period_end, trial_end, updated_at")
        .eq("store_id", STORE_ID)
        .maybeSingle();
      setSub(data as Subscription | null);
      setLoading(false);
    })();
  }, []);

  const openPortal = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: STORE_ID }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-slate-600 text-sm">← HOME</Link>
          <h1 className="text-lg font-bold text-slate-900">💳 契約管理</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {flash && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
            {flash}
          </div>
        )}

        {loading ? (
          <p className="text-center text-slate-400 py-10">読み込み中…</p>
        ) : !sub ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-sm text-slate-600">まだ契約がありません</p>
            <Link href="/pricing"
              className="inline-block mt-4 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl">
              料金プランを見る →
            </Link>
          </div>
        ) : (
          <>
            {/* サブスクサマリー */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">現在のプラン</p>
                  <h2 className="text-2xl font-black text-slate-900">{PLAN_LABEL[sub.plan_id] ?? sub.plan_id}</h2>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_LABEL[sub.status]?.color ?? "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABEL[sub.status]?.label ?? sub.status}
                </span>
              </div>
              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">次回請求日</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{fmtDateTime(sub.current_period_end)}</p>
                </div>
                {sub.trial_end && (
                  <div>
                    <p className="text-xs text-slate-500">試用終了日</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{fmtDateTime(sub.trial_end)}</p>
                  </div>
                )}
              </div>
              {sub.cancel_at_period_end && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-800">
                  ⚠️ このプランは次回請求日に解約されます
                </div>
              )}
            </div>

            <button onClick={openPortal} disabled={busy}
              className="w-full py-4 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-2xl text-base font-bold active:scale-95">
              {busy ? "遷移中…" : "🔧 支払方法・解約の管理 →"}
            </button>
            <p className="text-xs text-slate-500 text-center">
              クレジットカード変更、請求書ダウンロード、プラン変更、解約は Stripe の管理画面から行えます。
            </p>

            {error && <p className="text-xs text-red-600 text-center">{error}</p>}
          </>
        )}
      </main>
    </div>
  );
}
