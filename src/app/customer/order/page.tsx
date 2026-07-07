"use client";

import { useState, useEffect, useRef, useCallback, FormEvent, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MenuItem, OptionSelection } from "@/types/pos";
import { fetchMenuItems, fetchCategories, CategoryRecord } from "@/lib/db";
import { menuItems as staticMenuItems, staticCategories, DEFAULT_RICE_OPTION_GROUPS } from "@/data/menu";
import { menuNameTranslations } from "@/data/menuTranslations";
import { tokyoGyozaMenuItems, tokyoGyozaCategories } from "@/data/tokyoGyozaMenu";
import { isSupabaseConfigured } from "@/lib/supabase";
import { type Lang, t } from "@/lib/i18n";
import type { UpsellSuggestion } from "@/app/api/upsell/route";
import VideoBackground from "@/components/VideoBackground";
import { addKdsOrder } from "@/lib/kdsStore";
import { recordOrder } from "@/lib/toppingAnalytics";

// ─── 店舗設定 ──────────────────────────────────────────────────
const IS_REGISTER_CHECKOUT = process.env.NEXT_PUBLIC_STORE_ID === "kitchen-wa";
const IS_TOKYO_GYOZA = process.env.NEXT_PUBLIC_STORE_ID === "tokyo-gyoza-ro";

// ─── 型定義 ────────────────────────────────────────────────────

type ServingTime = "before" | "with" | "after";

interface CartItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  servingTime: ServingTime;
  selectedOptions: OptionSelection[];
}

type ActiveTab = "menu" | "cart" | "ai" | "checkout";

