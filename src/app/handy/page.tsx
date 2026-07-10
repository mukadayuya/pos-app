"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { fetchMenuItems, fetchCategories } from "@/lib/db";
import { MenuItem } from "@/types/pos";
import type { CategoryRecord } from "@/lib/db";
import MenuSearchBox from "@/components/MenuSearchBox";
import { t, type Lang } from "@/lib/i18n";
import { warajiItemName, warajiCatName, warajiMenuTranslations } from "@/data/warajiTranslations";

// 翻訳名（ネパール語・英語・中国語・韓国語）も検索対象にする
function translationTargets(item: MenuItem): string[] {
  return Object.values(warajiMenuTranslations[item.name] ?? {}) as string[];
}

const IS_WARAJI = process.env.NEXT_PUBLIC_STORE_ID === "waraji";
const IS_SHOTEN = process.env.NEXT_PUBLIC_STORE_ID === "shoten";
const STAFF_LIST = (IS_WARAJI || IS_SHOTEN) ? ["小黒", "ラム", "ビカス"] : ["向田", "スタッフA"];
const STORE_DISPLAY = IS_SHOTEN ? "笑点" : "笑路";

const HANDY_LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: "ja", flag: "🇯🇵", label: "日本語" },
  { code: "ne", flag: "🇳🇵", label: "नेपाली" },
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "ko", flag: "🇰🇷", label: "한국어" },
];

type CartItem = { itemKey: string; item: MenuItem; qty: number };

type OrderRecord = {
  id: string;
  tableNo: string;
  staff: string;
  items: { name: string; emoji: string; qty: number; unitPrice: number }[];
  totalTaxIncl: number;
  sentAt: number;
  served: boolean;
  closed: boolean;
};

const TABLES = ["1", "2", "3", "4", "5", "6", "カウンター1", "カウンター2", "座敷1", "座敷2"];
const LS_ORDERS_KEY = "waraji_handy_orders";
const LS_LANG_KEY = "waraji_handy_lang";
const LS_CART_KEY = "waraji_handy_cart";
const LS_TABLE_KEY = "waraji_handy_table";
const LS_STAFF_KEY = "waraji_handy_staff";
const MAX_QTY = 99;

function speechLangFor(lang: Lang): "ja-JP" | "en-US" | "ne-NP" | "zh-CN" | "ko-KR" {
  if (lang === "en") return "en-US";
  if (lang === "ne") return "ne-NP";
  if (lang === "zh") return "zh-CN";
  if (lang === "ko") return "ko-KR";
  return "ja-JP";
}

