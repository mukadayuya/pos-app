"use client";

import { useState, useEffect, useRef, useCallback, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MenuItem, OptionSelection } from "@/types/pos";
import { fetchMenuItems, fetchCategories, CategoryRecord } from "@/lib/db";
import { menuItems as staticMenuItems } from "@/data/menu";
import { isSupabaseConfigured } from "@/lib/supabase";
import { type Lang, t } from "@/lib/i18n";

// ─── 型定義 ────────────────────────────────────────────────────

type ServingTime = "before" | "with" | "after";

interface CartItem {
  id: string; // unique cart entry id
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
  "from-violet-400 to-purple-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-sky-400 to-blue-500",
  "from-lime-400 to-green-500",
  "from-fuchsia-400 to-pink-600",
  "from-cyan-400 to-sky-500",
];

const SERVING_TIME_OPTIONS: { value: ServingTime; label: string; icon: string }[] = [
  { value: "before", label: "食事前", icon: "🥗" },
  { value: "with",   label: "食事と一緒", icon: "🍽️" },
  { value: "after",  label: "食事後", icon: "☕" },
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

// ─── メインページ (Suspense ラッパー) ──────────────────────────────

export default function CustomerOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">読み込み中...</p>
        </div>
      </div>
    }>
      <CustomerOrderInner />
    </Suspense>
  );
}

// ─── 内部コンポーネント ─────────────────────────────────────────────

function CustomerOrderInner() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const isTable = roleParam !== "mobile";

  // ── 状態 ─────────────────────────────────────
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>("menu");
  const [lang, setLang] = useState<Lang>("ja");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");

  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [orderSentModal, setOrderSentModal] = useState(false);
  const [checkoutCalled, setCheckoutCalled] = useState(false);

  // AI チャット
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const pendingAiMessage = useRef<string | null>(null);

  // ── データ取得 ─────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        let items: MenuItem[];
        let cats: CategoryRecord[];
        if (isSupabaseConfigured) {
          [items, cats] = await Promise.all([fetchMenuItems(), fetchCategories()]);
          if (items.length === 0) items = staticMenuItems;
        } else {
          items = staticMenuItems;
          cats = [];
        }
        setMenuItems(items);
        setCategories(cats);
      } catch {
        setMenuItems(staticMenuItems);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
      // static data: category is a string name
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

  // カテゴリー表示名
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
    setCart((prev) => [
      ...prev,
      {
        id: `${item.id}-${Date.now()}`,
        menuItem: item,
        quantity,
        servingTime,
        selectedOptions,
      },
    ]);
  }

  function removeFromCart(cartId: string) {
    setCart((prev) => prev.filter((c) => c.id !== cartId));
  }

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
        ? `現在のカート: ${cart.map((c) => `${c.menuItem.emoji ?? ""} ${c.menuItem.name} ×${c.quantity}`).join(", ")}`
        : undefined;

      try {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "chat",
            message: text,
            menuContext,
            conversationHistory: history,
          }),
        });
        const data = await res.json() as { ok: boolean; result?: string; error?: string };
        const aiText = data.ok && data.result
          ? data.result
          : data.error ?? "エラーが発生しました。もう一度お試しください。";
        setChatMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: aiText }]);
      } catch {
        setChatMessages((prev) => [
          ...prev,
          { id: `a-err-${Date.now()}`, role: "assistant", text: "接続エラーが発生しました。もう一度お試しください。" },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [chatMessages, cart],
  );

  function handleChatSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isTyping) return;
    sendChatMessage(trimmed);
  }

  // ── AI相談ボタン ────────────────────────────────
  function handleAiConsult(item: MenuItem) {
    const msg = `この料理について教えてください: ${item.name}（${formatPrice(item.price)}）`;
    pendingAiMessage.current = msg;
    setActiveTab("ai");
  }

  // ── レンダリング ────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">メニューを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      {/* ── ヘッダー ── */}
      <header className="h-14 flex-shrink-0 bg-gradient-to-r from-violet-600 to-purple-700 flex items-center justify-between px-4 shadow-lg z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-white text-xs font-black tracking-tight">FL</span>
          </div>
          <div className="leading-none">
            <p className="text-white font-black text-base tracking-tight">FLOWS</p>
            <p className="text-violet-200 text-[10px] font-medium tracking-widest uppercase">by Infotainment</p>
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
            isTable={isTable}
            onOpenDetail={setDetailItem}
            onAiConsult={handleAiConsult}
          />
        )}
        {activeTab === "cart" && (
          <CartTab
            cart={cart}
            cartTotal={cartTotal}
            getCategoryColor={categoryColorMap}
            onRemove={removeFromCart}
            onSwitchMenu={() => setActiveTab("menu")}
            onOrderSent={() => setOrderSentModal(true)}
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
            categoryColorMap={categoryColorMap}
            called={checkoutCalled}
            onCall={() => setCheckoutCalled(true)}
          />
        )}
      </main>

      {/* ── ボトムタブバー ── */}
      <nav className="h-16 flex-shrink-0 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgb(0,0,0,0.07)] flex z-20">
        <TabButton icon="🍽️" label="メニュー"     active={activeTab === "menu"}     onClick={() => setActiveTab("menu")} />
        <TabButton icon="🛒" label="注文確認"     active={activeTab === "cart"}     onClick={() => setActiveTab("cart")} badge={cartCount > 0 ? cartCount : undefined} />
        <TabButton icon="💬" label="AIコンシェルジュ" active={activeTab === "ai"}   onClick={() => setActiveTab("ai")} />
        <TabButton icon="💳" label="お会計"       active={activeTab === "checkout"} onClick={() => setActiveTab("checkout")} />
      </nav>

      {/* ── 商品詳細モーダル ── */}
      {detailItem && (
        <ProductDetailModal
          item={detailItem}
          categoryColor={categoryColorMap(detailItem.category)}
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
          message="ご注文ありがとうございます。スタッフが参ります。🙏"
          onClose={() => setOrderSentModal(false)}
        />
      )}
    </div>
  );
}

