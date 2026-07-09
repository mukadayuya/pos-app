"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase";
import { fetchDefaultStoreId } from "@/lib/adminDb";
import { fetchPeriodSummary, fetchTodayHourlySales, HourlySales } from "@/lib/db";

const IS_BRONCO = process.env.NEXT_PUBLIC_STORE_ID === "bronco";
const IS_ABC = process.env.NEXT_PUBLIC_STORE_ID === "yakitori-abc";
const IS_WARAJI = process.env.NEXT_PUBLIC_STORE_ID === "waraji";
const IS_SHOTEN = process.env.NEXT_PUBLIC_STORE_ID === "shoten";
const DEFAULT_STORE_NAME    = IS_BRONCO ? "メキシコダイニングレストラン ブロンコ" : IS_ABC ? "焼鳥居酒屋ABC" : IS_WARAJI ? "炭火やきとり 笑路" : IS_SHOTEN ? "居食屋 笑点" : "Kitchen Kazu";
const DEFAULT_STORE_ADDRESS = IS_BRONCO ? "東京都大田区田園調布1-21-5" : IS_ABC ? "東京都新宿区西新宿1-2-3 ABCビル1F" : IS_WARAJI ? "愛知県豊田市丸山町9丁目18" : IS_SHOTEN ? "愛知県豊田市" : "";
const DEFAULT_STORE_TEL     = IS_BRONCO ? "03-3722-3694" : IS_ABC ? "03-1234-5678" : IS_WARAJI ? "0565-42-8933" : IS_SHOTEN ? "" : "";

type SettingsTab    = "store" | "settlement" | "hardware";
type SettlementSub  = "inspect" | "cashcount" | "close";

const BILLS = [
  { label: "10,000円", value: 10000 },
  { label: " 5,000円", value: 5000  },
  { label: " 1,000円", value: 1000  },
  { label: "   500円", value: 500   },
  { label: "   100円", value: 100   },
  { label: "    50円", value: 50    },
  { label: "    10円", value: 10    },
  { label: "     5円", value: 5     },
  { label: "     1円", value: 1     },
];

function fmtYen(n: number) { return `¥${n.toLocaleString()}`; }

