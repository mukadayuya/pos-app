"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getAiStats, AiStats } from "@/lib/aiStats";

// ─── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1400): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    setValue(0);
    if (target === 0) return;
    const start = performance.now();
    function step(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = window.requestAnimationFrame(step);
    }
    rafRef.current = window.requestAnimationFrame(step);
    return () => { if (rafRef.current) window.cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return value;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActivityEntry {
  time: string;
  type: "chat" | "upsell";
  description: string;
  outcome: string;
}

// ─── Static demo data ─────────────────────────────────────────────────────────

const DEMO_ACTIVITY: ActivityEntry[] = [
  {
    time: "14:32",
    type: "chat",
    description: "AIコンシェルジュが英語で接客（アレルギー対応）",
    outcome: "接客",
  },
  {
    time: "14:18",
    type: "upsell",
    description: "アップセル提案「生ビール ¥550」→ 追加注文",
    outcome: "成功",
  },
  {
    time: "13:55",
    type: "chat",
    description: "中国語で接客（メニュー説明）",
    outcome: "接客",
  },
  {
    time: "13:22",
    type: "upsell",
    description: "アップセル提案「デザート ¥380」→ 追加注文",
    outcome: "成功",
  },
  {
    time: "12:44",
    type: "chat",
    description: "日本語で接客（補助金について）",
    outcome: "接客",
  },
  {
    time: "12:01",
    type: "upsell",
    description: "アップセル提案「ランチドリンク ¥350」→ 追加注文",
    outcome: "成功",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  icon,
  iconBg,
  accent,
  targetValue,
  format,
  label,
  sub,
  dramatic,
}: {
  icon: string;
  iconBg: string;
  accent: string;
  targetValue: number;
  format: (n: number) => string;
  label: string;
  sub: string;
  dramatic?: boolean; // larger, glowing display for the money card
}) {
  const displayed = useCountUp(targetValue, dramatic ? 1800 : 1200);

  const glowColor =
    accent === "violet"  ? "rgba(139,92,246,0.20)"  :
    accent === "emerald" ? "rgba(16,185,129,0.20)"   :
                           "rgba(245,158,11,0.20)";
  const borderActive =
    accent === "violet"  ? "rgba(139,92,246,0.55)"  :
    accent === "emerald" ? "rgba(16,185,129,0.55)"   :
                           "rgba(245,158,11,0.55)";

  return (
    <div
      className="flex-1 min-w-0 bg-slate-800/80 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200"
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 24px ${glowColor}`;
        (e.currentTarget as HTMLDivElement).style.borderColor = borderActive;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "";
        (e.currentTarget as HTMLDivElement).style.borderColor = "";
      }}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${iconBg}`}>
        {icon}
      </div>

      {/* Value — count-up */}
      <div>
        {dramatic ? (
          <p
            className="text-3xl font-extrabold text-transparent bg-clip-text tracking-tight tabular-nums"
            style={{ backgroundImage: "linear-gradient(135deg, #34d399 0%, #a78bfa 100%)" }}
          >
            {format(displayed)}
          </p>
        ) : (
          <p className="text-2xl font-bold text-white tracking-tight tabular-nums">
            {format(displayed)}
          </p>
        )}
        <p className="text-sm text-slate-400 mt-0.5">{label}</p>
      </div>

      {/* Sub */}
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const isUpsell = entry.type === "upsell";
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-700/40 last:border-0">
      {/* Icon */}
      <div
        className={`
          mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0
          ${isUpsell ? "bg-emerald-900/60" : "bg-violet-900/60"}
        `}
      >
        {isUpsell ? "🎯" : "💬"}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-mono">{entry.time}</span>
          <span className="text-sm text-slate-200 leading-snug">{entry.description}</span>
        </div>
      </div>

      {/* Badge */}
      <span
        className={`
          shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5
          ${isUpsell
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-violet-500/20 text-violet-400"}
        `}
      >
        {entry.outcome}
      </span>
    </div>
  );
}

// ─── ROI Calculator ───────────────────────────────────────────────────────────