type ConversationTurn = {
  role: "user" | "model";
  content: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

// ─── 定数 ────────────────────────────────────────────────────────

const LANGUAGES: { code: Lang; flag: string; label: string }[] = IS_TOKYO_GYOZA
  ? [
      { code: "ja", flag: "🇯🇵", label: "日本語" },
      { code: "en", flag: "🇺🇸", label: "English" },
      { code: "zh", flag: "🇨🇳", label: "中文" },
      { code: "ko", flag: "🇰🇷", label: "한국어" },
      { code: "th", flag: "🇹🇭", label: "ภาษาไทย" },
    ]
  : [
      { code: "ja", flag: "🇯🇵", label: "日本語" },
      { code: "en", flag: "🇺🇸", label: "English" },
      { code: "zh", flag: "🇨🇳", label: "中文" },
      { code: "ko", flag: "🇰🇷", label: "한국어" },
      { code: "es", flag: "🇪🇸", label: "Español" },
      { code: "hi", flag: "🇮🇳", label: "हिन्दी" },
      { code: "bn", flag: "🇧🇩", label: "বাংলা" },
    ];

// ─── ユーティリティ ────────────────────────────────────────────────

function calcItemTotal(item: CartItem): number {
  const optionDelta = item.selectedOptions.reduce((s, o) => s + o.price, 0);
  return (item.menuItem.price + optionDelta) * item.quantity;
}

function formatPrice(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function localName(item: MenuItem, lang: Lang): string {
  if (lang === "en") return menuNameTranslations[item.id]?.en ?? item.name_en ?? item.name;
  if (lang === "zh") return item.name_zh ?? item.name;
  if (lang === "ko") return item.name_ko ?? item.name;
  if (lang === "es") return menuNameTranslations[item.id]?.es ?? item.name_en ?? item.name;
  if (lang === "hi") return menuNameTranslations[item.id]?.hi ?? item.name_en ?? item.name;
  if (lang === "bn") return menuNameTranslations[item.id]?.bn ?? item.name_en ?? item.name;
  if (lang === "th") return menuNameTranslations[item.id]?.th ?? item.name_en ?? item.name;
  return item.name;
}

const CATEGORY_TRANSLATIONS: Record<string, { es: string; hi: string }> = {
  "広島お好み焼き": { es: "Okonomiyaki de Hiroshima", hi: "हिरोशिमा ओकोनोमियाकी" },
  "大阪お好み焼き": { es: "Okonomiyaki de Osaka",     hi: "ओसाका ओकोनोमियाकी" },
  "焼きそば・焼きうどん": { es: "Yakisoba y Yaki-udon", hi: "याकिसोबा और याकी-उडोन" },
  "鉄板焼き":       { es: "Teppanyaki",               hi: "तेप्पान्याकी" },
  "牛すじ料理":     { es: "Platos de tendón",         hi: "बीफ टेंडन डिश" },
  "おつまみ":       { es: "Aperitivos",               hi: "स्नैक्स" },
  "サラダ":         { es: "Ensaladas",                hi: "सलाद" },
  "ごはんもの":     { es: "Platos de arroz",          hi: "चावल की डिश" },
  "デザート":       { es: "Postres",                  hi: "मिठाई" },
  "トッピング":     { es: "Extras",                   hi: "टॉपिंग" },
  "ランチ":         { es: "Almuerzo",                 hi: "लंच" },
  // 焼鳥居酒屋ABC
  "焼鳥":           { es: "Yakitori",                 hi: "याकितोरी" },
  "揚げ物":         { es: "Frituras",                 hi: "तले हुए व्यंजन" },
  "一品料理":       { es: "A la carta",               hi: "एकल व्यंजन" },
  "野菜・サラダ":   { es: "Ensaladas",                hi: "सलाद" },
  "ご飯・〆":       { es: "Arroz y platos finales",   hi: "चावल और समापन" },
  "甘味":           { es: "Postres",                  hi: "मिठाई" },
  "ドリンク":       { es: "Bebidas",                  hi: "ड्रिंक्स" },
};

const CATEGORY_TH: Record<string, string> = {
  "餃子":     "เกี๊ยว",
  "一品料理": "อาหารเดี่ยว",
  "ラーメン": "ราเมน",
  "セット":   "เซ็ต",
  "ドリンク": "เครื่องดื่ม",
};

const CATEGORY_BN: Record<string, string> = {
  "広島お好み焼き": "হিরোশিমা ওকোনোমিয়াকি",
  "大阪お好み焼き": "ওসাকা ওকোনোমিয়াকি",
  "焼きそば・焼きうどん": "ইয়াকিসোবা ও ইয়াকি-উডন",
  "鉄板焼き":       "তেপ্পানইয়াকি",
  "牛すじ料理":     "বিফ টেন্ডন ডিশ",
  "おつまみ":       "স্ন্যাকস",
  "サラダ":         "সালাদ",
  "ごはんもの":     "ভাতের ডিশ",
  "デザート":       "ডেজার্ট",
  "トッピング":     "টপিং",
  "ランチ":         "লাঞ্চ",
  // 焼鳥居酒屋ABC
  "焼鳥":           "ইয়াকিতোরি",
  "揚げ物":         "ভাজা খাবার",
  "一品料理":       "একক পদ",
  "野菜・サラダ":   "সালাদ",
  "ご飯・〆":       "ভাত ও শেষ পদ",
  "甘味":           "মিষ্টি",
  "ドリンク":       "ড্রিংকস",
};

function localCategoryName(cat: { name: string; name_en?: string; name_zh?: string; name_ko?: string }, lang: Lang): string {
  if (lang === "en") return cat.name_en ?? cat.name;
  if (lang === "zh") return cat.name_zh ?? cat.name;
  if (lang === "ko") return cat.name_ko ?? cat.name;
  if (lang === "es") return CATEGORY_TRANSLATIONS[cat.name]?.es ?? cat.name_en ?? cat.name;
  if (lang === "hi") return CATEGORY_TRANSLATIONS[cat.name]?.hi ?? cat.name_en ?? cat.name;
  if (lang === "bn") return CATEGORY_BN[cat.name] ?? cat.name_en ?? cat.name;
  if (lang === "th") return CATEGORY_TH[cat.name] ?? cat.name_en ?? cat.name;
  return cat.name;
}

function localDescription(item: MenuItem, lang: Lang): string | undefined {
  if (lang === "en") return item.description_en ?? item.description;
  if (lang === "zh") return item.description_zh ?? item.description;
  if (lang === "ko") return item.description_ko ?? item.description;
  if (lang === "th") return item.description_th ?? item.description_en ?? item.description;
  if (lang === "es" || lang === "hi" || lang === "bn") return item.description_en ?? item.description;
  return item.description;
}

// ─── Error Boundary ─────────────────────────────────────────────

class OrderErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 max-w-sm w-full text-center space-y-4">
            <span className="text-5xl">⚠️</span>
            <h2 className="text-lg font-black text-gray-700">読み込みエラー</h2>
            <p className="text-gray-400 text-sm">メニューの取得に失敗しました。</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="w-full bg-gray-200 text-white font-bold py-3 rounded-2xl hover:bg-gray-300 transition-colors"
            >
              再試行
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── メインページ ─────────────────────────────────────────────

export default function CustomerOrderPage() {
  return (
    <OrderErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
            <p className="text-gray-300 text-sm">読み込み中...</p>
          </div>
        </div>
      }>
        <CustomerOrderInner />
      </Suspense>
    </OrderErrorBoundary>
  );
}

// ─── 内部コンポーネント ─────────────────────────────────────────────

function CustomerOrderInner() {
  const router = useRouter();
  useEffect(() => { if (IS_REGISTER_CHECKOUT) router.replace("/register"); }, [router]);
  if (IS_REGISTER_CHECKOUT) return null;

  const searchParams = useSearchParams();
  const roleParam  = searchParams.get("role");
  const tableParam = searchParams.get("table");
  const isTable    = roleParam !== "mobile";

  const [menuItems, setMenuItems]   = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadSlow, setLoadSlow]     = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>("menu");
  const [lang, setLang]           = useState<Lang>("ja");

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("flows_cart_v1");
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [sentCart, setSentCart] = useState<CartItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");

  const [detailItem, setDetailItem]         = useState<MenuItem | null>(null);
  const [orderSentModal, setOrderSentModal] = useState(false);
  const [checkoutCalled, setCheckoutCalled] = useState(false);

  const [upsellBanner, setUpsellBanner]   = useState<UpsellSuggestion | null>(null);
  const [upsellLoading, setUpsellLoading] = useState(false);
  const upsellDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upsellDismissRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [isTyping, setIsTyping]         = useState(false);
  const chatBottomRef    = useRef<HTMLDivElement>(null);
  const pendingAiMessage = useRef<string | null>(null);

  useEffect(() => {
    const slowTimer = setTimeout(() => setLoadSlow(true), 3000);
    async function load() {
      try {
        let items: MenuItem[];
        let cats: CategoryRecord[];
        if (IS_TOKYO_GYOZA) {
          items = tokyoGyozaMenuItems;
          cats  = tokyoGyozaCategories;
        } else if (isSupabaseConfigured) {
          const timeout = new Promise<never>((_, r) =>
            setTimeout(() => r(new Error("fetch timeout")), 5000)
          );
          [items, cats] = await Promise.race([
            Promise.all([fetchMenuItems(), fetchCategories()]),
            timeout,
          ]);
          if (items.length === 0) { items = staticMenuItems; cats = staticCategories; }
        } else {
          items = staticMenuItems;
          cats  = staticCategories;
        }
        setMenuItems(items);
        setCategories(cats);
      } catch {
        setMenuItems(staticMenuItems);
        setCategories(staticCategories);
      } finally {
        clearTimeout(slowTimer);
        setLoading(false);
        setLoadSlow(false);
      }
    }
    load();
    return () => clearTimeout(slowTimer);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("flows_cart_v1", JSON.stringify(cart)); } catch { /* quota */ }
  }, [cart]);

  useEffect(() => {
    setChatMessages([{ id: "greeting", role: "assistant", text: t(lang, "greeting") }]);
  }, [lang]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isTyping]);

  useEffect(() => {
    if (activeTab === "ai" && pendingAiMessage.current) {
      const msg = pendingAiMessage.current;
      pendingAiMessage.current = null;
      sendChatMessage(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const filteredItems = (
    activeCategoryId === "all"
      ? menuItems
      : menuItems.filter((m) => m.category === activeCategoryId)
  ).filter(m => m.isAvailable !== false);

  const toppingCategoryId = categories.find(c => c.name === "トッピング")?.id ?? null;
  const toppingItems = toppingCategoryId ? menuItems.filter(i => i.category === toppingCategoryId) : [];

  const getCategoryName = useCallback(
    (id: string): string => {
      const cat = categories.find((c) => c.id === id);
      return cat?.name ?? id;
    },
    [categories],
  );

  function addToCart(item: MenuItem, quantity: number, servingTime: ServingTime, selectedOptions: OptionSelection[]) {
    setCart(prev => [...prev, { id: `${item.id}-${Date.now()}`, menuItem: item, quantity, servingTime, selectedOptions }]);
  }

  function removeFromCart(cartId: string) {
    setCart(prev => prev.filter(c => c.id !== cartId));
  }

  function incrementCart(cartId: string) {
    setCart(prev => prev.map(c => c.id === cartId ? { ...c, quantity: c.quantity + 1 } : c));
  }

  function decrementCart(cartId: string) {
    setCart(prev => prev.reduce<CartItem[]>((acc, c) => {
      if (c.id === cartId) { if (c.quantity > 1) acc.push({ ...c, quantity: c.quantity - 1 }); }
      else { acc.push(c); }
      return acc;
    }, []));
  }

  const prevCartLengthRef = useRef(0);
  const prevLangRef = useRef<Lang>(lang);
  useEffect(() => {
    const added = cart.length > prevCartLengthRef.current;
    const langChanged = lang !== prevLangRef.current;
    prevCartLengthRef.current = cart.length;
    prevLangRef.current = lang;
    if (!added && !langChanged) return;
    if (cart.length === 0) return;
    if (menuItems.length === 0) return; // メニュー未ロード時は発火しない
    setUpsellBanner(null);
    if (upsellDismissRef.current) clearTimeout(upsellDismissRef.current);
    if (cart.length > 6) return;
    if (upsellDebounceRef.current) clearTimeout(upsellDebounceRef.current);
    upsellDebounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 8000);
      setUpsellLoading(true);
      fetch("/api/upsell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          cartItems: cart.map(c => ({ name: localName(c.menuItem, lang), emoji: c.menuItem.emoji, category: c.menuItem.category, price: c.menuItem.price })),
          lang,
          allMenuItems: (menuItems.filter(m => m.category === "drink").length > 0
            ? menuItems.filter(m => m.category === "drink")
            : menuItems.slice(0, 30)
          ).map(m => ({ name: localName(m, lang), emoji: m.emoji, category: m.category, price: m.price })),
        }),
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((data: { ok: boolean; suggestion?: UpsellSuggestion }) => {
          if (data.ok && data.suggestion) {
            setUpsellBanner(data.suggestion);
            upsellDismissRef.current = setTimeout(() => setUpsellBanner(null), 18000);
          }
        })
        .catch(() => { /* silent */ })
        .finally(() => { clearTimeout(timeoutId); setUpsellLoading(false); });
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, lang, menuItems]);

  useEffect(() => {
    return () => {
      if (upsellDebounceRef.current) clearTimeout(upsellDebounceRef.current);
      if (upsellDismissRef.current)  clearTimeout(upsellDismissRef.current);
    };
  }, []);

  const cartTotal = cart.reduce((s, c) => s + calcItemTotal(c), 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const sendChatMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text };
      setChatMessages((prev) => [...prev, userMsg]);
      setChatInput("");
      setIsTyping(true);

      const history: ConversationTurn[] = chatMessages
        .slice(-20)
        .filter((m) => m.id !== "greeting")
        .map((m) => ({ role: m.role === "user" ? "user" : "model", content: m.text }));

      const menuContext = cart.length > 0
        ? cart.map((c) => `${c.menuItem.emoji ?? ""} ${localName(c.menuItem, lang)} ×${c.quantity}`).join(", ")
        : undefined;

      try {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "chat", message: text, menuContext, conversationHistory: history, lang }),
        });
        const data = await res.json() as { ok: boolean; result?: string; error?: string };
        const aiText = data.ok && data.result ? data.result : data.error ?? t(lang, "aiError");
        setChatMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: aiText }]);
      } catch {
        setChatMessages((prev) => [...prev, { id: `a-err-${Date.now()}`, role: "assistant", text: t(lang, "aiError") }]);
      } finally {
        setIsTyping(false);
      }
    },
    [chatMessages, cart, lang],
  );

  function handleChatSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isTyping) return;
    sendChatMessage(trimmed);
  }

  function handleAiConsult(item: MenuItem) {
    pendingAiMessage.current = `${t(lang, "aiConsultPrompt")}: ${localName(item, lang)} (${formatPrice(item.price)})`;
    setActiveTab("ai");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-100 border-t-stone-800 rounded-full animate-spin" />
          <p className="text-gray-300 text-sm">{t(lang, "loadingMenu")}</p>
          {loadSlow && (
            <div className="flex flex-col items-center gap-2 mt-2">
              <p className="text-gray-300 text-xs">{t(lang, "loadingSlow")}</p>
              <button
                onClick={() => { setMenuItems(staticMenuItems); setCategories(staticCategories); setLoading(false); }}
                className="px-5 py-2.5 bg-gray-200 text-white text-sm font-bold rounded-xl shadow hover:bg-gray-300 transition-colors"
              >
                {t(lang, "startOffline")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      {/* ── ヘッダー ── */}
      <header className="h-14 flex-shrink-0 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
            <span className="text-gray-600 text-xs font-black tracking-tight">FL</span>
          </div>
          <div className="leading-none">
            <p className="text-gray-800 font-black text-base tracking-tight">FLOWS</p>
            {isTable && tableParam ? (
              <p className="text-gray-400 text-[11px] font-medium">{tableParam}{t(lang, "tableLabel")}</p>
            ) : (
              <p className="text-gray-400 text-[10px] font-medium tracking-widest uppercase">
                {isTable ? t(lang, "tableOrderTitle") : t(lang, "mobileOrderTitle")}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-0.5">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={[
                "w-7 h-7 rounded-full text-sm flex items-center justify-center transition-all",
                lang === l.code ? "bg-gray-100 shadow-sm scale-110" : "hover:bg-gray-50",
              ].join(" ")}
              title={l.label}
            >
              {l.flag}
            </button>
          ))}
        </div>
      </header>

      {/* ── メインコンテンツ ── */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === "menu" && (
          <MenuTab
            items={filteredItems}
            categories={categories}
            menuItems={menuItems}
            activeCategoryId={activeCategoryId}
            onCategoryChange={setActiveCategoryId}
            getCategoryName={getCategoryName}
            cart={cart}
            cartTotal={cartTotal}
            cartCount={cartCount}
            lang={lang}
            onOpenDetail={setDetailItem}
            onAiConsult={handleAiConsult}
            onGoToCart={() => setActiveTab("cart")}
          />
        )}
        {activeTab === "cart" && (
          <CartTab
            cart={cart}
            cartTotal={cartTotal}
            lang={lang}
            onRemove={removeFromCart}
            onIncrement={incrementCart}
            onDecrement={decrementCart}
            onSwitchMenu={() => setActiveTab("menu")}
            onOrderSent={() => {
              addKdsOrder({
                id: `order-${Date.now()}`,
                items: cart.map(c => ({
                  name: c.menuItem.name, emoji: c.menuItem.emoji,
                  options: c.selectedOptions.map(o => `${o.groupName}: ${o.itemName}`),
                  qty: c.quantity, servingTime: c.servingTime,
                })),
                lang, createdAt: Date.now(), status: "new",
              });
              recordOrder(cart.map(c => c.menuItem.name));
              setSentCart([...cart]);
              setCart([]);
              localStorage.removeItem("flows_cart_v1");
              setCheckoutCalled(false);
              setOrderSentModal(true);
              setActiveTab("menu");
            }}
          />
        )}
        {activeTab === "ai" && (
          <AiTab
            lang={lang}
            messages={chatMessages}
            input={chatInput}
            isTyping={isTyping}
            bottomRef={chatBottomRef}
            onInputChange={setChatInput}
            onSubmit={handleChatSubmit}
          />
        )}
        {activeTab === "checkout" && (() => {
          const displayCart  = cart.length > 0 ? cart : sentCart;
          const displayTotal = displayCart.reduce((s, c) => s + calcItemTotal(c), 0);
          return (
            <CheckoutTab
              cart={displayCart}
              cartTotal={displayTotal}
              lang={lang}
              called={checkoutCalled}
              isRegister={IS_REGISTER_CHECKOUT}
              onCall={() => setCheckoutCalled(true)}
            />
          );
        })()}
      </main>

      {/* ── アップセルバナー ── */}
      {(upsellBanner || upsellLoading) && (
        <UpsellBanner
          suggestion={upsellBanner}
          loading={upsellLoading}
          lang={lang}
          onDismiss={() => { setUpsellBanner(null); if (upsellDismissRef.current) clearTimeout(upsellDismissRef.current); }}
          onCta={(targetName) => {
            const found = menuItems.find(m => m.name === targetName);
            setUpsellBanner(null);
            if (upsellDismissRef.current) clearTimeout(upsellDismissRef.current);
            if (found) { setDetailItem(found); } else { setActiveTab("menu"); }
          }}
        />
      )}

      {/* ── ボトムタブバー ── */}
      <nav className="h-16 flex-shrink-0 bg-white border-t border-gray-100 flex z-20">
        <TabButton icon="🍽️" label={t(lang, "tabMenu")}  active={activeTab === "menu"}     onClick={() => setActiveTab("menu")} />
        <TabButton icon="🛒" label={t(lang, "tabCart")}  active={activeTab === "cart"}     onClick={() => setActiveTab("cart")} badge={cartCount > 0 ? cartCount : undefined} />
        <TabButton icon="💬" label={t(lang, "tabAi")}    active={activeTab === "ai"}       onClick={() => setActiveTab("ai")} />
        <TabButton icon="💳" label={t(lang, "tabBill")}  active={activeTab === "checkout"} onClick={() => setActiveTab("checkout")} />
      </nav>

      {detailItem && (
        <ProductDetailModal
          item={detailItem}
          lang={lang}
          toppingItems={toppingItems}
          onClose={() => setDetailItem(null)}
          onAddToCart={(qty, servingTime, opts) => { addToCart(detailItem, qty, servingTime, opts); setDetailItem(null); }}
        />
      )}

      {orderSentModal && (
        <SuccessModal message={t(lang, IS_REGISTER_CHECKOUT ? "orderSuccessRegister" : "orderSuccess")} onClose={() => setOrderSentModal(false)} />
      )}
    </div>
  );
}

