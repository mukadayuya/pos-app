"use client";

// 勤怠管理・スタッフマスターと月次集計（Phase 2-④）

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAllStaff, createStaff, updateStaff, computeWorkSummary,
  type StaffMember, type WorkSummary,
} from "@/lib/attendance";

const ROLE_PRESETS = ["ホール", "キッチン", "店長", "アルバイト", "社員"];
const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#64748b",
];

function monthOptions(n = 6): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function monthRange(ym: string): { fromIso: string; toIso: string } {
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 1);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

function fmtHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const mm = Math.floor(minutes % 60);
  return `${h}h${mm}m`;
}

// スタッフ編集モーダル
function StaffFormModal({ initial, onClose, onSaved }: {
  initial: StaffMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName]     = useState(initial?.name ?? "");
  const [role, setRole]     = useState(initial?.role ?? "");
  const [wage, setWage]     = useState(String(initial?.hourly_wage ?? 1100));
  const [color, setColor]   = useState(initial?.color ?? COLOR_PRESETS[9]);
  const [pin, setPin]       = useState(initial?.pin ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [note, setNote]     = useState(initial?.note ?? "");
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setError("氏名は必須です"); return; }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(), role: role.trim() || null,
        hourly_wage: Number(wage) || 1100,
        color, pin: pin.trim() || null, is_active: isActive,
        note: note.trim() || null,
      };
      if (initial) await updateStaff(initial.id, payload);
      else await createStaff(payload);
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold">{initial ? "スタッフ編集" : "スタッフ新規登録"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">氏名 <span className="text-red-500">*</span></span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="山田太郎"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">役職・所属</span>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="ホール"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
            <div className="mt-1 flex flex-wrap gap-1">
              {ROLE_PRESETS.map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className={`px-2 py-1 rounded text-[10px] font-bold ${
                    role === r ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                  }`}>{r}</button>
              ))}
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">時給（円）</span>
            <input type="number" value={wage} onChange={e => setWage(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none tabular-nums" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">表示色（シフト・打刻カード用）</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {COLOR_PRESETS.map(c => (
                <button key={c} onClick={() => setColor(c)} title={c}
                  className={`w-8 h-8 rounded-full border-2 ${color === c ? "border-slate-900" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">PIN（打刻認証・任意）</span>
            <input type="text" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} maxLength={6}
              placeholder="1234"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none font-mono" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">メモ</span>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="連絡先・特記事項"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4" />
            <span className="text-sm text-slate-700">在籍中（勤怠打刻対象）</span>
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold">キャンセル</button>
          <button onClick={save} disabled={busy || !name.trim()}
            className="flex-1 py-3 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold">
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AttendanceManagePage() {
  const [staff, setStaff]     = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [month, setMonth]     = useState(monthOptions()[0]);
  const [summary, setSummary] = useState<WorkSummary[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setStaff(await fetchAllStaff());
    const { fromIso, toIso } = monthRange(month);
    setSummary(await computeWorkSummary(fromIso, toIso));
    setLoading(false);
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  const totalWage = summary.reduce((s, w) => s + w.estimated_wage, 0);
  const totalHours = summary.reduce((s, w) => s + w.total_minutes, 0) / 60;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Link href="/attendance" className="text-slate-600 text-sm">← 打刻</Link>
        <h1 className="text-lg font-bold text-slate-900">スタッフ管理・給与集計</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* スタッフマスター */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-700">👥 スタッフマスター ({staff.length}名)</h2>
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold rounded-lg">
              + 新規登録
            </button>
          </div>
          {loading ? (
            <p className="text-xs text-slate-400">読み込み中…</p>
          ) : staff.length === 0 ? (
            <p className="text-xs text-slate-400">まだスタッフが登録されていません。</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {staff.map(s => (
                <li key={s.id} className="py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: s.color ?? "#64748b" }}>
                    {s.name.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${s.is_active ? "text-slate-800" : "text-slate-400 line-through"}`}>
                      {s.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.role ?? "—"} · 時給¥{s.hourly_wage.toLocaleString()}
                      {!s.is_active && " · 退職"}
                    </p>
                  </div>
                  <button onClick={() => { setEditing(s); setShowForm(true); }}
                    className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1">編集</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 月次集計 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-700">📊 月次給与集計</h2>
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
              {monthOptions().map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {summary.length === 0 ? (
            <p className="text-xs text-slate-400">{month} の勤務記録はまだありません。</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">総勤務時間</p>
                  <p className="text-lg font-black text-slate-800 tabular-nums">{totalHours.toFixed(1)}h</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">対象人数</p>
                  <p className="text-lg font-black text-slate-800 tabular-nums">{summary.length}名</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-emerald-700">概算人件費</p>
                  <p className="text-lg font-black text-emerald-800 tabular-nums">¥{totalWage.toLocaleString()}</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-2">スタッフ</th>
                    <th className="text-right py-2">日数</th>
                    <th className="text-right py-2">時間</th>
                    <th className="text-right py-2">給与</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.map(w => (
                    <tr key={w.staff_id}>
                      <td className="py-2 font-semibold text-slate-800">{w.staff_name}</td>
                      <td className="py-2 text-right text-slate-600 tabular-nums">{w.days_worked}日</td>
                      <td className="py-2 text-right text-slate-600 tabular-nums">{fmtHM(w.total_minutes)}</td>
                      <td className="py-2 text-right font-bold text-slate-900 tabular-nums">¥{w.estimated_wage.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-400 mt-2">
                ※ 給与は時給×労働時間の概算。残業割増・深夜手当・社保等は含みません。
              </p>
            </>
          )}
        </section>
      </main>

      {showForm && (
        <StaffFormModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}
