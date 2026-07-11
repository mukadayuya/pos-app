"use client";

// プリンター機器管理画面
// 店舗にレシートプリンターを登録・削除する。CloudPRNTポーリング先URLは
// この画面で発行して、プリンター本体のWebコンソールから設定してもらう。

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { STORE_ID } from "@/lib/db";
import { normalizePrinterMac, formatPrinterMac } from "@/lib/printer/mac";

type Device = {
  mac_address: string;
  name: string | null;
  model: string | null;
  status: string | null;
  status_msg: string | null;
  last_seen_at: string | null;
  created_at: string;
};

const MODELS = [
  { id: "mPOP",       label: "Star mPOP（Bluetooth+Wi-Fi統合機）" },
  { id: "TSP143",     label: "Star TSP143 (LAN)" },
  { id: "TM-m30III",  label: "EPSON TM-m30III" },
  { id: "TM-T88VII",  label: "EPSON TM-T88VII" },
  { id: "other",      label: "その他" },
];

export default function PrintersSettingsPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [loading, setLoading]   = useState(true);
  const [macInput, setMacInput] = useState("");
  const [name, setName]         = useState("");
  const [model, setModel]       = useState("mPOP");
  const [error, setError]       = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("printer_devices")
      .select("mac_address, name, model, status, status_msg, last_seen_at, created_at")
      .eq("store_id", STORE_ID)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDevices((data ?? []) as Device[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addDevice() {
    setError(null);
    const mac = normalizePrinterMac(macInput);
    if (!mac) { setError("MACアドレスは 12桁の16進数（例 0011623AB4CD）で入力してください"); return; }
    if (!supabase) { setError("Supabase未設定"); return; }
    setSaving(true);
    const { error } = await supabase.from("printer_devices").insert({
      mac_address: mac,
      store_id:    STORE_ID,
      name:        name || null,
      model:       model || null,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setMacInput(""); setName(""); setModel("mPOP");
    await load();
  }

  async function removeDevice(mac: string) {
    if (!supabase) return;
    if (!confirm(`このプリンター（${formatPrinterMac(mac)}）を削除しますか？`)) return;
    const { error } = await supabase.from("printer_devices").delete().eq("mac_address", mac);
    if (error) { setError(error.message); return; }
    await load();
  }

  const [testing, setTesting] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<{ mac: string; text: string; ok: boolean } | null>(null);

  async function testPrint(mac: string) {
    setTesting(mac);
    setTestMsg(null);
    try {
      const res = await fetch("/api/print/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: STORE_ID,
          kind: "test",
          targetMac: mac,
          receipt: {
            storeName: "🖨️ テスト印刷",
            createdAt: new Date().toISOString(),
            lines: [
              { name: "接続テスト", qty: 1, unitPriceTaxIncl: 0, taxRate: 0 },
            ],
            subtotalTaxIncl: 0,
            totalTaxIncl: 0,
            footerNote: "この用紙が印刷されれば設定OKです",
            columns: 42,
          },
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        setTestMsg({ mac, text: `失敗: ${msg}`, ok: false });
      } else {
        const j = await res.json();
        setTestMsg({ mac, text: `キュー投入OK (jobId=${j.jobId?.slice(0, 8)}…). 数秒以内に印刷されます。`, ok: true });
      }
    } catch (e) {
      setTestMsg({ mac, text: `エラー: ${(e as Error).message}`, ok: false });
    } finally {
      setTesting(null);
    }
  }

  const cloudPrntUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/print/cloudprnt`
    : "https://[このアプリのURL]/api/print/cloudprnt";

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Link href="/settings" className="text-slate-600 text-sm">← 設定</Link>
        <h1 className="text-lg font-bold text-slate-900">プリンター機器管理</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 使い方 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-base font-bold text-slate-800 mb-3">🖨️ セットアップ手順</h2>
          <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
            <li>プリンター本体の背面にある MAC アドレスを確認（12桁の16進数）</li>
            <li>下のフォームから MAC・表示名・機種を登録</li>
            <li>プリンター本体の Web コンソールで <b>CloudPRNT</b> を有効化し、
              サーバーURLを次の値に設定：
              <div className="mt-2 bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs break-all select-all">
                {cloudPrntUrl}
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                （ポーリング間隔は 5〜10 秒を推奨）
              </span>
            </li>
            <li>プリンターがオンラインになると下の一覧に自動で
              「最終応答」時刻が更新されます</li>
          </ol>
        </section>

        {/* 登録フォーム */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-base font-bold text-slate-800 mb-3">新規登録</h2>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-slate-600 font-semibold">MACアドレス（必須）</span>
              <input
                type="text"
                value={macInput}
                onChange={e => setMacInput(e.target.value)}
                placeholder="00:11:62:3A:B4:CD または 0011623AB4CD"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-600 font-semibold">表示名（任意）</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例：レジ横mPOP"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-600 font-semibold">機種</span>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-slate-500"
              >
                {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              onClick={addDevice}
              disabled={saving}
              className="w-full h-11 bg-slate-900 hover:bg-slate-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm active:scale-95"
            >
              {saving ? "登録中…" : "登録する"}
            </button>
          </div>
        </section>

        {/* 一覧 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-base font-bold text-slate-800 mb-3">登録済みプリンター</h2>
          {loading ? (
            <p className="text-sm text-slate-400">読み込み中…</p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-slate-500">まだプリンターが登録されていません。</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {devices.map(d => (
                <li key={d.mac_address} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">
                      {d.name || "（名称未設定）"} <span className="text-xs text-slate-400 font-normal">/ {d.model || "?"}</span>
                    </p>
                    <p className="text-xs text-slate-500 font-mono">{formatPrinterMac(d.mac_address)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      最終応答: {d.last_seen_at
                        ? new Date(d.last_seen_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
                        : "未検出"}
                      {d.status_msg ? `｜${d.status_msg}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <button
                      onClick={() => testPrint(d.mac_address)}
                      disabled={testing === d.mac_address}
                      className="text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-xs font-bold px-3 py-1 rounded-lg"
                    >
                      {testing === d.mac_address ? "投入中…" : "🖨️ テスト印刷"}
                    </button>
                    <button
                      onClick={() => removeDevice(d.mac_address)}
                      className="text-red-500 hover:text-red-700 text-xs font-bold px-3 py-1"
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {testMsg && (
            <p className={`text-xs mt-3 ${testMsg.ok ? "text-emerald-700" : "text-red-600"}`}>
              [{formatPrinterMac(testMsg.mac)}] {testMsg.text}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