// ─── タブボタン ────────────────────────────────────────────────

function TabButton({ icon, label, active, badge, onClick }: {
  icon: string; label: string; active: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center justify-center gap-0.5 relative pt-1">
      <span className={["absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full transition-all duration-200", active ? "bg-gray-400" : "bg-transparent"].join(" ")} />
      <span className="relative">
        <span className="text-xl leading-none">{icon}</span>
        {badge !== undefined && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] bg-gray-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {badge}
          </span>
        )}
      </span>
      <span className={["text-[10px] font-semibold leading-none transition-colors duration-200", active ? "text-gray-700" : "text-gray-400"].join(" ")}>
        {label}
      </span>
    </button>
  );
}

// ─── メニュータブ ──────────────────────────────────────────────

function MenuTab({
  items, categories, menuItems, activeCategoryId, onCategoryChange,
  getCategoryName, cart, cartTotal, cartCount, lang,
  onOpenDetail, onAiConsult, onGoToCart,
}: {
  items: MenuItem[];
  categories: CategoryRecord[];
  menuItems: MenuItem[];
  activeCategoryId: string;
  onCategoryChange: (id: string) => void;
  getCategoryName: (id: string) => string;
  cart: CartItem[];
  cartTotal: number;
  cartCount: number;
  lang: Lang;
  onOpenDetail: (item: MenuItem) => void;
  onAiConsult: (item: MenuItem) => void;
  onGoToCart: () => void;
}) {
  const allCategories: { id: string; name: string }[] =
    categories.length > 0
      ? categories
      : Array.from(new Set(menuItems.map((m) => m.category))).map((c) => ({ id: c, name: c }));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 横スクロールカテゴリーピル */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-3 py-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => onCategoryChange("all")}
            className={["px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              activeCategoryId === "all" ? "bg-gray-200 text-gray-700" : "bg-gray-50 text-gray-400 hover:bg-gray-100",
            ].join(" ")}
          >
            {t(lang, "allItems")}
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={["px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                activeCategoryId === cat.id ? "bg-gray-200 text-gray-700" : "bg-gray-50 text-gray-400 hover:bg-gray-100",
              ].join(" ")}
            >
              {localCategoryName(cat, lang)}
            </button>
          ))}
        </div>
      </div>

      {/* 商品グリッド */}
      <div className="flex-1 overflow-y-auto p-3 pb-0">
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              cartQty={cart.filter((c) => c.menuItem.id === item.id).reduce((s, c) => s + c.quantity, 0)}
              lang={lang}
              onClick={() => onOpenDetail(item)}
              onAiConsult={() => onAiConsult(item)}
            />
          ))}
          {items.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-300 gap-2">
              <span className="text-5xl">🍽️</span>
              <p className="text-sm font-medium">{t(lang, "noItems")}</p>
            </div>
          )}
        </div>
        {cartCount > 0 && <div className="h-16" />}
      </div>

      {/* スティッキーカートバー */}
      {cartCount > 0 && (
        <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-500">
            {cartCount}{lang === "ja" ? "点" : lang === "zh" ? "件" : lang === "ko" ? "개" : " item(s)"}
          </span>
          <button
            onClick={onGoToCart}
            className="flex items-center gap-2 bg-gray-200 text-gray-600 font-bold px-5 py-2 rounded-xl text-sm active:scale-95 transition-all"
          >
            {t(lang, "cartBarSee")} {formatPrice(cartTotal)} →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 商品カード ────────────────────────────────────────────────

function ProductCard({ item, cartQty, lang, onClick, onAiConsult }: {
  item: MenuItem;
  cartQty: number;
  lang: Lang;
  onClick: () => void;
  onAiConsult: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-col active:scale-[0.97] transition-transform">
      {/* ビジュアルエリア */}
      <button
        onClick={onClick}
        className="w-full aspect-[4/3] overflow-hidden flex items-center justify-center relative bg-gray-50"
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-5xl drop-shadow-sm select-none">{item.emoji ?? "🍽️"}</span>
        )}
        {cartQty > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[22px] h-[22px] bg-gray-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 ring-2 ring-white">
            {cartQty}
          </span>
        )}
      </button>

      {/* テキスト・アクション */}
      <div className="px-2.5 pt-2 pb-2.5 flex flex-col flex-1">
        <button onClick={onClick} className="text-left flex-1">
          <p className="font-medium text-gray-700 text-xs leading-snug line-clamp-2">{localName(item, lang)}</p>
          <p className="text-gray-700 font-bold text-sm mt-0.5">{formatPrice(item.price)}</p>
        </button>
        <div className="flex items-center gap-1.5 mt-2">
          <button
            onClick={onClick}
            className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1 whitespace-nowrap active:scale-95 transition-all hover:bg-gray-200"
          >
            <span className="text-sm font-black leading-none">＋</span>
            <span>{t(lang, "add")}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAiConsult(); }}
            className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
            title="AIコンシェルジュに相談"
          >
            <span className="text-[10px] font-black text-gray-600 tracking-tight">AI</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 商品詳細モーダル ──────────────────────────────────────────

