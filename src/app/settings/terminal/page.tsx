"use client";

// Stripe Terminal 接続テスト画面（Phase 4-⑮）
// 実機到着時のセルフチェック用。実際のレジ画面統合前の接続確認。

import { useState } from "react";
import Link from "next/link";
import {
  connectFirstAvailableReader,
  chargeViaTerminal,
  getReaderStatus,
} from "@/lib/stripeTerminal";

export default function TerminalSettingsPage() {
  const [connecting, setConnecting] = useState(false);
  const [reader, setReader] = useState<{ connected: boolean; label?: string }>({ connected: false });
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [testAmount, setTestAmount] = useState("100");
  const [testing, setTesting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectFirstAvailableReader();
      setReader(getReaderStatus());
      setFlash("✓ リーダーに接続しました");
      setTimeout(() => setFlash(null), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  const handleTestCharge = async () => {
    setTesting(true);
    setError(null);
    setFlash(null);
    const amount = Math.max(50, Number(testAmount) || 100);
    const result = await chargeViaTerminal(amount, "Terminal接続テスト", { test: "true" });
    if (result.success) {
      setFlash(`✓ テスト決済成功: ${result.paymentIntentId}`);
    } else {
      setError(result.error);
    }
    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/settings" className="text-slate-600 text-sm">← 設定</Link>
          <h1 className="text-lg font-bold text-slate-900">💳 Stripe Terminal 接続テスト</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
          <p className="font-bold mb-1">🛠️ 実機到着後にご利用ください</p>
          <p>Stripe Terminal 対応リーダー（WisePOS E / iPhone Tap to Pay）が必要です。
          Wi-Fi接続とStripeダッシュボードでのリーダー登録が完了している必要があります。</p>
        </div>

        {/* リーダー接続 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">1. カードリーダーに接続</h2>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${reader.connected ? "bg-emerald-500" : "bg-slate-300"}`} />
            <p className="text-sm">
              {reader.connected
                ? <>接続中: <b>{reader.label}</b></>
                : "未接続"}
            </p>
          </div>
          <button onClick={handleConnect} disabled={connecting}
            className="w-full py-3 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold">
            {connecting ? "探索中…" : reader.connected ? "🔄 再接続" : "🔍 リーダーを探して接続"}
          </button>
        </div>

        {/* テスト決済 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">2. テスト決済（¥50〜）</h2>
          <label className="block">
            <span className="text-xs text-slate-500">テスト金額（円）</span>
            <input type="number" value={testAmount} onChange={e => setTestAmount(e.target.value)}
              min={50} placeholder="100"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none tabular-nums" />
          </label>
          <button onClick={handleTestCharge} disabled={testing || !reader.connected}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold">
            {testing ? "処理中…（リーダーにカードをタッチ）" : "💳 テスト決済実行"}
          </button>
        </div>

        {flash && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
            {flash}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* 設定手順 */}
        <details className="bg-white rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">
            📖 設定手順（初回のみ）
          </summary>
          <ol className="mt-3 space-y-2 text-xs text-slate-600 list-decimal list-inside">
            <li>Stripe ダッシュボード → Terminal → リーダーを登録</li>
            <li>登録コード（3語）をリーダーで入力</li>
            <li>リーダーを Wi-Fi に接続</li>
            <li>Vercel 環境変数 STRIPE_SECRET_KEY を設定</li>
            <li>本ページで「リーダーを探して接続」を押す</li>
            <li>テスト決済で動作確認</li>
            <li>成功したらレジ画面から Terminal 決済を選べるようになります</li>
          </ol>
          <div className="mt-3 p-3 bg-slate-50 rounded-lg text-[10px] text-slate-500">
            <p className="font-bold mb-1">シミュレータで試す場合:</p>
            <p>環境変数 <code>NEXT_PUBLIC_STRIPE_TERMINAL_SIMULATED=true</code> を追加すると
            仮想リーダー（テスト用）で動作します。</p>
          </div>
        </details>
      </main>
    </div>
  );
}
