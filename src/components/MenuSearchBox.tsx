"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { MenuItem } from "@/types/pos";

// カタカナ→ひらがな正規化（検索マッチ用）
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, "");
}

// メニューの検索対象文字列（名前＋読み仮名）
function searchTargets(item: MenuItem): string[] {
  return [
    normalize(item.name),
    normalize(item.description ?? ""),  // 読み仮名は description に格納
  ].filter(Boolean);
}

// 音声認識が一音の発話を漢字にしてしまった場合の読み仮名テーブル
// 例:「ほ」と言うと「歩」が返る → 「ほ」に変換して再検索する
const KANJI_KANA: Record<string, string> = {
  "歩": "ほ", "保": "ほ", "穂": "ほ", "名": "な", "菜": "な", "奈": "な",
  "実": "み", "身": "み", "味": "み", "三": "み", "手": "て", "天": "て",
  "目": "め", "芽": "め", "気": "き", "木": "き", "黄": "き", "都": "と",
  "戸": "と", "十": "と", "田": "た", "多": "た", "他": "た", "差": "さ",
  "佐": "さ", "課": "か", "蚊": "か", "下": "か", "火": "ひ", "日": "ひ",
  "湯": "ゆ", "由": "ゆ", "世": "せ", "瀬": "せ", "背": "せ", "素": "す",
  "巣": "す", "津": "つ", "通": "つ", "絵": "え", "江": "え", "尾": "お",
  "緒": "お", "和": "わ", "輪": "わ", "葉": "は", "歯": "は", "波": "は",
  "矢": "や", "夜": "よ", "四": "よ", "無": "む", "根": "ね", "音": "ね",
  "値": "ね", "野": "の", "里": "り", "理": "り", "路": "ろ", "間": "ま",
  "真": "ま", "馬": "ま", "空": "そら", "君": "くん", "区": "く", "九": "く",
};

// 短い入力の漢字を読み仮名に変換（2文字以下のときのみ適用）
function kanjiToKana(raw: string): string {
  if (raw.length > 2) return raw;
  return Array.from(raw).map(ch => KANJI_KANA[ch] ?? ch).join("");
}

type Lang = "ja-JP" | "ne-NP" | "en-US" | "zh-CN" | "ko-KR";
const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: "ja-JP", flag: "🇯🇵", label: "日本語" },
  { code: "ne-NP", flag: "🇳🇵", label: "नेपाली" },
  { code: "en-US", flag: "🇺🇸", label: "English" },
  { code: "zh-CN", flag: "🇨🇳", label: "中文" },
  { code: "ko-KR", flag: "🇰🇷", label: "한국어" },
];

type Props = {
  menuItems: MenuItem[];
  onSelect: (item: MenuItem) => void;
  initialLang?: Lang;
  hideLangSelector?: boolean;
  /** 翻訳名など、名前・読み仮名以外の追加検索対象（多言語検索用） */
  extraTargets?: (item: MenuItem) => string[];
  /** 検索欄の説明文の例示（店舗により実在メニューを差し替える） */
  placeholder?: string;
};

// Apple端末（iPhone/iPad/Mac Safari）の音声認識はネパール語非対応
function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
}

// 端末で使えない言語は日本語認識に自動フォールバック
function resolveSpeechLang(lang: Lang): { effective: string; fallbackFrom: Lang | null } {
  if (lang === "ne-NP" && isApplePlatform()) {
    return { effective: "ja-JP", fallbackFrom: "ne-NP" };
  }
  return { effective: lang, fallbackFrom: null };
}