const COMBO_TOASTS: Record<Lang, string[]> = {
  ja: ["✨ その組み合わせ、シェフのお墨付き！", "👨‍🍳 最高のカスタマイズです！", "🎯 絶妙な選択！"],
  en: ["✨ Chef-approved combo!", "👨‍🍳 Excellent customization!", "🎯 Great choice!"],
  zh: ["✨ 主厨认可的搭配！", "👨‍🍳 绝妙组合！", "🎯 好选择！"],
  ko: ["✨ 셰프 인정 조합!", "👨‍🍳 완벽한 커스터마이징!", "🎯 훌륭한 선택!"],
  es: ["✨ ¡Combinación aprobada por el chef!", "👨‍🍳 ¡Excelente elección!", "🎯 ¡Perfecto!"],
  hi: ["✨ शेफ की पसंद!", "👨‍🍳 बेहतरीन चुनाव!", "🎯 परफेक्ट कॉम्बो!"],
  bn: ["✨ শেফের পছন্দ!", "👨‍🍳 চমৎকার সমন্বয়!", "🎯 দারুণ পছন্দ!"],
  th: ["✨ เมนูแนะนำจากเชฟ!", "👨‍🍳 การเลือกที่ยอดเยี่ยม!", "🎯 ดีมาก!"],
};

