"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { MenuItem, OrderItem, OrderOptions, SalesRecord, ServiceTab, OrderDiscount, HoldEntry, TaxRate } from "@/types/pos";
import { broncoMenuItems, broncoCategories } from "@/data/broncoMenu";
import { isSupabaseConfigured } from "@/lib/supabase";
import { saveSaleRecord, fetchMenuItems, fetchCategories, CategoryRecord } from "@/lib/db";
import { enqueueUnsentSale, flushUnsentSales } from "@/lib/unsentSalesQueue";
import { buildDraft, persistDraftOrder, fetchDraftOrder, clearDraftOrder } from "@/lib/draftOrderSync";
import { toTakeoutMenuItem } from "@/lib/menuTransform";
import { fetchIsTakeoutEnabled } from "@/lib/storeSettings";
import CategoryBar from "@/components/CategoryBar";
import MenuPanel from "@/components/MenuPanel";
import OrderPanel from "@/components/OrderPanel";
import SalesHistory from "@/components/SalesHistory";
import OptionModal from "@/components/OptionModal";
import CheckoutScreen from "@/components/CheckoutScreen";
import FloatingNumpad from "@/components/FloatingNumpad";
import HoldRecallModal from "@/components/HoldRecallModal";
import { useRoleLayout } from "@/hooks/useRoleLayout";

const HOLD_STORAGE_KEY     = "pos_held_orders";
const ORDER_STORAGE_KEY    = "pos_order_items";
const MALE_COUNT_KEY       = "pos_male_count";
const FEMALE_COUNT_KEY     = "pos_female_count";
const DISCOUNT_STORAGE_KEY = "pos_discount";
const MAX_HOLDS = 20;

type SidePanel = "salesHistory" | null;

const IS_BRONCO = process.env.NEXT_PUBLIC_STORE_ID === "bronco";
const IS_ABC = process.env.NEXT_PUBLIC_STORE_ID === "yakitori-abc";
const STAFF_LIST = IS_BRONCO ? ["畠野", "向田", "スタッフA"]
  : IS_ABC ? ["佐藤", "山田", "スタッフA"]
  : ["沖", "向田", "スタッフA"];

// Supabase 未設定 / テーブル未作成時のフォールバックカテゴリー
// テイクアウトは CategoryBar 内の専用ボタンで独立管理するため除外
const DEFAULT_CATEGORIES: CategoryRecord[] = [
  { id: "dinner", name: "夜部", display_order: 0 },
  { id: "lunch",  name: "昼部", display_order: 1 },
];

