"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [storeName, setStoreName]           = useState("Kitchen Kazu");
  const [storeAddress, setStoreAddress]     = useState("");
  const [storeTel, setStoreTel]             = useState("");
  const [invoiceNumber, setInvoiceNumber]   = useState("");
  const [logoDataUrl, setLogoDataUrl]       = useState<string | null>(null);
  const [btStatus, setBtStatus]             = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [btDevice, setBtDevice]             = useState("mPOP-xxxxxxx");
  const [saved, setSaved]                   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStoreName(localStorage.getItem("store_name")        || "Kitchen Kazu");
    setStoreAddress(localStorage.getItem("store_address")  || "");
    setStoreTel(localStorage.getItem("store_tel")          || "");
    setInvoiceNumber(localStorage.getItem("invoice_number") || "");
    setLogoDataUrl(localStorage.getItem("receipt_logo")    || null);
  }, []);

  const handleSave = () => {
    localStorage.setItem("store_name",      storeName);
    localStorage.setItem("store_address",  storeAddress);
    localStorage.setItem("store_tel",      storeTel);
    localStorage.setItem("invoice_number", invoiceNumber);
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
    if (btStatus === "connected") {
      setBtStatus("disconnected");
      return;
    }
    setBtStatus("connecting");
    setTimeout(() => {
      setBtStatus("connected");
      setBtDevice("mPOP-KK8823");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white text-sm transition-colors">← HOME</Link>
          <span className="text-slate-600">|</span>
          <span className="text-xl">⚙️</span>
          <h1 className="text-lg font-bold">設定 / 点検・精算</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">

        {/* 店舗情報 */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">店舗情報（レシート表示）</h2>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">店舗名</label>
              <input
                type="text"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">住所</label>
              <input
                type="text"
                value={storeAddress}
                onChange={e => setStoreAddress(e.target.value)}
                placeholder="例：岐阜県高山市○○町1-2-3"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">電話番号</label>
              <input
                type="text"
                value={storeTel}
                onChange={e => setStoreTel(e.target.value)}
                placeholder="例：0577-00-0000"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                インボイス登録番号
                <span className="ml-2 text-xs font-normal text-slate-500">（領収書に印字）</span>
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="例：T1234567890123"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-600 font-mono"
              />
            </div>
            <button
              onClick={handleSave}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                saved ? "bg-emerald-600 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}
            >
              {saved ? "✓ 保存しました" : "保存する"}
            </button>
          </div>
        </section>

        {/* ロゴ */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">レシートロゴ（社印）</h2>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-4">
            {logoDataUrl ? (
              <div className="flex flex-col items-center gap-3">
                <img src={logoDataUrl} alt="ロゴ" className="max-h-24 max-w-xs object-contain rounded-lg bg-white p-2" />
                <button
                  onClick={() => { setLogoDataUrl(null); localStorage.removeItem("receipt_logo"); }}
                  className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                >
                  🗑️ ロゴを削除
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-slate-900/50 transition-all"
              >
                <p className="text-3xl mb-2">🖼️</p>
                <p className="text-slate-400 text-sm">クリックして画像を選択</p>
                <p className="text-slate-600 text-xs mt-1">PNG, JPG（最大2MB）</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            {!logoDataUrl && (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-semibold transition-all"
              >
                📁 ファイルを選択
              </button>
            )}
          </div>
        </section>

        {/* Star mPOP Bluetooth */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">ハードウェア連携</h2>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                  btStatus === "connected" ? "bg-emerald-900" : "bg-slate-700"
                }`}>
                  🖨️
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">スター精密 mPOP</p>
                  <p className="text-xs text-slate-400">レシートプリンター / キャッシュドロワー</p>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                btStatus === "connected"
                  ? "bg-emerald-900 text-emerald-400"
                  : btStatus === "connecting"
                  ? "bg-amber-900 text-amber-400"
                  : "bg-slate-700 text-slate-400"
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  btStatus === "connected" ? "bg-emerald-400" : btStatus === "connecting" ? "bg-amber-400 animate-pulse" : "bg-slate-500"
                }`} />
                {btStatus === "connected" ? "接続済み" : btStatus === "connecting" ? "接続中..." : "未接続"}
              </div>
            </div>

            {btStatus === "connected" && (
              <div className="bg-slate-900 rounded-xl px-4 py-3 text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>デバイス名</span>
                  <span className="text-white font-mono">{btDevice}</span>
                </div>
                <div className="flex justify-between">
                  <span>通信方式</span>
                  <span className="text-white">Bluetooth LE</span>
                </div>
                <div className="flex justify-between">
                  <span>ペーパー幅</span>
                  <span className="text-white">58mm</span>
                </div>
              </div>
            )}

            <button
              onClick={handleBluetooth}
              disabled={btStatus === "connecting"}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
                btStatus === "connected"
                  ? "bg-red-900 hover:bg-red-800 text-red-300"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}
            >
              {btStatus === "connecting" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> 接続中...
                </span>
              ) : btStatus === "connected" ? (
                "切断する"
              ) : (
                "🔵 Bluetoothで接続"
              )}
            </button>

            <p className="text-xs text-slate-600 text-center">
              ※ これはモック画面です。実際のBluetooth接続には専用SDK連携が必要です。
            </p>
          </div>
        </section>

        {/* 点検・精算 */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">点検 / 精算</h2>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-3">
            <p className="text-xs text-slate-400">レジの点検・精算レポートを印刷します。</p>
            <div className="flex gap-3">
              <button
                onClick={() => window.open("/admin/sales", "_blank")}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-semibold transition-all active:scale-95"
              >
                📋 点検（売上確認）
              </button>
              <button
                onClick={() => alert("精算レポートを印刷します（mPOP接続時に有効）")}
                className="flex-1 py-3 bg-violet-700 hover:bg-violet-600 text-white rounded-xl text-sm font-semibold transition-all active:scale-95"
              >
                🖨️ 精算レポート印刷
              </button>
            </div>
          </div>
        </section>

        {/* バージョン情報 */}
        <div className="text-center text-slate-700 text-xs pb-4">
          Kitchen Kazu POS v2.0 · Powered by Next.js + Supabase
        </div>
      </main>
    </div>
  );
}
