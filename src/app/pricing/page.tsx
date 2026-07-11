// FLOWS POS 料金プラン（Phase 5-⑰）
// 見込み客向けランディング。3プラン比較＋補助金活用による実質価格訴求＋加藤さん事例。

"use client";

import Link from "next/link";
import { useState } from "react";
import { STORE_ID } from "@/lib/db";

type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthly: number;
  emoji: string;
  color: string;
  targetStore: string;
  features: string[];
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "個人店・小規模店向け",
    monthly: 4980,
    emoji: "🌱",
    color: "slate",
    targetStore: "座席数 20席以下",
    features: [
      "レジ機能・売上管理",
      "テーブル管理",
      "領収書発行",
      "X/Zレポート",
      "現金管理・仮払い記録",
      "スタッフ勤怠・給与集計",
      "iPad × 1台 まで",
      "メールサポート",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    tagline: "多くのお店に選ばれています",
    monthly: 9800,
    emoji: "🌿",
    color: "emerald",
    featured: true,
    targetStore: "座席数 21〜50席",
    features: [
      "Basicの全機能",
      "ハンディオーダー（5言語対応・音声検索）",
      "予約・取り置き管理",
      "分割会計・割り勘",
      "返品・部分返品処理",
      "モバイルオーダー（QRコード）",
      "iPad × 3台 + ハンディ × 3台",
      "AIチャットサポート",
      "補助金チェッカー標準搭載",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "多店舗・インバウンド対応",
    monthly: 19800,
    emoji: "🌳",
    color: "amber",
    targetStore: "多店舗運営・インバウンド需要あり",
    features: [
      "Standardの全機能",
      "CloudPRNTレシート印刷",
      "免税販売対応（インバウンド）",
      "多店舗一括管理",
      "APIアクセス・データ連携",
      "iPad・ハンディ台数無制限",
      "電話サポート・SLA保証",
      "補助金申請サポート（向田さん直接対応）",
      "オンサイト導入研修",
    ],
  },
];

const FAQS = [
  { q: "契約期間の縛りはありますか？", a: "月額課金・いつでも解約可能です。年払いプランなら10%オフでご提供します。" },
  { q: "既存POSからの乗換は可能ですか？", a: "CSVインポートで過去データを引き継げます。ハードウェア（iPad等）はそのままご利用いただけます。" },
  { q: "初期費用はかかりますか？", a: "オンライン申込なら初期費用0円。オンサイト研修（Proプラン）を希望される場合のみ、出張費実費のみいただきます。" },
  { q: "補助金活用の対応はしてもらえますか？", a: "はい。IT導入補助金・業務改善助成金の申請サポートを標準提供します。過去実績: 加藤さん(名古屋イタリアン)233万円→自己負担46万円。" },
  { q: "サポート時間は？", a: "Basic/Standard: 平日10:00-19:00。Pro: 24時間・電話対応可。" },
];

function fmtYen(n: number): string { return `¥${n.toLocaleString()}`; }

// 補助金活用で実質何円か表示するヘルパー
function subsidyReducedPrice(monthly: number): number {
  // IT導入補助金の想定: 導入後2年間の月額×24 の 50〜75% が補助
  // 概算で「1年経費の半額が補助金で戻る」→ 実質50%OFF相当
  return Math.floor(monthly * 0.5);
}

function usePricingCheckout() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const startCheckout = async (planId: string) => {
    setLoadingPlan(planId);
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          storeId: STORE_ID,
          storeName: typeof window !== "undefined" ? (localStorage.getItem("store_name") ?? undefined) : undefined,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setLoadingPlan(null);
    }
  };

  return { loadingPlan, error, startCheckout };
}

