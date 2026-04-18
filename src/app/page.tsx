"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { MenuItem, OrderItem, OrderOptions, SalesRecord, Category } from "@/types/pos";
import { menuItems as defaultMenuItems, riceSizeAdjustments } from "@/data/menu";
import { isSupabaseConfigured } from "@/lib/supabase";
import { saveSaleRecord, fetchMenuItems, saveMenuItem } from "@/lib/db";
import CategoryBar from "@/components/CategoryBar";
import MenuPanel from "@/components/MenuPanel";
import OrderPanel from "@/components/OrderPanel";
import SalesHistory from "@/components/SalesHistory";
import AddMenuPanel from "@/components/AddMenuPanel";
import OptionModal from "@/components/OptionModal";
import CheckoutModal from "@/components/CheckoutModal";

type SidePanel = "salesHistory" | "addMenu" | null;

export default function POSPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("lunch");
  const [menuItems, setMenuItems] = useState<MenuItem[]>(defaultMenuItems);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [salesHistory, setSalesHistory] = useState<SalesRecord[]>([]);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [checkoutRecord, setCheckoutRecord] = useState<SalesRecord | null>(null);
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);

  // Supabaseが設定済みならDBからメニューを読み込む
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchMenuItems()
      .then((items) => {
        if (items.length > 0) setMenuItems(items);
      })
      .catch(console.error);
  }, []);

  const handleMenuItemTap = useCallback((item: MenuItem) => {
    setPendingItem(item);
  }, []);

  const handleOptionConfirm = useCallback(
    (options: OrderOptions) => {
      if (!pendingItem) return;
      const item = pendingItem;
      const unitPrice = item.price + riceSizeAdjustments[options.riceSize];
      const itemKey = `${item.id}_${options.riceType}_${options.riceSize}`;

      setOrderItems((prev) => {
        const existing = prev.find((o) => o.itemKey === itemKey);
        if (existing) {
          return prev.map((o) =>
            o.itemKey === itemKey ? { ...o, quantity: o.quantity + 1 } : o
          );
        }
        return [...prev, { itemKey, menuItem: item, quantity: 1, options, unitPrice }];
      });
      setPendingItem(null);
    },
    [pendingItem]
  );

  const handleIncrement = useCallback((itemKey: string) => {
    setOrderItems((prev) =>
      prev.map((o) => (o.itemKey === itemKey ? { ...o, quantity: o.quantity + 1 } : o))
    );
  }, []);

  const handleDecrement = useCallback((itemKey: string) => {
    setOrderItems((prev) => {
      const item = prev.find((o) => o.itemKey === itemKey);
      if (!item) return prev;
      if (item.quantity <= 1) return prev.filter((o) => o.itemKey !== itemKey);
      return prev.map((o) =>
        o.itemKey === itemKey ? { ...o, quantity: o.quantity - 1 } : o
      );
    });
  }, []);

  const handleRemove = useCallback((itemKey: string) => {
    setOrderItems((prev) => prev.filter((o) => o.itemKey !== itemKey));
  }, []);

  const handleCheckout = useCallback((record: SalesRecord) => {
    setSalesHistory((prev) => [...prev, record]);
    setCheckoutRecord(record);
    // DB保存（非同期・非ブロッキング）
    if (isSupabaseConfigured) {
      saveSaleRecord(record).catch(console.error);
    }
  }, []);

  const handleCheckoutDone = useCallback(() => {
    setOrderItems([]);
    setCheckoutRecord(null);
  }, []);

  const handleAddMenuItem = useCallback((item: MenuItem) => {
    setMenuItems((prev) => [...prev, item]);
    // DB保存（非同期・非ブロッキング）
    if (isSupabaseConfigured) {
      saveMenuItem(item).catch(console.error);
    }
  }, []);

  const togglePanel = (panel: SidePanel) => {
    setSidePanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-6 py-3 bg-indigo-700 text-white shadow-lg flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍽️</span>
          <h1 className="text-xl font-bold tracking-wide">レジ</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => togglePanel("addMenu")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              sidePanel === "addMenu"
                ? "bg-white text-indigo-700"
                : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500"
            }`}
          >
            <span className="text-base font-bold">＋</span>
            <span>メニュー追加</span>
          </button>
          <button
            onClick={() => togglePanel("salesHistory")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              sidePanel === "salesHistory"
                ? "bg-white text-indigo-700"
                : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500"
            }`}
          >
            <span>📊</span>
            <span>売上集計</span>
            {salesHistory.length > 0 && (
              <span className="bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full px-2 py-0.5">
                {salesHistory.length}
              </span>
            )}
          </button>
          <Link
            href="/admin/sales"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
          >
            <span>⚙️</span>
            <span>管理画面</span>
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 左カラム：カテゴリ */}
        <CategoryBar
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />

        {/* 中央カラム：商品グリッド */}
        <div className="flex-1 overflow-y-auto p-4">
          <MenuPanel
            activeCategory={activeCategory}
            menuItems={menuItems}
            onAddItem={handleMenuItemTap}
          />
        </div>

        {/* 右カラム：注文リスト */}
        <div className="w-80 flex-shrink-0 overflow-hidden">
          <OrderPanel
            items={orderItems}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
            onRemove={handleRemove}
            onCheckout={handleCheckout}
            onClear={() => setOrderItems([])}
          />
        </div>

        {/* スライドインパネル */}
        <div
          className={`absolute inset-0 z-40 transition-opacity duration-200 ${
            sidePanel ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setSidePanel(null)}
        >
          <div
            className={`absolute right-0 top-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 ${
              sidePanel ? "translate-x-0" : "translate-x-full"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {sidePanel === "salesHistory" && (
              <SalesHistory
                records={salesHistory}
                onClose={() => setSidePanel(null)}
              />
            )}
            {sidePanel === "addMenu" && (
              <AddMenuPanel
                onAdd={handleAddMenuItem}
                onClose={() => setSidePanel(null)}
              />
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

      {/* 会計完了モーダル */}
      {checkoutRecord && (
        <CheckoutModal record={checkoutRecord} onDone={handleCheckoutDone} />
      )}
    </div>
  );
}
