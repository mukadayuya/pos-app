"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { MenuItem, OrderItem, OrderOptions, SalesRecord, ServiceTab } from "@/types/pos";
import { menuItems as defaultMenuItems, riceSizeAdjustments } from "@/data/menu";
import { isSupabaseConfigured } from "@/lib/supabase";
import { saveSaleRecord, fetchMenuItems } from "@/lib/db";
import CategoryBar from "@/components/CategoryBar";
import MenuPanel from "@/components/MenuPanel";
import OrderPanel from "@/components/OrderPanel";
import SalesHistory from "@/components/SalesHistory";
import OptionModal from "@/components/OptionModal";
import CheckoutScreen from "@/components/CheckoutScreen";

type SidePanel = "salesHistory" | null;

export default function RegisterPage() {
  const [activeTab, setActiveTab] = useState<ServiceTab>("dinner");
  const [menuItems, setMenuItems] = useState<MenuItem[]>(defaultMenuItems);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [salesHistory, setSalesHistory] = useState<SalesRecord[]>([]);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchMenuItems()
      .then(items => { if (items.length > 0) setMenuItems(items); })
      .catch(console.error);
  }, []);

  const handleMenuItemTap = useCallback((item: MenuItem) => {
    setPendingItem(item);
  }, []);

  const handleOptionConfirm = useCallback(
    (options: OrderOptions) => {
      if (!pendingItem) return;
      const item = pendingItem;
      const isTakeout = activeTab === "takeout";
      const taxRate = isTakeout ? 0.08 as const : (item.taxRate ?? 0.10 as const);
      const unitPrice = item.price + riceSizeAdjustments[options.riceSize];
      const itemKey = `${item.id}_${options.riceType}_${options.riceSize}_${taxRate}`;

      setOrderItems(prev => {
        const existing = prev.find(o => o.itemKey === itemKey);
        if (existing) {
          return prev.map(o => o.itemKey === itemKey ? { ...o, quantity: o.quantity + 1 } : o);
        }
        return [...prev, { itemKey, menuItem: item, quantity: 1, options, unitPrice, taxRate }];
      });
      setPendingItem(null);
    },
    [pendingItem, activeTab]
  );

  const handleIncrement = useCallback((itemKey: string) => {
    setOrderItems(prev => prev.map(o => o.itemKey === itemKey ? { ...o, quantity: o.quantity + 1 } : o));
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
  }, []);

  const handleCheckoutComplete = useCallback((record: SalesRecord) => {
    setSalesHistory(prev => [...prev, record]);
    if (isSupabaseConfigured) {
      saveSaleRecord(record).catch(console.error);
    }
  }, []);

  const handleCheckoutDone = useCallback(() => {
    setOrderItems([]);
    setShowCheckout(false);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-slate-500 hover:text-white transition-colors text-sm mr-2"
          >
            ← HOME
          </Link>
          <span className="text-xl">🍽️</span>
          <h1 className="text-white text-lg font-bold tracking-wide">レジ</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            activeTab === "takeout"
              ? "bg-teal-600 text-white"
              : activeTab === "dinner"
              ? "bg-indigo-600 text-white"
              : "bg-amber-500 text-white"
          }`}>
            {activeTab === "takeout" ? "テイクアウト 8%" : activeTab === "dinner" ? "夜部 10%" : "昼部 10%"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidePanel(p => p === "salesHistory" ? null : "salesHistory")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              sidePanel === "salesHistory"
                ? "bg-white text-slate-900"
                : "bg-slate-700 hover:bg-slate-600 text-white"
            }`}
          >
            <span>📋</span>
            <span>履歴</span>
            {salesHistory.length > 0 && (
              <span className="bg-indigo-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                {salesHistory.length}
              </span>
            )}
          </button>
          <Link
            href="/admin/sales"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-all"
          >
            <span>📊</span>
            <span>売上データ</span>
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 左：カテゴリタブ */}
        <CategoryBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* 中央：メニューグリッド */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
          <MenuPanel
            activeTab={activeTab}
            menuItems={menuItems}
            onAddItem={handleMenuItemTap}
          />
        </div>

        {/* 右：注文パネル */}
        <div className="w-72 flex-shrink-0 overflow-hidden">
          <OrderPanel
            items={orderItems}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
            onRemove={handleRemove}
            onCheckout={() => setShowCheckout(true)}
            onClear={() => setOrderItems([])}
          />
        </div>

        {/* 履歴スライドパネル */}
        <div
          className={`absolute inset-0 z-40 transition-opacity duration-200 ${
            sidePanel ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setSidePanel(null)}
        >
          <div
            className={`absolute right-72 top-0 h-full w-80 bg-slate-900 border-l border-slate-700 shadow-2xl transform transition-transform duration-300 ${
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

      {/* オプション選択モーダル */}
      {pendingItem && (
        <OptionModal
          item={pendingItem}
          onConfirm={handleOptionConfirm}
          onClose={() => setPendingItem(null)}
        />
      )}

      {/* 会計画面 */}
      {showCheckout && (
        <CheckoutScreen
          items={orderItems}
          serviceTab={activeTab}
          onComplete={handleCheckoutComplete}
          onCancel={handleCheckoutDone}
        />
      )}
    </div>
  );
}
