"use client";

import { useState, useEffect, useRef, useCallback, FormEvent, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { useSearchParams } from "next/navigation";
import { MenuItem, OptionSelection } from "@/types/pos";
import { fetchMenuItems, fetchCategories, CategoryRecord } from "@/lib/db";
import { menuItems as staticMenuItems } from "@/data/menu";
import { isSupabaseConfigured } from "@/lib/supabase";
import { type Lang, t } from "@/lib/i18n";
import type { UpsellSuggestion } from "@/app/api/upsell/route";
import VideoBackground from "@/components/VideoBackground";
import { addKdsOrder } from "@/lib/kdsStore";
import { recordOrder } from "@/lib/toppingAnalytics";

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

const LANGUAGES: { code: Lang; flag: string; label: string }[] = [
  { code: "ja", flag: "🇯🇵", label: "日本語" },
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "ko", flag: "🇰🇷", label: "한국어" },
];

const CATEGORY_COLORS: string[] = [
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
  "from-sky-400 to-blue-500",
  "from-lime-400 to-green-500",
  "from-yellow-400 to-amber-500",
  "from-red-400 to-rose-500",
  "from-cyan-400 to-sky-500",
];

// ─── ユーティリティ ────────────────────────────────────────────────

function getCategoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function calcItemTotal(item: CartItem): number {
  const optionDelta = item.selectedOptions.reduce((s, o) => s + o.price, 0);
  return (item.menuItem.price + optionDelta) * item.quantity;
}

