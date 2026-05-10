"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { type Lang, t } from "@/lib/i18n";

// ── 定数 ────────────────────────────────────────────────────────

const MENU_CONTEXT =
  "本日のメニュー: 唐揚げ定食(880円), カレーライス(780円), 生姜焼き定食(850円)";

const LANGUAGES: { code: Lang; flag: string; label: string }[] = [
  { code: "ja", flag: "🇯🇵", label: "日本語" },
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "ko", flag: "🇰🇷", label: "한국어" },
];

// ── 型定義 ───────────────────────────────────────────────────────

type ConversationTurn = {
  role: "user" | "model";
  content: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

// ── コンポーネント ────────────────────────────────────────────────

export default function CustomerChatPage() {
  const [lang, setLang] = useState<Lang>("ja");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 言語変更時: 挨拶メッセージをリセット
  useEffect(() => {
    setMessages([
      {
        id: "greeting",
        role: "assistant",
        text: t(lang, "greeting"),
      },
    ]);
    setInput("");
  }, [lang]);

  // 新メッセージ時に末尾へスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // 会話履歴を Gemini 形式に変換（最新20ターン）
    const history: ConversationTurn[] = messages
      .slice(-20)
      .filter((m) => m.id !== "greeting")
      .map((m) => ({
        role: m.role === "user" ? "user" : "model",
        content: m.text,
      }));

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          message: trimmed,
          menuContext: MENU_CONTEXT,
          conversationHistory: history,
        }),
      });

      const data = (await res.json()) as { ok: boolean; result?: string; error?: string };

      const aiText =
        data.ok && data.result
          ? data.result
          : data.error ?? "エラーが発生しました。もう一度お試しください。";

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: aiText,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: "assistant",
          text: "接続エラーが発生しました。もう一度お試しください。",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-lg">💬</span>
          </div>
          <div>
            <p className="text-white font-black text-lg leading-none tracking-tight">FLOWS</p>
            <p className="text-violet-200 text-xs font-medium mt-0.5">AI アシスタント</p>
          </div>
        </div>

        {/* 言語セレクタ */}
        <div className="max-w-lg mx-auto mt-3 flex gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                lang === l.code
                  ? "bg-white text-violet-700 shadow-md"
                  : "bg-white/20 text-white hover:bg-white/30",
              ].join(" ")}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* メッセージエリア */}
      <main className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* タイピングインジケーター */}
          {isTyping && <TypingIndicator />}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* 入力エリア */}
      <footer className="bg-white border-t border-slate-100 px-4 py-3 shadow-[0_-4px_16px_rgb(0,0,0,0.06)]">
        <form
          onSubmit={handleSubmit}
          className="max-w-lg mx-auto flex gap-2 items-end"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isTyping ? t(lang, "sending") : t(lang, "chatPlaceholder")}
            disabled={isTyping}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400
              focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent
              disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center
              text-white shadow-[0_2px_12px_rgba(139,92,246,0.4)]
              hover:shadow-[0_4px_20px_rgba(139,92,246,0.55)] hover:-translate-y-0.5
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0
              active:scale-95 transition-all"
            aria-label="送信"
          >
            <SendIcon />
          </button>
        </form>
      </footer>
    </div>
  );
}

// ── サブコンポーネント ────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mr-2 flex-shrink-0 mt-1 shadow-sm">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      )}
      <div
        className={[
          "max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-tr-sm shadow-[0_2px_12px_rgba(139,92,246,0.35)]"
            : "bg-white text-slate-800 rounded-tl-sm shadow-[0_2px_12px_rgb(0,0,0,0.07)] ring-1 ring-black/[0.04]",
        ].join(" ")}
      >
        {message.text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mr-2 flex-shrink-0 shadow-sm">
        <span className="text-white text-xs font-bold">AI</span>
      </div>
      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-[0_2px_12px_rgb(0,0,0,0.07)] ring-1 ring-black/[0.04] flex items-center gap-1">
        <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5 translate-x-0.5"
    >
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  );
}
