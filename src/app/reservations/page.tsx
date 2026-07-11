"use client";

// 予約管理（Phase 1-⑪）
// コース料理店・貸切対応飲食店で必須の予約管理画面。
// 日付ごとに一覧表示・新規登録・チェックイン/キャンセル/完了操作を行う。

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchReservationsForDay,
  createReservation,
  updateReservationStatus,
  deleteReservation,
  STATUS_LABEL,
  STATUS_COLOR,
  type Reservation,
  type ReservationStatus,
} from "@/lib/reservations";

function todayIso(offset = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offset);
  return now.toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}（${wd}）`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── 新規予約モーダル ──
function NewReservationModal({ defaultDate, onClose, onCreated }: {
  defaultDate: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [date, setDate]         = useState(defaultDate);
  const [time, setTime]         = useState("18:00");
  const [name, setName]         = useState("");
  const [phone, setPhone]       = useState("");
  const [size, setSize]         = useState(2);
  const [tablePref, setTablePref] = useState("");
  const [course, setCourse]     = useState("");
  const [price, setPrice]       = useState("");
  const [deposit, setDeposit]   = useState("");
  const [note, setNote]         = useState("");
  const [staff, setStaff]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) { setError("お客様名は必須です"); return; }
    setBusy(true);
    try {
      const iso = new Date(`${date}T${time}:00+09:00`).toISOString();
      await createReservation({
        reserved_at: iso,
        customer_name: name.trim(),
        phone: phone.trim() || null,
        party_size: Math.max(1, size),
        table_pref: tablePref.trim() || null,
        course_name: course.trim() || null,
        course_price: price ? Number(price) : null,
        deposit: deposit ? Number(deposit) : 0,
        note: note.trim() || null,
        staff: staff.trim() || null,
      });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold">📅 新規予約</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">日付</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">時刻</span>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">お客様名 <span className="text-red-500">*</span></span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="例: 山田太郎"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">電話</span>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="090-1234-5678"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">人数</span>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => setSize(s => Math.max(1, s - 1))}
                  className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold">−</button>
                <span className="flex-1 text-center text-lg font-black tabular-nums">{size}人</span>
                <button onClick={() => setSize(s => Math.min(30, s + 1))}
                  className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold">＋</button>
              </div>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">希望席（任意）</span>
            <input value={tablePref} onChange={e => setTablePref(e.target.value)} placeholder="座敷 / テーブル / カウンター"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">コース名（任意）</span>
              <input value={course} onChange={e => setCourse(e.target.value)} placeholder="季節のコース"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">単価（税込）</span>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="5500"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none tabular-nums" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">前受金 / 取り置き金額（任意）</span>
            <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="3000"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none tabular-nums" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">メモ（アレルギー・要望等）</span>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="例: エビアレルギー / 誕生日ケーキ持込"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none resize-none" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">受付担当</span>
            <input value={staff} onChange={e => setStaff(e.target.value)} placeholder="山田"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold">キャンセル</button>
          <button onClick={submit} disabled={busy || !name.trim()}
            className="flex-1 py-3 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold">
            {busy ? "登録中…" : "予約を登録"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── メイン ──
export default function ReservationsPage() {
  const [dateIso, setDateIso] = useState(todayIso());
  const [rows, setRows]       = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await fetchReservationsForDay(dateIso));
    setLoading(false);
  }, [dateIso]);

  useEffect(() => { void load(); }, [load]);

  const changeStatus = async (id: string, s: ReservationStatus) => {
    await updateReservationStatus(id, s);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("この予約を削除しますか？（履歴に残さない場合）")) return;
    await deleteReservation(id);
    await load();
  };

  // 集計
  const activeCount = rows.filter(r => r.status === "confirmed" || r.status === "checked_in").length;
  const totalGuests = rows.filter(r => r.status !== "cancelled" && r.status !== "no_show").reduce((s, r) => s + r.party_size, 0);
  const totalDeposit = rows.reduce((s, r) => s + (r.deposit ?? 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-600 text-sm">← HOME</Link>
          <h1 className="text-lg font-bold text-slate-900">📅 予約管理</h1>
          <button onClick={() => setShowNew(true)}
            className="ml-auto px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold rounded-lg active:scale-95">
            + 新規予約
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => setDateIso(iso => todayIso(0))}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">今日</button>
          <button onClick={() => {
            const d = new Date(dateIso); d.setDate(d.getDate() - 1);
            setDateIso(d.toISOString().slice(0, 10));
          }} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg">←</button>
          <span className="text-base font-bold text-slate-800 min-w-[120px] text-center">{fmtDate(dateIso)}</span>
          <button onClick={() => {
            const d = new Date(dateIso); d.setDate(d.getDate() + 1);
            setDateIso(d.toISOString().slice(0, 10));
          }} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg">→</button>
          <div className="ml-auto text-xs text-slate-500 flex items-center gap-3">
            <span>予定 <b className="text-slate-800">{activeCount}件</b></span>
            <span>客数 <b className="text-slate-800">{totalGuests}名</b></span>
            <span>前受金 <b className="text-slate-800 tabular-nums">¥{totalDeposit.toLocaleString()}</b></span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-slate-400 py-10">読み込み中…</p>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-sm text-slate-500">{fmtDate(dateIso)} の予約はまだありません</p>
            <button onClick={() => setShowNew(true)}
              className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-lg">
              新規予約を登録
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map(r => (
              <li key={r.id} className={`bg-white rounded-2xl border border-slate-200 p-4 ${r.status === "cancelled" ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-black text-slate-900 tabular-nums">{fmtTime(r.reserved_at)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_COLOR[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      <span className="text-sm text-slate-600">👥 {r.party_size}名</span>
                      {r.table_pref && <span className="text-xs text-slate-400">🪑 {r.table_pref}</span>}
                    </div>
                    <p className="text-base font-bold text-slate-800">{r.customer_name}様</p>
                    {r.phone && <p className="text-xs text-slate-500">☎ {r.phone}</p>}
                    {r.course_name && (
                      <p className="text-xs text-slate-600 mt-1">
                        📋 {r.course_name}
                        {r.course_price ? ` ¥${r.course_price.toLocaleString()}/人` : ""}
                      </p>
                    )}
                    {r.deposit > 0 && (
                      <p className="text-xs text-emerald-700 font-bold mt-0.5">💰 前受金 ¥{r.deposit.toLocaleString()}</p>
                    )}
                    {r.note && <p className="text-xs text-slate-500 mt-1 bg-amber-50 px-2 py-1 rounded">📝 {r.note}</p>}
                    {r.staff && <p className="text-[10px] text-slate-400 mt-1">受付: {r.staff}</p>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {r.status === "confirmed" && (
                      <button onClick={() => changeStatus(r.id, "checked_in")}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">
                        ✓ 来店
                      </button>
                    )}
                    {r.status === "checked_in" && (
                      <button onClick={() => changeStatus(r.id, "completed")}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg">
                        ⛌ 完了
                      </button>
                    )}
                    {(r.status === "confirmed" || r.status === "checked_in") && (
                      <button onClick={() => changeStatus(r.id, "cancelled")}
                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 hover:border-red-300 hover:text-red-600 text-xs font-bold rounded-lg">
                        キャンセル
                      </button>
                    )}
                    <button onClick={() => remove(r.id)}
                      className="text-xs text-slate-400 hover:text-red-500">削除</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showNew && (
        <NewReservationModal
          defaultDate={dateIso}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); void load(); }}
        />
      )}
    </div>
  );
}