// ── 担当者選択ピッカー ───────────────────────────────────────
function StaffPicker({
  current,
  onSelect,
}: {
  current: string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (name: string) => {
    onSelect(name);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
          current
            ? "bg-white text-slate-800 ring-1 ring-black/[0.07] shadow-sm hover:bg-slate-50"
            : "bg-white/50 text-slate-400 ring-1 ring-dashed ring-slate-200 hover:bg-white hover:text-slate-600"
        }`}
      >
        <span className="text-base">👤</span>
        <span>{current ? current : "担当者：未選択"}</span>
        <span className={`text-xs transition-transform duration-200 ${open ? "rotate-180" : ""} ${current ? "text-slate-400" : "text-slate-500"}`}>
          ▼
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 min-w-[180px]">
          <p className="px-4 pt-3 pb-1.5 text-xs font-bold text-slate-400 uppercase tracking-widest">
            担当者を選択
          </p>
          <div className="pb-2">
            {STAFF_LIST.map(name => (
              <button
                key={name}
                onClick={() => handleSelect(name)}
                className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
                  current === name
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className={`w-4 text-center text-xs ${current === name ? "text-indigo-500" : "text-transparent"}`}>
                  ✓
                </span>
                {name}
              </button>
            ))}
          </div>
          {current && (
            <>
              <div className="border-t border-slate-100 mx-3" />
              <button
                onClick={() => handleSelect("")}
                className="w-full text-left px-4 py-3 text-sm text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors flex items-center gap-2"
              >
                <span className="w-4 text-center text-xs">↩</span>
                ログアウト
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── テーブルビュー用メニューグリッド（大きなカード、タップ不可） ──────────
function TableMenuGrid({
  activeCategoryId,
  isTakeout,
  menuItems,
}: {
  activeCategoryId: string;
  isTakeout: boolean;
  menuItems: MenuItem[];
}) {
  const filtered = (isTakeout
    ? menuItems.filter(item => item.isTakeoutAvailable !== false)
    : menuItems.filter(item => item.category === activeCategoryId)
  ).filter(item => item.isAvailable !== false);

  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
      {filtered.map(item => {
        const effectiveTaxRate = isTakeout ? 0.08 : item.taxRate;
        const taxIncludedPrice = Math.round(item.price * (1 + effectiveTaxRate));
        return (
          <div
            key={item.id}
            className="bg-white rounded-3xl p-6 flex flex-col items-center gap-4
              shadow-[0_2px_16px_rgb(0,0,0,0.07)] ring-1 ring-black/[0.04] select-none"
          >
            {item.emoji && (
              <span className="text-7xl leading-none">{item.emoji}</span>
            )}
            <div className="w-full text-center space-y-1">
              <p className="text-base font-bold text-slate-800 tracking-tight leading-snug">
                {item.name}
              </p>
              <p className="text-3xl font-black text-indigo-600 tracking-tight">
                ¥{taxIncludedPrice.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400">
                税抜 ¥{item.price.toLocaleString()} ·{" "}
                <span className={isTakeout ? "text-teal-600" : ""}>
                  {isTakeout ? "8%" : "10%"}
                </span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── メインページ ──────────────────────────────────────────────
/**
 * Default export wraps RegisterPageInner in a <Suspense> boundary.
 * This is required by Next.js App Router when useSearchParams() is used
 * inside a statically prerendered route (build will fail otherwise).
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#F5F6FA]" />}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const role = useRoleLayout();
  const [categories, setCategories]         = useState<CategoryRecord[]>(DEFAULT_CATEGORIES);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("dinner");
  const [isTakeout, setIsTakeout]           = useState<boolean>(false);
  const [isTakeoutEnabled, setIsTakeoutEnabled] = useState<boolean>(true);
  const [settingsReady, setSettingsReady]   = useState<boolean>(false);
  const [menuItems, setMenuItems]           = useState<MenuItem[]>([]);
  const [orderItems, setOrderItems]     = useState<OrderItem[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) || "[]"); } catch { return []; }
  });
  const [salesHistory, setSalesHistory] = useState<SalesRecord[]>([]);
  const [sidePanel, setSidePanel]       = useState<SidePanel>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [pendingItem, setPendingItem]   = useState<MenuItem | null>(null);
  const [maleCount, setMaleCount]       = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem(MALE_COUNT_KEY) || "0", 10) || 0;
  });
  const [femaleCount, setFemaleCount]   = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem(FEMALE_COUNT_KEY) || "0", 10) || 0;
  });
  const [staffName, setStaffName]       = useState<string>("");
  const [discount, setDiscount]         = useState<OrderDiscount | null>(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem(DISCOUNT_STORAGE_KEY) || "null"); } catch { return null; }
  });
  const [holds, setHolds]               = useState<HoldEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(HOLD_STORAGE_KEY) || "[]"); } catch { return []; }
  });
  const [showHoldRecall, setShowHoldRecall]     = useState(false);
  const [isManualInput, setIsManualInput]       = useState(false);
  const [editingItemKey, setEditingItemKey]     = useState<string | null>(null);
  const [saveError, setSaveError]               = useState<{ record: SalesRecord; attempt: number } | null>(null);
  const [unsentCount, setUnsentCount]           = useState(0);
  // mobile role: which panel is active in the bottom tab bar
  const [mobileTab, setMobileTab]               = useState<"menu" | "order">("menu");

  // activeTab をカテゴリー名と isTakeout フラグから導出
  const selectedCategory = categories.find(c => c.id === activeCategoryId);
  const activeTab: ServiceTab = isTakeout ? "takeout"
    : selectedCategory?.name === "昼部" ? "lunch"
    : "dinner";

  // localStorage から担当者を復元（同期）
  useEffect(() => {
    setStaffName(localStorage.getItem("pos_staff_name") || "");
  }, []);

  // 店舗設定を取得（DB 優先、非同期）
  // ガード: DB が「明示的に false」を返した場合のみ isTakeoutEnabled を false にする。
  //         エラー・行なし・例外はすべて fetchIsTakeoutEnabled 内で true に変換済みのため、
  //         ここで false を受け取るのは「DB が false を持つ意図的な設定のみ」に限定される。
  useEffect(() => {
    const applyTakeoutSetting = (enabled: boolean) => {
      if (enabled === false) {
        setIsTakeoutEnabled(false);
        setIsTakeout(false);
      } else {
        setIsTakeoutEnabled(true);
      }
      setSettingsReady(true);
    };

    const fetchAndApply = () => {
      fetchIsTakeoutEnabled()
        .then(applyTakeoutSetting)
        .catch(() => {
          setIsTakeoutEnabled(true);
          setSettingsReady(true);
        });
    };

    // マウント時に即座に取得
    fetchAndApply();

    // タブ/ウィンドウがフォアグラウンドに戻るたびに再取得する。
    // 商品管理画面で設定を変えてレジ画面に戻った場合も最新値を反映できる。
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchAndApply();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (IS_BRONCO) {
      setCategories(broncoCategories);
      setActiveCategoryId(broncoCategories[0].id);
      return;
    }
    fetchCategories()
      .then(cats => {
        // テイクアウトは CategoryBar に独立ボタンとして固定表示するため
        // categories state には含めない（名前・ID どちらでも除外）
        const sorted = cats
          .filter(c => c.name !== "テイクアウト" && c.id !== "takeout")
          .sort((a, b) => a.display_order - b.display_order);
        if (sorted.length > 0) {
          setCategories(sorted);
          setActiveCategoryId(sorted[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (IS_BRONCO) {
      setMenuItems(broncoMenuItems);
      return;
    }
    if (!isSupabaseConfigured) return;
    fetchMenuItems()
      .then(items => { if (items.length > 0) setMenuItems(items); })
      .catch(console.error);
  }, []);

  // 注文内容・客層・割引を localStorage へ自動保存
  useEffect(() => {
    try { localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orderItems)); } catch { /* ignore */ }
  }, [orderItems]);

  // 進行中注文をクラウドへ退避（5秒デバウンス）。キャッシュクリア・端末故障対策
  const orderItemsRef = useRef(orderItems);
  useEffect(() => { orderItemsRef.current = orderItems; }, [orderItems]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const t = setTimeout(() => {
      if (orderItems.length === 0) return;
      persistDraftOrder(buildDraft(orderItems, maleCount, femaleCount, discount));
    }, 5000);
    return () => clearTimeout(t);
  }, [orderItems, maleCount, femaleCount, discount]);

  // localStorage が空（キャッシュクリア等）のときだけクラウドの退避注文を復元
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchDraftOrder().then(draft => {
      if (!draft || draft.items.length === 0) return;
      if (orderItemsRef.current.length > 0) return; // 端末内に注文あり → 復元不要
      setOrderItems(draft.items);
      setMaleCount(draft.maleCount ?? 0);
      setFemaleCount(draft.femaleCount ?? 0);
      setDiscount(draft.discount ?? null);
    });
  }, []);
  useEffect(() => {
    try { localStorage.setItem(MALE_COUNT_KEY, String(maleCount)); } catch { /* ignore */ }
  }, [maleCount]);
  useEffect(() => {
    try { localStorage.setItem(FEMALE_COUNT_KEY, String(femaleCount)); } catch { /* ignore */ }
  }, [femaleCount]);
  useEffect(() => {
    try { localStorage.setItem(DISCOUNT_STORAGE_KEY, JSON.stringify(discount)); } catch { /* ignore */ }
  }, [discount]);

  const handleCategoryChange = useCallback((id: string) => {
    setActiveCategoryId(id);
    setIsTakeout(false);
  }, []);

  const handleTakeoutSelect = useCallback(() => {
    setIsTakeout(true);
  }, []);

  const handleSelectStaff = useCallback((name: string) => {
    setStaffName(name);
    if (name) {
      localStorage.setItem("pos_staff_name", name);
    } else {
      localStorage.removeItem("pos_staff_name");
    }
  }, []);

  const handleMenuItemTap = useCallback((item: MenuItem) => {
    // テイクアウト時は taxRate を 0.08 に変換したコピーを pendingItem にセット。
    // emoji / options.optionGroups など全プロパティはスプレッドで保持される。
    const resolved = isTakeout ? toTakeoutMenuItem(item) : item;
    // 焼鳥ABCなど、オプションを一切使わない店舗では
    // 「ご飯の量／種類」モーダルを開かずに直接カートへ入れる
    const hasCustomOptions = Array.isArray(resolved.options?.optionGroups)
      && (resolved.options?.optionGroups?.length ?? 0) > 0;
    if (IS_ABC && !hasCustomOptions) {
      const taxRate = resolved.taxRate ?? 0.10;
      const itemKey = `${resolved.id}_x_${taxRate}`;
      setOrderItems(prev => {
        const existing = prev.find(o => o.itemKey === itemKey);
        if (existing) {
          return prev.map(o => o.itemKey === itemKey ? { ...o, quantity: o.quantity + 1 } : o);
        }
        return [...prev, {
          itemKey,
          menuItem: resolved,
          quantity: 1,
          options: { riceType: "white", riceSize: "none", selections: [] },
          unitPrice: resolved.price,
          taxRate,
        }];
      });
      return;
    }
    setPendingItem(resolved);
  }, [isTakeout]);

  const handleOptionConfirm = useCallback(
    (options: OrderOptions) => {
      if (!pendingItem) return;
      const item        = pendingItem;
      const taxRate     = item.taxRate ?? 0.10 as const;
      // Sum of option prices (tax-exclusive) + item base price → direct addition, no rounding error
      const optTaxExcl = options.selections.reduce((s, sel) => s + sel.price, 0);
      const unitPrice  = item.price + optTaxExcl;
      const selKey      = options.selections.map(s => `${s.groupId}:${s.itemId}`).join(",");
      const itemKey     = `${item.id}_${selKey || "x"}_${taxRate}`;
      setOrderItems(prev => {
        const existing = prev.find(o => o.itemKey === itemKey);
        if (existing) {
          return prev.map(o => o.itemKey === itemKey ? { ...o, quantity: o.quantity + 1 } : o);
        }
        return [...prev, { itemKey, menuItem: item, quantity: 1, options, unitPrice, taxRate }];
      });
      setPendingItem(null);
    },
    [pendingItem]
  );

  const handleIncrement = useCallback((itemKey: string) => {
    setOrderItems(prev => prev.map(o =>
      o.itemKey === itemKey ? { ...o, quantity: Math.min(999, o.quantity + 1) } : o
    ));
  }, []);

  const handleDecrement = useCallback((itemKey: string) => {
    setOrderItems(prev => {
      const item = prev.find(o => o.itemKey === itemKey);
      if (!item) return prev;
      if (item.quantity <= 1) return prev.filter(o => o.itemKey !== itemKey);
      return prev.map(o => o.itemKey === itemKey ? { ...o, quantity: o.quantity - 1 } : o);
    });
  }, []);

  const handleRemove = useCallback((itemKey: string) => {
    setOrderItems(prev => prev.filter(o => o.itemKey !== itemKey));
    setEditingItemKey(prev => prev === itemKey ? null : prev);
  }, []);

  const handleCheckoutComplete = useCallback((record: SalesRecord) => {
    setSalesHistory(prev => [...prev, record]);
    if (isSupabaseConfigured) {
      saveSaleRecord(record).catch(err => {
        console.error("saveSaleRecord failed:", err);
        // 売上を失わないよう端末内キューへ退避し、通信回復時に自動再送する
        setUnsentCount(enqueueUnsentSale(record));
        setSaveError({ record, attempt: 1 });
      });
    }
  }, []);

  const handleRetrySave = useCallback(() => {
    if (!saveError) return;
    const { record, attempt } = saveError;
    setSaveError(null);
    flushUnsentSales(saveSaleRecord).then(({ remaining }) => {
      setUnsentCount(remaining);
      if (remaining > 0) setSaveError({ record, attempt: attempt + 1 });
    });
  }, [saveError]);

  // 未送信キューの自動再送（マウント時・通信回復時）
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const flush = () => {
      flushUnsentSales(saveSaleRecord).then(({ sent, remaining }) => {
        setUnsentCount(remaining);
        if (sent > 0 && remaining === 0) setSaveError(null);
      });
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  const handleCheckoutDone = useCallback(() => {
    setOrderItems([]);
    setMaleCount(0);
    setFemaleCount(0);
    setDiscount(null);
    setShowCheckout(false);
    clearDraftOrder();
    try {
      localStorage.removeItem(ORDER_STORAGE_KEY);
      localStorage.removeItem(MALE_COUNT_KEY);
      localStorage.removeItem(FEMALE_COUNT_KEY);
      localStorage.removeItem(DISCOUNT_STORAGE_KEY);
    } catch { /* ignore */ }
  }, []);

  // ── 保留（Hold）─────────────────────────────────────────────
  const handleHold = useCallback(() => {
    if (orderItems.length === 0) return;
    const entry: HoldEntry = {
      id: crypto.randomUUID(),
      items: orderItems,
      maleCount,
      femaleCount,
      discount,
      heldAt: new Date().toISOString(),
    };
    setHolds(prev => {
      const next = [entry, ...prev].slice(0, MAX_HOLDS);
      localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setOrderItems([]);
    setMaleCount(0);
    setFemaleCount(0);
    setDiscount(null);
  }, [orderItems, maleCount, femaleCount, discount]);

  const handleRecall = useCallback((id: string) => {
    const entry = holds.find(h => h.id === id);
    if (!entry) return;
    setOrderItems(entry.items);
    setMaleCount(entry.maleCount ?? 0);
    setFemaleCount(entry.femaleCount ?? 0);
    setDiscount(entry.discount ?? null);
    setHolds(prev => {
      const next = prev.filter(h => h.id !== id);
      localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [holds]);

  const handleDeleteHold = useCallback((id: string) => {
    setHolds(prev => {
      const next = prev.filter(h => h.id !== id);
      localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── 既存アイテムの金額変更 ────────────────────────────────────
  const handleEditItemPrice = useCallback((itemKey: string, price: number, taxRate: TaxRate, reason?: string) => {
    setOrderItems(prev =>
      prev.map(o => o.itemKey === itemKey ? { ...o, unitPrice: price, taxRate, priceAdjustReason: reason } : o)
    );
    setEditingItemKey(null);
  }, []);

  // ── 商品別割引の変更 ──────────────────────────────────────────
  const handleItemDiscountChange = useCallback((itemKey: string, disc: import("@/types/pos").OrderDiscount | null) => {
    setOrderItems(prev =>
      prev.map(o => o.itemKey === itemKey ? { ...o, itemDiscount: disc } : o)
    );
  }, []);

  // ── 手入力（FloatingNumpad）──────────────────────────────────
  const handleManualAdd = useCallback((price: number, taxRate: TaxRate, label: string) => {
    const itemKey = `manual_${Date.now()}_${taxRate}`;
    const manualItem: MenuItem = {
      id: itemKey,
      name: label,
      price,
      category: "manual",
      emoji: "✏️",
      taxRate,
    };
    setOrderItems(prev => [...prev, {
      itemKey,
      menuItem: manualItem,
      quantity: 1,
      options: { riceType: "white", riceSize: "none", selections: [] },
      unitPrice: price,
      taxRate,
    }]);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Shared order panel props (used by both handy and mobile roles)
  // ─────────────────────────────────────────────────────────────
  const orderPanelProps = {
    items: orderItems,
    maleCount,
    femaleCount,
    discount,
    holdCount: holds.length,
    onMaleChange: setMaleCount,
    onFemaleChange: setFemaleCount,
    onIncrement: handleIncrement,
    onDecrement: handleDecrement,
    onRemove: handleRemove,
    onCheckout: () => setShowCheckout(true),
    onClear: () => { setOrderItems([]); setDiscount(null); setEditingItemKey(null); },
    onDiscountChange: setDiscount,
    onItemDiscountChange: handleItemDiscountChange,
    onHold: handleHold,
    onRecallOpen: () => setShowHoldRecall(true),
    onEditPrice: (key: string) => { setEditingItemKey(key); setIsManualInput(false); },
  };

  // ─────────────────────────────────────────────────────────────
  // Modals that appear on top regardless of role
  // ─────────────────────────────────────────────────────────────
  const sharedModals = (
    <>
      {/* オプション選択モーダル */}
      {pendingItem && (
        <OptionModal
          item={pendingItem}
          taxRate={pendingItem.taxRate ?? 0.10}
          onConfirm={handleOptionConfirm}
          onClose={() => setPendingItem(null)}
        />
      )}

      {/* 手入力 / 金額変更テンキー */}
      {(isManualInput || (editingItemKey !== null && orderItems.some(o => o.itemKey === editingItemKey))) && (() => {
        const ei = editingItemKey ? orderItems.find(o => o.itemKey === editingItemKey) : null;
        return (
          <FloatingNumpad
            key={editingItemKey ?? "manual"}
            onAdd={handleManualAdd}
            onEditConfirm={handleEditItemPrice}
            editingItem={ei ? {
              itemKey: ei.itemKey,
              name: ei.menuItem.name,
              currentUnitPrice: ei.unitPrice,
              taxRate: ei.taxRate,
            } : null}
            defaultTaxRate={isTakeout ? 0.08 : 0.10}
            onClose={() => { setIsManualInput(false); setEditingItemKey(null); }}
          />
        );
      })()}

      {/* 保留呼び出しモーダル */}
      {showHoldRecall && (
        <HoldRecallModal
          holds={holds}
          onRecall={handleRecall}
          onDelete={handleDeleteHold}
          onClose={() => setShowHoldRecall(false)}
        />
      )}

      {/* 会計画面 */}
      {showCheckout && (
        <CheckoutScreen
          items={orderItems}
          serviceTab={activeTab}
          maleCount={maleCount}
          femaleCount={femaleCount}
          staff={staffName || undefined}
          discount={discount}
          onComplete={handleCheckoutComplete}
          onCancel={() => setShowCheckout(false)}
          onDone={handleCheckoutDone}
        />
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────
  // TABLE role: customer-facing menu browser, no order panel
  // ─────────────────────────────────────────────────────────────
  if (role === "table") {
    return (
      <div className="flex flex-col h-screen bg-[#F5F6FA] overflow-hidden">
        {/* テーブルビューヘッダー：店舗名のみ表示 */}
        <header className="flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-xl border-b border-black/[0.05] shadow-sm flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[12px] flex items-center justify-center shadow-[0_2px_10px_rgba(99,102,241,0.4)]">
              <span className="text-white text-xs font-black tracking-tight">FL</span>
            </div>
            <div className="leading-none">
              <p className="text-lg font-black text-slate-900 tracking-tight leading-none">FLOWS</p>
              <p className="text-[10px] font-medium text-slate-400 tracking-[0.12em] uppercase mt-0.5">by Infotainment</p>
            </div>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ring-1 ${
            activeTab === "dinner"
              ? "bg-indigo-50 text-indigo-700 ring-indigo-200/60"
              : "bg-amber-50 text-amber-700 ring-amber-200/60"
          }`}>
            {selectedCategory?.name ?? "夜部"} メニュー
          </span>
        </header>

        {/* メインコンテンツ：カテゴリ＋大きなメニューカード */}
        <div className="flex flex-1 overflow-hidden">
          <CategoryBar
            categories={categories}
            activeCategoryId={activeCategoryId}
            onCategoryChange={id => { handleCategoryChange(id); }}
            isTakeout={isTakeout}
            onTakeoutSelect={handleTakeoutSelect}
            isTakeoutEnabled={isTakeoutEnabled}
            isManualInput={false}
            onManualInputSelect={() => {}}
          />
          {/* メニューグリッド：カードを大きく表示 */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#F5F6FA]">
            <TableMenuGrid
              activeCategoryId={activeCategoryId}
              isTakeout={isTakeout}
              menuItems={menuItems}
            />
          </div>
        </div>

        {/* 下部：スタッフ呼び出しバナー（チェックアウト不可） */}
        <div className="flex-shrink-0 bg-white border-t border-slate-200 px-6 py-4 shadow-[0_-4px_20px_rgb(0,0,0,0.06)]">
          <button
            disabled
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-black text-lg tracking-wide shadow-[0_4px_20px_rgba(99,102,241,0.4)] cursor-default select-none"
          >
            📲 ご注文はスタッフまで / スタッフをお呼びください
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // MOBILE role: single-column stacked layout with bottom tabs
  // ─────────────────────────────────────────────────────────────
  if (role === "mobile") {
    return (
      <div className="flex flex-col h-screen bg-[#F5F6FA] overflow-hidden">
        {/* DB保存失敗バナー */}
        {saveError && (
          <div className="fixed top-0 inset-x-0 z-[60] bg-red-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <div>
                <p className="text-sm font-bold">
                  保存エラー{saveError.attempt > 1 ? `（手動リトライ${saveError.attempt}回目）` : "（自動リトライ済）"}
                </p>
                <p className="text-[10px] text-red-200">売上{unsentCount > 0 ? `${unsentCount}件を` : "は"}端末内に退避済み・通信回復後に自動再送します</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRetrySave}
                className="text-xs font-bold bg-white text-red-600 px-3 py-1.5 rounded-lg"
              >
                再試行
              </button>
              <button
                onClick={() => setSaveError(null)}
                className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* モバイルヘッダー：コンパクト */}
        <header className="flex items-center justify-between px-4 py-2.5 bg-white/90 backdrop-blur-xl border-b border-black/[0.05] shadow-sm flex-shrink-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[8px] flex items-center justify-center shadow-[0_2px_6px_rgba(99,102,241,0.35)]">
              <span className="text-white text-[9px] font-black tracking-tight">FL</span>
            </div>
            <span className="text-sm font-black text-slate-900 tracking-tight">FLOWS</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ring-1 ${
              isTakeout
                ? "bg-teal-50 text-teal-700 ring-teal-200/60"
                : activeTab === "dinner"
                ? "bg-indigo-50 text-indigo-700 ring-indigo-200/60"
                : "bg-amber-50 text-amber-700 ring-amber-200/60"
            }`}>
              {isTakeout ? "テイクアウト" : selectedCategory?.name ?? "夜部"}
            </span>
          </div>
          <StaffPicker current={staffName} onSelect={handleSelectStaff} />
        </header>

        {/* カテゴリバー（水平スクロール可） */}
        <div className="flex-shrink-0 bg-white border-b border-slate-100">
          <CategoryBar
            categories={categories}
            activeCategoryId={activeCategoryId}
            onCategoryChange={id => { handleCategoryChange(id); setIsManualInput(false); }}
            isTakeout={isTakeout}
            onTakeoutSelect={() => { handleTakeoutSelect(); setIsManualInput(false); }}
            isTakeoutEnabled={isTakeoutEnabled}
            isManualInput={isManualInput}
            onManualInputSelect={() => setIsManualInput(m => !m)}
          />
        </div>

        {/* メインエリア：アクティブタブに応じてパネル切り替え */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === "menu" ? (
            <div className="h-full overflow-y-auto p-3 bg-[#F5F6FA]">
              <MenuPanel
                activeCategoryId={activeCategoryId}
                isTakeout={isTakeout}
                menuItems={menuItems}
                onAddItem={item => { handleMenuItemTap(item); setMobileTab("order"); }}
              />
            </div>
          ) : (
            <div className="h-full overflow-hidden">
              <OrderPanel {...orderPanelProps} />
            </div>
          )}
        </div>

        {/* ボトムタブバー：メニュー ｜ 注文確認 */}
        <div className="flex-shrink-0 flex border-t border-slate-200 bg-white shadow-[0_-2px_12px_rgb(0,0,0,0.06)]">
          <button
            onClick={() => setMobileTab("menu")}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px] transition-colors ${
              mobileTab === "menu"
                ? "text-indigo-600 bg-indigo-50"
                : "text-slate-400 hover:text-slate-600 active:bg-slate-50"
            }`}
          >
            <span className="text-xl leading-none">🍽</span>
            <span className="text-[11px] font-bold tracking-tight">メニュー</span>
          </button>
          <button
            onClick={() => setMobileTab("order")}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px] transition-colors relative ${
              mobileTab === "order"
                ? "text-indigo-600 bg-indigo-50"
                : "text-slate-400 hover:text-slate-600 active:bg-slate-50"
            }`}
          >
            <span className="text-xl leading-none">🛒</span>
            <span className="text-[11px] font-bold tracking-tight">注文確認</span>
            {orderItems.length > 0 && (
              <span className="absolute top-2 right-[calc(50%-22px)] min-w-[18px] h-[18px] bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
                {orderItems.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>

        {sharedModals}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // HANDY role (default): existing full POS layout — unchanged
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#F5F6FA] overflow-hidden">

      {/* DB保存失敗バナー */}
      {saveError && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-red-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-bold">
                データの保存に失敗しました{saveError.attempt > 1 ? `（手動リトライ${saveError.attempt}回目）` : "（自動リトライ3回済）"}
              </p>
              <p className="text-xs text-red-200">売上{unsentCount > 0 ? `${unsentCount}件を` : "は"}端末内に退避済み・通信回復後に自動再送します</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetrySave}
              className="text-xs font-bold bg-white text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              再試行
            </button>
            <button
              onClick={() => setSaveError(null)}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur-xl border-b border-black/[0.05] shadow-[0_1px_0_rgb(0,0,0,0.04)] flex-shrink-0 z-10">

        {/* 左：ロゴ＋タブ＋客層 */}
        <div className="flex items-center gap-4">
          {/* FLOWS ロゴ */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[10px] flex items-center justify-center shadow-[0_2px_8px_rgba(99,102,241,0.38)] group-hover:shadow-[0_4px_14px_rgba(99,102,241,0.5)] transition-shadow duration-200">
              <span className="text-white text-[10px] font-black tracking-tight">FL</span>
            </div>
            <div className="leading-none">
              <p className="text-sm font-black text-slate-900 tracking-tight leading-none">FLOWS</p>
              <p className="text-[9px] font-medium text-slate-400 tracking-[0.12em] uppercase mt-0.5">by Infotainment</p>
            </div>
          </Link>

          <div className="w-px h-5 bg-slate-200" />
          <h1 className="text-sm font-bold text-slate-500 tracking-tight">レジ</h1>

          {/* サービスタブバッジ */}
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ring-1 ${
            isTakeout
              ? "bg-teal-50 text-teal-700 ring-teal-200/60"
              : activeTab === "dinner"
              ? "bg-indigo-50 text-indigo-700 ring-indigo-200/60"
              : "bg-amber-50 text-amber-700 ring-amber-200/60"
          }`}>
            {isTakeout ? "テイクアウト · 8%" : `${selectedCategory?.name ?? "夜部"} · 10%`}
          </span>

        </div>

        {/* 右：担当者＋履歴＋売上 */}
        <div className="flex items-center gap-2">
          <StaffPicker current={staffName} onSelect={handleSelectStaff} />

          <button
            onClick={() => setSidePanel(p => p === "salesHistory" ? null : "salesHistory")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              sidePanel === "salesHistory"
                ? "bg-indigo-600 text-white shadow-[0_2px_8px_rgba(99,102,241,0.35)]"
                : "bg-white ring-1 ring-black/[0.07] text-slate-600 hover:bg-slate-50 shadow-sm"
            }`}
          >
            <span>📋</span>
            <span>履歴</span>
            {salesHistory.length > 0 && (
              <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                sidePanel === "salesHistory" ? "bg-white/20 text-white" : "bg-indigo-600 text-white"
              }`}>
                {salesHistory.length}
              </span>
            )}
          </button>

          {!IS_BRONCO && (
            <Link href="/employees"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-500 hover:to-orange-600 transition-all duration-200 shadow-[0_2px_8px_rgba(251,191,36,0.35)]">
              <span>✨</span>
              <span>受給チャンス</span>
            </Link>
          )}

          {!IS_BRONCO && (
            <Link href="/admin/ai-dashboard"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-violet-700 text-white hover:from-violet-500 hover:to-violet-600 transition-all duration-200 shadow-[0_2px_8px_rgba(139,92,246,0.35)]">
              <span>📈</span>
              <span>AI成果</span>
            </Link>
          )}

          <Link href="/sales-data"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-white ring-1 ring-black/[0.07] text-slate-600 hover:bg-slate-50 transition-all duration-200 shadow-sm">
            <span>📊</span>
            <span>売上データ</span>
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden relative">
        <CategoryBar
          categories={categories}
          activeCategoryId={activeCategoryId}
          onCategoryChange={id => { handleCategoryChange(id); setIsManualInput(false); }}
          isTakeout={isTakeout}
          onTakeoutSelect={() => { handleTakeoutSelect(); setIsManualInput(false); }}
          isTakeoutEnabled={isTakeoutEnabled}
          isManualInput={isManualInput}
          onManualInputSelect={() => setIsManualInput(m => !m)}
        />
        <div className="flex-1 overflow-y-auto p-6 bg-[#F5F6FA]">
          <MenuPanel
            activeCategoryId={activeCategoryId}
            isTakeout={isTakeout}
            menuItems={menuItems}
            onAddItem={handleMenuItemTap}
          />
        </div>
        <div className="w-72 flex-shrink-0 overflow-hidden">
          <OrderPanel {...orderPanelProps} />
        </div>

        {/* 履歴スライドパネル */}
        <div
          className={`absolute inset-0 z-40 transition-opacity duration-200 ${
            sidePanel ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setSidePanel(null)}
        >
          <div
            className={`absolute right-72 top-0 h-full w-80 bg-white/90 backdrop-blur-xl border-l border-black/[0.05] shadow-[0_0_40px_rgb(0,0,0,0.08)] transform transition-transform duration-300 ${
              sidePanel ? "translate-x-0" : "translate-x-full"
            }`}
            onClick={e => e.stopPropagation()}
          >
            {sidePanel === "salesHistory" && (
              <SalesHistory records={salesHistory} onClose={() => setSidePanel(null)} />
            )}
          </div>
        </div>
      </div>

      {sharedModals}
    </div>
  );
}
