"use client";

// オンボーディングウィザード（Phase 5-⑰）
// 新規契約店舗のセットアップフロー。
// 4ステップ: 店舗情報→初回スタッフ→補助金プロフィール→完了

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { saveStoreProfile, fetchStoreProfile, DEFAULT_PROFILE, type StoreProfile } from "@/lib/subsidies";
import { fetchActiveStaff, createStaff } from "@/lib/attendance";

const STEPS = [
  { id: 1, title: "店舗情報", icon: "🏪" },
  { id: 2, title: "スタッフ", icon: "👥" },
  { id: 3, title: "補助金診断", icon: "💰" },
  { id: 4, title: "完了", icon: "🎉" },
];

const INDUSTRIES = ["飲食業", "小売業", "サービス業", "宿泊業", "製造業"];
const PREFECTURES = ["東京都", "神奈川県", "愛知県", "大阪府", "京都府", "福岡県", "北海道", "宮城県", "その他"];

interface StoreInfo {
  storeName: string;
  storeAddress: string;
  storeTel: string;
  invoiceNumber: string;
}

export default function OnboardingPage() {
  const [step, setStep]                     = useState(1);
  const [storeInfo, setStoreInfo]           = useState<StoreInfo>({
    storeName: "", storeAddress: "", storeTel: "", invoiceNumber: "",
  });
  const [staffName, setStaffName]           = useState("");
  const [staffWage, setStaffWage]           = useState("1200");
  const [profile, setProfile]               = useState<StoreProfile>(DEFAULT_PROFILE);
  const [existingStaffCount, setStaffCount] = useState(0);
  const [busy, setBusy]                     = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStoreInfo({
      storeName:     localStorage.getItem("store_name")     ?? "",
      storeAddress:  localStorage.getItem("store_address")  ?? "",
      storeTel:      localStorage.getItem("store_tel")      ?? "",
      invoiceNumber: localStorage.getItem("invoice_number") ?? "",
    });
    void (async () => {
      const p = await fetchStoreProfile();
      setProfile(p);
      const staff = await fetchActiveStaff();
      setStaffCount(staff.length);
    })();
  }, []);

  const saveStore = useCallback(() => {
    localStorage.setItem("store_name",      storeInfo.storeName);
    localStorage.setItem("store_address",   storeInfo.storeAddress);
    localStorage.setItem("store_tel",       storeInfo.storeTel);
    localStorage.setItem("invoice_number",  storeInfo.invoiceNumber);
  }, [storeInfo]);

  const saveStaff = useCallback(async () => {
    if (!staffName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createStaff({
        name: staffName.trim(),
        role: "店長",
        hourly_wage: Number(staffWage) || 1200,
        color: "#22c55e",
        pin: null,
        is_active: true,
        note: "オンボーディングで自動作成",
      });
      setStaffName("");
      const staff = await fetchActiveStaff();
      setStaffCount(staff.length);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }, [staffName, staffWage]);

  const saveProfileStep = useCallback(async () => {
    setBusy(true);
    setError(null);
    try { await saveStoreProfile(profile); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }, [profile]);

  const next = async () => {
    if (step === 1) saveStore();
    if (step === 3) await saveProfileStep();
    setStep(s => Math.min(4, s + 1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Progress */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {STEPS.map(s => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s.id ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
              }`}>
                {step > s.id ? "✓" : s.id}
              </div>
              <span className={`text-xs font-bold hidden sm:inline ${step >= s.id ? "text-slate-800" : "text-slate-400"}`}>
                {s.icon} {s.title}
              </span>
              {s.id < STEPS.length && (
                <div className={`flex-1 h-0.5 ${step > s.id ? "bg-emerald-500" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Step 1 */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">STEP 1/4</p>
              <h1 className="text-2xl font-black text-slate-900 mt-1">🏪 お店の基本情報</h1>
              <p className="text-sm text-slate-500 mt-2">
                レシート・領収書に印字される情報です。後から変更できます。
              </p>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-700">店舗名 <span className="text-red-500">*</span></span>
                <input value={storeInfo.storeName}
                  onChange={e => setStoreInfo(s => ({ ...s, storeName: e.target.value }))}
                  placeholder="例: 居酒屋 やまだ"
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-300 text-base outline-none focus:border-emerald-500" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">住所</span>
                <input value={storeInfo.storeAddress}
                  onChange={e => setStoreInfo(s => ({ ...s, storeAddress: e.target.value }))}
                  placeholder="例: 東京都新宿区西新宿1-1-1"
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-300 text-base outline-none focus:border-emerald-500" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">電話番号</span>
                <input value={storeInfo.storeTel}
                  onChange={e => setStoreInfo(s => ({ ...s, storeTel: e.target.value }))}
                  placeholder="03-1234-5678"
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-300 text-base outline-none focus:border-emerald-500" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">適格請求書発行事業者登録番号</span>
                <input value={storeInfo.invoiceNumber}
                  onChange={e => setStoreInfo(s => ({ ...s, invoiceNumber: e.target.value }))}
                  placeholder="T1234567890123（インボイス登録済みの場合）"
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-300 text-base outline-none focus:border-emerald-500 font-mono" />
              </label>
            </div>
            <button onClick={next} disabled={!storeInfo.storeName.trim()}
              className="w-full mt-6 py-4 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-2xl text-base font-black active:scale-95">
              次へ →
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">STEP 2/4</p>
              <h1 className="text-2xl font-black text-slate-900 mt-1">👥 最初のスタッフを登録</h1>
              <p className="text-sm text-slate-500 mt-2">
                勤怠・レジ担当者として使います。まずは店長（あなた）から。後で追加できます。
              </p>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-700">氏名</span>
                <input value={staffName} onChange={e => setStaffName(e.target.value)}
                  placeholder="例: 山田太郎"
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-300 text-base outline-none focus:border-emerald-500" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">時給（円）</span>
                <input type="number" value={staffWage} onChange={e => setStaffWage(e.target.value)}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-300 text-base outline-none focus:border-emerald-500 tabular-nums" />
              </label>
              {existingStaffCount > 0 && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  ✓ 現在 {existingStaffCount} 名のスタッフが登録されています。
                </p>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button onClick={saveStaff} disabled={busy || !staffName.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold">
                + このスタッフを登録
              </button>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => setStep(1)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold">
                ← 戻る
              </button>
              <button onClick={next}
                className="flex-[2] py-3 bg-slate-900 hover:bg-slate-700 text-white rounded-xl text-sm font-bold">
                {existingStaffCount > 0 ? "次へ →" : "スキップして次へ →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">STEP 3/4</p>
              <h1 className="text-2xl font-black text-slate-900 mt-1">💰 補助金診断のための情報</h1>
              <p className="text-sm text-slate-500 mt-2">
                お店で使える補助金を自動判定するための情報です。
                <b className="text-emerald-700">最大1,000万円以上</b>の補助金が見つかることも。
              </p>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-700">業種</span>
                <select value={profile.industry}
                  onChange={e => setProfile(p => ({ ...p, industry: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-300 text-base outline-none focus:border-emerald-500">
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">従業員数（アルバイト含む）</span>
                <input type="number" min={1} value={profile.employee_count}
                  onChange={e => setProfile(p => ({ ...p, employee_count: Number(e.target.value) || 1 }))}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-300 text-base outline-none focus:border-emerald-500 tabular-nums" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">都道府県</span>
                <select value={profile.prefecture ?? ""}
                  onChange={e => setProfile(p => ({ ...p, prefecture: e.target.value || null }))}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-300 text-base outline-none focus:border-emerald-500">
                  <option value="">選択してください</option>
                  {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">資本金（万円・任意）</span>
                <input type="number" min={0} value={profile.capital ?? ""}
                  onChange={e => setProfile(p => ({ ...p, capital: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="個人事業主は空欄でOK"
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-300 text-base outline-none focus:border-emerald-500 tabular-nums" />
              </label>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => setStep(2)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold">
                ← 戻る
              </button>
              <button onClick={next} disabled={busy}
                className="flex-[2] py-3 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold">
                {busy ? "保存中…" : "次へ →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">セットアップ完了！</h1>
            <p className="text-sm text-slate-600 mb-8">
              FLOWS POS へようこそ。<br />
              次にやることを選んでください。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/product-management" className="bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 rounded-2xl p-4 transition-all active:scale-95">
                <div className="text-3xl mb-2">🍽️</div>
                <p className="text-sm font-bold text-slate-800">メニューを登録</p>
                <p className="text-[10px] text-slate-500 mt-1">商品と価格を追加</p>
              </Link>
              <Link href="/subsidies" className="bg-amber-50 hover:bg-amber-100 border-2 border-amber-200 rounded-2xl p-4 transition-all active:scale-95">
                <div className="text-3xl mb-2">💰</div>
                <p className="text-sm font-bold text-slate-800">補助金を確認</p>
                <p className="text-[10px] text-slate-500 mt-1">利用可能な補助金一覧</p>
              </Link>
              <Link href="/settings/printers" className="bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-2xl p-4 transition-all active:scale-95">
                <div className="text-3xl mb-2">🖨️</div>
                <p className="text-sm font-bold text-slate-800">プリンターを設定</p>
                <p className="text-[10px] text-slate-500 mt-1">Star mPOP など</p>
              </Link>
              <Link href="/" className="bg-slate-900 hover:bg-slate-700 text-white rounded-2xl p-4 transition-all active:scale-95">
                <div className="text-3xl mb-2">🏠</div>
                <p className="text-sm font-bold">ホームへ</p>
                <p className="text-[10px] opacity-70 mt-1">POSを使い始める</p>
              </Link>
            </div>
            <a href="https://www.instagram.com/yuya_mukada/" target="_blank" rel="noopener noreferrer"
              className="mt-6 inline-block text-xs text-emerald-700 underline">
              📱 わからないことは Instagram で相談
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
