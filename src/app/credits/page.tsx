"use client";

// 写真クレジットページ。
// メニュー写真のうち、作者・ライセンスの表示が必要なもの（CC BY / CC BY-SA など）を自動で一覧にする。
// 台帳は src/data/photoCredits.json（node scripts/gen_photo_credits.mjs で自動生成）。
//
// 「行き止まり禁止」: iPhone のホーム画面アイコンから全画面で開いたとき、ブラウザの戻るボタンはない。
// → 画面上部に必ず「← 戻る」を置く。履歴があれば戻る、なければ元の画面へ直接移動する。

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchMenuItems } from "@/lib/db";
import { buildCredits, type PhotoCredit } from "@/lib/photoCredits";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; credits: PhotoCredit[] };

export default function CreditsPage() {
  return (
    <Suspense fallback={<CreditsFallback />}>
      <CreditsInner />
    </Suspense>
  );
}

/**
 * 「← 戻る」の動き。
 *  - ブラウザの履歴があれば素直に戻る
 *  - ホーム画面アイコンから直接開いた等で履歴がないときは、元の画面へ直接移動
 *    （?from=handy ならハンディ、それ以外はお客様の注文画面。role / table は引き継いで同じテーブルに戻す）
 */
function goBack(router: ReturnType<typeof useRouter>, params: { get(name: string): string | null }) {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  if (params.get("from") === "handy") {
    router.push("/handy");
    return;
  }
  const q = new URLSearchParams();
  const role  = params.get("role");
  const table = params.get("table");
  if (role)  q.set("role", role);
  if (table) q.set("table", table);
  const qs = q.toString();
  router.push(qs ? `/customer/order?${qs}` : "/customer/order");
}

// 読み込み中の枠（Suspense の fallback）でも「戻る」は効かせる。URLは押された時点で読む
function CreditsFallback() {
  const router = useRouter();
  return (
    <Shell onBack={() => goBack(router, new URLSearchParams(window.location.search))}>
      <Loading />
    </Shell>
  );
}

function CreditsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState]     = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await fetchMenuItems();
        if (!cancelled) setState({ status: "ready", credits: buildCredits(items) });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  return (
    <Shell onBack={() => goBack(router, searchParams)}>
      {state.status === "loading" && <Loading />}

      {state.status === "error" && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-stone-600">読み込めませんでした。通信状況をご確認ください。</p>
          <button
            type="button"
            onClick={() => { setState({ status: "loading" }); setReloadKey((k) => k + 1); }}
            className="min-h-11 px-5 rounded-xl bg-amber-500 text-stone-900 text-sm font-bold active:scale-95 transition-transform"
          >
            もう一度読み込む
          </button>
        </div>
      )}

      {state.status === "ready" && state.credits.length === 0 && (
        <p className="py-16 text-center text-sm text-stone-500">クレジット表示が必要な写真はありません</p>
      )}

      {state.status === "ready" && state.credits.length > 0 && (
        <ul className="flex flex-col gap-3">
          {state.credits.map((c) => (
            <CreditCard key={c.fileName} credit={c} />
          ))}
        </ul>
      )}
    </Shell>
  );
}

// ─── 共通の枠（ヘッダー＋戻るボタン＋見出し） ─────────────────────────

function Shell({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <header
        className="sticky top-0 z-10 bg-white border-b border-stone-200 px-3 pb-2"
        style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
      >
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={onBack}
            className="min-h-11 px-4 rounded-xl bg-stone-800 text-white text-sm font-bold active:scale-95 transition-transform"
          >
            ← 戻る
          </button>
        </div>
      </header>

      <main
        className="max-w-2xl mx-auto px-4 pt-5"
        style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 pl-3 border-l-4 border-amber-500">
          <h1 className="text-xl font-black text-stone-900 leading-tight">写真クレジット</h1>
          <p className="text-[11px] tracking-widest text-stone-400 mt-0.5">Photo credits</p>
        </div>
        <p className="text-xs leading-relaxed text-stone-600 mb-5">
          メニュー写真の一部は Wikimedia Commons の写真を、各作者のライセンスに従って使っています。画面に合わせて縮小・切り抜きして表示しています。
        </p>
        {children}
      </main>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col items-center gap-3 py-16">
      <div className="w-10 h-10 border-4 border-stone-200 border-t-amber-600 rounded-full animate-spin" />
      <p className="text-sm text-stone-400">読み込み中...</p>
    </div>
  );
}

// ─── 1枚ぶんのカード ───────────────────────────────────────────

const LINK = "text-amber-700 underline underline-offset-2 break-all";

/** "Glass_of_Scotch_and_soda.jpg" → "Glass of Scotch and soda" */
function photoTitle(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
}

function CreditCard({ credit: c }: { credit: PhotoCredit }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={c.imageUrl}
        alt={c.itemNames[0]}
        width={72}
        height={72}
        loading="lazy"
        decoding="async"
        className="w-[72px] h-[72px] flex-shrink-0 rounded-lg object-cover bg-stone-100"
      />
      <dl className="min-w-0 flex-1 flex flex-col gap-1.5 text-sm [overflow-wrap:anywhere]">
        <Row label="作者">{c.author}</Row>
        <Row label="ライセンス">
          {c.licenseUrl ? (
            <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
              {c.license || c.licenseUrl}
            </a>
          ) : (
            c.license || "元の写真のページをご覧ください"
          )}
        </Row>
        <Row label="元の写真">
          {/* CC BY 2.0/3.0 は写真の題名も表示する決まりなので、ファイル名（題名）をリンク文字にする */}
          <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
            {photoTitle(c.fileName)}
          </a>
          <span className="text-stone-400">（Wikimedia Commons）</span>
        </Row>
        <Row label="使っている品">{c.itemNames.join("、")}</Row>
      </dl>
    </li>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold text-stone-400 leading-tight">{label}</dt>
      <dd className="text-stone-800 leading-snug">{children}</dd>
    </div>
  );
}
