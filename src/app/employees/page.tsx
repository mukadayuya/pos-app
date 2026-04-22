"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
interface SubsidyWizardAnswers {
  hasEmployees: boolean;
  hasInsurance: boolean;
  hasEquipmentInvestment: boolean;
  estimatedAmount: number;
}

interface EmployeeRecord {
  id: string;
  name: string;
  type: "fulltime" | "parttime";
  weeklyHours: string;
  hasInsurance: boolean;
  joinedAt: string;
}

const LS_EMPLOYEES = "pos_employees";

function loadEmployees(): EmployeeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_EMPLOYEES);
    return raw ? (JSON.parse(raw) as EmployeeRecord[]) : [];
  } catch {
    return [];
  }
}

function saveEmployees(list: EmployeeRecord[]): void {
  if (typeof window !== "undefined")
    localStorage.setItem(LS_EMPLOYEES, JSON.stringify(list));
}

const SUBSIDY_ITEMS = [
  {
    key: "キャリアアップ助成金",
    condition: (w: SubsidyWizardAnswers) => w.hasEmployees && w.hasInsurance,
    amount: 570_000,
    desc: "パートタイム労働者を正社員化することで受給できます",
    link: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html",
  },
  {
    key: "雇用調整助成金",
    condition: (w: SubsidyWizardAnswers) => w.hasEmployees,
    amount: 300_000,
    desc: "経営悪化時に雇用を維持した際の助成金です",
    link: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/pageL07.html",
  },
  {
    key: "IT導入補助金",
    condition: (w: SubsidyWizardAnswers) => w.hasEquipmentInvestment,
    amount: 450_000,
    desc: "ITツール・設備購入費用の最大2/3を補助します",
    link: "https://www.it-hojo.jp/",
  },
];

function blank(): EmployeeRecord {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "parttime",
    weeklyHours: "",
    hasInsurance: false,
    joinedAt: "",
  };
}