export default function MenuSearchBox({ menuItems, onSelect, initialLang = "ja-JP", hideLangSelector = false, extraTargets, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<Lang>(initialLang);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechInfo, setSpeechInfo] = useState<string | null>(null);
  const recogRef = useRef<any>(null);

  useEffect(() => {
    setLang(initialLang);
  }, [initialLang]);

  useEffect(() => {
    return () => {
      try { recogRef.current?.stop?.(); } catch { /* ignore */ }
    };
  }, []);

  // 検索本体。音声認識の候補選定でも再利用するため関数化
  const searchFor = useCallback((raw: string, useKanaFallback: boolean = true): MenuItem[] => {
    // 音声認識が付けがちな句読点・記号を除去
    const cleaned = raw.replace(/[。、．，.,!?！？\s]+/g, "");
    if (!cleaned) return [];

    const run = (q: string): MenuItem[] => {
      if (!q) return [];
      return menuItems
        .filter(m => m.isAvailable !== false)
        .map(m => {
          // 日本語名・読み仮名に加えて、翻訳名（ネパール語/英語等）も検索対象に
          const targets = [
            ...searchTargets(m),
            ...((extraTargets?.(m) ?? []).map(normalize).filter(Boolean)),
          ];
          let score = 0;
          for (const t of targets) {
            if (t.startsWith(q)) score = Math.max(score, 3);
            else if (t.includes(q)) score = Math.max(score, 1);
          }
          return { item: m, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(x => x.item);
    };

    let list = run(normalize(cleaned));
    // ヒットなし＆短い入力なら、漢字→読み仮名変換して再検索（「歩」→「ほ」）
    if (list.length === 0 && useKanaFallback) {
      const mapped = kanjiToKana(cleaned);
      if (mapped !== cleaned) list = run(normalize(mapped));
    }
    return list;
  }, [menuItems, extraTargets]);

  // 検索欄への表示用テキスト。漢字のままで直接ヒットしないなら読み仮名に変換して見せる
  // （「歩」と表示されるのを防ぎ「ほ」を表示する）
  const displayText = useCallback((raw: string): string => {
    const cleaned = raw.replace(/[。、．，.,!?！？]+/g, "").trim();
    if (!cleaned) return "";
    if (searchFor(cleaned, false).length > 0) return cleaned; // そのままヒットするなら原文
    const mapped = kanjiToKana(cleaned);
    return mapped !== cleaned ? mapped : cleaned;
  }, [searchFor]);

  const results = useMemo(() => searchFor(query), [query, searchFor]);

  // LINE・Instagram等のアプリ内ブラウザ判定（音声認識APIがOS制限で使えない）
  const isInAppBrowser = () => {
    if (typeof navigator === "undefined") return false;
    return /Line\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent);
  };

  const friendlySpeechError = (code: string): string | null => {
    if (code === "aborted") return null; // ユーザー自身の停止・画面遷移。エラー表示しない
    if (code === "service-not-allowed" || code === "not-allowed") {
      return isInAppBrowser()
        ? "LINEなどアプリ内ブラウザでは音声入力が使えません。画面右下の「…」→「他のブラウザで開く」からSafariで開いてください"
        : "マイクの使用が許可されていません。ブラウザ設定でこのサイトのマイクを許可してください";
    }
    if (code === "no-speech")     return "音声が聞き取れませんでした。マイクに近づけてもう一度お話しください";
    if (code === "audio-capture") return "マイクが見つかりません。端末のマイク設定をご確認ください";
    if (code === "network")       return "通信エラーです。ネット環境をご確認ください";
    if (code === "language-not-supported")
      return "この端末はこの言語の音声認識に対応していません。言語を切り替えてお試しください";
    if (code === "bad-grammar")   return "音声を解釈できませんでした。もう一度お試しください";
    return `音声入力エラー: ${code}`;
  };

  // かな・英数のみ（漢字を含まない）判定。短い発話の漢字誤変換対策で使用
  const isKanaOnly = (s: string) => /^[ぁ-んァ-ヶーゝゞ・\sa-zA-Z0-9]+$/.test(s.trim());

  const startListen = () => {
    setSpeechError(null);
    setSpeechInfo(null);
    // アプリ内ブラウザは開始前に案内（試しても必ず失敗するため）
    if (isInAppBrowser()) {
      setSpeechError(friendlySpeechError("service-not-allowed"));
      return;
    }
    const SR = (typeof window !== "undefined") &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) {
      setSpeechError("この端末のブラウザは音声入力に対応していません。Safari または Chrome をご利用ください");
      return;
    }
    // 端末が対応していない言語は日本語認識に自動切替（例: Apple端末のネパール語）
    const { effective, fallbackFrom } = resolveSpeechLang(lang);
    if (fallbackFrom === "ne-NP") {
      setSpeechInfo("🇳🇵 यो उपकरणले नेपाली आवाज बुझ्दैन। कृपया जापानीमा बोल्नुहोस्（この端末はネパール語音声に未対応のため、日本語で認識します）");
    }
    beginRecognition(SR, effective, false);
  };

  const beginRecognition = (SR: any, speechLang: string, isRetry: boolean) => {
    // 二重起動防止：既存の認識が生きていれば止めてから開始
    try { recogRef.current?.abort?.(); } catch { /* ignore */ }
    try {
      const r = new SR();
      r.lang = speechLang;
      r.continuous = false;
      // 話している途中から画面に反映（体感速度を大幅改善）
      r.interimResults = true;
      // 認識候補を複数もらう：「ほ」→「歩」のような漢字誤変換でも
      // 別候補で検索ヒットすればそちらを採用できる
      r.maxAlternatives = 5;

      // 無音・無応答での固まり防止（12秒で自動停止）
      const safetyTimer = setTimeout(() => {
        try { r.stop(); } catch { /* ignore */ }
      }, 12000);
      // 途中経過が止まったら即確定させる（OSの無音待ち1〜2秒を短縮）
      let finalizeTimer: ReturnType<typeof setTimeout> | null = null;
      const scheduleFinalize = () => {
        if (finalizeTimer) clearTimeout(finalizeTimer);
        finalizeTimer = setTimeout(() => {
          try { r.stop(); } catch { /* ignore */ }
        }, 500);
      };
      // 完全無音のまま10秒経ったら諦めて終了させる
      // 注意1: 「音を検知したら即解除」する。3秒固定だった時、ゆっくり話し始めた
      //       正常な発話まで切ってしまい「無反応」に見える事故が起きたため
      // 注意2: iOS Safari初回のマイク許可ダイアログを操作する間もこのタイマーが
      //       進むため、短いと許可完了前にタイムアウトする。10秒に緩和。
      let noResultTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        try { r.stop(); } catch { /* ignore */ }
      }, 10000);
      const clearNoResultTimer = () => {
        if (noResultTimer) { clearTimeout(noResultTimer); noResultTimer = null; }
      };
      // 結果ゼロで終わったかを追跡（無言で待機に戻る「無反応」を撲滅するため）
      let gotResult = false;
      let hadError = false;

      r.onstart = () => setListening(true);
      // マイクストリーム取得時点でも無音タイマーを解除（onsoundstartより早い）
      // iOS Safariは環境音レベルでは onsoundstart が発火しないことがあるため保険
      r.onaudiostart = clearNoResultTimer;
      // 音・話し声を検知したら「無音タイマー」は解除（話している最中に切らない）
      r.onsoundstart = clearNoResultTimer;
      r.onspeechstart = clearNoResultTimer;
      // 話し声が途切れたら0.3秒の猶予をおいて確定（即stopだと結果を取りこぼす）
      r.onspeechend = () => {
        setTimeout(() => { try { r.stop(); } catch { /* ignore */ } }, 300);
      };
      r.onresult = (e: any) => {
        clearNoResultTimer();
        gotResult = true;
        const res = e.results?.[e.results.length - 1];
        if (!res) return;
        if (!res.isFinal) {
          // 途中経過を即時表示（リアルタイム検索）。漢字は読み仮名で表示
          const t = res[0]?.transcript ?? "";
          if (t) setQuery(displayText(t));
          scheduleFinalize();
          return;
        }
        if (finalizeTimer) clearTimeout(finalizeTimer);
        // 確定：全候補から「かなのみ＆ヒット→ヒット→かなのみ→先頭」の優先順で採用
        const alts: string[] = [];
        for (let i = 0; i < res.length; i++) {
          const t = res[i]?.transcript?.trim();
          if (t) alts.push(t);
        }
        const best =
          alts.find(a => isKanaOnly(a) && searchFor(a).length > 0) ??
          alts.find(a => searchFor(a).length > 0) ??
          alts.find(isKanaOnly) ??
          alts[0] ?? "";
        // 表示は必ず読み仮名優先（「歩」ではなく「ほ」を見せる）
        setQuery(displayText(best));
      };
      r.onerror = (e: any) => {
        hadError = true;
        clearTimeout(safetyTimer);
        clearNoResultTimer();
        if (finalizeTimer) clearTimeout(finalizeTimer);
        const code = e.error ?? "unknown";
        // 未対応言語なら日本語認識で1回だけ自動リトライ
        if (code === "language-not-supported" && !isRetry && speechLang !== "ja-JP") {
          setSpeechInfo("この言語の音声認識は端末未対応のため、日本語で認識します");
          setListening(false);
          beginRecognition(SR, "ja-JP", true);
          return;
        }
        const msg = friendlySpeechError(code);
        if (msg) setSpeechError(msg);
        setListening(false);
      };
      r.onend = () => {
        clearTimeout(safetyTimer);
        clearNoResultTimer();
        if (finalizeTimer) clearTimeout(finalizeTimer);
        setListening(false);
        // 何も認識できずに終わった場合は無言で戻らず必ず案内を出す（「無反応」の撲滅）
        if (!gotResult && !hadError) {
          setSpeechError("音声を検出できませんでした。🎤を押してから一呼吸おいて、はっきりお話しください");
        }
      };
      recogRef.current = r;
      r.start();
    } catch (err: any) {
      setSpeechError(err?.message ?? "音声入力を起動できませんでした");
      setListening(false);
    }
  };

  const stopListen = () => {
    try { recogRef.current?.stop?.(); } catch { /* ignore */ }
    setListening(false);
  };

  return (
    <div className="w-full mb-3">
      <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-300 px-3 py-2 shadow-sm">
        {!hideLangSelector && (
          <select
            value={lang}
            onChange={e => setLang(e.target.value as Lang)}
            className="h-11 px-2 rounded-xl bg-slate-100 text-lg border border-slate-200 outline-none cursor-pointer"
            title="音声認識の言語"
            aria-label="音声認識の言語を選択"
          >
            {LANGS.map(l => (
              <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
            ))}
          </select>
        )}
        <button
          onClick={listening ? stopListen : startListen}
          className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold transition-all ${
            listening
              ? "bg-red-500 text-white animate-pulse"
              : "bg-slate-900 text-white hover:bg-slate-700 active:scale-95"
          }`}
          title={listening ? "停止" : "音声で検索"}
          aria-label={listening ? "音声入力を停止" : "音声入力を開始"}
        >
          {listening ? "■" : "🎤"}
        </button>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder ?? "ひらがな・かたかな・音声で検索（例:「なま」で 生ビール・生ガキ）"}
          className="flex-1 bg-transparent outline-none text-base text-slate-800 placeholder:text-slate-400"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm"
            aria-label="クリア"
          >✕</button>
        )}
      </div>

      {speechError && (
        <p className="text-xs text-red-500 mt-1 px-2">{speechError}</p>
      )}
      {speechInfo && !speechError && (
        <p className="text-xs text-amber-600 mt-1 px-2">{speechInfo}</p>
      )}

      {results.length > 0 && (
        <div className="mt-2 bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden max-h-72 overflow-y-auto">
          {results.map(item => (
            <button
              key={item.id}
              onClick={() => {
                onSelect(item);
                setQuery("");
              }}
              className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 active:bg-slate-100 flex items-center gap-3"
            >
              <span className="text-2xl w-8 text-center flex-shrink-0">{item.emoji ?? ""}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-slate-500 truncate">{item.description}</p>
                )}
              </div>
              <span className="text-base font-bold text-slate-700 flex-shrink-0">
                ¥{Math.round(item.price * (1 + (item.taxRate ?? 0.10))).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}

      {query && results.length === 0 && (
        <p className="text-xs text-slate-500 mt-2 px-2">「{query}」に一致するメニューは見つかりません</p>
      )}
    </div>
  );
}