function loadOrders(): OrderRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OrderRecord[];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return parsed.filter(o => o.sentAt > cutoff);
  } catch { return []; }
}
function saveOrders(list: OrderRecord[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_ORDERS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
function fmtTime(ms: number) {
  const d = new Date(ms);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

type Tab = "order" | "pending" | "history";

export default function HandyPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [activeCatId, setActiveCatId] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNo, setTableNo] = useState<string>("1");
  const [staff, setStaff] = useState<string>(STAFF_LIST[0]);
  const [lang, setLang] = useState<Lang>("ja");
  const [showCart, setShowCart] = useState(false);
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("order");
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState<string>("all");

  useEffect(() => {
    const saved = localStorage.getItem(LS_LANG_KEY) as Lang | null;
    if (saved && HANDY_LANGS.some(l => l.code === saved)) setLang(saved);
    // 卓・担当者もリロード後に復元（営業中の画面更新で選び直しにならないように）
    const savedTable = localStorage.getItem(LS_TABLE_KEY);
    if (savedTable && TABLES.includes(savedTable)) setTableNo(savedTable);
    const savedStaff = localStorage.getItem(LS_STAFF_KEY);
    if (savedStaff && STAFF_LIST.includes(savedStaff)) setStaff(savedStaff);
    setOrders(loadOrders());
  }, []);
  useEffect(() => { localStorage.setItem(LS_LANG_KEY, lang); }, [lang]);
  useEffect(() => { localStorage.setItem(LS_TABLE_KEY, tableNo); }, [tableNo]);
  useEffect(() => { localStorage.setItem(LS_STAFF_KEY, staff); }, [staff]);
  useEffect(() => { saveOrders(orders); }, [orders]);

  // カートを永続化（{商品id, 数量} のみ保存。リロードしても注文取り直しにならない）
  // 注意: 復元完了前に空カートで上書きしないよう、復元後にのみ保存を有効化
  const cartHydratedRef = useRef(false);
  useEffect(() => {
    if (!cartHydratedRef.current) return;
    try {
      localStorage.setItem(LS_CART_KEY, JSON.stringify(cart.map(c => ({ id: c.item.id, qty: c.qty }))));
    } catch { /* ignore */ }
  }, [cart]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCategories(), fetchMenuItems()])
      .then(([cats, items]) => {
        if (cancelled) return;
        const sorted = cats
          .filter(c => c.name !== "テイクアウト" && c.id !== "takeout")
          .sort((a, b) => a.display_order - b.display_order);
        setCategories(sorted);
        if (sorted.length > 0) setActiveCatId(sorted[0].id);
        setMenuItems(items);
        // 保存されていたカートを復元（メニューに存在しない商品は捨てる）
        try {
          const rawCart = localStorage.getItem(LS_CART_KEY);
          if (rawCart) {
            const stored = JSON.parse(rawCart) as { id: string; qty: number }[];
            const restored: CartItem[] = stored
              .map(s => {
                const item = items.find(m => m.id === s.id);
                if (!item || item.isAvailable === false) return null;
                return { itemKey: item.id, item, qty: Math.min(MAX_QTY, Math.max(1, s.qty)) };
              })
              .filter((c): c is CartItem => c !== null);
            if (restored.length > 0) setCart(restored);
          }
        } catch { /* ignore */ }
        // ここから先はカート変更を保存してよい（復元完了）
        cartHydratedRef.current = true;
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const cartTotal = cart.reduce((s, c) => {
    const rate = c.item.taxRate ?? 0.10;
    return s + Math.round(c.item.price * (1 + rate)) * c.qty;
  }, 0);

  const addToCart = useCallback((item: MenuItem) => {
    setCart(prev => {
      const key = item.id;
      const existing = prev.find(c => c.itemKey === key);
      if (existing) return prev.map(c => c.itemKey === key ? { ...c, qty: Math.min(MAX_QTY, c.qty + 1) } : c);
      return [...prev, { itemKey: key, item, qty: 1 }];
    });
    setFlash(warajiItemName(item.name, lang));
    setTimeout(() => setFlash(null), 700);
  }, [lang]);

  const changeQty = (key: string, delta: number) => {
    setCart(prev => prev
      .map(c => c.itemKey === key ? { ...c, qty: Math.min(MAX_QTY, c.qty + delta) } : c)
      .filter(c => c.qty > 0));
  };
  const removeFromCart = (key: string) => setCart(prev => prev.filter(c => c.itemKey !== key));

  // カートが空になったらモーダルを自動で閉じる（空モーダルが残らないように）
  useEffect(() => {
    if (showCart && cart.length === 0) setShowCart(false);
  }, [cart.length, showCart]);

  // 連打ガードは state ではなく ref で行う（stateは非同期更新のため同一瞬間の連打をすり抜ける）
  const sendingRef = useRef(false);
  const sendToKitchen = async () => {
    if (sendingRef.current || cart.length === 0) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const record: OrderRecord = {
        id: crypto.randomUUID(),
        tableNo,
        staff,
        items: cart.map(c => ({
          name: c.item.name,
          emoji: c.item.emoji ?? "🍽️",
          qty: c.qty,
          unitPrice: Math.round(c.item.price * (1 + (c.item.taxRate ?? 0.10))),
        })),
        totalTaxIncl: cartTotal,
        sentAt: Date.now(),
        served: false,
        closed: false,
      };
      await new Promise(r => setTimeout(r, 250));
      setOrders(prev => [record, ...prev]);
      setCart([]);
      setShowCart(false);
      setFlash("✓ キッチンへ送信しました");
      setTimeout(() => setFlash(null), 1200);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  // 確認はカード内の2度押しUI（OrderCard側）で行うため、ここでは即実行
  const toggleServed = (id: string) => setOrders(prev => prev.map(o => o.id === id ? { ...o, served: !o.served } : o));
  const closeOrder = (id: string) =>
    setOrders(prev => prev.map(o => o.id === id ? { ...o, closed: true, served: true } : o));
  const cancelOrder = (id: string) => setOrders(prev => prev.filter(o => o.id !== id));

  const filteredItems = menuItems
    .filter(m => m.category === activeCatId && m.isAvailable !== false)
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

  // 未会計の注文（卓管理タブに表示）
  const openOrders = useMemo(() => orders.filter(o => !o.closed), [orders]);
  // 赤バッジ = まだ提供していない注文の数（提供済は含めない）
  const unservedCount = useMemo(() => openOrders.filter(o => !o.served).length, [openOrders]);
  // 未会計の注文がある卓の一覧（絞り込みチップ用）
  const openTables = useMemo(() => Array.from(new Set(openOrders.map(o => o.tableNo))), [openOrders]);
  // 絞り込み対象の卓の注文が全て会計済みになったら自動で「全卓」に戻す
  const effectiveFilter = tableFilter !== "all" && !openTables.includes(tableFilter) ? "all" : tableFilter;
  // 卓管理は古い順（FIFO）: 先に入った注文から提供するのが現場の鉄則
  const visibleOpenOrders = useMemo(
    () => (effectiveFilter === "all" ? openOrders : openOrders.filter(o => o.tableNo === effectiveFilter))
      .slice()
      .sort((a, b) => a.sentAt - b.sentAt),
    [openOrders, effectiveFilter],
  );
  const historyOrders = useMemo(() => [...orders].sort((a, b) => b.sentAt - a.sentAt), [orders]);

  const L = {
    tableLabel:  lang === "ja" ? "卓" : lang === "en" ? "Table" : lang === "ne" ? "टेबल" : lang === "zh" ? "桌" : lang === "ko" ? "테이블" : "Table",
    itemsLabel:  lang === "ja" ? "品" : lang === "en" ? "items" : lang === "ne" ? "वस्तु" : lang === "zh" ? "品" : lang === "ko" ? "개" : "items",
    sendLabel:   lang === "ja" ? "▶ キッチンへ送信" : lang === "en" ? "▶ Send to Kitchen" : lang === "ne" ? "▶ भान्सामा पठाउनुहोस्" : lang === "zh" ? "▶ 发送到厨房" : lang === "ko" ? "▶ 주방으로 보내기" : "▶ Send to Kitchen",
    sendingLabel:lang === "ja" ? "送信中…" : lang === "en" ? "Sending..." : lang === "ne" ? "पठाइँदै..." : lang === "zh" ? "发送中..." : lang === "ko" ? "전송 중…" : "Sending...",
    selectPrompt:lang === "ja" ? "メニューを選んでカートに追加" : lang === "en" ? "Select menu items" : lang === "ne" ? "मेनु छान्नुहोस्" : lang === "zh" ? "选择菜单商品" : lang === "ko" ? "메뉴를 선택하세요" : "Select items",
    orderContentLabel: lang === "ja" ? "注文内容" : t(lang, "cartTitle"),
    totalLabel:  lang === "ja" ? "合計（税込）" : t(lang, "total"),
    noItemsInCat: t(lang, "noItems"),
    tabOrder:    lang === "ja" ? "注文" : "Order",
    tabPending:  lang === "ja" ? "卓管理" : lang === "en" ? "Tables" : lang === "ne" ? "टेबल" : lang === "zh" ? "桌台" : lang === "ko" ? "테이블" : "Tables",
    tabHistory:  lang === "ja" ? "履歴" : "History",
    allTables:   lang === "ja" ? "全卓" : lang === "en" ? "All" : lang === "ne" ? "सबै" : lang === "zh" ? "全部" : lang === "ko" ? "전체" : "All",
    served:      lang === "ja" ? "提供済" : "Served",
    serve:       lang === "ja" ? "提供する" : "Serve",
    close:       lang === "ja" ? "会計" : "Close",
    cancel:      lang === "ja" ? "取消" : "Cancel",
    confirmTap:  lang === "ja" ? "もう一度タップで確定" : lang === "en" ? "Tap again to confirm" : lang === "ne" ? "पुष्टि गर्न फेरि ट्याप गर्नुहोस्" : lang === "zh" ? "再次点击确认" : lang === "ko" ? "한 번 더 탭하여 확정" : "Tap again",
    closed:      lang === "ja" ? "会計済" : "Closed",
    pending:     lang === "ja" ? "未提供" : "Pending",
    noPending:   lang === "ja" ? "対応中の注文はありません" : "No open orders",
    noHistory:   lang === "ja" ? "本日の注文履歴はまだありません" : "No history yet",
    loading:     lang === "ja" ? "読み込み中..." : t(lang, "loadingMenu"),
    tableChoice: lang === "ja" ? "卓を選択" : "Table",
    staffChoice: lang === "ja" ? "担当スタッフ" : "Staff",
  };

  return (
    <div className="min-h-[100svh] flex flex-col bg-slate-100 w-full overflow-x-hidden">
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto">
        {/* ── Header ─────────────────────────────────────── */}
        <header className="bg-white text-slate-900 border-b border-slate-200 shadow-sm sticky top-0 z-30" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="px-3 py-2 flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0 min-w-0">
              <p className="text-[9px] leading-none opacity-70 font-bold tracking-wider">HANDY</p>
              <p className="text-sm font-bold leading-tight truncate">{STORE_DISPLAY}</p>
            </div>
            <div className="flex-1 text-center min-w-0">
              <p className="text-[10px] opacity-70 leading-tight">
                {L.tableLabel} {tableNo} · {staff}
              </p>
            </div>
            <select
              value={lang}
              onChange={e => setLang(e.target.value as Lang)}
              className="flex-shrink-0 bg-slate-100 border border-slate-300 text-slate-800 rounded-lg px-1.5 py-1 text-xs font-bold outline-none cursor-pointer max-w-[80px]"
              aria-label="Language"
            >
              {HANDY_LANGS.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
              ))}
            </select>
          </div>
          <div className="px-3 pb-2 flex gap-2 min-w-0">
            <select
              value={tableNo}
              onChange={e => {
                const next = e.target.value;
                setTableNo(next);
                // カートに商品が残ったまま卓を替えると誤送信の元なので注意を出す
                if (cart.length > 0) {
                  setFlash(`⚠️ カートの${cartCount}品は ${L.tableLabel}${next} として送信されます`);
                  setTimeout(() => setFlash(null), 2500);
                }
              }}
              className="flex-1 min-w-0 bg-slate-100 border border-slate-300 text-slate-800 rounded-lg px-2 py-2 text-sm font-bold outline-none"
              aria-label={L.tableChoice}
            >
              {TABLES.map(t => <option key={t} value={t}>{L.tableLabel} {t}</option>)}
            </select>
            <select
              value={staff}
              onChange={e => setStaff(e.target.value)}
              className="flex-1 min-w-0 bg-slate-100 border border-slate-300 text-slate-800 rounded-lg px-2 py-2 text-sm font-bold outline-none"
              aria-label={L.staffChoice}
            >
              {STAFF_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* ── Tab Bar (attached to header for smooth stickiness) ── */}
          <div className="flex bg-white border-t border-slate-100">
            {([
              { key: "order",   icon: "🛒", label: L.tabOrder,   badge: cartCount },
              { key: "pending", icon: "⏳", label: L.tabPending, badge: unservedCount },
              { key: "history", icon: "📜", label: L.tabHistory, badge: 0 },
            ] as const).map(item => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`flex-1 min-w-0 py-2 text-xs font-bold transition-all relative ${
                  tab === item.key ? "bg-slate-100 text-slate-900" : "text-slate-400"                }`}
              >
                <span className="text-sm mr-1">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {item.badge > 0 && (
                  <span className="ml-1 inline-block bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-black">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        {/* ── Loading ────────────────────────────────────── */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">{L.loading}</p>
            </div>
          </div>
        )}

        {/* ── Main content by tab ─────────────────────────── */}
        {!loading && tab === "order" && (
          <>
            <div className="px-3 pt-3 w-full min-w-0">
              <MenuSearchBox
                menuItems={menuItems}
                onSelect={addToCart}
                initialLang={speechLangFor(lang)}
                hideLangSelector
                extraTargets={translationTargets}
                placeholder={
                  IS_SHOTEN
                    ? "ひらがな・かたかな・音声で検索（例:「なま」で 生ビール・「ひだ」で 飛騨牛）"
                    : IS_WARAJI
                      ? "ひらがな・かたかな・音声で検索（例:「なま」で 生ビール・「つく」で つくね）"
                      : undefined
                }
              />
            </div>

            <div className="pb-2 overflow-x-auto no-scrollbar">
              <div className="flex gap-2 whitespace-nowrap px-3">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCatId(cat.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${
                      activeCatId === cat.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
                    }`}>
                    {warajiCatName(cat.name, lang)}
                  </button>
                ))}
              </div>
            </div>

            <main className="flex-1 overflow-y-auto px-3 pb-40">
              <div className="grid grid-cols-2 gap-2">
                {filteredItems.map(item => {
                  const taxIncl = Math.round(item.price * (1 + (item.taxRate ?? 0.10)));
                  const displayName = warajiItemName(item.name, lang);
                  const showJa = lang !== "ja" && displayName !== item.name;
                  return (
                    <button key={item.id} onClick={() => addToCart(item)}
                      className="bg-white rounded-xl shadow-sm border border-slate-200 hover:border-slate-400 active:scale-95 transition-all text-left overflow-hidden min-w-0">
                      {item.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="w-full h-20 object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="p-2 min-w-0">
                        <div className="flex items-start gap-1 min-w-0">
                          <span className="text-lg leading-none flex-shrink-0">{item.emoji ?? "🍽️"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 leading-tight line-clamp-2 break-all">{displayName}</p>
                            {showJa && <p className="text-[10px] text-slate-400 leading-tight truncate mt-0.5">{item.name}</p>}
                          </div>
                        </div>
                        <p className="text-sm font-black text-slate-900 mt-1">
                          ¥{item.price.toLocaleString()}
                          <span className="text-[10px] font-normal text-slate-400 ml-1">(税込¥{taxIncl.toLocaleString()})</span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {filteredItems.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-12">{L.noItemsInCat}</p>
              )}
            </main>
          </>
        )}

        {!loading && tab === "pending" && (
          <main className="flex-1 overflow-y-auto px-3 py-3 pb-24 space-y-3 min-w-0">
            {/* 卓での絞り込みチップ */}
            {openTables.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setTableFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    effectiveFilter === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"
                  }`}>
                  {L.allTables} ({openOrders.length})
                </button>
                {openTables.map(tn => (
                  <button key={tn} onClick={() => setTableFilter(tn)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      effectiveFilter === tn ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"
                    }`}>
                    {L.tableLabel}{tn}
                  </button>
                ))}
              </div>
            )}
            {visibleOpenOrders.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-6xl mb-3 opacity-50">⏳</p>
                <p className="text-sm text-slate-400">{L.noPending}</p>
              </div>
            ) : visibleOpenOrders.map(o => (
              <OrderCard key={o.id} order={o} labels={L}
                onServe={() => toggleServed(o.id)}
                onClose={() => closeOrder(o.id)}
                onCancel={() => cancelOrder(o.id)}
              />
            ))}
          </main>
        )}

        {!loading && tab === "history" && (
          <main className="flex-1 overflow-y-auto px-3 py-3 pb-24 space-y-3 min-w-0">
            {historyOrders.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-6xl mb-3 opacity-50">📜</p>
                <p className="text-sm text-slate-400">{L.noHistory}</p>
              </div>
            ) : historyOrders.map(o => (
              <OrderCard key={o.id} order={o} labels={L} readonly={o.closed}
                onServe={() => toggleServed(o.id)}
                onClose={() => closeOrder(o.id)}
                onCancel={() => cancelOrder(o.id)}
              />
            ))}
          </main>
        )}
      </div>

      {/* ── Flash toast ────────────────────────────────── */}
      {flash && (
        <div className="fixed left-1/2 -translate-x-1/2 bg-slate-800/95 text-white text-sm px-4 py-2.5 rounded-full shadow-xl z-40 max-w-[85%] truncate pointer-events-none"
          style={{ bottom: `calc(env(safe-area-inset-bottom) + 100px)` }}>
          + {flash}
        </div>
      )}

      {/* ── Sticky cart bar (only on order tab) ────────── */}
      {tab === "order" && !loading && (
        <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
          <div className="max-w-md mx-auto bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] p-3 pointer-events-auto"
            style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom))` }}>
            {cart.length === 0 ? (
              <div className="w-full h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">
                {L.selectPrompt}
              </div>
            ) : (
              <div className="flex gap-2 min-w-0">
                <button onClick={() => setShowCart(true)}
                  className="flex-1 min-w-0 bg-slate-100 hover:bg-slate-200 rounded-2xl px-3 py-2.5 flex items-center justify-between active:scale-95 transition-all">
                  <span className="text-xs font-bold text-slate-600 flex-shrink-0">{cartCount}{L.itemsLabel}</span>
                  <span className="text-base font-black text-slate-800 truncate">¥{cartTotal.toLocaleString()}</span>
                </button>
                <button onClick={sendToKitchen} disabled={sending}
                  className="flex-[1.4] min-w-0 bg-slate-900 hover:bg-slate-700 disabled:opacity-60 text-white rounded-2xl font-black text-xs px-2 py-2.5 active:scale-95 transition-all truncate">
                  {sending ? L.sendingLabel : L.sendLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Cart modal ─────────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowCart(false)}>
          <div className="absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col animate-slideup"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between min-w-0">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 truncate">{L.tableLabel} {tableNo} · {staff}</p>
                <p className="text-base font-black text-slate-800 truncate">{L.orderContentLabel} {cartCount}{L.itemsLabel}</p>
              </div>
              <button onClick={() => setShowCart(false)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 text-lg flex-shrink-0 flex items-center justify-center">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.map(c => {
                const rate = c.item.taxRate ?? 0.10;
                const eachTaxIncl = Math.round(c.item.price * (1 + rate));
                const displayName = warajiItemName(c.item.name, lang);
                return (
                  <div key={c.itemKey} className="bg-slate-50 rounded-xl p-3 flex items-center gap-2 min-w-0">
                    <span className="text-xl flex-shrink-0">{c.item.emoji ?? "🍽️"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{displayName}</p>
                      <p className="text-xs text-slate-500 truncate">
                        ¥{c.item.price.toLocaleString()}（税込¥{eachTaxIncl.toLocaleString()}） × {c.qty} = ¥{(eachTaxIncl * c.qty).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => changeQty(c.itemKey, -1)} className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 text-sm">−</button>
                      <span className="w-6 text-center font-bold text-sm">{c.qty}</span>
                      <button onClick={() => changeQty(c.itemKey, 1)} className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 text-sm">+</button>
                      <button onClick={() => removeFromCart(c.itemKey)} className="ml-1 w-8 h-8 rounded-lg bg-red-50 text-red-500 text-sm">🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="flex justify-between items-baseline mb-3 min-w-0">
                <span className="text-sm text-slate-500 flex-shrink-0">{L.totalLabel}</span>
                <span className="text-2xl font-black text-slate-800 truncate">¥{cartTotal.toLocaleString()}</span>
              </div>
              <button onClick={sendToKitchen} disabled={sending} className="w-full h-14 bg-slate-900 hover:bg-slate-700 disabled:opacity-60 text-white rounded-2xl font-black text-base active:scale-95">
                {sending ? L.sendingLabel : L.sendLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; }
        @keyframes slideup {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slideup { animation: slideup 0.24s ease-out; }
      `}</style>
    </div>
  );
}

function OrderCard({ order, labels, readonly, onServe, onClose, onCancel }: {
  order: OrderRecord;
  labels: { tableLabel: string; served: string; serve: string; close: string; cancel: string; closed: string; pending: string; itemsLabel: string; confirmTap: string };
  readonly?: boolean;
  onServe: () => void;
  onClose: () => void;
  onCancel: () => void;
}) {
  const totalQty = order.items.reduce((s, i) => s + i.qty, 0);
  // 会計・取消は「2度押しで確定」方式（OSダイアログ禁止・誤タップ防止）
  const [confirming, setConfirming] = useState<null | "close" | "cancel">(null);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(null), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const handleClose = () => {
    if (confirming === "close") { setConfirming(null); onClose(); }
    else setConfirming("close");
  };
  const handleCancel = () => {
    if (confirming === "cancel") { setConfirming(null); onCancel(); }
    else setConfirming("cancel");
  };
  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden min-w-0 ${
      order.closed ? "border-slate-200 opacity-70" :
      order.served ? "border-emerald-300" :
      "border-amber-300"
    }`}>
      <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100 min-w-0 gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800 truncate">
            {labels.tableLabel}{order.tableNo}
            <span className="ml-2 text-slate-400 font-normal">{fmtTime(order.sentAt)}</span>
          </p>
          <p className="text-[10px] text-slate-400 truncate">{order.staff}</p>
        </div>
        <div className="flex-shrink-0">
          {order.closed ? (
            <span className="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded-md font-bold whitespace-nowrap">{labels.closed}</span>
          ) : order.served ? (
            <span className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md font-bold whitespace-nowrap">✓ {labels.served}</span>
          ) : (
            <span className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-bold whitespace-nowrap">{labels.pending}</span>
          )}
        </div>
      </div>
      <div className="px-3 py-2 space-y-0.5 min-w-0">
        {order.items.map((it, i) => (
          <div key={i} className="flex items-center text-xs min-w-0 gap-2">
            <span className="w-5 flex-shrink-0 text-center">{it.emoji}</span>
            <span className="flex-1 truncate">{it.name}</span>
            <span className="text-slate-500 font-mono flex-shrink-0">× {it.qty}</span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between min-w-0">
        <span className="text-xs text-slate-500 flex-shrink-0">{totalQty}{labels.itemsLabel}</span>
        <span className="text-sm font-black text-slate-800 truncate">¥{order.totalTaxIncl.toLocaleString()}</span>
      </div>
      {!readonly && !order.closed && (
        <div className="flex border-t border-slate-100">
          <button onClick={() => { setConfirming(null); onServe(); }}
            className={`flex-1 py-2.5 text-xs font-bold transition-all ${order.served ? "text-slate-400 active:bg-slate-50" : "text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100"}`}>
            {order.served ? "↺ " + labels.served : "✓ " + labels.serve}
          </button>
          <button onClick={handleClose}
            className={`flex-1 py-2.5 text-xs font-bold border-l border-slate-100 transition-all ${
              confirming === "close"
                ? "bg-blue-600 text-white animate-pulse"
                : "text-blue-600 hover:bg-blue-50 active:bg-blue-100"
            }`}>
            {confirming === "close" ? labels.confirmTap : `💴 ${labels.close}`}
          </button>
          <button onClick={handleCancel}
            className={`flex-1 py-2.5 text-xs font-bold border-l border-slate-100 transition-all ${
              confirming === "cancel"
                ? "bg-red-600 text-white animate-pulse"
                : "text-red-500 hover:bg-red-50 active:bg-red-100"
            }`}>
            {confirming === "cancel" ? labels.confirmTap : `🗑 ${labels.cancel}`}
          </button>
        </div>
      )}
    </div>
  );
}
