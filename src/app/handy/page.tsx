"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchMenuItems, fetchCategories } from "@/lib/db";
import { MenuItem } from "@/types/pos";
import type { CategoryRecord } from "@/lib/db";
import MenuSearchBox from "@/components/MenuSearchBox";
import { t, type Lang } from "@/lib/i18n";
import { warajiItemName, warajiCatName } from "@/data/warajiTranslations";

const IS_WARAJI = process.env.NEXT_PUBLIC_STORE_ID === "waraji";
const STAFF_LIST = IS_WARAJI ? ["小黒", "ラム", "ビカス"] : ["向田", "スタッフA"];

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
  sentAt: number; // epoch ms
  served: boolean;
  closed: boolean;
};

const TABLES = ["1", "2", "3", "4", "5", "6", "カウンター1", "カウンター2", "座敷1", "座敷2"];
const LS_ORDERS_KEY = "waraji_handy_orders";
const LS_LANG_KEY = "waraji_handy_lang";

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
    // 24時間より古い注文は自動で除外（デモで hisotry が散らからないように）
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

  useEffect(() => {
    const saved = localStorage.getItem(LS_LANG_KEY) as Lang | null;
    if (saved && HANDY_LANGS.some(l => l.code === saved)) setLang(saved);
    setOrders(loadOrders());
  }, []);
  useEffect(() => { localStorage.setItem(LS_LANG_KEY, lang); }, [lang]);
  useEffect(() => { saveOrders(orders); }, [orders]);

  useEffect(() => {
    fetchCategories()
      .then(cats => {
        const sorted = cats
          .filter(c => c.name !== "テイクアウト" && c.id !== "takeout")
          .sort((a, b) => a.display_order - b.display_order);
        setCategories(sorted);
        if (sorted.length > 0) setActiveCatId(sorted[0].id);
      })
      .catch(console.error);
  }, []);
  useEffect(() => {
    fetchMenuItems().then(items => setMenuItems(items)).catch(console.error);
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
      if (existing) return prev.map(c => c.itemKey === key ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { itemKey: key, item, qty: 1 }];
    });
    setFlash(warajiItemName(item.name, lang));
    setTimeout(() => setFlash(null), 800);
  }, [lang]);

  const changeQty = (key: string, delta: number) => {
    setCart(prev => prev.map(c => c.itemKey === key ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0));
  };
  const removeFromCart = (key: string) => setCart(prev => prev.filter(c => c.itemKey !== key));

  const sendToKitchen = async () => {
    if (cart.length === 0) return;
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
      await new Promise(r => setTimeout(r, 300));
      setOrders(prev => [record, ...prev]);
      setCart([]);
      setShowCart(false);
      setFlash("✓ キッチンへ送信しました");
      setTimeout(() => setFlash(null), 1200);
    } finally {
      setSending(false);
    }
  };

  const toggleServed = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, served: !o.served } : o));
  };
  const closeOrder = (id: string) => {
    if (!confirm("この注文を会計済み（クローズ）にしますか？")) return;
    setOrders(prev => prev.map(o => o.id === id ? { ...o, closed: true, served: true } : o));
  };
  const cancelOrder = (id: string) => {
    if (!confirm("この注文を取り消しますか？")) return;
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  const filteredItems = menuItems
    .filter(m => m.category === activeCatId && m.isAvailable !== false)
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

  const pendingOrders = useMemo(() => orders.filter(o => !o.closed), [orders]);
  const historyOrders = useMemo(() => [...orders].sort((a, b) => b.sentAt - a.sentAt), [orders]);

  // UI ラベル
  const L = {
    tableLabel:  lang === "ja" ? "卓" : lang === "en" ? "Table" : lang === "ne" ? "टेबल" : lang === "zh" ? "桌" : lang === "ko" ? "테이블" : "Table",
    staffLabel:  lang === "ja" ? "担当" : lang === "en" ? "Staff" : lang === "ne" ? "स्टाफ" : lang === "zh" ? "员工" : lang === "ko" ? "담당" : "Staff",
    itemsLabel:  lang === "ja" ? "品" : lang === "en" ? "items" : lang === "ne" ? "वस्तु" : lang === "zh" ? "品" : lang === "ko" ? "개" : "items",
    sendLabel:   lang === "ja" ? "▶ キッチンへ" : lang === "en" ? "▶ To Kitchen" : lang === "ne" ? "▶ भान्सामा" : lang === "zh" ? "▶ 送厨房" : lang === "ko" ? "▶ 주방으로" : "▶ To Kitchen",
    sendingLabel: lang === "ja" ? "送信中…" : lang === "en" ? "Sending..." : lang === "ne" ? "पठाइँदै..." : lang === "zh" ? "发送中..." : lang === "ko" ? "전송 중…" : "Sending...",
    selectPrompt: lang === "ja" ? "商品を選択してください" : lang === "en" ? "Please select items" : lang === "ne" ? "कृपया वस्तु चयन गर्नुहोस्" : lang === "zh" ? "请选择商品" : lang === "ko" ? "상품을 선택하세요" : "Please select items",
    orderContentLabel: lang === "ja" ? "注文内容" : t(lang, "cartTitle"),
    totalLabel:  lang === "ja" ? "合計（税込）" : t(lang, "total"),
    noItemsInCat: t(lang, "noItems"),
    tabOrder:    lang === "ja" ? "注文" : "Order",
    tabPending:  lang === "ja" ? "未提供" : "Open",
    tabHistory:  lang === "ja" ? "履歴" : "History",
    served:      lang === "ja" ? "提供済" : "Served",
    serve:       lang === "ja" ? "提供" : "Serve",
    close:       lang === "ja" ? "会計" : "Close",
    cancel:      lang === "ja" ? "取消" : "Cancel",
    closed:      lang === "ja" ? "会計済" : "Closed",
    noPending:   lang === "ja" ? "未提供の注文はありません" : "No open orders",
    noHistory:   lang === "ja" ? "本日の注文履歴はまだありません" : "No history today",
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-100 max-w-md mx-auto">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="bg-indigo-600 text-white px-3 py-2.5 shadow-md sticky top-0 z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="w-16 text-left">
            <p className="text-[10px] leading-none opacity-70">HANDY</p>
            <p className="text-sm font-bold leading-tight">笑路 (Waraji)</p>
          </div>
          <p className="text-xs opacity-70">
            {L.tableLabel}{tableNo} · {staff}
          </p>
          <select
            value={lang}
            onChange={e => setLang(e.target.value as Lang)}
            className="bg-indigo-700 border border-indigo-400 rounded-lg px-1.5 py-1 text-xs font-bold outline-none cursor-pointer"
            aria-label="Language"
          >
            {HANDY_LANGS.map(l => (
              <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 mt-2">
          <select
            value={tableNo}
            onChange={e => setTableNo(e.target.value)}
            className="flex-1 bg-indigo-700 border border-indigo-400 rounded-lg px-2 py-1.5 text-sm font-bold outline-none"
          >
            {TABLES.map(t => <option key={t} value={t}>{L.tableLabel} {t}</option>)}
          </select>
          <select
            value={staff}
            onChange={e => setStaff(e.target.value)}
            className="flex-1 bg-indigo-700 border border-indigo-400 rounded-lg px-2 py-1.5 text-sm font-bold outline-none"
          >
            {STAFF_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </header>

      {/* ── Tab Bar ────────────────────────────────────── */}
      <div className="flex bg-white border-b border-slate-200 sticky top-[110px] z-10">
        {([
          { key: "order",   icon: "🛒", label: L.tabOrder,   badge: cartCount },
          { key: "pending", icon: "⏳", label: L.tabPending, badge: pendingOrders.length },
          { key: "history", icon: "📜", label: L.tabHistory, badge: 0 },
        ] as const).map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all ${
              tab === item.key
                ? "border-indigo-600 text-indigo-600 bg-indigo-50"
                : "border-transparent text-slate-500"
            }`}
          >
            <span className="text-base mr-1">{item.icon}</span>
            {item.label}
            {item.badge > 0 && (
              <span className="ml-1 inline-block bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-black align-top">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Main content by tab ─────────────────────────── */}
      {tab === "order" && (
        <>
          <div className="px-3 pt-3">
            <MenuSearchBox
              menuItems={menuItems}
              onSelect={addToCart}
              initialLang={speechLangFor(lang)}
              hideLangSelector
            />
          </div>

          <div className="px-2 pb-2 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 whitespace-nowrap">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setActiveCatId(cat.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${
                    activeCatId === cat.id ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                  }`}>
                  {warajiCatName(cat.name, lang)}
                </button>
              ))}
            </div>
          </div>

          <main className="flex-1 overflow-y-auto px-3 pb-32">
            <div className="grid grid-cols-2 gap-2">
              {filteredItems.map(item => {
                const totalPrice = Math.round(item.price * (1 + (item.taxRate ?? 0.10)));
                const displayName = warajiItemName(item.name, lang);
                const showJa = lang !== "ja" && displayName !== item.name;
                return (
                  <button key={item.id} onClick={() => addToCart(item)}
                    className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 hover:border-indigo-400 active:scale-95 transition-all text-left">
                    <div className="flex items-start gap-2">
                      <span className="text-2xl leading-none">{item.emoji ?? "🍽️"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 leading-tight line-clamp-2">{displayName}</p>
                        {showJa && <p className="text-[10px] text-slate-400 leading-tight truncate mt-0.5">{item.name}</p>}
                        <p className="text-sm font-black text-indigo-600 mt-1">¥{totalPrice}</p>
                      </div>
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

      {tab === "pending" && (
        <main className="flex-1 overflow-y-auto px-3 py-3 pb-24 space-y-3">
          {pendingOrders.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">{L.noPending}</p>
          ) : pendingOrders.map(o => (
            <OrderCard key={o.id} order={o} labels={L}
              onServe={() => toggleServed(o.id)}
              onClose={() => closeOrder(o.id)}
              onCancel={() => cancelOrder(o.id)}
            />
          ))}
        </main>
      )}

      {tab === "history" && (
        <main className="flex-1 overflow-y-auto px-3 py-3 pb-24 space-y-3">
          {historyOrders.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">{L.noHistory}</p>
          ) : historyOrders.map(o => (
            <OrderCard key={o.id} order={o} labels={L} readonly
              onServe={() => toggleServed(o.id)}
              onClose={() => closeOrder(o.id)}
              onCancel={() => cancelOrder(o.id)}
            />
          ))}
        </main>
      )}

      {/* ── Flash toast ────────────────────────────────── */}
      {flash && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-sm px-4 py-2 rounded-full shadow-lg z-40 max-w-[280px] truncate">
          + {flash}
        </div>
      )}

      {/* ── Sticky cart bar (only on order tab) ────────── */}
      {tab === "order" && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] p-3 z-20">
          {cart.length === 0 ? (
            <button disabled className="w-full h-14 rounded-2xl bg-slate-100 text-slate-400 font-bold text-sm">
              {L.selectPrompt}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setShowCart(true)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 rounded-2xl px-3 py-2.5 flex items-center justify-between active:scale-95 transition-all">
                <span className="text-xs font-bold text-slate-600">{cartCount}{L.itemsLabel}</span>
                <span className="text-base font-black text-slate-800">¥{cartTotal.toLocaleString()}</span>
              </button>
              <button onClick={sendToKitchen} disabled={sending}
                className="flex-[1.4] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-2xl font-black text-sm active:scale-95 transition-all">
                {sending ? L.sendingLabel : L.sendLabel}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Cart modal ─────────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setShowCart(false)}>
          <div className="absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col animate-slideup" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{L.tableLabel} {tableNo} · {staff}</p>
                <p className="text-lg font-black text-slate-800">{L.orderContentLabel} {cartCount}{L.itemsLabel}</p>
              </div>
              <button onClick={() => setShowCart(false)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.map(c => {
                const rate = c.item.taxRate ?? 0.10;
                const each = Math.round(c.item.price * (1 + rate));
                const displayName = warajiItemName(c.item.name, lang);
                return (
                  <div key={c.itemKey} className="bg-slate-50 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-xl">{c.item.emoji ?? "🍽️"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{displayName}</p>
                      <p className="text-xs text-slate-500">¥{each} × {c.qty} = ¥{(each * c.qty).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeQty(c.itemKey, -1)} className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold text-slate-700">−</button>
                      <span className="w-6 text-center font-bold">{c.qty}</span>
                      <button onClick={() => changeQty(c.itemKey, 1)} className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold text-slate-700">+</button>
                      <button onClick={() => removeFromCart(c.itemKey)} className="ml-1 w-8 h-8 rounded-lg bg-red-50 text-red-500 text-sm">🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="flex justify-between items-baseline mb-3">
                <span className="text-sm text-slate-500">{L.totalLabel}</span>
                <span className="text-2xl font-black text-slate-800">¥{cartTotal.toLocaleString()}</span>
              </div>
              <button onClick={sendToKitchen} disabled={sending} className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-2xl font-black text-base active:scale-95">
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
  labels: { tableLabel: string; served: string; serve: string; close: string; cancel: string; closed: string; itemsLabel: string };
  readonly?: boolean;
  onServe: () => void;
  onClose: () => void;
  onCancel: () => void;
}) {
  const totalQty = order.items.reduce((s, i) => s + i.qty, 0);
  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${order.closed ? "border-slate-200 opacity-70" : order.served ? "border-emerald-300" : "border-amber-300"}`}>
      <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100">
        <div>
          <p className="text-xs font-bold text-slate-800">
            {labels.tableLabel}{order.tableNo}
            <span className="ml-2 text-slate-400 font-normal">{fmtTime(order.sentAt)}</span>
          </p>
          <p className="text-[10px] text-slate-400">{order.staff}</p>
        </div>
        <div className="flex items-center gap-1">
          {order.closed ? (
            <span className="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded-md font-bold">{labels.closed}</span>
          ) : order.served ? (
            <span className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md font-bold">✓ {labels.served}</span>
          ) : (
            <span className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-bold">未提供</span>
          )}
        </div>
      </div>
      <div className="px-3 py-2 space-y-0.5">
        {order.items.map((it, i) => (
          <div key={i} className="flex items-center text-xs">
            <span className="w-6">{it.emoji}</span>
            <span className="flex-1 truncate">{it.name}</span>
            <span className="text-slate-500 font-mono">× {it.qty}</span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">{totalQty}{labels.itemsLabel}</span>
        <span className="text-sm font-black text-slate-800">¥{order.totalTaxIncl.toLocaleString()}</span>
      </div>
      {!readonly && !order.closed && (
        <div className="flex border-t border-slate-100">
          <button onClick={onServe}
            className={`flex-1 py-2 text-xs font-bold ${order.served ? "text-slate-400" : "text-emerald-600 hover:bg-emerald-50"}`}>
            {order.served ? "↺ " + labels.served : "✓ " + labels.serve}
          </button>
          <button onClick={onClose} className="flex-1 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border-l border-slate-100">
            💴 {labels.close}
          </button>
          <button onClick={onCancel} className="flex-1 py-2 text-xs font-bold text-red-500 hover:bg-red-50 border-l border-slate-100">
            🗑 {labels.cancel}
          </button>
        </div>
      )}
    </div>
  );
}