// ─── Mini hourly chart (reuse violet style) ───────────────────
function HourlyBar({ data }: { data: HourlySales[] }) {
  if (data.length === 0)
    return <p className="text-xs text-slate-400 text-center py-4">本日の売上データがありません</p>;
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="flex items-end gap-1 h-20 px-1 pb-1">
      {data.map(d => (
        <div key={d.hour} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
          <div className="w-full flex flex-col justify-end" style={{ height: "64px" }}>
            <div
              className="w-full bg-violet-500 rounded-t"
              style={{ height: `${Math.max(2, Math.round((d.total / max) * 64))}px` }}
              title={`${d.hour}時 ${fmtYen(d.total)}`}
            />
          </div>
          <span className="text-slate-400 font-mono" style={{ fontSize: "8px" }}>{d.hour}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab]       = useState<SettingsTab>("store");
  const [settleSub, setSettleSub]       = useState<SettlementSub>("inspect");

  // Store settings
  const [storeName, setStoreName]       = useState(DEFAULT_STORE_NAME);
  const [storeAddress, setStoreAddress] = useState(DEFAULT_STORE_ADDRESS);
  const [storeTel, setStoreTel]         = useState(DEFAULT_STORE_TEL);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [logoDataUrl, setLogoDataUrl]   = useState<string | null>(null);
  const [saved, setSaved]               = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hardware
  const [btStatus, setBtStatus]         = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [btDevice, setBtDevice]         = useState("mPOP-xxxxxxx");

  // Cash counter
  const [counts, setCounts]             = useState<Record<number, number>>(
    Object.fromEntries(BILLS.map(b => [b.value, 0]))
  );
  const cashTotal = BILLS.reduce((s, b) => s + b.value * (counts[b.value] ?? 0), 0);

  // Inspection data
  const [inspectLoading, setInspectLoading] = useState(false);
  const [todaySales, setTodaySales]         = useState<{ total: number; count: number; avgSpend: number } | null>(null);
  const [hourlyData, setHourlyData]         = useState<HourlySales[]>([]);

  useEffect(() => {
    setStoreName(localStorage.getItem("store_name")       || DEFAULT_STORE_NAME);
    setStoreAddress(localStorage.getItem("store_address") || DEFAULT_STORE_ADDRESS);
    setStoreTel(localStorage.getItem("store_tel")         || DEFAULT_STORE_TEL);
    setInvoiceNumber(localStorage.getItem("invoice_number") || "");
    setLogoDataUrl(localStorage.getItem("receipt_logo")   || null);
  }, []);

  const loadInspectData = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setInspectLoading(true);
    try {
      const sid = await fetchDefaultStoreId();
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const [summary, hourly] = await Promise.all([
        fetchPeriodSummary(todayStart, todayEnd),
        fetchTodayHourlySales(),
      ]);
      setTodaySales(summary);
      setHourlyData(hourly);
    } catch { /* ignore */ }
    finally { setInspectLoading(false); }
  }, []);

  // Load inspection data when that tab is first opened
  useEffect(() => {
    if (activeTab === "settlement" && settleSub === "inspect") loadInspectData();
  }, [activeTab, settleSub, loadInspectData]);

  const handleSave = () => {
    localStorage.setItem("store_name",      storeName);
    localStorage.setItem("store_address",   storeAddress);
    localStorage.setItem("store_tel",       storeTel);
    localStorage.setItem("invoice_number",  invoiceNumber);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      setLogoDataUrl(url);
      localStorage.setItem("receipt_logo", url);
    };
    reader.readAsDataURL(file);
  };

  const handleBluetooth = () => {
    if (btStatus === "connected") { setBtStatus("disconnected"); return; }
    setBtStatus("connecting");
    setTimeout(() => { setBtStatus("connected"); setBtDevice("mPOP-KK8823"); }, 2000);
  };

  const setCount = (val: number, delta: number) =>
    setCounts(prev => ({ ...prev, [val]: Math.max(0, (prev[val] ?? 0) + delta) }));

  const TABS: { key: SettingsTab; label: string; icon: string }[] = [
    { key: "store",      label: "店舗設定",  icon: "🏪" },
    { key: "settlement", label: "点検・精算", icon: "🖨️" },
    { key: "hardware",   label: "ハードウェア", icon: "🔵" },
  ];

  const SETTLE_SUBS: { key: SettlementSub; label: string }[] = [
    { key: "inspect",   label: "点検（売上確認）" },
    { key: "cashcount", label: "レジ金入力" },
    { key: "close",     label: "精算実行" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ─────────────────────────────────────── */}
      <header className="bg-violet-800 text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-violet-300 hover:text-white text-sm font-medium transition-colors">← HOME</Link>
            <div className="w-8 h-8 bg-white/20 rounded-[10px] flex items-center justify-center">
              <span className="text-[10px] font-black tracking-tight">FL</span>
            </div>
            <div className="leading-none">
              <p className="text-sm font-bold leading-tight">設定・点検・精算</p>
              <p className="text-[11px] text-violet-300 mt-0.5">{storeName} · FLOWS</p>
            </div>
          </div>
          <Link href="/register"
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all">
            🧾 レジへ
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6">

        {/* ── Horizontal tab bar ─────────────────────────── */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1.5 mb-6 shadow-sm">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === t.key
                  ? "bg-violet-700 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ════ 店舗設定 ════════════════════════════════════ */}
        {activeTab === "store" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">店舗情報（レシート表示）</h2>
              {[
                { label: "店舗名",       value: storeName,      set: setStoreName,      placeholder: DEFAULT_STORE_NAME },
                { label: "住所",         value: storeAddress,   set: setStoreAddress,   placeholder: DEFAULT_STORE_ADDRESS || "例：岐阜県高山市○○町1-2-3" },
                { label: "電話番号",     value: storeTel,       set: setStoreTel,       placeholder: DEFAULT_STORE_TEL || "例：0577-00-0000" },
                { label: "インボイス登録番号", value: invoiceNumber, set: setInvoiceNumber, placeholder: "例：T1234567890123" },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all placeholder-slate-400"
                  />
                </div>
              ))}
              <button
                onClick={handleSave}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  saved ? "bg-emerald-600 text-white" : "bg-violet-700 hover:bg-violet-600 text-white"
                }`}
              >
                {saved ? "✓ 保存しました" : "保存する"}
              </button>
            </div>

            {/* Logo */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">レシートロゴ（社印）</h2>
              {logoDataUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <img src={logoDataUrl} alt="ロゴ" className="max-h-24 max-w-xs object-contain rounded-lg bg-slate-50 p-2 border border-slate-200" />
                  <button
                    onClick={() => { setLogoDataUrl(null); localStorage.removeItem("receipt_logo"); }}
                    className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors"
                  >
                    🗑️ ロゴを削除
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 transition-all"
                >
                  <p className="text-3xl mb-2">🖼️</p>
                  <p className="text-slate-500 text-sm">クリックして画像を選択</p>
                  <p className="text-slate-400 text-xs mt-1">PNG, JPG（最大2MB）</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              {!logoDataUrl && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all"
                >
                  📁 ファイルを選択
                </button>
              )}
            </div>
          </div>
        )}

        {/* ════ 点検・精算 ══════════════════════════════════ */}
        {activeTab === "settlement" && (
          <div className="space-y-5">
            {/* Sub-tab pills */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              {SETTLE_SUBS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSettleSub(s.key)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    settleSub === s.key
                      ? "bg-violet-700 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* 点検 */}
            {settleSub === "inspect" && (
              <div className="space-y-4">
                {!isSupabaseConfigured ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm">
                    ⚠️ Supabase が未設定のため売上データを表示できません。
                  </div>
                ) : inspectLoading ? (
                  <div className="flex justify-center py-12 text-slate-400 gap-2">
                    <span className="animate-spin">⏳</span> 読込中…
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">本日売上</p>
                        <p className="text-2xl font-black text-violet-700 tabular-nums">{fmtYen(todaySales?.total ?? 0)}</p>
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">会計件数</p>
                        <p className="text-2xl font-black text-indigo-700 tabular-nums">{todaySales?.count ?? 0}<span className="text-sm font-normal text-slate-400 ml-1">件</span></p>
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">客単価</p>
                        <p className="text-2xl font-black text-emerald-700 tabular-nums">{fmtYen(todaySales?.avgSpend ?? 0)}</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">時間別売上</p>
                      <HourlyBar data={hourlyData} />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={loadInspectData}
                        className="flex-1 py-3 bg-violet-700 hover:bg-violet-600 text-white rounded-xl text-sm font-bold transition-all active:scale-95"
                      >
                        🔄 データを更新
                      </button>
                      <Link href="/sales-data"
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold text-center transition-all active:scale-95">
                        📊 詳細を見る →
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* レジ金入力 */}
            {settleSub === "cashcount" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="grid grid-cols-[1fr_100px_100px_120px] gap-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <span>紙幣・硬貨</span><span className="text-center">− 枚数 ＋</span><span className="text-right">金額</span><span className="text-right">小計</span>
                    </div>
                  </div>
                  {BILLS.map(b => (
                    <div key={b.value} className="grid grid-cols-[1fr_100px_100px_120px] gap-3 items-center px-5 py-3.5 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <p className="text-sm font-semibold text-slate-700 font-mono">{b.label}</p>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setCount(b.value, -1)}
                          className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-600 transition-colors"
                        >−</button>
                        <span className="w-8 text-center text-sm font-black tabular-nums text-slate-900">{counts[b.value] ?? 0}</span>
                        <button
                          onClick={() => setCount(b.value, +1)}
                          className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-600 transition-colors"
                        >＋</button>
                      </div>
                      <p className="text-xs text-right text-slate-400 font-mono">{fmtYen(b.value)}</p>
                      <p className="text-sm font-bold text-right tabular-nums text-slate-800 font-mono">
                        {fmtYen(b.value * (counts[b.value] ?? 0))}
                      </p>
                    </div>
                  ))}
                  <div className="px-5 py-4 bg-violet-50 flex items-center justify-between">
                    <p className="text-sm font-bold text-violet-800">レジ内現金 合計</p>
                    <p className="text-2xl font-black text-violet-700 tabular-nums">{fmtYen(cashTotal)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setCounts(Object.fromEntries(BILLS.map(b => [b.value, 0])))}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition-all"
                >
                  リセット
                </button>
              </div>
            )}

            {/* 精算実行 */}
            {settleSub === "close" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-600">精算サマリー</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-600">本日売上合計</span>
                      <span className="text-lg font-black text-violet-700 tabular-nums">{fmtYen(todaySales?.total ?? 0)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-600">レジ金合計（現金）</span>
                      <span className="text-lg font-black text-slate-800 tabular-nums">{fmtYen(cashTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 bg-slate-50 rounded-xl px-3">
                      <span className="text-sm font-bold text-slate-700">差異</span>
                      {(() => {
                        const diff = cashTotal - (todaySales?.total ?? 0);
                        return (
                          <span className={`text-lg font-black tabular-nums ${diff === 0 ? "text-emerald-600" : diff > 0 ? "text-blue-600" : "text-red-600"}`}>
                            {diff >= 0 ? "+" : ""}{fmtYen(diff)}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  {todaySales === null && isSupabaseConfigured && (
                    <p className="text-xs text-slate-400">※ 売上データを取得するには「点検」タブで更新してください。</p>
                  )}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs space-y-1">
                  <p className="font-bold">精算前チェックリスト</p>
                  <p>□ 未会計の伝票がないことを確認</p>
                  <p>□ キャッシュドロワーの現金を数え「レジ金入力」に入力</p>
                  <p>□ 過不足があれば原因を確認・記録</p>
                </div>
                <button
                  onClick={() => alert("精算レポートを印刷します（mPOP接続時に有効）")}
                  className="w-full py-4 bg-violet-700 hover:bg-violet-600 text-white rounded-2xl text-base font-bold transition-all active:scale-95 shadow-sm"
                >
                  🖨️ 精算レポートを印刷する
                </button>
                <p className="text-center text-slate-400 text-xs">
                  ※ Star精密 mPOP が Bluetooth 接続済みの場合のみ印刷されます
                </p>
              </div>
            )}
          </div>
        )}

        {/* ════ ハードウェア ════════════════════════════════ */}
        {activeTab === "hardware" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">ハードウェア連携</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                    btStatus === "connected" ? "bg-emerald-100" : "bg-slate-100"
                  }`}>
                    🖨️
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">スター精密 mPOP</p>
                    <p className="text-xs text-slate-400">レシートプリンター / キャッシュドロワー</p>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                  btStatus === "connected"
                    ? "bg-emerald-100 text-emerald-700"
                    : btStatus === "connecting"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-500"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    btStatus === "connected" ? "bg-emerald-500" : btStatus === "connecting" ? "bg-amber-500 animate-pulse" : "bg-slate-400"
                  }`} />
                  {btStatus === "connected" ? "接続済み" : btStatus === "connecting" ? "接続中..." : "未接続"}
                </div>
              </div>

              {btStatus === "connected" && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500 space-y-2">
                  <div className="flex justify-between">
                    <span>デバイス名</span><span className="font-mono text-slate-700 font-semibold">{btDevice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>通信方式</span><span className="text-slate-700 font-semibold">Bluetooth LE</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ペーパー幅</span><span className="text-slate-700 font-semibold">58mm</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleBluetooth}
                disabled={btStatus === "connecting"}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
                  btStatus === "connected"
                    ? "bg-red-100 hover:bg-red-200 text-red-700"
                    : "bg-violet-700 hover:bg-violet-600 text-white"
                }`}
              >
                {btStatus === "connecting" ? (
                  <span className="flex items-center justify-center gap-2"><span className="animate-spin">⏳</span> 接続中...</span>
                ) : btStatus === "connected" ? "切断する" : "🔵 Bluetoothで接続"}
              </button>

              <p className="text-xs text-slate-400 text-center">
                ※ これはモック画面です。実際のBluetooth接続には専用SDK連携が必要です。
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-slate-300 text-xs">
          {IS_BRONCO ? "ブロンコ POS · Powered by FLOWS" : IS_ABC ? "焼鳥居酒屋ABC POS · Powered by FLOWS" : IS_WARAJI ? "笑路 POS · Powered by FLOWS" : IS_SHOTEN ? "笑点 POS · Powered by FLOWS" : "Kitchen Kazu POS v2.0 · Powered by FLOWS"}
        </div>
      </div>
    </div>
  );
}