function formatPrice(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
            <span className="text-5xl">⚠️</span>
            <h2 className="text-lg font-black text-slate-800">読み込みエラー</h2>
            <p className="text-slate-500 text-sm">メニューの取得に失敗しました。</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="w-full bg-stone-800 text-white font-bold py-3 rounded-2xl hover:bg-stone-900 transition-colors"
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

// ─── メインページ (ErrorBoundary + Suspense ラッパー) ─────────────

export default function CustomerOrderPage() {
  return (
    <OrderErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">読み込み中...</p>
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
  const searchParams = useSearchParams();
  const roleParam  = searchParams.get("role");
  const tableParam = searchParams.get("table"); // テーブル番号
  const isTable    = roleParam !== "mobile";

  // ── 状態 ─────────────────────────────────
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
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");

  const [detailItem, setDetailItem]       = useState<MenuItem | null>(null);
  const [orderSentModal, setOrderSentModal] = useState(false);
  const [checkoutCalled, setCheckoutCalled] = useState(false);

  // ── アップセルバナー ────────────────────────────
  const [upsellBanner, setUpsellBanner]   = useState<UpsellSuggestion | null>(null);
  const [upsellLoading, setUpsellLoading] = useState(false);
  const upsellDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upsellDismissRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI チャット
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [isTyping, setIsTyping]         = useState(false);
  const chatBottomRef       = useRef<HTMLDivElement>(null);
  const pendingAiMessage    = useRef<string | null>(null);

  // ── データ取得 ─────────────────────────────────
  useEffect(() => {
    const slowTimer = setTimeout(() => setLoadSlow(true), 3000);

    async function load() {
      try {
        let items: MenuItem[];
        let cats: CategoryRecord[];
        if (isSupabaseConfigured) {
          const timeout = new Promise<never>((_, r) =>
            setTimeout(() => r(new Error("fetch timeout")), 5000)
          );
          [items, cats] = await Promise.race([
            Promise.all([fetchMenuItems(), fetchCategories()]),
            timeout,
          ]);
          if (items.length === 0) items = staticMenuItems;
        } else {
          items = staticMenuItems;
          cats  = [];
        }
        setMenuItems(items);
        setCategories(cats);
      } catch {
        setMenuItems(staticMenuItems);
        setCategories([]);
      } finally {
        clearTimeout(slowTimer);
        setLoading(false);
        setLoadSlow(false);
      }
    }
    load();
    return () => clearTimeout(slowTimer);
  }, []);

  // ── カートをlocalStorageに同期 ──────────────────────
  useEffect(() => {
    try { localStorage.setItem("flows_cart_v1", JSON.stringify(cart)); } catch { /* quota */ }
  }, [cart]);

  // ── 言語変更時の挨拶リセット ──────────────────────
  useEffect(() => {
    setChatMessages([
      { id: "greeting", role: "assistant", text: t(lang, "greeting") },
    ]);
  }, [lang]);

  // ── チャット末尾スクロール ──────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isTyping]);

  // ── AI タブ遷移後にペンディングメッセージを送信 ──────
  useEffect(() => {
    if (activeTab === "ai" && pendingAiMessage.current) {
      const msg = pendingAiMessage.current;
      pendingAiMessage.current = null;
      sendChatMessage(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── カテゴリーカラーマップ ──────────────────────
  const categoryColorMap = useCallback(
    (categoryId: string): string => {
      const idx = categories.findIndex((c) => c.id === categoryId);
      if (idx >= 0) return getCategoryColor(idx);
      const allCats = Array.from(new Set(menuItems.map((m) => m.category)));
      const sidx = allCats.indexOf(categoryId);
      return getCategoryColor(sidx >= 0 ? sidx : 0);
    },
    [categories, menuItems],
  );

  // ── フィルタリング ──────────────────────────────
  const filteredItems =
    activeCategoryId === "all"
      ? menuItems
      : menuItems.filter((m) => m.category === activeCategoryId);

  const getCategoryName = useCallback(
    (id: string): string => {
      const cat = categories.find((c) => c.id === id);
      return cat?.name ?? id;
    },
    [categories],
  );

  // ── カート操作 ──────────────────────────────────
  function addToCart(
    item: MenuItem,
    quantity: number,
    servingTime: ServingTime,
    selectedOptions: OptionSelection[],
  ) {
    setCart(prev => [
      ...prev,
      { id: `${item.id}-${Date.now()}`, menuItem: item, quantity, servingTime, selectedOptions },
    ]);
  }

  function removeFromCart(cartId: string) {
    setCart(prev => prev.filter(c => c.id !== cartId));
  }

  function incrementCart(cartId: string) {
    setCart(prev => prev.map(c => c.id === cartId ? { ...c, quantity: c.quantity + 1 } : c));
  }

  function decrementCart(cartId: string) {
    setCart(prev =>
      prev.reduce<CartItem[]>((acc, c) => {
        if (c.id === cartId) {
          if (c.quantity > 1) acc.push({ ...c, quantity: c.quantity - 1 });
          // quantity が1以下なら削除
        } else {
          acc.push(c);
        }
        return acc;
      }, [])
    );
  }

  // ── カート増加を監視 → アップセル発火 ──────────
  const prevCartLengthRef = useRef(0);
  useEffect(() => {
    const added = cart.length > prevCartLengthRef.current;
    prevCartLengthRef.current = cart.length;
    if (!added) return;
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
          cartItems: cart.map(c => ({
            name: c.menuItem.name, emoji: c.menuItem.emoji,
            category: c.menuItem.category, price: c.menuItem.price,
          })),
          lang,
          allMenuItems: menuItems.slice(0, 30).map(m => ({
            name: m.name, emoji: m.emoji, category: m.category, price: m.price,
          })),
        }),
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((data: { ok: boolean; suggestion?: UpsellSuggestion }) => {
          if (data.ok && data.suggestion) {
            setUpsellBanner(data.suggestion);
            upsellDismissRef.current = setTimeout(() => setUpsellBanner(null), 18000);
          }
        })
        .catch(() => { /* サイレント失敗 */ })
        .finally(() => { clearTimeout(timeoutId); setUpsellLoading(false); });
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  useEffect(() => {
    return () => {
      if (upsellDebounceRef.current) clearTimeout(upsellDebounceRef.current);
      if (upsellDismissRef.current)  clearTimeout(upsellDismissRef.current);
    };
  }, []);

  const cartTotal = cart.reduce((s, c) => s + calcItemTotal(c), 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  // ── AI コンシェルジュ ───────────────────────────
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
        ? cart.map((c) => `${c.menuItem.emoji ?? ""} ${c.menuItem.name} ×${c.quantity}`).join(", ")
        : undefined;

      try {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "chat", message: text, menuContext, conversationHistory: history }),
        });
        const data = await res.json() as { ok: boolean; result?: string; error?: string };
        const aiText = data.ok && data.result ? data.result : data.error ?? t(lang, "aiError");
        setChatMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: aiText }]);
      } catch {
        setChatMessages((prev) => [
          ...prev,
          { id: `a-err-${Date.now()}`, role: "assistant", text: t(lang, "aiError") },
        ]);
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
    const msg = `この料理について教えてください: ${item.name}（${formatPrice(item.price)}）`;
    pendingAiMessage.current = msg;
    setActiveTab("ai");
  }

  // ── レンダリング ────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">{t(lang, "loadingMenu")}</p>
          {loadSlow && (
            <div className="flex flex-col items-center gap-2 mt-2">
              <p className="text-slate-400 text-xs">{t(lang, "loadingSlow")}</p>
              <button
                onClick={() => { setMenuItems(staticMenuItems); setCategories([]); setLoading(false); }}
                className="px-5 py-2.5 bg-stone-800 text-white text-sm font-bold rounded-xl shadow hover:bg-stone-900 transition-colors"
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
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      {/* ── ヘッダー ── */}
      <header className="h-14 flex-shrink-0 bg-gradient-to-r from-stone-900 to-stone-800 flex items-center justify-between px-4 shadow-lg z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-white text-xs font-black tracking-tight">FL</span>
          </div>
          <div className="leading-none">
            <p className="text-white font-black text-base tracking-tight">FLOWS</p>
            {/* テーブル番号 or モバイルオーダー表示 */}
            {isTable && tableParam ? (
              <p className="text-amber-400 text-[11px] font-bold">
                {tableParam}{t(lang, "tableLabel")}
              </p>
            ) : (
              <p className="text-stone-400 text-[10px] font-medium tracking-widest uppercase">
                {isTable ? "Table Order" : "Mobile Order"}
              </p>
            )}
          </div>
        </div>

        {/* 言語セレクタ */}
        <div className="flex gap-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={[
                "w-8 h-8 rounded-full text-base flex items-center justify-center transition-all",
                lang === l.code
                  ? "bg-white shadow-md scale-110"
                  : "bg-white/20 hover:bg-white/35",
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
            categoryColorMap={categoryColorMap}
            cart={cart}
            cartTotal={cartTotal}
            cartCount={cartCount}
            isTable={isTable}
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
            getCategoryColor={categoryColorMap}
            onRemove={removeFromCart}
            onIncrement={incrementCart}
            onDecrement={decrementCart}
            onSwitchMenu={() => setActiveTab("menu")}
            onOrderSent={() => {
              addKdsOrder({
                id: `order-${Date.now()}`,
                items: cart.map(c => ({
                  name: c.menuItem.name,
                  emoji: c.menuItem.emoji,
                  options: c.selectedOptions.map(o => `${o.groupName}: ${o.itemName}`),
                  qty: c.quantity,
                  servingTime: c.servingTime,
                })),
                lang,
                createdAt: Date.now(),
                status: "new",
              });
              recordOrder(cart.map(c => c.menuItem.name));
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
        {activeTab === "checkout" && (
          <CheckoutTab
            cart={cart}
            cartTotal={cartTotal}
            lang={lang}
            categoryColorMap={categoryColorMap}
            called={checkoutCalled}
            onCall={() => setCheckoutCalled(true)}
          />
        )}
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
      <nav className="h-16 flex-shrink-0 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgb(0,0,0,0.07)] flex z-20">
        <TabButton icon="🍽️" label={t(lang, "tabMenu")}    active={activeTab === "menu"}     onClick={() => setActiveTab("menu")} />
        <TabButton icon="🛒" label={t(lang, "tabCart")}    active={activeTab === "cart"}     onClick={() => setActiveTab("cart")} badge={cartCount > 0 ? cartCount : undefined} />
        <TabButton icon="💬" label={t(lang, "tabAi")}      active={activeTab === "ai"}       onClick={() => setActiveTab("ai")} />
        <TabButton icon="💳" label={t(lang, "tabBill")}    active={activeTab === "checkout"} onClick={() => setActiveTab("checkout")} />
      </nav>

      {/* ── 商品詳細モーダル ── */}
      {detailItem && (
        <ProductDetailModal
          item={detailItem}
          categoryColor={categoryColorMap(detailItem.category)}
          lang={lang}
          onClose={() => setDetailItem(null)}
          onAddToCart={(qty, servingTime, opts) => {
            addToCart(detailItem, qty, servingTime, opts);
            setDetailItem(null);
          }}
        />
      )}

      {/* ── 注文完了モーダル ── */}
      {orderSentModal && (
        <SuccessModal
          message={t(lang, "orderSuccess")}
          onClose={() => setOrderSentModal(false)}
        />
      )}
    </div>
  );
}

// ─── タブボタン ────────────────────────────────────────────────

function TabButton({
  icon, label, active, badge, onClick,
}: {
  icon: string; label: string; active: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center justify-center gap-0.5 relative pt-1">
      <span className={["absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full transition-all duration-200", active ? "bg-amber-500" : "bg-transparent"].join(" ")} />
      <span className="relative">
        <span className="text-xl leading-none">{icon}</span>
        {badge !== undefined && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {badge}
          </span>
        )}
      </span>
      <span className={["text-[10px] font-semibold leading-none transition-colors duration-200", active ? "text-amber-600" : "text-stone-400"].join(" ")}>
        {label}
      </span>
    </button>
  );
}

// ─── メニュータブ ──────────────────────────────────────────────

function MenuTab({
  items, categories, menuItems, activeCategoryId, onCategoryChange,
  getCategoryName, categoryColorMap, cart, cartTotal, cartCount,
  isTable, lang, onOpenDetail, onAiConsult, onGoToCart,
}: {
  items: MenuItem[];
  categories: CategoryRecord[];
  menuItems: MenuItem[];
  activeCategoryId: string;
  onCategoryChange: (id: string) => void;
  getCategoryName: (id: string) => string;
  categoryColorMap: (id: string) => string;
  cart: CartItem[];
  cartTotal: number;
  cartCount: number;
  isTable: boolean;
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
      {/* ── 横スクロールカテゴリーピル ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2.5 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => onCategoryChange("all")}
            className={[
              "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all",
              activeCategoryId === "all"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 text-stone-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {t(lang, "allItems")}
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={[
                "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all",
                activeCategoryId === cat.id
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-slate-100 text-stone-600 hover:bg-slate-200",
              ].join(" ")}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── 商品グリッド ── */}
      <div className="flex-1 overflow-y-auto p-2.5 pb-0">
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              color={categoryColorMap(item.category)}
              cartQty={cart.filter((c) => c.menuItem.id === item.id).reduce((s, c) => s + c.quantity, 0)}
              isTable={isTable}
              lang={lang}
              onClick={() => onOpenDetail(item)}
              onAiConsult={() => onAiConsult(item)}
            />
          ))}
          {items.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <span className="text-5xl">🍽️</span>
              <p className="text-sm font-medium">{t(lang, "noItems")}</p>
            </div>
          )}
        </div>
        {/* カートバー分のスペース */}
        {cartCount > 0 && <div className="h-16" />}
      </div>

      {/* ── スティッキーカートバー（カートに1点以上あるとき） ── */}
      {cartCount > 0 && (
        <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-[0_-2px_12px_rgb(0,0,0,0.06)]">
          <span className="text-sm font-bold text-slate-600">
            {cartCount}{lang === "ja" ? "点" : lang === "zh" ? "件" : lang === "ko" ? "개" : " item(s)"}
          </span>
          <button
            onClick={onGoToCart}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black px-5 py-2 rounded-xl text-sm shadow-md shadow-amber-300/50 active:scale-95 transition-all"
          >
            {t(lang, "cartBarSee")} {formatPrice(cartTotal)} →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 商品カード ────────────────────────────────────────────────

function ProductCard({
  item, color, cartQty, isTable, lang, onClick, onAiConsult,
}: {
  item: MenuItem;
  color: string;
  cartQty: number;
  isTable: boolean;
  lang: Lang;
  onClick: () => void;
  onAiConsult: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-200/60 flex flex-col transition-transform active:scale-[0.97] relative">

      {/* ── ビジュアルエリア（画像 or 絵文字グラデーション） ── */}
      <button
        onClick={onClick}
        className={[
          "w-full flex-shrink-0 flex items-center justify-center relative overflow-hidden aspect-[4/3]",
          !item.imageUrl ? `bg-gradient-to-br ${color}` : "bg-slate-100",
        ].join(" ")}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-5xl drop-shadow-md select-none">
            {item.emoji ?? "🍽️"}
          </span>
        )}

        {cartQty > 0 && (
          <span className="absolute top-2 right-2 min-w-[26px] h-[26px] bg-amber-600 text-white text-xs font-black rounded-full flex items-center justify-center px-1.5 shadow-lg ring-2 ring-white">
            {cartQty}
          </span>
        )}
      </button>

      {/* ── テキスト・アクションエリア ── */}
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2 flex-1">
        <button onClick={onClick} className="text-left space-y-0.5">
          <p className="font-bold text-slate-800 leading-snug line-clamp-2 text-sm">{item.name}</p>
          <p className="text-stone-900 font-black text-base">{formatPrice(item.price)}</p>
        </button>

        <div className="flex items-center gap-2 mt-auto pt-1">
          <button
            onClick={onClick}
            className="flex-1 flex items-center justify-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold py-2 rounded-xl shadow-sm shadow-amber-300/60 hover:shadow-md active:scale-95 transition-all duration-150 whitespace-nowrap"
          >
            <span className="text-sm leading-none font-black">＋</span>
            <span>{t(lang, "add")}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAiConsult(); }}
            className="flex-shrink-0 w-8 h-8 bg-stone-100 text-stone-500 rounded-xl border border-stone-200 flex items-center justify-center hover:bg-stone-200 active:scale-95 transition-all duration-150"
            title="AIコンシェルジュに相談"
          >
            <span className="text-sm">🤖</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 深層アップセル：コンボトーストメッセージ ──────────────────

