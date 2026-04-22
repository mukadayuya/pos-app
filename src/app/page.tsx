"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SubsidyWizardModal from "@/components/SubsidyWizardModal";

const LS_BANNER_DISMISSED = "subsidy_banner_dismissed_at";
const LS_BOT_VISITED = "subsidy_bot_visited";
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const tiles = [
  {
    label: "レジ",
    icon: "🧾",
    href: "/register",
    bg: "bg-indigo-600 hover:bg-indigo-500",
    available: true,
  },
  {
    label: "点検 / 精算",
    icon: "🖨️",
    href: "/settings",
    bg: "bg-slate-700 hover:bg-slate-600",
    available: true,
  },
  {
    label: "売上データ",
    icon: "📊",
    href: "/sales-data",
    bg: "bg-violet-700 hover:bg-violet-600",
    available: true,
  },
  {
    label: "入出金管理",
    icon: "💵",
    href: "#",
    bg: "bg-slate-700 hover:bg-slate-600",
    available: false,
  },
  {
    label: "商品管理",
    icon: "🍽️",
    href: "/product-management",
    bg: "bg-teal-700 hover:bg-teal-600",
    available: true,
  },
  {
    label: "クーポン・\n割引設定",
    icon: "🏷️",
    href: "#",
    bg: "bg-slate-700 hover:bg-slate-600",
    available: false,
  },
];

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
  const [now, setNow] = useState(new Date());
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
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const timeStr = now.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <SubsidyWizardModal
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleBotVisited}
      />

      {/* ヘッダー */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🍽️</span>
          <div>
            <h1 className="text-white text-xl font-bold tracking-wide leading-tight">
              Kitchen Kazu
            </h1>
            <p className="text-slate-500 text-xs">POS レジシステム</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-sm">{dateStr}</p>
          <p className="text-white text-2xl font-mono font-bold tracking-widest">
            {timeStr}
          </p>
        </div>
      </header>

      {/* 損失回避 通知バナー（15:00〜16:00、Bot遷移後は非表示、閉じたら3日後に再表示） */}
      {showBanner && (
        <SubsidyNotificationBanner
          onOpen={() => setShowWizard(true)}
          onClose={handleBannerClose}
        />
      )}

      {/* タイルグリッド */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="grid grid-cols-3 gap-5 w-full max-w-2xl">
          {tiles.map((tile) => {
            const inner = (
              <div
                className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl aspect-square w-full transition-all active:scale-95 ${tile.bg} ${
                  tile.available ? "shadow-lg cursor-pointer" : "opacity-40 cursor-not-allowed"
                }`}
              >
                <span className="text-5xl leading-none">{tile.icon}</span>
                <span className="text-white text-base font-bold text-center leading-snug whitespace-pre-line px-2">
                  {tile.label}
                </span>
                {!tile.available && (
                  <span className="absolute top-2.5 right-2.5 bg-slate-600 text-slate-300 text-xs px-1.5 py-0.5 rounded-md font-medium">
                    準備中
                  </span>
                )}
              </div>
            );

            return tile.available && tile.href !== "#" ? (
              <Link key={tile.label} href={tile.href}>
                {inner}
              </Link>
            ) : (
              <div key={tile.label}>{inner}</div>
            );
          })}
        </div>
      </main>

      <footer className="text-center py-4 text-slate-700 text-xs">
        Kitchen Kazu POS v2.0
      </footer>
    </div>
  );
}

function SubsidyNotificationBanner({
  onOpen,
  onClose,
}: {
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mx-6 mt-4 bg-gradient-to-r from-amber-950 to-orange-950 border border-amber-600 rounded-2xl px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="text-amber-400 text-xl mt-0.5 flex-shrink-0">⚠️</span>
        <p className="flex-1 text-amber-100 text-sm font-bold leading-snug">
          【4/22更新】厨房助成金の申請期限が近づいています。未受給の金額（想定）を確認してください。
        </p>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-amber-600 hover:text-amber-400 text-lg leading-none mt-0.5"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>
      <button
        onClick={onOpen}
        className="mt-3 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm rounded-xl transition-all active:scale-95"
      >
        未受給の金額を確認する →
      </button>
    </div>
  );
}
