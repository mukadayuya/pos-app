"use client";

// シフト作成画面（Phase 2-④ 拡張）
// 週間シフト表。スタッフ × 曜日のグリッドでシフトを登録・編集。

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchActiveStaff, type StaffMember } from "@/lib/attendance";
import {
  fetchWeekShifts, upsertShift, deleteShift, copyPreviousWeek,
  weekMonday, addDaysIso, type Shift,
} from "@/lib/shifts";

const WEEK_DAYS = ["月", "火", "水", "木", "金", "土", "日"];

function todayMonday(): string {
  return weekMonday(new Date());
}

function fmtWeekLabel(mondayIso: string): string {
  const monday = new Date(`${mondayIso}T00:00:00+09:00`);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(monday)}(月) 〜 ${fmt(sunday)}(日)`;
}

interface ShiftEditData {
  staffId: string;
  workDate: string;
  existing?: Shift;
}

function ShiftEditModal({
  data, staffName, onClose, onSaved,
}: {
  data: ShiftEditData;
  staffName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [start, setStart]   = useState(data.existing?.start_time ?? "17:00");
  const [end, setEnd]       = useState(data.existing?.end_time ?? "23:00");
  const [role, setRole]     = useState(data.existing?.role ?? "");
  const [note, setNote]     = useState(data.existing?.note ?? "");
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await upsertShift({
        staff_id: data.staffId,
        work_date: data.workDate,
        start_time: start,
        end_time: end,
        role: role.trim() || null,
        note: note.trim() || null,
        status: "confirmed",
      });
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!data.existing) return;
    if (!confirm("このシフトを削除しますか？")) return;
    setBusy(true);
    try {
      await deleteShift(data.existing.id);
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const workDateLabel = new Date(`${data.workDate}T00:00:00+09:00`).toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">{staffName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{workDateLabel}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">開始時刻</span>
              <input type="time" value={start} onChange={e => setStart(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-base outline-none tabular-nums" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">終了時刻</span>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-base outline-none tabular-nums" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">役割（任意）</span>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="ホール / キッチン / レジ"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">メモ（任意）</span>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="早上がり希望 / 研修 等"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-2">
          {data.existing ? (
            <button onClick={remove} disabled={busy}
              className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-sm font-bold">削除</button>
          ) : null}
          <button onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold">キャンセル</button>
          <button onClick={save} disabled={busy}
            className="flex-[2] py-3 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold">
            {busy ? "保存中…" : data.existing ? "更新" : "登録"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShiftsPage() {
  const [monday, setMonday]   = useState(todayMonday());
  const [staff, setStaff]     = useState<StaffMember[]>([]);
  const [shifts, setShifts]   = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShiftEditData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, sh] = await Promise.all([
      fetchActiveStaff(),
      fetchWeekShifts(monday),
    ]);
    setStaff(s);
    setShifts(sh);
    setLoading(false);
  }, [monday]);

  useEffect(() => { void load(); }, [load]);

  const shiftByCell = useMemo(() => {
    const map = new Map<string, Shift>();
    shifts.forEach(s => map.set(`${s.staff_id}::${s.work_date}`, s));
    return map;
  }, [shifts]);

  const handleCopyPrev = async () => {
    if (!confirm(`先週のシフトを今週(${fmtWeekLabel(monday)})にコピーしますか？`)) return;
    setCopying(true);
    setMessage(null);
    try {
      const result = await copyPreviousWeek(monday);
      setMessage(`✓ ${result.copied}件コピー・${result.skipped}件スキップ`);
      setTimeout(() => setMessage(null), 3000);
      await load();
    } catch (e) {
      setMessage(`失敗: ${(e as Error).message}`);
    } finally { setCopying(false); }
  };

  // 合計時間計算
  const totalHours = useMemo(() => {
    return shifts.reduce((total, s) => {
      const [sh, sm] = s.start_time.split(":").map(Number);
      const [eh, em] = s.end_time.split(":").map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60; // 日跨ぎ
      return total + mins;
    }, 0) / 60;
  }, [shifts]);

  const staffHours = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shifts) {
      const [sh, sm] = s.start_time.split(":").map(Number);
      const [eh, em] = s.end_time.split(":").map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      map.set(s.staff_id, (map.get(s.staff_id) ?? 0) + mins / 60);
    }
    return map;
  }, [shifts]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/attendance" className="text-slate-600 text-sm">← 打刻</Link>
          <h1 className="text-lg font-bold text-slate-900">📆 シフト表</h1>
          <Link href="/attendance/manage" className="ml-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">
            管理・集計 →
          </Link>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => setMonday(addDaysIso(monday, -7))}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg">←</button>
          <span className="text-base font-bold text-slate-800 flex-1 text-center tabular-nums">{fmtWeekLabel(monday)}</span>
          <button onClick={() => setMonday(addDaysIso(monday, 7))}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg">→</button>
          <button onClick={() => setMonday(todayMonday())}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">今週</button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          <span>週合計 <b className="text-slate-800 tabular-nums">{totalHours.toFixed(1)}h</b></span>
          <button onClick={handleCopyPrev} disabled={copying}
            className="ml-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg">
            {copying ? "コピー中…" : "📋 先週のシフトをコピー"}
          </button>
        </div>
        {message && (
          <div className="mt-2 text-xs text-emerald-700">{message}</div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-slate-400 py-10">読み込み中…</p>
        ) : staff.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-4xl mb-2">👥</p>
            <p className="text-sm text-slate-500">スタッフがまだ登録されていません</p>
            <Link href="/attendance/manage"
              className="inline-block mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-lg">
              スタッフを登録する →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-bold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[110px]">スタッフ</th>
                    {WEEK_DAYS.map((d, i) => {
                      const dateIso = addDaysIso(monday, i);
                      const dateObj = new Date(`${dateIso}T00:00:00+09:00`);
                      const isToday = dateIso === new Date().toISOString().slice(0, 10);
                      return (
                        <th key={d} className={`text-center px-2 py-2 font-bold text-slate-600 min-w-[100px] ${isToday ? "bg-emerald-50 text-emerald-800" : ""}`}>
                          {d}<br />
                          <span className="text-[10px] font-normal text-slate-500">{dateObj.getMonth() + 1}/{dateObj.getDate()}</span>
                        </th>
                      );
                    })}
                    <th className="text-right px-3 py-2 font-bold text-slate-600 min-w-[60px]">合計</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.map(s => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: s.color ?? "#64748b" }}>
                            {s.name.slice(0, 1)}
                          </div>
                          <span className="font-bold text-slate-800 truncate">{s.name}</span>
                        </div>
                      </td>
                      {WEEK_DAYS.map((_, i) => {
                        const dateIso = addDaysIso(monday, i);
                        const shift = shiftByCell.get(`${s.id}::${dateIso}`);
                        return (
                          <td key={i} className="p-1 text-center">
                            <button
                              onClick={() => setEditing({ staffId: s.id, workDate: dateIso, existing: shift })}
                              className={`w-full py-1.5 px-1 rounded-lg text-xs font-bold transition-colors ${
                                shift
                                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "border border-dashed border-slate-200 text-slate-300 hover:border-slate-400 hover:text-slate-500"
                              }`}
                              title={shift ? shift.role ?? "" : "追加"}
                            >
                              {shift ? (
                                <>
                                  <div className="tabular-nums">{shift.start_time}</div>
                                  <div className="text-[9px] text-slate-500">|</div>
                                  <div className="tabular-nums">{shift.end_time}</div>
                                </>
                              ) : (
                                <span className="text-base">＋</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-bold text-slate-800 tabular-nums">
                        {(staffHours.get(s.id) ?? 0).toFixed(1)}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="text-center text-xs text-slate-400 mt-4">
          セルをタップしてシフトを追加・編集
        </p>
      </main>

      {editing && (
        <ShiftEditModal
          data={editing}
          staffName={staff.find(s => s.id === editing.staffId)?.name ?? "?"}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}