const COMBO_TOASTS: Record<Lang, { spice: string; size: string; default: string[] }> = {
  ja: {
    spice:   "🌶️ その辛さ、冷えたビールと最高の組み合わせ！",
    size:    "💪 ボリューム満点！お供のドリンクはいかが？",
    default: ["✨ その組み合わせ、シェフのお墨付き！", "👨‍🍳 最高のカスタマイズです！", "🎯 絶妙な選択！"],
  },
  en: {
    spice:   "🌶️ Bold! A cold draft beer pairs perfectly!",
    size:    "💪 Great size! Add a drink to complete the meal?",
    default: ["✨ Chef-approved combo!", "👨‍🍳 Excellent customization!", "🎯 Great choice!"],
  },
  zh: {
    spice:   "🌶️ 辣味绝了！来杯冰饮搭配最完美！",
    size:    "💪 分量十足！加杯饮料更完美！",
    default: ["✨ 主厨认可的搭配！", "👨‍🍳 绝妙组合！", "🎯 好选择！"],
  },
  ko: {
    spice:   "🌶️ 매운맛! 차가운 맥주와 환상의 조합!",
    size:    "💪 든든한 양! 음료 한 잔 추가하시겠어요?",
    default: ["✨ 셰프 인정 조합!", "👨‍🍳 완벽한 커스터마이징!", "🎯 훌륭한 선택!"],
  },
};