export default function EmployeesPage() {
  const [wizard, setWizard] = useState<SubsidyWizardAnswers | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EmployeeRecord>(blank());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    //setWizard(loadWizardAnswers());
    //setEmployees(loadEmployees());
  }, []);

  const eligibleSubsidies = wizard
    ? SUBSIDY_ITEMS.filter(s => s.condition(wizard))
    : [];

  const handleSave = () => {
    if (!form.name.trim()) return;
    const next = [...employees, form];
    setEmployees(next);
    saveEmployees(next);
    setForm(blank());
    setShowForm(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDelete = (id: string) => {
    const next = employees.filter(e => e.id !== id);
    setEmployees(next);
    saveEmployees(next);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="flex items-center gap-3 px-6 py-4 bg-slate-900 border-b border-slate-700">
        <Link href="/" className="text-slate-400 hover:text-white text-sm transition-colors">
          ← HOME
        </Link>
        <span className="text-slate-600">|</span>
        <span className="text-xl">👥</span>
        <h1 className="text-lg font-bold">従業員管理 · 助成金サポート</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* 診断結果サマリー */}
        {wizard && (
          <div className="bg-emerald-950 border border-emerald-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-emerald-400 text-xs font-semibold mb-0.5">診断結果</p>
                <p className="text-white text-lg font-black">
                  推定受給額{" "}
                  <span className="text-emerald-300">
                    {(wizard.estimatedAmount / 10000).toFixed(0)}万円
                  </span>
                </p>
              </div>
              <div className="text-4xl">💰</div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: "従業員あり", val: wizard.hasEmployees },
                { label: "保険加入", val: wizard.hasInsurance },
                { label: "設備投資", val: wizard.hasEquipmentInvestment },
              ].map(({ label, val }) => (
                <div
                  key={label}
                  className={`rounded-xl px-3 py-2 text-center text-xs font-semibold ${
                    val
                      ? "bg-emerald-800 text-emerald-300"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {val ? "✓" : "—"} {label}
                </div>
              ))}
            </div>

            {eligibleSubsidies.length > 0 && (
              <div className="space-y-2">
                <p className="text-emerald-400 text-xs font-semibold">対象の助成金・補助金</p>
                {eligibleSubsidies.map(s => (
                  <div key={s.key} className="bg-emerald-900/50 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-bold">{s.key}</p>
                      <p className="text-emerald-400 text-xs mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                    <p className="text-emerald-300 text-sm font-black flex-shrink-0">
                      〜{(s.amount / 10000).toFixed(0)}万
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!wizard && (
          <div className="bg-amber-950 border border-amber-700 rounded-2xl p-5 text-center space-y-3">
            <p className="text-amber-300 font-bold text-sm">診断がまだ完了していません</p>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm rounded-xl transition-all active:scale-95"
            >
              HOMEで無料診断を受ける →
            </Link>
          </div>
        )}

        {/* 従業員一覧 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">従業員一覧</h2>
            <button
              onClick={() => { setForm(blank()); setShowForm(true); }}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition-all active:scale-95"
            >
              ＋ 追加
            </button>
          </div>

          {saved && (
            <p className="text-sm text-emerald-400 font-semibold mb-3">✓ 保存しました</p>
          )}

          {employees.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm bg-slate-900 rounded-2xl border border-slate-800">
              従業員を追加してください
            </div>
          ) : (
            <div className="space-y-2">
              {employees.map(emp => (
                <div
                  key={emp.id}
                  className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3.5 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg flex-shrink-0">
                    👤
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{emp.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                        emp.type === "fulltime"
                          ? "bg-indigo-900 text-indigo-300"
                          : "bg-slate-700 text-slate-400"
                      }`}>
                        {emp.type === "fulltime" ? "正社員" : "アルバイト"}
                      </span>
                      {emp.weeklyHours && (
                        <span className="text-xs text-slate-500">週{emp.weeklyHours}h</span>
                      )}
                      {emp.hasInsurance && (
                        <span className="text-xs bg-emerald-900 text-emerald-400 px-2 py-0.5 rounded-md font-medium">
                          保険加入
                        </span>
                      )}
                      {emp.joinedAt && (
                        <span className="text-xs text-slate-600">{emp.joinedAt}〜</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(emp.id)}
                    className="px-3 py-1.5 bg-red-900/60 hover:bg-red-900 text-red-400 rounded-lg text-xs font-semibold transition-all active:scale-95 flex-shrink-0"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 申請サポート案内 */}
        <section className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-300">📋 申請サポート情報</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            助成金の申請には社労士（社会保険労務士）への相談が推奨されます。
            ハローワークや商工会議所でも無料相談を実施しています。
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://www.hellowork.mhlw.go.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
            >
              ハローワーク →
            </a>
            <a
              href="https://www.jcci.or.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
            >
              商工会議所 →
            </a>
          </div>
        </section>
      </main>

      {/* 従業員追加モーダル */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="text-base font-bold">従業員を追加</h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 flex items-center justify-center text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">氏名</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例：山田 太郎"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-all placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">雇用形態</label>
                <div className="flex gap-2">
                  {(["fulltime", "parttime"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                        form.type === t
                          ? "border-teal-500 bg-teal-900 text-teal-300"
                          : "border-slate-600 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {t === "fulltime" ? "正社員" : "アルバイト"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">週の勤務時間</label>
                  <input
                    type="number"
                    value={form.weeklyHours}
                    onChange={e => setForm(f => ({ ...f, weeklyHours: e.target.value }))}
                    placeholder="例：20"
                    min="1"
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-all placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">入社年月</label>
                  <input
                    type="month"
                    value={form.joinedAt}
                    onChange={e => setForm(f => ({ ...f, joinedAt: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    onClick={() => setForm(f => ({ ...f, hasInsurance: !f.hasInsurance }))}
                    className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                      form.hasInsurance ? "bg-emerald-600" : "bg-slate-600"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      form.hasInsurance ? "left-6" : "left-0.5"
                    }`} />
                  </button>
                  <span className="text-sm text-slate-300 font-medium">社会保険・雇用保険に加入済み</span>
                </label>
              </div>

              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm transition-all active:scale-95"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
