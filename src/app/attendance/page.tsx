"use client";

// 勤怠管理（Phase 2-④）
// スタッフ選択→出勤/退勤ボタンで打刻。当日勤務状況を一覧表示。
// スタッフ管理と月次集計は下部から遷移。

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchActiveStaff, fetchOpenEntry, clockIn, clockOut, computeWorkSummary,
  type StaffMember, type TimeEntry, type WorkSummary,
} from "@/lib/attendance";

function fmtJst(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
}

function fmtHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h}時間${m}分`;
}

function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [staff, setStaff]         = useState<StaffMember[]>([]);
  const [openByStaff, setOpen]    = useState<Map<string, TimeEntry>>(new Map());
  const [today, setToday]         = useState<WorkSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [busy, setBusy]           = useState<string | null>(null);
  const [message, setMessage]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchActiveStaff();
    setStaff(list);
    const map = new Map<string, TimeEntry>();
    await Promise.all(list.map(async s => {
      const open = await fetchOpenEntry(s.id);
      if (open) map.set(s.id, open);
    }));
    setOpen(map);
    const iso = todayIso();
    const summary = await computeWorkSummary(iso, iso);
    setToday(summary);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleClockIn = async (s: StaffMember) => {
    setBusy(s.id);
    setMessage(null);
    try {
      await clockIn(s.id);
      setMessage(`✓ ${s.name}さん 出勤 打刻`);
      setTimeout(() => setMessage(null), 3000);
      await load();
    } catch (e) { setMessage(`失敗: ${(e as Error).message}`); }
    finally { setBusy(null); }
  };

  const handleClockOut = async (s: StaffMember, entry: TimeEntry) => {
    // 休憩時間を確認
    const input = prompt(`${s.name}さんの休憩時間（分）を入力してください`, "60");
    if (input === null) return;
    const breakMin = Math.max(0, Number(input) || 0);
    setBusy(s.id);
    setMessage(null);
    try {
      await clockOut(entry.id, breakMin);
      setMessage(`✓ ${s.name}さん 退勤 打刻`);
      setTimeout(() => setMessage(null), 3000);
      await load();
    } catch (e) { setMessage(`失敗: ${(e as Error).message}`); }
    finally { setBusy(null); }
  };

  const workingNow = staff.filter(s => openByStaff.has(s.id));

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-600 text-sm">← HOME</Link>
          <h1 className="text-lg font-bold text-slate-900">⏰ 勤怠打刻</h1>
          <Link href="/attendance/manage"
            className="ml-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">
            管理・集計 →
          </Link>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          <span>出勤中 <b className="text-slate-800">{workingNow.length}</b> / スタッフ {staff.length}名</span>
          <span className="ml-4">{new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", weekday: "short", month: "long", day: "numeric" })}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {message && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-sm text-emerald-800">
            {message}
          </div>
        )}

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
          <>
            {/* 打刻カードグリッド */}
            <section>
              <h2 className="text-sm font-bold text-slate-700 mb-2">スタッフを選んで打刻</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {staff.map(s => {
                  const open = openByStaff.get(s.id);
                  const isWorking = !!open;
                  return (
                    <div key={s.id} className={`rounded-2xl border-2 p-4 ${
                      isWorking ? "bg-emerald-50 border-emerald-400" : "bg-white border-slate-200"
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black"
                          style={{ backgroundColor: s.color ?? "#64748b" }}>
                          {s.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 truncate">{s.name}</p>
                          {s.role && <p className="text-[10px] text-slate-500 truncate">{s.role}</p>}
                        </div>
                      </div>
                      {isWorking ? (
                        <>
                          <p className="text-xs text-emerald-800 font-bold">🟢 出勤中</p>
                          <p className="text-[10px] text-slate-500 mb-2">出勤 {fmtJst(open.clock_in)}</p>
                          <button onClick={() => handleClockOut(s, open)} disabled={busy === s.id}
                            className="w-full py-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg">
                            {busy === s.id ? "処理中…" : "退勤打刻"}
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-slate-400 mb-3">未出勤</p>
                          <button onClick={() => handleClockIn(s)} disabled={busy === s.id}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg">
                            {busy === s.id ? "処理中…" : "✓ 出勤打刻"}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 本日の勤務サマリー */}
            {today.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="text-sm font-bold text-slate-700 mb-3">📊 本日の勤務サマリー</h2>
                <ul className="divide-y divide-slate-100">
                  {today.map(w => (
                    <li key={w.staff_id} className="py-2 flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-800">{w.staff_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-600">{fmtHM(w.total_minutes)}</span>
                        <span className="text-slate-500 text-xs">休憩{w.break_minutes}分</span>
                        <span className="font-bold text-slate-900 tabular-nums w-24 text-right">¥{w.estimated_wage.toLocaleString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
