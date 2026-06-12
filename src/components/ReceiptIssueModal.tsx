"use client";

import { useState } from "react";

interface Props {
  total?: number;       // provided → pre-fills and locks amount; omitted → user enters manually
  onClose: () => void;
}

const TADASHI_PRESETS = ["お食事代として", "御会食代として", "飲食代として"] as const;

function printFormalReceipt(params: {
  addressee: string;
  tadashi: string;
  total: number;
}) {
  const IS_BRONCO = process.env.NEXT_PUBLIC_STORE_ID === "bronco";
  const IS_ABC = process.env.NEXT_PUBLIC_STORE_ID === "yakitori-abc";
  const storeName    = localStorage.getItem("store_name")     || (IS_BRONCO ? "メキシコダイニングレストラン ブロンコ" : IS_ABC ? "焼鳥居酒屋ABC" : "Kitchen Kazu");
  const storeAddress = localStorage.getItem("store_address")  || "";
  const storeTel     = localStorage.getItem("store_tel")      || "";
  const invoiceNum   = localStorage.getItem("invoice_number") || "";
  const logoDataUrl  = localStorage.getItem("receipt_logo")   || "";

  const addressee = params.addressee.trim() || "上様";
  const tadashi   = params.tadashi.trim()   || "お食事代として";

  // ¥12,000ー  改ざん防止
  const amountStr = `￥${params.total.toLocaleString()}ー`;

  const dateStr = new Date().toLocaleDateString("ja-JP-u-ca-japanese", {
    era: "long", year: "numeric", month: "long", day: "numeric",
  });

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>領収証</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: 'Hiragino Mincho ProN', 'Yu Mincho', 'MS Mincho', 'Noto Serif JP', serif;
    background: #f0f0f0;
    color: #111;
  }
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 20px 20px;
    gap: 20px;
    min-height: 100vh;
  }
  .receipt {
    background: #fff;
    width: 190mm;
    padding: 16mm 18mm 18mm;
    border: 1px solid #ccc;
    box-shadow: 0 2px 12px rgba(0,0,0,.12);
    position: relative;
  }

  /* ─ タイトル ─ */
  .title {
    text-align: center;
    font-size: 26pt;
    font-weight: bold;
    letter-spacing: .6em;
    padding-right: .6em;   /* letter-spacingによる右余白補正 */
    margin-bottom: 12mm;
    border-bottom: 3px double #111;
    padding-bottom: 5mm;
  }

  /* ─ 宛名 ─ */
  .addressee-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 8mm;
  }
  .addressee-name {
    font-size: 20pt;
    font-weight: bold;
    flex: 1;
    border-bottom: 1.5px solid #555;
    padding-bottom: 1mm;
  }
  .sama {
    font-size: 14pt;
    padding-bottom: 1mm;
    white-space: nowrap;
  }

  /* ─ 金額 ─ */
  .amount-row {
    display: flex;
    align-items: center;
    gap: 8mm;
    margin-bottom: 7mm;
  }
  .amount-label {
    font-size: 12pt;
    width: 12mm;
    flex-shrink: 0;
  }
  .amount-box {
    flex: 1;
    border: 2px solid #111;
    padding: 2mm 5mm;
    font-size: 24pt;
    font-weight: bold;
    letter-spacing: .05em;
    background: #fafafa;
    text-align: right;
  }

  /* ─ 但書き ─ */
  .tadashi-row {
    font-size: 11pt;
    margin-bottom: 9mm;
    padding-left: 1mm;
  }
  .tadashi-row span { margin-left: 1em; }

  /* ─ 確認文 ─ */
  .confirmed {
    text-align: center;
    font-size: 10pt;
    color: #444;
    margin-bottom: 12mm;
    letter-spacing: .05em;
  }

  /* ─ 下段（日付 ＋ 店舗情報） ─ */
  .bottom {
    display: flex;
    justify-content: flex-end;
  }
  .store-block {
    text-align: right;
    font-size: 10pt;
    line-height: 1.85;
    position: relative;
    padding-bottom: 22mm;   /* seal用の余白 */
    min-width: 60mm;
  }
  .date-line {
    font-size: 11pt;
    margin-bottom: 3mm;
  }
  .store-name {
    font-size: 14pt;
    font-weight: bold;
    margin-bottom: 1mm;
  }
  .invoice-num { color: #555; font-size: 9pt; }

  /* ─ 社印（seal） ─ */
  .seal {
    position: absolute;
    right: -4mm;
    bottom: 0;
    width: 26mm;
    height: 26mm;
    object-fit: contain;
    opacity: 0.72;
    mix-blend-mode: multiply;
  }

  /* ─ 印刷ボタン ─ */
  .print-btn {
    display: block;
    padding: 12px 40px;
    font-size: 14px;
    font-family: sans-serif;
    cursor: pointer;
    background: #4f46e5;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-weight: bold;
    box-shadow: 0 2px 8px rgba(79,70,229,.35);
  }
  .print-btn:hover { background: #4338ca; }

  @media print {
    html, body { background: white; padding: 0; }
    .receipt { border: none; box-shadow: none; width: 100%; padding: 10mm 12mm; }
    .print-btn { display: none; }
  }
</style>
</head>
<body>

<div class="receipt">
  <h1 class="title">領　収　証</h1>

  <div class="addressee-row">
    <span class="addressee-name">${escapeHtml(addressee)}</span>
    <span class="sama">様</span>
  </div>

  <div class="amount-row">
    <span class="amount-label">金額</span>
    <div class="amount-box">${amountStr}</div>
  </div>

  <p class="tadashi-row">但し<span>${escapeHtml(tadashi)}</span></p>

  <p class="confirmed">上記の金額正に領収いたしました</p>

  <div class="bottom">
    <div class="store-block">
      <p class="date-line">${dateStr}</p>
      <p class="store-name">${escapeHtml(storeName)}</p>
      ${storeAddress ? `<p>${escapeHtml(storeAddress)}</p>` : ""}
      ${storeTel     ? `<p>TEL ${escapeHtml(storeTel)}</p>` : ""}
      ${invoiceNum   ? `<p class="invoice-num">登録番号 ${escapeHtml(invoiceNum)}</p>` : ""}
      ${logoDataUrl  ? `<img class="seal" src="${logoDataUrl}" alt="社印">` : ""}
    </div>
  </div>
</div>

<button class="print-btn" onclick="window.print()">🖨️ 印刷する</button>

</body>
</html>`;

  const win = window.open("", "_blank", "width=820,height=680");
  if (!win) { alert("ポップアップがブロックされました。ブラウザの設定を確認してください。"); return; }
  win.document.write(html);
  win.document.close();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function ReceiptIssueModal({ total, onClose }: Props) {
  const [addressee, setAddressee] = useState("");
  const [tadashiPreset, setTadashiPreset] = useState<string>(TADASHI_PRESETS[0]);
  const [tadashiFree, setTadashiFree]     = useState("");
  const [isCustom, setIsCustom]           = useState(false);
  const [manualAmount, setManualAmount]   = useState("");

  const resolvedTotal = total ?? parseInt(manualAmount.replace(/,/g, ""), 10);
  const resolvedTadashi = isCustom ? tadashiFree : tadashiPreset;

  const canIssue = total !== undefined
    ? true
    : parseInt(manualAmount.replace(/,/g, ""), 10) > 0;

  const handleIssue = () => {
    const finalTotal = total !== undefined ? total : parseInt(manualAmount.replace(/,/g, ""), 10);
    if (!finalTotal || finalTotal <= 0) return;
    printFormalReceipt({ addressee, tadashi: resolvedTadashi, total: finalTotal });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xl">📄</span>
            <h2 className="text-base font-bold text-slate-800">領収書発行</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* 金額（fixed or manual） */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">金額</label>
            {total !== undefined ? (
              <div className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 text-xl font-bold text-slate-800 text-right">
                ¥{total.toLocaleString()}
              </div>
            ) : (
              <input
                type="text"
                inputMode="numeric"
                value={manualAmount}
                onChange={e => setManualAmount(e.target.value.replace(/[^0-9,]/g, ""))}
                placeholder="例：12000"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            )}
          </div>

          {/* 宛名 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              宛名 <span className="text-slate-400 font-normal text-xs">（空欄の場合は「上様」）</span>
            </label>
            <input
              type="text"
              value={addressee}
              onChange={e => setAddressee(e.target.value)}
              placeholder="例：山田太郎"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          {/* 但書き */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">但書き</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {TADASHI_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => { setTadashiPreset(p); setIsCustom(false); }}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                    !isCustom && tadashiPreset === p
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setIsCustom(true)}
                className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                  isCustom
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                ほか（自由入力）
              </button>
            </div>
            {isCustom && (
              <input
                type="text"
                value={tadashiFree}
                onChange={e => setTadashiFree(e.target.value)}
                placeholder="例：ご会議代として"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                autoFocus
              />
            )}
          </div>

          {/* プレビュー */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500 space-y-0.5 border border-slate-200">
            <p><span className="font-semibold text-slate-600">宛名：</span>{addressee.trim() || "上様"}</p>
            <p><span className="font-semibold text-slate-600">金額：</span>￥{(resolvedTotal || 0).toLocaleString()}ー</p>
            <p><span className="font-semibold text-slate-600">但し：</span>{resolvedTadashi || "─"}</p>
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all active:scale-95"
          >
            キャンセル
          </button>
          <button
            onClick={handleIssue}
            disabled={!canIssue}
            className="flex-2 flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm"
          >
            📄 領収書を発行する
          </button>
        </div>
      </div>
    </div>
  );
}
