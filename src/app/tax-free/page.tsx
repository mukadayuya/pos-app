"use client";

// 免税販売管理（Phase 1-⑬・インバウンド対応）
// 訪日外国人客への免税販売時のパスポート情報を記録・保管。
// 税務署への保管義務(7年)対応。

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchTaxFreeRecords,
  createTaxFreeRecord,
  deleteTaxFreeRecord,
  estimateTaxAmount,
  CATEGORY_LABEL,
  TAX_FREE_MIN,
  TAX_FREE_MAX_CONSUMABLE,
  type TaxFreeRecord,
  type TaxFreeCategory,
} from "@/lib/taxFree";

const COUNTRIES: { code: string; label: string; flag: string }[] = [
  { code: "CN", label: "中国",       flag: "🇨🇳" },
  { code: "KR", label: "韓国",       flag: "🇰🇷" },
  { code: "TW", label: "台湾",       flag: "🇹🇼" },
  { code: "HK", label: "香港",       flag: "🇭🇰" },
  { code: "US", label: "アメリカ",   flag: "🇺🇸" },
  { code: "GB", label: "イギリス",   flag: "🇬🇧" },
  { code: "FR", label: "フランス",   flag: "🇫🇷" },
  { code: "DE", label: "ドイツ",     flag: "🇩🇪" },
  { code: "IT", label: "イタリア",   flag: "🇮🇹" },
  { code: "ES", label: "スペイン",   flag: "🇪🇸" },
  { code: "AU", label: "オーストラリア", flag: "🇦🇺" },
  { code: "TH", label: "タイ",       flag: "🇹🇭" },
  { code: "VN", label: "ベトナム",   flag: "🇻🇳" },
  { code: "PH", label: "フィリピン", flag: "🇵🇭" },
  { code: "IN", label: "インド",     flag: "🇮🇳" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

// ── 新規免税販売モーダル ──
function NewRecordModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (r: TaxFreeRecord) => void;
}) {
  const [passportNo, setPassportNo]   = useState("");
  const [nationality, setNationality] = useState("CN");
  const [customerName, setCustomerName] = useState("");
  const [entryDate, setEntryDate]     = useState(todayIso());
  const [category, setCategory]       = useState<TaxFreeCategory>("consumable");
  const [taxExcludedTotal, setTaxExcludedTotal] = useState("");
  const [staff, setStaff]             = useState("");
  const [note, setNote]               = useState("");
  const [busy, setBusy]               = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const totalNum = Number(taxExcludedTotal) || 0;
  const taxNum   = estimateTaxAmount(totalNum);
  const valid = passportNo.trim().length > 0
    && customerName.trim().length > 0
    && totalNum >= TAX_FREE_MIN
    && !(category === "consumable" && totalNum > TAX_FREE_MAX_CONSUMABLE);

  const submit = async () => {
    setError(null);
    if (!valid) { setError("必須項目と金額（税抜5,000円以上）を確認してください"); return; }
    setBusy(true);
    try {
      const r = await createTaxFreeRecord({
        sale_id: null,
        passport_no: passportNo.trim().toUpperCase(),
        nationality: nationality,
        customer_name: customerName.trim(),
        entry_date: entryDate || null,
        category,
        tax_excluded_total: totalNum,
        tax_amount: taxNum,
        staff: staff.trim() || null,
        note: note.trim() || null,
      });
      onCreated(r);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold">🌏 免税販売の記録</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {/* 案内 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-800">
            ⓘ 免税対象は税抜5,000円以上。消耗品（食品・飲料等）は50万円まで。
            必ずパスポートで本人確認してください。
          </div>

          {/* パスポート */}
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">パスポート番号 <span className="text-red-500">*</span></span>
            <input value={passportNo} onChange={e => setPassportNo(e.target.value.toUpperCase())}
              placeholder="例: TR1234567" maxLength={9}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none font-mono uppercase tracking-wider" />
          </label>

          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">国籍 <span className="text-red-500">*</span></span>
              <select value={nationality} onChange={e => setNationality(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none">
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}
                <option value="OTHER">その他</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">入国日</span>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">氏名（ローマ字） <span className="text-red-500">*</span></span>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)}
              placeholder="例: WANG XIAOMING"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none uppercase" />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">商品分類 <span className="text-red-500">*</span></span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(["general","consumable","mixed"] as TaxFreeCategory[]).map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold border-2 transition-colors ${
                    category === c ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-400"
                  }`}>
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">税抜金額（税抜合計） <span className="text-red-500">*</span></span>
            <input type="number" value={taxExcludedTotal} onChange={e => setTaxExcludedTotal(e.target.value)}
              placeholder="例: 5000（下限¥5,000）" min={TAX_FREE_MIN}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-base font-bold outline-none tabular-nums" />
            {totalNum > 0 && (
              <p className="text-xs text-slate-500 mt-1 tabular-nums">
                免除税額 ≒ ¥{taxNum.toLocaleString()} / 客の支払額 ¥{totalNum.toLocaleString()}
              </p>
            )}
            {category === "consumable" && totalNum > TAX_FREE_MAX_CONSUMABLE && (
              <p className="text-xs text-red-600 mt-1">消耗品は50万円まで</p>
            )}
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">販売担当</span>
            <input value={staff} onChange={e => setStaff(e.target.value)} placeholder="山田"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">メモ</span>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="例: 免税購入品を封印した"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold">キャンセル</button>
          <button onClick={submit} disabled={busy || !valid}
            className="flex-1 py-3 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold">
            {busy ? "登録中…" : "免税販売として記録"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── メイン ──
export default function TaxFreePage() {
  const [rows, setRows]       = useState<TaxFreeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await fetchTaxFreeRecords());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("この免税販売記録を削除しますか？（税務保管7年義務があるため通常削除しません）")) return;
    await deleteTaxFreeRecord(id);
    await load();
  };

  const totalCount = rows.length;
  const totalAmount = rows.reduce((s, r) => s + r.tax_excluded_total, 0);
  const totalTaxExempted = rows.reduce((s, r) => s + r.tax_amount, 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-600 text-sm">← HOME</Link>
          <h1 className="text-lg font-bold text-slate-900">🌏 免税販売</h1>
          <button onClick={() => setShowNew(true)}
            className="ml-auto px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold rounded-lg active:scale-95">
            + 新規記録
          </button>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
          <span>件数 <b className="text-slate-800">{totalCount}</b></span>
          <span>販売合計 <b className="text-slate-800 tabular-nums">¥{totalAmount.toLocaleString()}</b></span>
          <span>免除税額 <b className="text-emerald-700 tabular-nums">¥{totalTaxExempted.toLocaleString()}</b></span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-slate-400 py-10">読み込み中…</p>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-4xl mb-2">🛍️</p>
            <p className="text-sm text-slate-500">まだ免税販売記録がありません</p>
            <button onClick={() => setShowNew(true)}
              className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-lg">
              新規記録を追加
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map(r => {
              const country = COUNTRIES.find(c => c.code === r.nationality);
              return (
                <li key={r.id} className="bg-white rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-lg">{country?.flag ?? "🌍"}</span>
                        <span className="text-sm font-bold text-slate-900">{r.customer_name}</span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                          {CATEGORY_LABEL[r.category]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        {r.passport_no} · {country?.label ?? r.nationality}
                        {r.entry_date && ` · 入国 ${r.entry_date}`}
                      </p>
                      {r.note && <p className="text-[10px] text-slate-400 mt-1">📝 {r.note}</p>}
                      <p className="text-[10px] text-slate-400 mt-1">
                        {fmtDateTime(r.created_at)}{r.staff && ` · ${r.staff}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-slate-900 tabular-nums">¥{r.tax_excluded_total.toLocaleString()}</p>
                      <p className="text-xs text-emerald-700 font-bold tabular-nums">免税 ¥{r.tax_amount.toLocaleString()}</p>
                      <button onClick={() => remove(r.id)} className="text-[10px] text-slate-400 hover:text-red-500 mt-1">削除</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {showNew && (
        <NewRecordModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); void load(); }}
        />
      )}
    </div>
  );
}
