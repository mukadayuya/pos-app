"use client";
import { useState, useRef, useEffect } from "react";
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
};

export default function MenuSearchBox({ menuItems, onSelect, initialLang = "ja-JP", hideLangSelector = false }: Props) {
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<Lang>(initialLang);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recogRef = useRef<any>(null);

  useEffect(() => {
    setLang(initialLang);
  }, [initialLang]);

  useEffect(() => {
    return () => {
      try { recogRef.current?.stop?.(); } catch { /* ignore */ }
    };
  }, []);

  const results = query.trim() === "" ? [] : (() => {
    const q = normalize(query);
    return menuItems
      .filter(m => m.isAvailable !== false)
      .map(m => {
        const targets = searchTargets(m);
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
  })();

  const startListen = () => {
    setSpeechError(null);
    const SR = (typeof window !== "undefined") &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) {
      setSpeechError("この端末は音声入力に対応していません");
      return;
    }
    try {
      const r = new SR();
      r.lang = lang;
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onstart = () => setListening(true);
      r.onresult = (e: any) => {
        const text = e.results?.[0]?.[0]?.transcript ?? "";
        setQuery(text);
      };
      r.onerror = (e: any) => {
        setSpeechError(`音声入力エラー: ${e.error ?? "unknown"}`);
        setListening(false);
      };
      r.onend = () => setListening(false);
      recogRef.current = r;
      r.start();
    } catch (err: any) {
      setSpeechError(err?.message ?? "音声入力を起動できませんでした");
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
              : "bg-orange-500 text-white hover:bg-orange-600 active:scale-95"
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
          placeholder="ひらがな・かたかな・音声で検索（例:「な」で 生ビール・なんこつ）"
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

      {results.length > 0 && (
        <div className="mt-2 bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden max-h-72 overflow-y-auto">
          {results.map(item => (
            <button
              key={item.id}
              onClick={() => {
                onSelect(item);
                setQuery("");
              }}
              className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-orange-50 active:bg-orange-100 flex items-center gap-3"
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
