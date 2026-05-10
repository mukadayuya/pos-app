export type Lang = "ja" | "en" | "zh" | "ko";

export const translations = {
  ja: {
    welcome: "ようこそ",
    chatPlaceholder: "ご質問をどうぞ...",
    sending: "送信中...",
    greeting: "いらっしゃいませ！何かご質問はありますか？",
    upsellTitle: "AIからの特別提案",
    upsellAnalyzing: "カートを分析中...",
    upsellDismiss: "閉じる",
    upsellAdd: "追加する",
  },
  en: {
    welcome: "Welcome",
    chatPlaceholder: "Ask us anything...",
    sending: "Sending...",
    greeting: "Welcome! How can I help you today?",
    upsellTitle: "AI Special Suggestion",
    upsellAnalyzing: "Analyzing your cart...",
    upsellDismiss: "Dismiss",
    upsellAdd: "Add",
  },
  zh: {
    welcome: "欢迎",
    chatPlaceholder: "请输入您的问题...",
    sending: "发送中...",
    greeting: "欢迎光临！请问有什么可以帮您？",
    upsellTitle: "AI 特别推荐",
    upsellAnalyzing: "正在分析您的订单...",
    upsellDismiss: "关闭",
    upsellAdd: "添加",
  },
  ko: {
    welcome: "환영합니다",
    chatPlaceholder: "질문을 입력해 주세요...",
    sending: "전송 중...",
    greeting: "어서오세요！무엇을 도와드릴까요？",
    upsellTitle: "AI 특별 추천",
    upsellAnalyzing: "주문을 분석 중...",
    upsellDismiss: "닫기",
    upsellAdd: "추가",
  },
} as const;

export function t(lang: Lang, key: keyof typeof translations.ja): string {
  return translations[lang][key] ?? translations.ja[key];
}
