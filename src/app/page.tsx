"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SubsidyWizardModal from "@/components/SubsidyWizardModal";

const LS_BANNER_DISMISSED = "subsidy_banner_dismissed_at";
const LS_BOT_VISITED      = "subsidy_bot_visited";
const THREE_DAYS_MS       = 3 * 24 * 60 * 60 * 1000;

type TileStyle = "primary" | "accent" | "card" | "disabled";

const IS_BRONCO = process.env.NEXT_PUBLIC_STORE_ID === "bronco";
const IS_ABC    = process.env.NEXT_PUBLIC_STORE_ID === "yakitori-abc";
const IS_WARAJI  = process.env.NEXT_PUBLIC_STORE_ID === "waraji";
const IS_SHOTEN  = process.env.NEXT_PUBLIC_STORE_ID === "shoten";
const IS_SIMPLE = IS_BRONCO || IS_ABC || IS_WARAJI || IS_SHOTEN;

const allTiles: {
  label: string; icon: string; href: string;
  style: TileStyle; iconBg?: string; hiddenInSimpleMode?: boolean; onlyWaraji?: boolean;
}[] = [
  { label: "レジ",                    icon: "🧾", href: "/register",           style: "primary"  },
  { label: "ハンディ",                icon: "📱", href: "/handy",              style: "accent",     onlyWaraji: true },
  { label: "テーブル管理",             icon: "🍽️", href: "/tables",             style: "accent" },
  { label: "予約管理",                icon: "📅", href: "/reservations",       style: "accent" },
  { label: "受給チャンス",             icon: "✨", href: "/employees",           style: "accent",                        hiddenInSimpleMode: true },
  { label: "売上データ",               icon: "📊", href: "/sales-data",          style: "card",     iconBg: "bg-violet-50" },
  { label: "商品管理",                 icon: "🍽️", href: "/product-management", style: "card",     iconBg: "bg-teal-50"   },
  { label: "点検 / 精算",             icon: "🖨️", href: "/settings",           style: "card",     iconBg: "bg-slate-100" },
  { label: "免税販売",                 icon: "🌏", href: "/tax-free",            style: "card",     iconBg: "bg-blue-50"   },
  { label: "💰 補助金チェッカー",       icon: "💰", href: "/subsidies",           style: "primary" },
  { label: "AIチャット（お客様用）",   icon: "💬", href: "/customer/chat",       style: "card",     iconBg: "bg-purple-50",  hiddenInSimpleMode: true },
  { label: "AI成果ダッシュボード",     icon: "📈", href: "/admin/ai-dashboard",  style: "card",     iconBg: "bg-violet-100", hiddenInSimpleMode: true },
  { label: "キッチン",                 icon: "🍳", href: "/kitchen",             style: "card",     iconBg: "bg-orange-50",  hiddenInSimpleMode: true },
];

const tiles = allTiles.filter(t => {
  if (t.onlyWaraji && !(IS_WARAJI || IS_SHOTEN)) return false;
  if (IS_SIMPLE && t.hiddenInSimpleMode) return false;
  return true;
});

function checkBannerVisible(): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(LS_BOT_VISITED) === "true") return false;
  const hour = new Date().getHours();
  if (hour < 15 || hour >= 16) return false;
  const dismissedAt = localStorage.getItem(LS_BANNER_DISMISSED);
  if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < THREE_DAYS_MS) return false;
  return true;
}