// ─── タブボタン ────────────────────────────────────────────────

function TabButton({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 relative pt-1"
    >
      {/* アクティブインジケーター */}
      <span
        className={[
          "absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full transition-all duration-200",
          active ? "bg-violet-600" : "bg-transparent",
        ].join(" ")}
      />

      {/* アイコン + バッジ */}
      <span className="relative">
        <span className="text-xl leading-none">{icon}</span>
        {badge !== undefined && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] bg-violet-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {badge}
          </span>
        )}
      </span>

      <span
        className={[
          "text-[10px] font-semibold leading-none transition-colors duration-200",
          active ? "text-violet-600" : "text-slate-400",
        ].join(" ")}
      >
        {label}
      </span>
    </button>
  );
}

// ─── メニュータブ ──────────────────────────────────────────────

function MenuTab({
  items,
  categories,
  menuItems,
  activeCategoryId,
  onCategoryChange,
  getCategoryName,
  categoryColorMap,
  cart,
  isTable,
  onOpenDetail,
  onAiConsult,
}: {
  items: MenuItem[];
  categories: CategoryRecord[];
  menuItems: MenuItem[];
  activeCategoryId: string;
  onCategoryChange: (id: string) => void;
  getCategoryName: (id: string) => string;
  categoryColorMap: (id: string) => string;
  cart: CartItem[];
  isTable: boolean;
  onOpenDetail: (item: MenuItem) => void;
  onAiConsult: (item: MenuItem) => void;
}) {
  // カテゴリー一覧を構築（DBカテゴリー優先、なければ静的データから）
  const allCategories: { id: string; name: string }[] =
    categories.length > 0
      ? categories
      : Array.from(new Set(menuItems.map((m) => m.category))).map((c) => ({ id: c, name: c }));

  return (
    <div className="h-full flex overflow-hidden">
      {/* カテゴリーサイドバー */}
      <aside className="w-[25%] flex-shrink-0 bg-slate-100 overflow-y-auto border-r border-slate-200">
        <div className="py-2 flex flex-col gap-0.5 px-1.5">
          {/* 全品 */}
          <button
            onClick={() => onCategoryChange("all")}
            className={[
              "w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all",
              activeCategoryId === "all"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            全品
          </button>

          {allCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={[
                "w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all leading-tight",
                activeCategoryId === cat.id
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200",
              ].join(" ")}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </aside>

      {/* 商品グリッド */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className={[
          "grid gap-3",
          isTable ? "grid-cols-3" : "grid-cols-2",
        ].join(" ")}>
          {items.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              color={categoryColorMap(item.category)}
              cartQty={cart.filter((c) => c.menuItem.id === item.id).reduce((s, c) => s + c.quantity, 0)}
              isTable={isTable}
              onClick={() => onOpenDetail(item)}
              onAiConsult={() => onAiConsult(item)}
            />
          ))}

          {items.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <span className="text-5xl">🍽️</span>
              <p className="text-sm font-medium">このカテゴリーに商品がありません</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 商品カード ────────────────────────────────────────────────

function ProductCard({
  item,
  color,
  cartQty,
  isTable,
  onClick,
  onAiConsult,
}: {
  item: MenuItem;
  color: string;
  cartQty: number;
  isTable: boolean;
  onClick: () => void;
  onAiConsult: () => void;
}) {
  return (
    <div
      className="bg-white rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-200/60 flex flex-col active:scale-[0.98] transition-transform"
    >
      {/* 画像エリア */}
      <button
        onClick={onClick}
        className={[
          "w-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br",
          color,
          isTable ? "h-28" : "h-20",
        ].join(" ")}
      >
        <span className="text-5xl drop-shadow-sm">{item.emoji ?? "🍽️"}</span>
        {cartQty > 0 && (
          <span className="absolute top-2 right-2 min-w-[22px] h-[22px] bg-violet-600 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 shadow">
            ×{cartQty}
          </span>
        )}
      </button>

      {/* テキストエリア */}
      <div className="p-2.5 flex flex-col gap-1.5 flex-1 relative">
        <button onClick={onClick} className="text-left">
          <p className={["font-bold text-slate-800 leading-tight line-clamp-2", isTable ? "text-sm" : "text-xs"].join(" ")}>
            {item.name}
          </p>
          <p className="text-violet-600 font-black text-sm mt-0.5">{formatPrice(item.price)}</p>
        </button>

        <div className="flex items-center justify-between mt-auto">
          <button
            onClick={onClick}
            className="flex items-center gap-1 bg-violet-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-violet-700 active:scale-95 transition-all shadow-sm"
          >
            <span>＋</span>
            <span>追加</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onAiConsult();
            }}
            className="text-[10px] text-violet-500 hover:text-violet-700 font-medium transition-colors"
          >
            🤖 AIに相談
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 商品詳細モーダル ──────────────────────────────────────────

function ProductDetailModal({
  item,
  categoryColor,
  onClose,
  onAddToCart,
}: {
  item: MenuItem;
  categoryColor: string;
  onClose: () => void;
  onAddToCart: (qty: number, servingTime: ServingTime, opts: OptionSelection[]) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [servingTime, setServingTime] = useState<ServingTime>("with");
  const [selectedOptions, setSelectedOptions] = useState<OptionSelection[]>(() => {
    if (!item.options?.optionGroups) return [];
    return item.options.optionGroups.map((g) => ({
      groupId: g.id,
      groupName: g.name,
      itemId: g.items[0].id,
      itemName: g.items[0].name,
      price: g.items[0].price,
    }));
  });

  function handleOptionChange(groupId: string, groupName: string, itemId: string, itemName: string, price: number) {
    setSelectedOptions((prev) =>
      prev.map((o) => o.groupId === groupId ? { groupId, groupName, itemId, itemName, price } : o)
    );
  }

  const optionDelta = selectedOptions.reduce((s, o) => s + o.price, 0);
  const unitPrice = item.price + optionDelta;
  const total = unitPrice * quantity;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* バックドロップ */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* パネル */}
      <div className="relative bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
          aria-label="閉じる"
        >
          ✕
        </button>

        {/* 絵文字エリア */}
        <div className={`h-36 flex items-center justify-center bg-gradient-to-br ${categoryColor}`}>
          <span className="text-7xl drop-shadow-md">{item.emoji ?? "🍽️"}</span>
        </div>

        {/* コンテンツ */}
        <div className="p-5 flex flex-col gap-5">
          {/* 商品名・価格 */}
          <div>
            <h2 className="text-lg font-black text-slate-800 leading-tight">{item.name}</h2>
            <p className="text-2xl font-black text-violet-600 mt-1">{formatPrice(unitPrice)}</p>
            {optionDelta !== 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                (基本価格: {formatPrice(item.price)})
              </p>
            )}
          </div>

          {/* 提供タイミング */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">提供タイミング</p>
            <div className="flex gap-2">
              {SERVING_TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setServingTime(opt.value)}
                  className={[
                    "flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all",
                    servingTime === opt.value
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-200 text-slate-500 hover:border-violet-300",
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
                      className={[
                        "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                        selected?.itemId === optItem.id
                          ? "border-violet-500 bg-violet-50"
                          : "border-slate-200 hover:border-violet-300",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name={`group-${group.id}`}
                        value={optItem.id}
                        checked={selected?.itemId === optItem.id}
                        onChange={() =>
                          handleOptionChange(group.id, group.name, optItem.id, optItem.name, optItem.price)
                        }
                        className="accent-violet-600"
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
            <p className="text-sm font-bold text-slate-700 mb-2">数量</p>
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
                className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl font-bold text-violet-600 hover:bg-violet-200 transition-all"
              >
                ＋
              </button>
              <span className="ml-auto text-xl font-black text-violet-600">{formatPrice(total)}</span>
            </div>
          </div>

          {/* カートに追加 */}
          <button
            onClick={() => onAddToCart(quantity, servingTime, selectedOptions)}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-black py-4 rounded-2xl text-base shadow-[0_4px_20px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_28px_rgba(139,92,246,0.55)] hover:-translate-y-0.5 active:scale-[0.98] transition-all"
          >
            カートに追加 — {formatPrice(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── カートタブ ────────────────────────────────────────────────

function CartTab({
  cart,
  cartTotal,
  getCategoryColor,
  onRemove,
  onSwitchMenu,
  onOrderSent,
}: {
  cart: CartItem[];
  cartTotal: number;
  getCategoryColor: (id: string) => string;
  onRemove: (id: string) => void;
  onSwitchMenu: () => void;
  onOrderSent: () => void;
}) {
  if (cart.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400 px-6">
        <span className="text-6xl">🛒</span>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-600">カートは空です</p>
          <p className="text-sm mt-1">メニューからお選びください</p>
        </div>
        <button
          onClick={onSwitchMenu}
          className="mt-2 px-6 py-3 bg-violet-600 text-white font-bold rounded-2xl text-sm shadow-sm hover:bg-violet-700 transition-colors"
        >
          メニューを見る
        </button>
      </div>
    );
  }

  const servingLabel: Record<ServingTime, string> = {
    before: "🥗 食事前",
    with:   "🍽️ 食事と一緒",
    after:  "☕ 食事後",
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <h2 className="text-base font-black text-slate-800">注文確認</h2>

        {cart.map((cartItem) => {
          const optionDelta = cartItem.selectedOptions.reduce((s, o) => s + o.price, 0);
          const unitPrice = cartItem.menuItem.price + optionDelta;
          const subtotal = unitPrice * cartItem.quantity;
          const color = getCategoryColor(cartItem.menuItem.category);

          return (
            <div
              key={cartItem.id}
              className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 flex items-start gap-3 p-3"
            >
              {/* 絵文字 */}
              <div className={`w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${color}`}>
                <span className="text-2xl">{cartItem.menuItem.emoji ?? "🍽️"}</span>
              </div>

              {/* 情報 */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">
                  {cartItem.menuItem.name}
                </p>
                {cartItem.selectedOptions.length > 0 && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {cartItem.selectedOptions.map((o) => o.itemName).join(" · ")}
                  </p>
                )}
                <p className="text-[11px] text-violet-500 font-medium mt-0.5">
                  {servingLabel[cartItem.servingTime]}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-slate-500">×{cartItem.quantity}</span>
                  <span className="text-sm font-black text-violet-600">{formatPrice(subtotal)}</span>
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

      {/* フッター */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-600">合計</span>
          <span className="text-2xl font-black text-violet-600">{formatPrice(cartTotal)}</span>
        </div>
        <p className="text-[11px] text-slate-400">※ 税込金額（{(10 * 100).toFixed(0)}%）です</p>
        <button
          onClick={onOrderSent}
          className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-black py-4 rounded-2xl text-base shadow-[0_4px_20px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_28px_rgba(139,92,246,0.55)] hover:-translate-y-0.5 active:scale-[0.98] transition-all"
        >
          注文をスタッフに送る 🙌
        </button>
      </div>
    </div>
  );
}

// ─── AIタブ ───────────────────────────────────────────────────

function AiTab({
  lang,
  messages,
  input,
  isTyping,
  bottomRef,
  onInputChange,
  onSubmit,
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
      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3 max-w-2xl mx-auto">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {isTyping && <TypingDots />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 入力エリア */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-3">
        <form onSubmit={onSubmit} className="max-w-2xl mx-auto flex gap-2 items-end">
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={isTyping ? t(lang, "sending") : t(lang, "chatPlaceholder")}
            disabled={isTyping}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-[0_2px_12px_rgba(139,92,246,0.4)] hover:shadow-[0_4px_20px_rgba(139,92,246,0.55)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 active:scale-95 transition-all"
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
  cart,
  cartTotal,
  categoryColorMap,
  called,
  onCall,
}: {
  cart: CartItem[];
  cartTotal: number;
  categoryColorMap: (id: string) => string;
  called: boolean;
  onCall: () => void;
}) {
  if (called) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 px-6">
        <span className="text-7xl animate-bounce">🙏</span>
        <div className="text-center">
          <p className="text-xl font-black text-slate-800">スタッフが参ります</p>
          <p className="text-sm text-slate-500 mt-2">しばらくお待ちください</p>
        </div>
        <div className="mt-4 w-full max-w-sm bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm text-amber-700 font-medium text-center">
            💳 現金・カードはスタッフにお申し付けください
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <h2 className="text-base font-black text-slate-800">お会計</h2>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <span className="text-5xl">🛒</span>
            <p className="text-sm font-medium">カートに商品がありません</p>
          </div>
        ) : (
          cart.map((cartItem) => {
            const optionDelta = cartItem.selectedOptions.reduce((s, o) => s + o.price, 0);
            const unitPrice = cartItem.menuItem.price + optionDelta;
            const subtotal = unitPrice * cartItem.quantity;
            const color = categoryColorMap(cartItem.menuItem.category);

            return (
              <div key={cartItem.id} className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/60 flex items-center gap-3 p-3">
                <div className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${color}`}>
                  <span className="text-xl">{cartItem.menuItem.emoji ?? "🍽️"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 leading-tight line-clamp-1">{cartItem.menuItem.name}</p>
                  <p className="text-xs text-slate-500">×{cartItem.quantity}</p>
                </div>
                <span className="text-sm font-black text-violet-600">{formatPrice(subtotal)}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex-shrink-0 bg-white border-t border-slate-200 p-4 flex flex-col gap-3">
        {cart.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-600">合計金額</span>
            <span className="text-2xl font-black text-violet-600">{formatPrice(cartTotal)}</span>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs text-amber-700 font-medium text-center">
            💳 現金・カードはスタッフにお申し付けください
          </p>
        </div>

        <button
          onClick={onCall}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black py-4 rounded-2xl text-base shadow-[0_4px_20px_rgba(245,158,11,0.4)] hover:shadow-[0_6px_28px_rgba(245,158,11,0.55)] hover:-translate-y-0.5 active:scale-[0.98] transition-all"
        >
          スタッフをお呼びします 🛎️
        </button>
      </div>
    </div>
  );
}

// ─── 成功モーダル ──────────────────────────────────────────────

function SuccessModal({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full flex flex-col items-center gap-4 text-center">
        <span className="text-6xl animate-bounce">🙏</span>
        <p className="text-base font-bold text-slate-800 leading-relaxed">{message}</p>
        <button
          onClick={onClose}
          className="mt-2 w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold py-3 rounded-2xl shadow-sm hover:shadow-md transition-all"
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

// ─── タイピングインジケーター ───────────────────────────────────

function TypingDots() {
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

// ─── 送信アイコン ──────────────────────────────────────────────

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 translate-x-0.5">
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  );
}