function RoiCalculator() {
  // monthlyRevenue is in 万円
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(80);

  // Formula: monthlyRevenue * 10000 * 0.12 * 0.15
  const monthlyGain = Math.round(monthlyRevenue * 10000 * 0.12 * 0.15);
  const annualGain  = monthlyGain * 12;

  function formatYen(yen: number): string {
    if (yen >= 10000) {
      return `+${(yen / 10000).toFixed(1)}万円`;
    }
    return `+${yen.toLocaleString("ja-JP")}円`;
  }

  return (
    <section className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
      <h2 className="text-base font-semibold text-white mb-5">
        ROIシミュレーター
      </h2>

      {/* Input row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <label className="text-sm text-slate-400 shrink-0" htmlFor="monthly-revenue">
          月商（万円）
        </label>
        <input
          id="monthly-revenue"
          type="number"
          min={1}
          max={10000}
          value={monthlyRevenue}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v > 0) setMonthlyRevenue(v);
          }}
          className="
            w-32 bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-2
            text-white text-sm placeholder-slate-500
            focus:outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/30
            transition-colors
          "
        />
        <span className="text-slate-400 text-sm">
          万円 × 月商
        </span>
      </div>

      {/* Breakdown row */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400 mb-6">
        <span className="bg-slate-700/50 rounded-lg px-3 py-1.5 text-slate-300 font-medium">
          AIアップセル率 12%
        </span>
        <span className="text-slate-600">×</span>
        <span className="bg-slate-700/50 rounded-lg px-3 py-1.5 text-slate-300 font-medium">
          成約率 15%
        </span>
        <span className="text-slate-600">=</span>
        <span className="bg-emerald-900/40 border border-emerald-700/40 rounded-lg px-3 py-1.5 text-emerald-300 font-semibold">
          月間増収: {formatYen(monthlyGain)}
        </span>
      </div>

      {/* Big annual number */}
      <div className="flex flex-col items-center py-6 gap-1">
        <p className="text-xs text-slate-500 uppercase tracking-wider">年間AI増収予測</p>
        <p
          className="text-5xl font-extrabold text-transparent bg-clip-text"
          style={{
            backgroundImage: "linear-gradient(135deg, #a78bfa 0%, #34d399 100%)",
          }}
        >
          {formatYen(annualGain)}
        </p>
      </div>

      <p className="text-xs text-slate-500 text-center">
        実際の成果はAI接客数に比例して上昇します
      </p>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiDashboardPage() {
  const [stats, setStats] = useState<AiStats | null>(null);

  useEffect(() => {
    setStats(getAiStats());
  }, []);

  // Derive display values — fall back to demo numbers when stats are zero
  const chatCount      = stats && stats.chatCount      > 0 ? stats.chatCount      : 12;
  const upsellTotal    = stats && stats.upsellTotalYen > 0 ? stats.upsellTotalYen : 3240;
  const upsellClicked  = stats?.upsellClicked  ?? 0;
  const upsellShown    = stats?.upsellShown    ?? 0;

  const successRate =
    upsellShown > 0
      ? `${Math.round((upsellClicked / upsellShown) * 100)}%`
      : "27%";  // demo

  const cumulativeChats = chatCount * 3;  // rough cumulative multiplier

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">

      {/* ── Header ── */}
      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link
          href="/register"
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <span className="text-base">←</span>
          <span>戻る</span>
        </Link>
        <div className="w-px h-5 bg-slate-700" />
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: "#a78bfa" }}
          />
          <h1 className="text-sm font-semibold text-white tracking-wide">
            FLOWS AI 成果ダッシュボード
          </h1>
        </div>
        <div className="ml-auto text-xs text-slate-500">
          FLOWS by Infotainment
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 px-4 sm:px-6 py-6 flex flex-col gap-6 max-w-4xl mx-auto w-full">

        {/* ── KPI Cards ── */}
        <div className="flex flex-col sm:flex-row gap-4">

          {/* Card 1: AI接客数 */}
          <KpiCard
            icon="💬"
            iconBg="bg-gradient-to-br from-violet-600 to-violet-800"
            accent="violet"
            targetValue={chatCount}
            format={(n) => `${n}`}
            label="本日のAI接客"
            sub={`累計 ${cumulativeChats} 件`}
          />

          {/* Card 2: アップセル成功額（ドラマチック演出） */}
          <KpiCard
            icon="💰"
            iconBg="bg-gradient-to-br from-emerald-600 to-emerald-800"
            accent="emerald"
            targetValue={upsellTotal}
            format={(n) => `¥${n.toLocaleString("ja-JP")}`}
            label="AIが稼いだ追加売上"
            sub={`アップセル成功率 ${successRate}`}
            dramatic
          />

          {/* Card 3: 予測ROI（年間） */}
          <KpiCard
            icon="📈"
            iconBg="bg-gradient-to-br from-amber-500 to-amber-700"
            accent="amber"
            targetValue={upsellTotal > 0 ? upsellTotal * 365 : 1182600}
            format={(n) => n >= 10000 ? `¥${(n / 10000).toFixed(1)}万` : `¥${n.toLocaleString("ja-JP")}`}
            label="AI活用による年間増収予測"
            sub="前月比 +12%"
          />
        </div>

        {/* ── ROI Calculator ── */}
        <RoiCalculator />

        {/* ── Activity Log ── */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">
            📋 今日のAI活動
          </h2>
          <div>
            {DEMO_ACTIVITY.map((entry, i) => (
              <ActivityRow key={i} entry={entry} />
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
