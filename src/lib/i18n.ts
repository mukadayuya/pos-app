export type Lang = "ja" | "en" | "zh" | "ko";

export const translations = {
  ja: {
    welcome: "ようこそ",
    chatPlaceholder: "ご質問をどうぞ...",
    sending: "送信中...",
    greeting: "いらっしゃいませ！何かご質問はありますか？",
  },
  en: {
    welcome: "Welcome",
    chatPlaceholder: "Ask us anything...",
    sending: "Sending...",
    greeting: "Welcome! How can I help you today?",
  },
  zh: {
    welcome: "欢迎",
    chatPlaceholder: "请输入您的问题...",
    sending: "发送中...",
    greeting: "欢迎光临！请问有什么可以帮您？",
  },
  ko: {
    welcome: "환영합니다",
    chatPlaceholder: "질문을 입력해 주세요...",
    sending: "전송 중...",
    greeting: "어서오세요！무엇을 도와드릴까요？",
  },
} as const;

export function t(lang: Lang, key: keyof typeof translations.ja): string {
  return translations[lang][key] ?? translations.ja[key];
}