function getComboToast(lang: Lang, groupName: string, itemName: string): string {
  const msgs = COMBO_TOASTS[lang] ?? COMBO_TOASTS.ja;
  const lower = `${groupName} ${itemName}`.toLowerCase();
  if (lower.includes("辛") || lower.includes("spic") || lower.includes("매운")) return msgs.spice;
  if (lower.includes("量") || lower.includes("大盛") || lower.includes("size") || lower.includes("분량")) return msgs.size;
  return msgs.default[Math.floor(Math.random() * msgs.default.length)];
}

// ─── 商品詳細モーダル ──────────────────────────────────────────

function ProductDetailModal({
  item, categoryColor, lang, onClose, onAddToCart,
}: {
  item: MenuItem;
  categoryColor: string;
  lang: Lang;
  onClose: () => void;
  onAddToCart: (qty: number, servingTime: ServingTime, opts: OptionSelection[]) => void;
}) {
  const [quantity, setQuantity]     = useState(1);
  const [servingTime, setServingTime] = useState<ServingTime>("with");
  const [selectedOptions, setSelectedOptions] = useState<OptionSelection[]>(() => {
    if (!item.options?.optionGroups) return [];
    return item.options.optionGroups.map((g) => ({
      groupId: g.id, groupName: g.name,
      itemId: g.items[0].id, itemName: g.items[0].name, price: g.items[0].price,
    }));
  });

  const [comboToast, setComboToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // serving time options をコンポーネント内で構築（lang対応）
  const servingTimeOptions = [
    { value: "before" as ServingTime, label: t(lang, "servingBefore"), icon: "🥗" },
    { value: "with"   as ServingTime, label: t(lang, "servingWith"),   icon: "🍽️" },
    { value: "after"  as ServingTime, label: t(lang, "servingAfter"),  icon: "☕" },
  ];

  function handleOptionChange(groupId: string, groupName: string, itemId: string, itemName: string, price: number) {
    setSelectedOptions((prev) =>
      prev.map((o) => o.groupId === groupId ? { groupId, groupName, itemId, itemName, price } : o)
    );
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setComboToast(getComboToast(lang, groupName, itemName));
    toastTimerRef.current = setTimeout(() => setComboToast(null), 2500);
  }

  const optionDelta = selectedOptions.reduce((s, o) => s + o.price, 0);
  const unitPrice   = item.price + optionDelta;
  const total       = unitPrice * quantity;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[88vh] overflow-y-auto shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
          aria-label="閉じる"
        >
          ✕
        </button>

        {/* シズル動画 / 画像 / 絵文字エリア */}
        {item.videoUrl ? (
          <VideoBackground
            videoUrl={item.videoUrl}
            fallbackGradient={categoryColor}
            emoji={item.emoji}
            height="h-56"
            overlayOpacity={0.40}
          />
        ) : item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <div className="h-52 overflow-hidden">
            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className={`h-36 flex items-center justify-center bg-gradient-to-br ${categoryColor}`}>
            <span className="text-8xl drop-shadow-md">{item.emoji ?? "🍽️"}</span>
          </div>
        )}

        <div className="p-5 flex flex-col gap-5">
          {/* 商品名・価格 */}
          <div>
            <h2 className="text-lg font-black text-slate-800 leading-tight">{item.name}</h2>
            <p className="text-2xl font-black text-stone-900 mt-1">{formatPrice(unitPrice)}</p>
            {optionDelta !== 0 && (
              <p className="text-xs text-slate-500 mt-0.5">({t(lang, "basePrice")}: {formatPrice(item.price)})</p>
            )}
          </div>

          {/* 提供タイミング */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">{t(lang, "servingTimeLabel")}</p>
            <div className="flex gap-2">
              {servingTimeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setServingTime(opt.value)}
                  className={["flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all",
                    servingTime === opt.value
                      ? "border-amber-500 bg-amber-50 text-amber-800"
                      : "border-stone-200 text-stone-500 hover:border-amber-300",
                  ].join(" ")}
                >
                  <span className="text-lg">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* オプション */}
          {item.options?.optionGroups.map((group) => {
            const selected = selectedOptions.find((o) => o.groupId === group.id);
            return (
              <div key={group.id}>
                <p className="text-sm font-bold text-slate-700 mb-2">{group.name}</p>
                <div className="flex flex-col gap-1.5">
                  {group.items.map((optItem) => (
                    <label
                      key={optItem.id}
                      className={["flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                        selected?.itemId === optItem.id ? "border-amber-500 bg-amber-50" : "border-stone-200 hover:border-amber-300",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name={`group-${group.id}`}
                        value={optItem.id}
                        checked={selected?.itemId === optItem.id}
                        onChange={() => handleOptionChange(group.id, group.name, optItem.id, optItem.name, optItem.price)}
                        className="accent-amber-600"
                      />
                      <span className="flex-1 text-sm font-medium text-slate-700">{optItem.name}</span>
                      {optItem.price !== 0 && (
                        <span className={["text-xs font-semibold", optItem.price > 0 ? "text-rose-500" : "text-emerald-600"].join(" ")}>
                          {optItem.price > 0 ? `+${formatPrice(optItem.price)}` : formatPrice(optItem.price)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          {/* 数量セレクター */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">{t(lang, "qty")}</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition-all"
              >
                −
              </button>
              <span className="text-2xl font-black text-slate-800 w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl font-bold text-amber-700 hover:bg-amber-200 transition-all"
              >
                ＋
              </button>
              <span className="ml-auto text-xl font-black text-stone-900">{formatPrice(total)}</span>
            </div>
          </div>

          {/* コンボ褒めトースト */}
          {comboToast && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-semibold">
              {comboToast}
            </div>
          )}

          {/* カートに追加 */}
          <button
            onClick={() => onAddToCart(quantity, servingTime, selectedOptions)}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black py-4 rounded-2xl text-base shadow-[0_4px_20px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_28px_rgba(245,158,11,0.5)] hover:-translate-y-0.5 active:scale-[0.98] transition-all"
          >
            {t(lang, "addToCart")} — {formatPrice(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── カートタブ ────────────────────────────────────────────────

function CartTab({
  cart, cartTotal, lang, getCategoryColor, onRemove, onIncrement, onDecrement, onSwitchMenu, onOrderSent,
}: {
  cart: CartItem[];
  cartTotal: number;
  lang: Lang;
  getCategoryColor: (id: string) => string;
  onRemove: (id: string) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onSwitchMenu: () => void;
  onOrderSent: () => void;
}) {
  if (cart.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400 px-6">
        <span className="text-6xl">🛒</span>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-600">{t(lang, "cartEmpty")}</p>
          <p className="text-sm mt-1">{t(lang, "cartEmptySub")}</p>
        </div>
        <button
          onClick={onSwitchMenu}
          className="mt-2 px-6 py-3 bg-stone-800 text-white font-bold rounded-2xl text-sm shadow-sm hover:bg-stone-900 transition-colors"
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
        <h2 className="text-base font-black text-slate-800">{t(lang, "cartTitle")}</h2>

        {cart.map((cartItem) => {
          const optionDelta = cartItem.selectedOptions.reduce((s, o) => s + o.price, 0);
          const unitPrice   = cartItem.menuItem.price + optionDelta;
          const subtotal    = unitPrice * cartItem.quantity;
          const color       = getCategoryColor(cartItem.menuItem.category);

          return (
            <div key={cartItem.id} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 flex items-start gap-3 p-3">
              {/* 絵文字 or 画像 */}
              <div className={`w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center ${cartItem.menuItem.imageUrl ? "bg-slate-100" : `bg-gradient-to-br ${color}`}`}>
                {cartItem.menuItem.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cartItem.menuItem.imageUrl} alt={cartItem.menuItem.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">{cartItem.menuItem.emoji ?? "🍽️"}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">
                  {cartItem.menuItem.name}
                </p>
                {cartItem.selectedOptions.length > 0 && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {cartItem.selectedOptions.map((o) => o.itemName).join(" · ")}
                  </p>
                )}
                <p className="text-[11px] text-stone-400 font-medium mt-0.5">
                  {servingLabel[cartItem.servingTime]}
                </p>

                {/* 数量コントロール + 小計 */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => onDecrement(cartItem.id)}
                    className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-sm hover:bg-slate-200 active:scale-90 transition-all"
                  >
                    −
                  </button>
                  <span className="text-sm font-black text-slate-800 w-5 text-center">
                    {cartItem.quantity}
                  </span>
                  <button
                    onClick={() => onIncrement(cartItem.id)}
                    className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-black text-sm hover:bg-amber-200 active:scale-90 transition-all"
                  >
                    ＋
                  </button>
                  <span className="ml-auto text-sm font-black text-stone-900">{formatPrice(subtotal)}</span>
                </div>
              </div>

              {/* 削除ボタン */}
              <button
                onClick={() => onRemove(cartItem.id)}
                className="w-7 h-7 flex-shrink-0 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-500 transition-colors text-sm"
                aria-label="削除"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex-shrink-0 bg-white border-t border-slate-200 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-600">{t(lang, "total")}</span>
          <span className="text-2xl font-black text-stone-900">{formatPrice(cartTotal)}</span>
        </div>
        <p className="text-[11px] text-slate-400">{t(lang, "taxNote")}</p>
        <button
          onClick={onOrderSent}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black py-4 rounded-2xl text-base shadow-[0_4px_20px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_28px_rgba(245,158,11,0.5)] hover:-translate-y-0.5 active:scale-[0.98] transition-all"
        >
          {t(lang, "sendOrder")}
        </button>
      </div>
    </div>
  );
}

// ─── AIタブ ───────────────────────────────────────────────────

function AiTab({
  lang, messages, input, isTyping, bottomRef, onInputChange, onSubmit,
}: {
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
          {messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)}
          {isTyping && <TypingDots />}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-3">
        <form onSubmit={onSubmit} className="max-w-2xl mx-auto flex gap-2 items-end">
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={isTyping ? t(lang, "sending") : t(lang, "chatPlaceholder")}
            disabled={isTyping}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 bg-gradient-to-br from-stone-700 to-stone-900 rounded-xl flex items-center justify-center text-white shadow-[0_2px_12px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
            aria-label="送信"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── チェックアウトタブ ─────────────────────────────────────────

function CheckoutTab({
  cart, cartTotal, lang, categoryColorMap, called, onCall,
}: {
  cart: CartItem[];
  cartTotal: number;
  lang: Lang;
  categoryColorMap: (id: string) => string;
  called: boolean;
  onCall: () => void;
}) {
  if (called) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 px-6">
        <span className="text-7xl animate-bounce">🙏</span>
        <div className="text-center">
          <p className="text-xl font-black text-slate-800">{t(lang, "staffComing")}</p>
          <p className="text-sm text-slate-500 mt-2">{t(lang, "pleaseWait")}</p>
        </div>
        <div className="mt-4 w-full max-w-sm bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm text-amber-700 font-medium text-center">{t(lang, "paymentNote")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <h2 className="text-base font-black text-slate-800">{t(lang, "checkoutTitle")}</h2>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <span className="text-5xl">🛒</span>
            <p className="text-sm font-medium">{t(lang, "noCartItems")}</p>
          </div>
        ) : (
          cart.map((cartItem) => {
            const optionDelta = cartItem.selectedOptions.reduce((s, o) => s + o.price, 0);
            const unitPrice   = cartItem.menuItem.price + optionDelta;
            const subtotal    = unitPrice * cartItem.quantity;
            const color       = categoryColorMap(cartItem.menuItem.category);

            return (
              <div key={cartItem.id} className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/60 flex items-center gap-3 p-3">
                <div className={`w-10 h-10 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center ${cartItem.menuItem.imageUrl ? "bg-slate-100" : `bg-gradient-to-br ${color}`}`}>
                  {cartItem.menuItem.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cartItem.menuItem.imageUrl} alt={cartItem.menuItem.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">{cartItem.menuItem.emoji ?? "🍽️"}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 leading-tight line-clamp-1">{cartItem.menuItem.name}</p>
                  <p className="text-xs text-slate-500">×{cartItem.quantity}</p>
                </div>
                <span className="text-sm font-black text-stone-900">{formatPrice(subtotal)}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex-shrink-0 bg-white border-t border-slate-200 p-4 flex flex-col gap-3">
        {cart.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-600">{t(lang, "totalAmount")}</span>
            <span className="text-2xl font-black text-stone-900">{formatPrice(cartTotal)}</span>
          </div>
        )}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs text-amber-700 font-medium text-center">{t(lang, "paymentNote")}</p>
        </div>
        <button
          onClick={onCall}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black py-4 rounded-2xl text-base shadow-[0_4px_20px_rgba(245,158,11,0.4)] hover:shadow-[0_6px_28px_rgba(245,158,11,0.55)] hover:-translate-y-0.5 active:scale-[0.98] transition-all"
        >
          {t(lang, "callStaff")}
        </button>
      </div>
    </div>
  );
}

// ─── 成功モーダル ──────────────────────────────────────────────

function SuccessModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full flex flex-col items-center gap-4 text-center">
        <span className="text-6xl animate-bounce">🙏</span>
        <p className="text-base font-bold text-slate-800 leading-relaxed">{message}</p>
        <button
          onClick={onClose}
          className="mt-2 w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3 rounded-2xl shadow-sm hover:shadow-md transition-all"
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
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-stone-600 to-stone-700 flex items-center justify-center mr-2 flex-shrink-0 mt-1 shadow-sm">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      )}
      <div className={["max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
        isUser
          ? "bg-gradient-to-br from-stone-800 to-stone-900 text-white rounded-tr-sm shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
          : "bg-white text-slate-800 rounded-tl-sm shadow-[0_2px_12px_rgb(0,0,0,0.07)] ring-1 ring-black/[0.04]",
      ].join(" ")}>
        {message.text}
      </div>
    </div>
  );
}

// ─── タイピングインジケーター ───────────────────────────────────

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-stone-600 to-stone-700 flex items-center justify-center mr-2 flex-shrink-0 shadow-sm">
        <span className="text-white text-xs font-bold">AI</span>
      </div>
      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-[0_2px_12px_rgb(0,0,0,0.07)] ring-1 ring-black/[0.04] flex items-center gap-1">
        <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ─── 送信アイコン ──────────────────────────────────────────────

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 translate-x-0.5">
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  );
}

// ─── アップセルバナー ───────────────────────────────────────────

function UpsellBanner({
  suggestion, loading, lang, onDismiss, onCta,
}: {
  suggestion: UpsellSuggestion | null;
  loading: boolean;
  lang: Lang;
  onDismiss: () => void;
  onCta: (targetItemName: string) => void;
}) {
  return (
    <div className="mx-3 mb-2 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-amber-50 border border-amber-200 animate-[slideUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)]">
      {loading ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-5 h-5 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin flex-shrink-0" />
          <p className="text-amber-800 text-sm font-medium">{t(lang, "upsellAnalyzing")}</p>
        </div>
      ) : suggestion ? (
        <div className="relative">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-base">✨</span>
              <span className="text-amber-700 text-[11px] font-bold tracking-widest uppercase">{t(lang, "upsellTitle")}</span>
              <span className="bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                {suggestion.scarcityText}
              </span>
            </div>
            <button
              onClick={onDismiss}
              className="w-7 h-7 rounded-full bg-amber-100 hover:bg-amber-200 flex items-center justify-center text-amber-600 text-xs transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="px-4 pb-3 flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{suggestion.targetItemEmoji}</span>
                <span className="text-stone-900 font-black text-base truncate">{suggestion.targetItemName}</span>
              </div>
              <p className="text-amber-800 text-xs leading-relaxed truncate">{suggestion.pairingText}</p>
              <p className="text-amber-700/80 text-[10px] mt-0.5 line-clamp-1 italic">✨ {suggestion.sizzleText}</p>
            </div>
            <button
              onClick={() => onCta(suggestion.targetItemName)}
              className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-amber-600 text-white font-black text-sm shadow-md shadow-amber-900/20 hover:bg-amber-700 active:scale-95 transition-all"
            >
              {suggestion.ctaText} →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
