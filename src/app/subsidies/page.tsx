"use client";

// 補助金・助成金チェッカー（Phase 3-⑦）
// 店舗プロフィールと売上データから利用可能な補助金を自動判定・提案する。
// 向田さんの Sales Flows（補助金サポート事業）との連携で他社POSに無い差別化ポイント。

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchStoreProfile,
  saveStoreProfile,
  computeAnnualRevenue,
  findAvailableSubsidies,
  daysUntilDeadline,
  isNewSubsidy,
  DEFAULT_PROFILE,
  type StoreProfile,
  type Eligibility,
} from "@/lib/subsidies";

const INDUSTRIES = ["飲食業", "小売業", "サービス業", "宿泊業", "製造業", "運輸業", "建設業", "その他"];
const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

function fmtYen(n: number): string { return `¥${Math.round(n).toLocaleString()}`; }
function fmtManYen(n: number): string {
  if (n >= 10000) {
    const man = n / 10000;
    return man >= 100 ? `${(man / 100).toFixed(1)}億` : `${Math.round(man)}万円`;
  }
  return `¥${n.toLocaleString()}`;
}

// 締切カウントダウン表示
function DeadlineChip({ deadlineIso }: { deadlineIso: string | null }) {
  const days = daysUntilDeadline(deadlineIso);
  if (days === null) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
      🔓 通年募集
    </span>
  );
  if (days <= 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">
      ⏰ 締切済
    </span>
  );
  const color = days <= 30 ? "bg-red-100 text-red-700" : days <= 90 ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${color} text-[10px] font-bold`}>
      ⏰ 締切まで{days}日
    </span>
  );
}

// ─── メイン ─────────────────────────────────────────────
export default function SubsidiesPage() {
  const [profile, setProfile] = useState<StoreProfile>(DEFAULT_PROFILE);
  const [results, setResults] = useState<Eligibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saved, setSaved]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, revenue] = await Promise.all([
      fetchStoreProfile(),
      computeAnnualRevenue(),
    ]);
    const merged: StoreProfile = { ...p, annual_revenue: revenue };
    setProfile(merged);
    const list = await findAvailableSubsidies(merged);
    setResults(list);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    setSavingProfile(true);
    try {
      await saveStoreProfile(profile);
      const list = await findAvailableSubsidies(profile);
      setResults(list);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSavingProfile(false); }
  };

  const eligible = results.filter(r => r.eligible);
  const ineligible = results.filter(r => !r.eligible);
  const potentialTotal = eligible.reduce((s, r) => s + r.subsidy.max_amount, 0);
  const newCount = results.filter(r => isNewSubsidy(r.subsidy)).length;

  // Phase 3-⑧ 申請サポート情報を JSON でクリップボードにコピー / 印刷
  const buildSupportCard = () => {
    const rows: string[] = [];
    rows.push("# 補助金申請サポート情報カード");
    rows.push(`発行日時: ${new Date().toLocaleString("ja-JP")}`);
    rows.push("");
    rows.push("## 店舗プロフィール");
    rows.push(`- 業種: ${profile.industry}`);
    rows.push(`- 従業員数: ${profile.employee_count}名`);
    if (profile.capital) rows.push(`- 資本金: ${profile.capital}万円`);
    if (profile.prefecture) rows.push(`- 都道府県: ${profile.prefecture}`);
    if (typeof profile.annual_revenue === "number") {
      rows.push(`- 年商(POS実データ): ¥${profile.annual_revenue.toLocaleString()}`);
    }
    rows.push("");
    rows.push("## 申請対象候補（利用可能な補助金）");
    for (const { subsidy } of eligible) {
      rows.push(`### ${subsidy.name}（${subsidy.provider}）`);
      rows.push(`- 最大: ¥${subsidy.max_amount.toLocaleString()}`);
      if (subsidy.typical_amount) rows.push(`- 相場: ¥${subsidy.typical_amount.toLocaleString()}`);
      if (subsidy.deadline_date) rows.push(`- 締切: ${subsidy.deadline_date}`);
      rows.push(`- 概要: ${subsidy.description}`);
      if (subsidy.application_url) rows.push(`- 申請ページ: ${subsidy.application_url}`);
      rows.push("");
    }
    return rows.join("\n");
  };

  const handleCopyCard = async () => {
    try {
      await navigator.clipboard.writeText(buildSupportCard());
      alert("申請サポート情報をクリップボードにコピーしました。向田さんに共有する時にペーストしてください。");
    } catch {
      alert("コピーに失敗しました。手動でコピーしてください。");
    }
  };

  const handlePrintCard = () => {
    const content = buildSupportCard();
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) { alert("ポップアップがブロックされました。"); return; }
    win.document.write(`
<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>補助金申請サポート情報</title>
<style>
body{font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;padding:20mm;line-height:1.7;color:#111;background:#fff}
h1{font-size:22pt;border-bottom:2px solid #10b981;padding-bottom:6mm;margin-bottom:8mm}
h2{font-size:14pt;color:#0f766e;margin-top:8mm;margin-bottom:3mm;border-left:4px solid #10b981;padding-left:8px}
h3{font-size:12pt;margin-top:5mm;margin-bottom:2mm}
ul{margin-left:20px}
li{margin-bottom:2mm;font-size:10pt}
.print-btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#0f766e;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold}
@media print{.print-btn{display:none}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ 印刷する</button>
${content.split("\n").map(l => {
  if (l.startsWith("# ")) return `<h1>${l.slice(2)}</h1>`;
  if (l.startsWith("## ")) return `<h2>${l.slice(3)}</h2>`;
  if (l.startsWith("### ")) return `<h3>${l.slice(4)}</h3>`;
  if (l.startsWith("- ")) return `<li>${l.slice(2)}</li>`;
  return l ? `<p>${l}</p>` : "<br>";
}).join("")}
</body></html>`);
    win.document.close();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-600 text-sm">← HOME</Link>
          <h1 className="text-lg font-bold text-slate-900">💰 補助金チェッカー</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* ヒーロー: 総額 */}
        {!loading && (
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl p-6 shadow-lg">
            <p className="text-xs font-bold uppercase tracking-wider opacity-90">お店が申請できる可能性のある補助金</p>
            <p className="text-4xl font-black tabular-nums mt-2">最大 {fmtManYen(potentialTotal)}</p>
            <p className="text-sm opacity-90 mt-2">
              🎯 該当 <b>{eligible.length}</b> 件 / 全 {results.length} 件を判定
              {newCount > 0 && (
                <span className="ml-2 inline-block bg-yellow-400 text-slate-900 text-xs font-black px-2 py-0.5 rounded-full">
                  🆕 新着 {newCount} 件
                </span>
              )}
            </p>
            <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-3">
              <p className="text-xs opacity-80 flex-1">
                💡 採択率100%の実績あり（加藤さん名古屋イタリアン 233万→46万円）
              </p>
              <a href="https://www.instagram.com/yuya_mukada/"
                target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 bg-white text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-50 active:scale-95 transition-all">
                無料相談 →
              </a>
            </div>
          </div>
        )}

        {/* プロフィール入力 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-700">🏢 店舗プロフィール（判定に使う情報）</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">業種</span>
              <select value={profile.industry}
                onChange={e => setProfile(p => ({ ...p, industry: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none">
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">従業員数</span>
              <input type="number" min={1} value={profile.employee_count}
                onChange={e => setProfile(p => ({ ...p, employee_count: Number(e.target.value) || 1 }))}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none tabular-nums" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">資本金（万円・任意）</span>
              <input type="number" min={0} value={profile.capital ?? ""}
                onChange={e => setProfile(p => ({ ...p, capital: e.target.value ? Number(e.target.value) : null }))}
                placeholder="例: 300"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none tabular-nums" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">都道府県</span>
              <select value={profile.prefecture ?? ""}
                onChange={e => setProfile(p => ({ ...p, prefecture: e.target.value || null }))}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none">
                <option value="">選択してください</option>
                {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <div className="bg-slate-50 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
            <span className="text-slate-600">POSデータから算出した年商（過去365日）</span>
            <span className="font-bold text-slate-900 tabular-nums">
              {profile.annual_revenue == null ? "—" : fmtYen(profile.annual_revenue)}
            </span>
          </div>
          <button onClick={handleSave} disabled={savingProfile}
            className="w-full py-3 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold active:scale-95">
            {savingProfile ? "保存中…" : saved ? "✓ 保存しました" : "プロフィールを保存して再判定"}
          </button>
        </section>

        {/* 利用可能な補助金 */}
        {loading ? (
          <p className="text-center text-slate-400 py-10">読み込み中…</p>
        ) : (
          <>
            {eligible.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-slate-700">✅ 利用可能な補助金 ({eligible.length}件)</h2>
                  <div className="flex gap-2">
                    <button onClick={handleCopyCard}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">
                      📋 サポート情報をコピー
                    </button>
                    <button onClick={handlePrintCard}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">
                      🖨️ 印刷
                    </button>
                  </div>
                </div>
                <ul className="space-y-3">
                  {eligible.map(({ subsidy, reasons }) => (
                    <li key={subsidy.id} className="bg-white rounded-2xl border-2 border-emerald-300 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {isNewSubsidy(subsidy) && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-yellow-400 text-slate-900 animate-pulse">
                                🆕 NEW
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {subsidy.provider}
                            </span>
                            <DeadlineChip deadlineIso={subsidy.deadline_date} />
                          </div>
                          <h3 className="text-base font-black text-slate-900">{subsidy.name}</h3>
                          <p className="text-xs text-slate-600 mt-1">{subsidy.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-slate-500">最大</p>
                          <p className="text-xl font-black text-emerald-700 tabular-nums leading-tight">
                            {fmtManYen(subsidy.max_amount)}
                          </p>
                          {subsidy.typical_amount && (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              相場 {fmtManYen(subsidy.typical_amount)}
                            </p>
                          )}
                        </div>
                      </div>
                      {subsidy.benefits && (
                        <p className="text-xs text-slate-500 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5 mt-2">
                          {subsidy.benefits}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {reasons.map((r, i) => (
                          <span key={i} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                            ✓ {r}
                          </span>
                        ))}
                      </div>
                      {subsidy.application_url && (
                        <div className="flex gap-2 mt-3">
                          <a href={subsidy.application_url} target="_blank" rel="noopener noreferrer"
                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold text-center">
                            📄 詳細を見る
                          </a>
                          <a href="https://www.instagram.com/yuya_mukada/"
                            target="_blank" rel="noopener noreferrer"
                            className="flex-1 py-2 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-xs font-bold text-center">
                            🎯 申請サポートを頼む
                          </a>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 利用不可の補助金（折りたたみ表示） */}
            {ineligible.length > 0 && (
              <section>
                <details className="bg-white rounded-2xl border border-slate-200 p-4">
                  <summary className="cursor-pointer text-sm font-bold text-slate-500">
                    ❌ 条件外の補助金 ({ineligible.length}件・条件クリアで対象になる可能性あり)
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {ineligible.map(({ subsidy, blockers }) => (
                      <li key={subsidy.id} className="border border-slate-100 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-700">{subsidy.name}</p>
                            <p className="text-xs text-slate-500">{subsidy.provider}・最大{fmtManYen(subsidy.max_amount)}</p>
                          </div>
                          <DeadlineChip deadlineIso={subsidy.deadline_date} />
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {blockers.map((b, i) => (
                            <li key={i} className="text-[11px] text-red-600">✗ {b}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </details>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