export default function PricingPage() {
  const { loadingPlan, error: checkoutError, startCheckout } = usePricingCheckout();
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Hero ────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-3">FLOWS POS 料金プラン</p>
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4">
            補助金活用で<br />
            <span className="text-emerald-300">実質半額</span>
            <span className="text-lg md:text-2xl font-normal ml-2">で始められる</span>
          </h1>
          <p className="text-sm md:text-base opacity-90 leading-relaxed max-w-2xl mx-auto">
            💡 加藤さん（名古屋イタリアン）は 233万円のPOS導入を 自己負担46万円 で実現。<br />
            IT導入補助金・業務改善助成金の申請を代行します。
          </p>
          <div className="mt-6 inline-flex items-center gap-3 bg-white/10 backdrop-blur px-4 py-2 rounded-full text-xs">
            <span>✓ 契約縛りなし</span>
            <span>✓ 初期費用0円</span>
            <span>✓ 補助金サポート標準</span>
          </div>
        </div>
      </section>

      {/* ── Plans ───────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 -mt-8 pb-16">
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map(p => {
            const reduced = subsidyReducedPrice(p.monthly);
            const colorMap = {
              slate:   { border: "border-slate-200",   accent: "text-slate-600",   bg: "bg-slate-50" },
              emerald: { border: "border-emerald-400", accent: "text-emerald-700", bg: "bg-emerald-50" },
              amber:   { border: "border-amber-300",   accent: "text-amber-700",   bg: "bg-amber-50" },
            };
            const c = colorMap[p.color as keyof typeof colorMap];
            return (
              <div key={p.id} className={`bg-white rounded-3xl border-2 ${c.border} ${p.featured ? "shadow-xl md:scale-105 relative" : "shadow-sm"} p-6`}>
                {p.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                    人気No.1
                  </div>
                )}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl">{p.emoji}</span>
                  <h3 className="text-2xl font-black text-slate-900">{p.name}</h3>
                </div>
                <p className={`text-xs font-bold ${c.accent} mb-4`}>{p.tagline}</p>
                <p className="text-[10px] text-slate-500 mb-3">目安: {p.targetStore}</p>

                <div className="mb-4">
                  <p className="text-3xl font-black text-slate-900 tabular-nums">{fmtYen(p.monthly)}<span className="text-sm font-normal text-slate-500">/月</span></p>
                  <div className={`${c.bg} border ${c.border} rounded-lg px-3 py-2 mt-2`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">💰 補助金活用で</p>
                    <p className={`text-lg font-black ${c.accent} tabular-nums`}>実質 {fmtYen(reduced)}/月〜</p>
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-700">
                      <span className={`${c.accent} font-bold shrink-0`}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  <button onClick={() => startCheckout(p.id)} disabled={loadingPlan === p.id}
                    className={`block w-full py-3 rounded-xl text-center font-black text-sm transition-all active:scale-95 ${
                      p.featured
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                        : "bg-slate-900 hover:bg-slate-700 text-white"
                    } disabled:opacity-60`}>
                    {loadingPlan === p.id ? "遷移中…" : "今すぐ契約する →"}
                  </button>
                  <a href="https://www.instagram.com/yuya_mukada/" target="_blank" rel="noopener noreferrer"
                    className="block w-full py-2.5 rounded-xl text-center font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700">
                    まずは無料相談
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          ※ 表示価格は税抜。年払いは10%オフ。補助金活用による実質価格は上限率50%で概算表示。
        </p>
        {checkoutError && (
          <p className="text-center text-xs text-red-600 mt-2">{checkoutError}</p>
        )}
      </section>

      {/* ── 実績・信頼性 ────────────────────────────── */}
      <section className="bg-white border-y border-slate-200 px-6 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3">導入実績</p>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">補助金申請 <span className="text-emerald-600">採択率100%</span></h2>
          <p className="text-sm text-slate-600 mb-8">80件以上の飲食店で補助金申請をサポート</p>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 max-w-2xl mx-auto text-left">
            <div className="flex items-start gap-3">
              <span className="text-4xl shrink-0">🍝</span>
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">加藤さん 名古屋イタリアン</p>
                <p className="text-lg font-black text-slate-900 mb-2">導入費用 233万円 → 自己負担 <span className="text-amber-700">46万円</span></p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  「働き方改革推進支援助成金」を活用。厨房設備の入替と併せてPOSレジも導入。
                  複雑な申請書類は向田さんがすべて作成してくれました。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 機能比較表 ───────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-black text-slate-900 text-center mb-6">機能比較</h2>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs">機能</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-600 text-xs">Basic</th>
                  <th className="text-center px-4 py-3 font-bold text-emerald-700 text-xs">Standard</th>
                  <th className="text-center px-4 py-3 font-bold text-amber-700 text-xs">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ["POSレジ・売上管理", "✓", "✓", "✓"],
                  ["テーブル管理", "✓", "✓", "✓"],
                  ["X/Zレポート・現金管理", "✓", "✓", "✓"],
                  ["勤怠管理・給与集計", "✓", "✓", "✓"],
                  ["ハンディ（音声・多言語）", "—", "✓", "✓"],
                  ["予約管理", "—", "✓", "✓"],
                  ["モバイルオーダー(QR)", "—", "✓", "✓"],
                  ["補助金チェッカー", "—", "✓", "✓"],
                  ["レシート印刷(CloudPRNT)", "—", "—", "✓"],
                  ["免税販売対応", "—", "—", "✓"],
                  ["多店舗一括管理", "—", "—", "✓"],
                  ["補助金申請サポート", "有償", "有償", "無料"],
                  ["電話サポート", "—", "—", "✓"],
                ].map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 text-slate-700">{row[0]}</td>
                    <td className={`text-center px-4 py-2.5 ${row[1] === "✓" ? "text-emerald-600 font-bold" : "text-slate-400"}`}>{row[1]}</td>
                    <td className={`text-center px-4 py-2.5 ${row[2] === "✓" ? "text-emerald-600 font-bold" : "text-slate-400"}`}>{row[2]}</td>
                    <td className={`text-center px-4 py-2.5 ${row[3] === "✓" ? "text-emerald-600 font-bold" : "text-slate-400"}`}>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-black text-slate-900 text-center mb-6">よくあるご質問</h2>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <details key={i} className="bg-white rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-bold text-slate-800">
                Q. {f.q}
              </summary>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed pl-4">
                A. {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white px-6 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-4">まずは無料相談から</h2>
          <p className="text-sm md:text-base opacity-90 mb-8 leading-relaxed">
            補助金活用でいくらまで自己負担が下がるか、<br />
            お店の状況をヒアリングして無料でお試算します。
          </p>
          <a href="https://www.instagram.com/yuya_mukada/" target="_blank" rel="noopener noreferrer"
            className="inline-block px-8 py-4 bg-white text-emerald-700 rounded-xl font-black text-lg shadow-2xl active:scale-95 transition-all">
            📱 Instagram で相談する →
          </a>
          <p className="text-xs opacity-70 mt-4">DM返信率100%・24時間以内</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          <div>
            <p className="font-black text-white">FLOWS POS</p>
            <p className="mt-1">飲食店向けPOSレジ SaaS · by 向田侑矢</p>
          </div>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-white">利用規約</Link>
            <Link href="/privacy" className="hover:text-white">プライバシー</Link>
            <a href="https://www.instagram.com/yuya_mukada/" target="_blank" rel="noopener noreferrer" className="hover:text-white">お問合せ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