function ProductDetailModal({ item, lang, toppingItems, onClose, onAddToCart }: {
  item: MenuItem;
  lang: Lang;
  toppingItems: MenuItem[];
  onClose: () => void;
  onAddToCart: (qty: number, servingTime: ServingTime, opts: OptionSelection[]) => void;
}) {
  const [quantity, setQuantity]     = useState(1);
  const [servingTime, setServingTime] = useState<ServingTime>("with");
  const optionGroups = IS_REGISTER_CHECKOUT
    ? (item.options?.optionGroups ?? (item.category !== "drink" ? DEFAULT_RICE_OPTION_GROUPS : []))
    : (item.options?.optionGroups ?? []);
  const [selectedOptions, setSelectedOptions] = useState<OptionSelection[]>(() =>
    optionGroups.map((g) => ({
      groupId: g.id, groupName: g.name,
      itemId: g.items[0].id, itemName: g.items[0].name, price: g.items[0].price,
    }))
  );
  const [selectedToppings, setSelectedToppings] = useState<Set<string>>(new Set());
  const showToppings = toppingItems.length > 0 && !toppingItems.some(t => t.id === item.id);

  function toggleTopping(id: string) {
    setSelectedToppings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const [comboToast, setComboToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const servingTimeOptions = [
    { value: "before" as ServingTime, label: t(lang, "servingBefore"), icon: "🥗" },
    { value: "with"   as ServingTime, label: t(lang, "servingWith"),   icon: "🍽️" },
    { value: "after"  as ServingTime, label: t(lang, "servingAfter"),  icon: "☕" },
  ];

  function handleOptionChange(groupId: string, groupName: string, itemId: string, itemName: string, price: number) {
    setSelectedOptions(prev => prev.map(o => o.groupId === groupId ? { groupId, groupName, itemId, itemName, price } : o));
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const msgs = COMBO_TOASTS[lang] ?? COMBO_TOASTS.ja;
    setComboToast(msgs[Math.floor(Math.random() * msgs.length)]);
    toastTimerRef.current = setTimeout(() => setComboToast(null), 2500);
  }

  const optionDelta  = selectedOptions.reduce((s, o) => s + o.price, 0);
  const toppingDelta = toppingItems.filter(t => selectedToppings.has(t.id)).reduce((s, t) => s + t.price, 0);
  const unitPrice    = item.price + optionDelta + toppingDelta;
  const total        = unitPrice * quantity;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[88vh] overflow-y-auto shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>

        {item.videoUrl ? (
          <VideoBackground videoUrl={item.videoUrl} fallbackGradient="bg-gray-50" emoji={item.emoji} height="h-56" overlayOpacity={0.35} />
        ) : item.imageUrl ? (
          <div className="h-52 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-36 flex items-center justify-center bg-gray-50">
            <span className="text-7xl">{item.emoji ?? "🍽️"}</span>
          </div>
        )}

        <div className="p-5 flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-black text-gray-700 leading-tight">{localName(item, lang)}</h2>
            <p className="text-2xl font-black text-gray-700 mt-1">{formatPrice(unitPrice)}</p>
            {optionDelta !== 0 && (
              <p className="text-xs text-gray-400 mt-0.5">({t(lang, "basePrice")}: {formatPrice(item.price)})</p>
            )}
            {localDescription(item, lang) && (
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{localDescription(item, lang)}</p>
            )}
          </div>

          {/* 提供タイミング（全店舗で非表示） */}
          {false && (
            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">{t(lang, "servingTimeLabel")}</p>
              <div className="flex gap-2">
                {servingTimeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setServingTime(opt.value)}
                    className={["flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all",
                      servingTime === opt.value
                        ? "border-gray-400 bg-gray-50 text-gray-700"
                        : "border-gray-100 text-gray-400 hover:border-stone-400",
                    ].join(" ")}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* オプション */}
          {optionGroups.map((group) => {
            const selected = selectedOptions.find((o) => o.groupId === group.id);
            return (
              <div key={group.id}>
                <p className="text-sm font-bold text-gray-600 mb-2">{group.name}</p>
                <div className="flex flex-col gap-1.5">
                  {group.items.map((optItem) => (
                    <label
                      key={optItem.id}
                      className={["flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                        selected?.itemId === optItem.id ? "border-gray-400 bg-gray-50" : "border-gray-100 hover:border-gray-200",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name={`group-${group.id}`}
                        value={optItem.id}
                        checked={selected?.itemId === optItem.id}
                        onChange={() => handleOptionChange(group.id, group.name, optItem.id, optItem.name, optItem.price)}
                        className="accent-gray-500"
                      />
                      <span className="flex-1 text-sm font-medium text-gray-600">{optItem.name}</span>
                      {optItem.price !== 0 && (
                        <span className={["text-xs font-semibold", optItem.price > 0 ? "text-gray-500" : "text-gray-400"].join(" ")}>
                          {optItem.price > 0 ? `+${formatPrice(optItem.price)}` : formatPrice(optItem.price)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          {/* トッピング */}
          {showToppings && (
            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">{t(lang, "toppings")}</p>
              <div className="flex flex-col gap-1.5">
                {toppingItems.map((topping) => (
                  <label
                    key={topping.id}
                    className={["flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                      selectedToppings.has(topping.id) ? "border-gray-400 bg-gray-50" : "border-gray-100 hover:border-gray-200",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={selectedToppings.has(topping.id)}
                      onChange={() => toggleTopping(topping.id)}
                      className="accent-gray-500 w-4 h-4"
                    />
                    <span className="text-lg">{topping.emoji ?? "🍢"}</span>
                    <span className="flex-1 text-sm font-medium text-gray-600">{localName(topping, lang)}</span>
                    <span className="text-xs font-semibold text-gray-500">+{formatPrice(topping.price)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 数量 */}
          <div>
            <p className="text-sm font-bold text-gray-600 mb-2">{t(lang, "qty")}</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-all"
              >
                −
              </button>
              <span className="text-2xl font-black text-gray-700 w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
              >
                ＋
              </button>
              <span className="ml-auto text-xl font-black text-gray-700">{formatPrice(total)}</span>
            </div>
          </div>

          {comboToast && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-gray-600 text-sm font-semibold">
              {comboToast}
            </div>
          )}

          <button
            onClick={() => {
              const toppingOpts: OptionSelection[] = toppingItems
                .filter(t => selectedToppings.has(t.id))
                .map(tp => ({ groupId: `topping-${tp.id}`, groupName: t(lang, "toppings"), itemId: tp.id, itemName: localName(tp, lang), price: tp.price }));
              onAddToCart(quantity, servingTime, [...selectedOptions, ...toppingOpts]);
            }}
            className="w-full bg-gray-200 text-gray-600 font-black py-4 rounded-2xl text-base hover:bg-gray-300 active:scale-[0.98] transition-all"
          >
            {t(lang, "addToCart")} — {formatPrice(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── カートタブ ────────────────────────────────────────────────

function CartTab({ cart, cartTotal, lang, onRemove, onIncrement, onDecrement, onSwitchMenu, onOrderSent }: {
  cart: CartItem[];
  cartTotal: number;
  lang: Lang;
  onRemove: (id: string) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onSwitchMenu: () => void;
  onOrderSent: () => void;
}) {
  if (cart.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-300 px-6">
        <span className="text-6xl">🛒</span>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-500">{t(lang, "cartEmpty")}</p>
          <p className="text-sm mt-1">{t(lang, "cartEmptySub")}</p>
        </div>
        <button
          onClick={onSwitchMenu}
          className="mt-2 px-6 py-3 bg-gray-200 text-gray-600 font-bold rounded-2xl text-sm hover:bg-gray-300 transition-colors"
        >
          {t(lang, "viewMenu")}
        </button>
      </div>
    );
  }

  const servingLabel: Record<ServingTime, string> = {
    before: `🥗 ${t(lang, "servingBefore")}`,
    with:   `🍽️ ${t(lang, "servingWith")}`,
    after:  `☕ ${t(lang, "servingAfter")}`,
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <h2 className="text-base font-black text-gray-700">{t(lang, "cartTitle")}</h2>
        {cart.map((cartItem) => {
          const optionDelta = cartItem.selectedOptions.reduce((s, o) => s + o.price, 0);
          const unitPrice   = cartItem.menuItem.price + optionDelta;
          const subtotal    = unitPrice * cartItem.quantity;

          return (
            <div key={cartItem.id} className="bg-white rounded-2xl border border-gray-100 flex items-start gap-3 p-3">
              <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-gray-50">
                {cartItem.menuItem.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cartItem.menuItem.imageUrl} alt={cartItem.menuItem.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">{cartItem.menuItem.emoji ?? "🍽️"}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-700 text-sm leading-tight line-clamp-2">{localName(cartItem.menuItem, lang)}</p>
                {cartItem.selectedOptions.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5">{cartItem.selectedOptions.map(o => o.itemName).join(" · ")}</p>
                )}
                <p className="text-[11px] text-gray-300 font-medium mt-0.5">{servingLabel[cartItem.servingTime]}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => onDecrement(cartItem.id)}
                    className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 font-black text-sm hover:bg-gray-100 active:scale-90 transition-all"
                  >−</button>
                  <span className="text-sm font-black text-gray-700 w-5 text-center">{cartItem.quantity}</span>
                  <button
                    onClick={() => onIncrement(cartItem.id)}
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-black text-sm hover:bg-stone-300 active:scale-90 transition-all"
                  >＋</button>
                  <span className="ml-auto text-sm font-black text-gray-700">{formatPrice(subtotal)}</span>
                </div>
              </div>

              <button
                onClick={() => onRemove(cartItem.id)}
                className="w-7 h-7 flex-shrink-0 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors text-sm"
              >✕</button>
            </div>
          );
        })}
      </div>

      <div className="flex-shrink-0 bg-white border-t border-gray-100 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-500">{t(lang, "total")}</span>
          <span className="text-2xl font-black text-gray-700">{formatPrice(cartTotal)}</span>
        </div>
        <p className="text-[11px] text-gray-300">{t(lang, "taxNote")}</p>
        <button
          onClick={onOrderSent}
          className="w-full bg-gray-200 text-gray-600 font-black py-4 rounded-2xl text-base hover:bg-gray-300 active:scale-[0.98] transition-all"
        >
          {t(lang, "sendOrder")}
        </button>
      </div>
    </div>
  );
}

// ─── AIタブ ───────────────────────────────────────────────────

function AiTab({ lang, messages, input, isTyping, bottomRef, onInputChange, onSubmit }: {
  lang: Lang;
  messages: ChatMessage[];
  input: string;
  isTyping: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3 max-w-2xl mx-auto">
          {messages.map(msg => <ChatBubble key={msg.id} message={msg} />)}
          {isTyping && <TypingDots />}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-3">
        <form onSubmit={onSubmit} className="max-w-2xl mx-auto flex gap-2 items-end">
          <input
            type="text"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            placeholder={isTyping ? t(lang, "sending") : t(lang, "chatPlaceholder")}
            disabled={isTyping}
            className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 bg-gray-200 rounded-xl flex items-center justify-center text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── チェックアウトタブ ─────────────────────────────────────────

function CheckoutTab({ cart, cartTotal, lang, called, isRegister, onCall }: {
  cart: CartItem[];
  cartTotal: number;
  lang: Lang;
  called: boolean;
  isRegister: boolean;
  onCall: () => void;
}) {
  const keyStaffComing  = isRegister ? "staffComingRegister"  : "staffComing";
  const keyPleaseWait   = isRegister ? "pleaseWaitRegister"   : "pleaseWait";
  const keyPaymentNote  = isRegister ? "paymentNoteRegister"  : "paymentNote";
  const keyCallStaff    = isRegister ? "callStaffRegister"    : "callStaff";

  if (called) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 px-6">
        <span className="text-7xl animate-bounce">🙏</span>
        <div className="text-center">
          <p className="text-xl font-black text-gray-700">{t(lang, keyStaffComing)}</p>
          <p className="text-sm text-gray-400 mt-2">{t(lang, keyPleaseWait)}</p>
        </div>
        <div className="mt-4 w-full max-w-sm bg-gray-50 border border-gray-100 rounded-2xl p-4">
          <p className="text-sm text-gray-500 font-medium text-center">{t(lang, keyPaymentNote)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <h2 className="text-base font-black text-gray-700">{t(lang, "checkoutTitle")}</h2>
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-300 gap-2">
            <span className="text-5xl">🛒</span>
            <p className="text-sm font-medium">{t(lang, "noCartItems")}</p>
          </div>
        ) : (
          cart.map((cartItem) => {
            const optionDelta = cartItem.selectedOptions.reduce((s, o) => s + o.price, 0);
            const subtotal    = (cartItem.menuItem.price + optionDelta) * cartItem.quantity;
            return (
              <div key={cartItem.id} className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 p-3">
                <div className="w-10 h-10 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-gray-50">
                  {cartItem.menuItem.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cartItem.menuItem.imageUrl} alt={cartItem.menuItem.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">{cartItem.menuItem.emoji ?? "🍽️"}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-700 line-clamp-1">{localName(cartItem.menuItem, lang)}</p>
                  <p className="text-xs text-gray-400">×{cartItem.quantity}</p>
                </div>
                <span className="text-sm font-black text-gray-700">{formatPrice(subtotal)}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex-shrink-0 bg-white border-t border-gray-100 p-4 flex flex-col gap-3">
        {cart.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-500">{t(lang, "totalAmount")}</span>
            <span className="text-2xl font-black text-gray-700">{formatPrice(cartTotal)}</span>
          </div>
        )}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500 font-medium text-center">{t(lang, keyPaymentNote)}</p>
        </div>
        <button
          onClick={onCall}
          className="w-full bg-gray-200 text-gray-600 font-black py-4 rounded-2xl text-base hover:bg-gray-300 active:scale-[0.98] transition-all"
        >
          {t(lang, keyCallStaff)}
        </button>
      </div>
    </div>
  );
}

// ─── 成功モーダル ──────────────────────────────────────────────

function SuccessModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl p-8 shadow-xl max-w-sm w-full flex flex-col items-center gap-4 text-center border border-gray-100">
        <span className="text-6xl animate-bounce">🙏</span>
        <p className="text-base font-bold text-gray-700 leading-relaxed">{message}</p>
        <button
          onClick={onClose}
          className="mt-2 w-full bg-gray-200 text-white font-bold py-3 rounded-2xl hover:bg-gray-300 transition-all"
        >
          OK
        </button>
      </div>
    </div>
  );
}

// ─── チャットバブル ─────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      )}
      <div className={["max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
        isUser
          ? "bg-gray-200 text-gray-700 rounded-tr-sm"
          : "bg-white text-gray-700 rounded-tl-sm border border-gray-100",
      ].join(" ")}>
        {message.text}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-2 flex-shrink-0">
        <span className="text-white text-xs font-bold">AI</span>
      </div>
      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-100 flex items-center gap-1">
        <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 translate-x-0.5">
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  );
}

// ─── アップセルバナー ───────────────────────────────────────────

function UpsellBanner({ suggestion, loading, lang, onDismiss, onCta }: {
  suggestion: UpsellSuggestion | null;
  loading: boolean;
  lang: Lang;
  onDismiss: () => void;
  onCta: (targetItemName: string) => void;
}) {
  return (
    <div className="mx-3 mb-2 rounded-2xl bg-white border border-gray-100 shadow-sm">
      {loading ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin flex-shrink-0" />
          <p className="text-gray-500 text-sm font-medium">{t(lang, "upsellAnalyzing")}</p>
        </div>
      ) : suggestion ? (
        <div className="relative">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-base">✨</span>
              <span className="text-gray-500 text-[11px] font-bold tracking-widest uppercase">{t(lang, "upsellTitle")}</span>
              <span className="bg-gray-50 text-gray-600 text-[10px] font-black px-2 py-0.5 rounded-full border border-gray-100">
                {suggestion.scarcityText}
              </span>
            </div>
            <button
              onClick={onDismiss}
              className="w-7 h-7 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xs transition-colors"
            >✕</button>
          </div>
          <div className="px-4 pb-3 flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{suggestion.targetItemEmoji}</span>
                <span className="text-gray-700 font-black text-base truncate">{suggestion.targetItemName}</span>
              </div>
              <p className="text-gray-500 text-xs leading-relaxed truncate">{suggestion.pairingText}</p>
            </div>
            <button
              onClick={() => onCta(suggestion.targetItemName)}
              className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-gray-200 text-gray-600 font-black text-sm hover:bg-gray-300 active:scale-95 transition-all"
            >
              {suggestion.ctaText} →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