export default function HomePage() {
  const [now, setNow]           = useState(new Date());
  const [showWizard, setShowWizard] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const check = () => setShowBanner(checkBannerVisible());
    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, []);

  const handleBannerClose = () => {
    localStorage.setItem(LS_BANNER_DISMISSED, String(Date.now()));
    setShowBanner(false);
  };
  const handleBotVisited = () => {
    localStorage.setItem(LS_BOT_VISITED, "true");
    setShowBanner(false);
  };

  const dateStr = now.toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
  const timeStr = now.toLocaleTimeString("ja-JP", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col">
      <SubsidyWizardModal
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleBotVisited}
      />

      {/* ヘッダー */}
      <header className="flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-xl border-b border-black/[0.05] shadow-[0_1px_0_rgb(0,0,0,0.04)]">
        {/* FLOWS ロゴ */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[12px] flex items-center justify-center shadow-[0_2px_12px_rgba(99,102,241,0.4)]">
            <span className="text-white text-sm font-black tracking-tight">FL</span>
          </div>
          <div className="leading-none">
            <p className="text-xl font-black text-slate-900 tracking-tight leading-none">FLOWS</p>
            <p className="text-[10px] text-slate-400 font-medium tracking-[0.12em] uppercase mt-0.5">
              by Infotainment
            </p>
          </div>
        </div>

        {/* 日時 */}
        <div className="text-right">
          <p className="text-slate-400 text-xs font-medium">{dateStr}</p>
          <p className="text-slate-900 text-2xl font-black font-mono tracking-wider mt-0.5 tabular-nums">
            {timeStr}
          </p>
        </div>
      </header>

      {/* 受給チャンス バナー（broncoは非表示） */}
      {showBanner && !IS_BRONCO && (
        <SubsidyNotificationBanner
          onOpen={() => setShowWizard(true)}
          onClose={handleBannerClose}
        />
      )}

      {/* メインタイルグリッド */}
      <main className="flex-1 flex items-center justify-center p-10">
        {IS_BRONCO ? (
          <div className="grid grid-cols-3 grid-rows-2 gap-5 w-full max-w-xl">
            {tiles.map((tile) => {
              const tall = tile.href === "/register";
              const tileEl = <Tile key={tile.label} {...tile} tall={tall} />;
              const cls = tall ? "row-span-2" : "";
              if (tile.style === "disabled" || tile.href === "#") {
                return <div key={tile.label} className={cls}>{tileEl}</div>;
              }
              return <Link key={tile.label} href={tile.href} className={cls}>{tileEl}</Link>;
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5 w-full max-w-xl">
            {tiles.map((tile) => {
              const tileEl = <Tile key={tile.label} {...tile} />;
              if (tile.style === "disabled" || tile.href === "#") {
                return <div key={tile.label}>{tileEl}</div>;
              }
              return <Link key={tile.label} href={tile.href}>{tileEl}</Link>;
            })}
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-slate-300 text-xs font-medium tracking-wide">
        © 2026 Infotainment · FLOWS v1.0
      </footer>
    </div>
  );
}

function Tile({
  label, icon, style, iconBg, tall = false,
}: {
  label: string; icon: string; style: TileStyle; iconBg?: string; tall?: boolean;
}) {
  const sizeClass = tall ? "h-full" : "aspect-square";

  if (style === "primary") {
    return (
      <div className={`bg-indigo-600 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 ${sizeClass}
        shadow-[0_4px_24px_rgba(99,102,241,0.38)] hover:shadow-[0_8px_36px_rgba(99,102,241,0.5)]
        hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer`}>
        <span className="text-5xl leading-none">{icon}</span>
        <span className="text-white text-base font-bold tracking-tight">{label}</span>
      </div>
    );
  }

  if (style === "accent") {
    return (
      <div className={`bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 ${sizeClass}
        shadow-[0_4px_24px_rgba(251,191,36,0.4)] hover:shadow-[0_8px_36px_rgba(251,191,36,0.55)]
        hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer`}>
        <span className="text-5xl leading-none">{icon}</span>
        <span className="text-white text-base font-bold tracking-tight text-center leading-snug">{label}</span>
      </div>
    );
  }

  if (style === "disabled") {
    return (
      <div className={`relative bg-white rounded-3xl p-6 flex flex-col items-center justify-center gap-4 ${sizeClass}
        ring-1 ring-black/[0.04] shadow-[0_2px_12px_rgb(0,0,0,0.04)] opacity-50 cursor-not-allowed`}>
        <div className={`w-14 h-14 ${iconBg ?? "bg-slate-50"} rounded-2xl flex items-center justify-center`}>
          <span className="text-3xl leading-none">{icon}</span>
        </div>
        <span className="text-slate-500 text-sm font-semibold tracking-tight text-center leading-snug">{label}</span>
        <span className="absolute top-2.5 right-2.5 bg-slate-100 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-semibold">
          準備中
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-3xl p-6 flex flex-col items-center justify-center gap-4 ${sizeClass}
      ring-1 ring-black/[0.04] shadow-[0_2px_12px_rgb(0,0,0,0.06)]
      hover:shadow-[0_8px_32px_rgb(0,0,0,0.10)] hover:-translate-y-0.5
      active:scale-95 transition-all duration-200 cursor-pointer`}>
      <div className={`w-14 h-14 ${iconBg ?? "bg-slate-50"} rounded-2xl flex items-center justify-center shadow-sm`}>
        <span className="text-3xl leading-none">{icon}</span>
      </div>
      <span className="text-slate-800 text-sm font-bold tracking-tight text-center leading-snug">{label}</span>
    </div>
  );
}

function SubsidyNotificationBanner({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) {
  return (
    <div className="mx-8 mt-5 bg-white ring-1 ring-amber-200 shadow-[0_4px_20px_rgba(251,191,36,0.18)] rounded-2xl px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="text-amber-500 text-xl mt-0.5 flex-shrink-0">✨</span>
        <p className="flex-1 text-slate-700 text-sm font-semibold leading-snug">
          【受給チャンス】厨房助成金の申請期限が近づいています。未受給の金額を確認してください。
        </p>
        <button onClick={onClose}
          className="flex-shrink-0 text-slate-300 hover:text-slate-500 text-lg leading-none mt-0.5 transition-colors">
          ✕
        </button>
      </div>
      <button onClick={onOpen}
        className="mt-3 w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all active:scale-95 shadow-[0_2px_8px_rgba(251,191,36,0.35)]">
        未受給の金額を確認する →
      </button>
    </div>
  );
}
