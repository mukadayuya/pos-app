import Link from "next/link";

/**
 * Role Demo Page
 *
 * Shows three styled links that demonstrate the ?role= URL parameter
 * for the FLOWS POS register page.
 *
 * Access at: /role-demo
 */
export default function RoleDemoPage() {
  const cards = [
    {
      role: "handy",
      href: "/register?role=handy",
      label: "スタッフ用 POS",
      sublabel: "Staff Handy POS",
      description: "フルレイアウト。注文・会計・割引・保留のすべての機能が使えます。",
      icon: "🖥️",
      color: "from-violet-500 to-indigo-600",
      ring: "ring-violet-400/40",
      badge: "?role=handy",
      badgeBg: "bg-violet-900/60 text-violet-200",
    },
    {
      role: "table",
      href: "/register?role=table",
      label: "テーブル用タブレット",
      sublabel: "Table Tablet View",
      description: "お客様向けメニュー閲覧専用。注文はスタッフへ。",
      icon: "📱",
      color: "from-emerald-500 to-teal-600",
      ring: "ring-emerald-400/40",
      badge: "?role=table",
      badgeBg: "bg-emerald-900/60 text-emerald-200",
    },
    {
      role: "mobile",
      href: "/register?role=mobile",
      label: "モバイル最適化",
      sublabel: "Mobile Optimized",
      description: "縦型・シングルコラムレイアウト。ボトムタブでメニューと注文を切り替え。",
      icon: "📲",
      color: "from-amber-400 to-orange-500",
      ring: "ring-amber-400/40",
      badge: "?role=mobile",
      badgeBg: "bg-amber-900/60 text-amber-200",
    },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6 py-16 gap-10">
      {/* ヘッダー */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[14px] flex items-center justify-center shadow-[0_4px_20px_rgba(99,102,241,0.5)]">
            <span className="text-white text-sm font-black tracking-tight">FL</span>
          </div>
          <div className="text-left leading-none">
            <p className="text-2xl font-black text-white tracking-tight">FLOWS</p>
            <p className="text-[11px] font-medium text-slate-400 tracking-[0.14em] uppercase mt-0.5">
              by Infotainment
            </p>
          </div>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          マルチデバイス対応デモ
        </h1>
        <p className="text-slate-400 text-sm max-w-md">
          <code className="text-indigo-300 font-mono">?role=</code> パラメータで、
          同じコードから異なるデバイス向けUIを切り替えられます。
        </p>
      </div>

      {/* カード群 */}
      <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-5">
        {cards.map(card => (
          <Link
            key={card.role}
            href={card.href}
            className={`group relative flex flex-col gap-5 rounded-3xl p-6 bg-slate-800 ring-2 ${card.ring}
              hover:ring-4 hover:-translate-y-1 hover:shadow-2xl
              transition-all duration-200 active:scale-[0.98]`}
          >
            {/* グラデーションアクセント */}
            <div className={`absolute inset-x-0 top-0 h-1 rounded-t-3xl bg-gradient-to-r ${card.color}`} />

            {/* アイコン */}
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center text-3xl shadow-lg`}>
              {card.icon}
            </div>

            {/* テキスト */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500 tracking-widest uppercase">
                {card.sublabel}
              </p>
              <h2 className="text-lg font-black text-white leading-tight">
                {card.label}
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                {card.description}
              </p>
            </div>

            {/* URLバッジ */}
            <div className="mt-auto">
              <span className={`inline-block px-3 py-1.5 rounded-xl font-mono text-xs font-semibold ${card.badgeBg}`}>
                {card.badge}
              </span>
            </div>

            {/* ホバー矢印 */}
            <span className="absolute bottom-5 right-5 text-slate-600 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-200 text-lg">
              →
            </span>
          </Link>
        ))}
      </div>

      {/* フッター */}
      <p className="text-slate-600 text-xs text-center">
        パラメータなし（
        <Link href="/register" className="text-slate-400 hover:text-white underline underline-offset-2 transition-colors">
          /register
        </Link>
        ）はデフォルトで{" "}
        <code className="text-indigo-400 font-mono">handy</code> と同じ動作です
      </p>
    </div>
  );
}
