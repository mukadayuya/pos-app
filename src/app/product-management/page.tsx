"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MenuItem, TaxRate } from "@/types/pos";
import {
  fetchMenuItems, saveMenuItem, updateMenuItem, deleteMenuItem,
  fetchCategories, saveCategory, updateCategoryRecord, deleteCategoryRecord,
  cleanupLegacyCategories, isValidUUID,
  CategoryRecord,
} from "@/lib/db";

const EMOJI_OPTIONS = [
  "🍔","🍕","🍜","🍣","🍱","🥗","🍗","🍟",
  "🍰","🍦","🍮","🎂","☕","🥤","🍺","🍵",
  "🫖","🍊","🧃","🍶","🥩","🍛","🍝","🫕",
];

type PageTab = "items" | "categories";

interface ItemEditState {
  name: string; price: string; category: string; emoji: string; taxRate: TaxRate;
}

// ─── カテゴリー設定タブ ────────────────────────────────────────
function CategoriesTab({
  categories,
  itemsByCat,
  onRefresh,
}: {
  categories: CategoryRecord[];
  itemsByCat: Record<string, number>;
  onRefresh: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName]   = useState("");
  const [adding, setAdding]       = useState(false);
  const [newName, setNewName]     = useState("");
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState("");

  const startEdit = (cat: CategoryRecord) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setErr("");
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) { setErr("カテゴリー名を入力してください"); return; }
    setBusy(true);
    try {
      await updateCategoryRecord(id, { name: editName.trim() });
      setEditingId(null);
      onRefresh();
    } catch (e: unknown) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (cat: CategoryRecord) => {
    const count = itemsByCat[cat.id] ?? 0;
    if (count > 0) {
      alert(`「${cat.name}」には${count}件の商品があります。\n先に商品のカテゴリーを変更してから削除してください。`);
      return;
    }
    if (!confirm(`「${cat.name}」を削除しますか？`)) return;
    setBusy(true);
    try {
      await deleteCategoryRecord(cat.id);
      onRefresh();
    } catch (e: unknown) {
      alert("削除に失敗しました: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) { setErr("カテゴリー名を入力してください"); return; }
    setBusy(true);
    try {
      // id は指定しない → DB が UUID を auto-generate して返す
      await saveCategory({
        name: newName.trim(),
        display_order: categories.length,
      });
      setNewName("");
      setAdding(false);
      setErr("");
      // DB から categories を再取得して UUID を確実に同期
      onRefresh();
    } catch (e: unknown) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* DB マイグレーション案内（カテゴリーが0件の場合） */}
      {categories.length === 0 && (
        <div className="bg-amber-950 border border-amber-700 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-bold text-amber-300">⚠️ カテゴリーが見つかりません</p>
          <p className="text-xs text-amber-400 leading-relaxed">
            Supabase Dashboard → SQL Editor で <code className="bg-amber-900 px-1 rounded text-amber-200">supabase/migrate_categories_to_uuid.sql</code> を実行してください。
          </p>
        </div>
      )}

      {/* 新規追加フォーム */}
      {adding ? (
        <div className="bg-slate-800 rounded-2xl border border-teal-600 p-4 space-y-3">
          <p className="text-sm font-semibold text-teal-300">新規カテゴリーを追加</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => { setNewName(e.target.value); setErr(""); }}
              placeholder="カテゴリー名（例：ドリンク）"
              autoFocus
              className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-all placeholder-slate-600"
            />
            <button
              onClick={handleAdd}
              disabled={busy}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all active:scale-95"
            >
              追加
            </button>
            <button
              onClick={() => { setAdding(false); setErr(""); }}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-semibold transition-all active:scale-95"
            >
              キャンセル
            </button>
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
      ) : (
        <button
          onClick={() => { setAdding(true); setErr(""); setNewName(""); }}
          className="w-full py-3 border-2 border-dashed border-slate-600 hover:border-teal-500 hover:bg-teal-900/20 text-slate-400 hover:text-teal-300 rounded-2xl text-sm font-semibold transition-all"
        >
          ＋ 新規カテゴリーを追加
        </button>
      )}

      {/* カテゴリー一覧 */}
      {categories.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          カテゴリーがありません
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <div key={cat.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
              {editingId === cat.id ? (
                <div className="flex items-center gap-2 px-4 py-3">
                  <span className="text-slate-500 text-sm w-6 text-center flex-shrink-0">{idx + 1}</span>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => { setEditName(e.target.value); setErr(""); }}
                    autoFocus
                    className="flex-1 bg-slate-900 border border-teal-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-teal-500 transition-all"
                  />
                  <button
                    onClick={() => saveEdit(cat.id)}
                    disabled={busy}
                    className="px-3 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setErr(""); }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-semibold transition-all active:scale-95"
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <span className="text-slate-600 text-sm w-6 text-center flex-shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{cat.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">ID: {cat.id}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                    (itemsByCat[cat.id] ?? 0) > 0
                      ? "bg-teal-900 text-teal-300"
                      : "bg-slate-700 text-slate-500"
                  }`}>
                    {itemsByCat[cat.id] ?? 0}件
                  </span>
                  <button
                    onClick={() => startEdit(cat)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-semibold transition-all active:scale-95 flex-shrink-0"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="px-3 py-1.5 bg-red-900/60 hover:bg-red-900 text-red-400 rounded-lg text-xs font-semibold transition-all active:scale-95 flex-shrink-0"
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!adding && err && <p className="text-xs text-red-400 text-center">{err}</p>}

      <p className="text-xs text-slate-600 text-center pt-2">
        ※ 商品が登録されているカテゴリーは削除できません
      </p>
    </div>
  );
}

// ─── 商品編集フォーム（共通） ─────────────────────────────────
function ItemForm({
  state,
  categories,
  onChange,
  onSave,
  onCancel,
  saveLabel,
  busy,
}: {
  state: ItemEditState;
  categories: CategoryRecord[];
  onChange: (s: ItemEditState) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  busy: boolean;
}) {
  const set = (partial: Partial<ItemEditState>) => onChange({ ...state, ...partial });

  return (
    <div className="space-y-4">
      {/* 絵文字 */}
      <div>
        <p className="text-xs font-semibold text-slate-400 mb-2">絵文字</p>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_OPTIONS.map(e => (
            <button key={e} onClick={() => set({ emoji: e })}
              className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                state.emoji === e ? "border-teal-500 bg-teal-900" : "border-slate-600 hover:border-slate-500"
              }`}>
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">商品名</label>
          <input type="text" value={state.name} onChange={e => set({ name: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">価格（円）</label>
          <input type="number" value={state.price} min="1" onChange={e => set({ price: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-all" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2">カテゴリー</label>
          {categories.length === 0 ? (
            <p className="text-xs text-amber-400 py-2">
              まずカテゴリーを登録してください
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => set({ category: cat.id })}
                  className={`flex-1 min-w-fit py-2 px-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    state.category === cat.id
                      ? "border-teal-500 bg-teal-900 text-teal-300"
                      : "border-slate-600 text-slate-400 hover:border-slate-500"
                  }`}>
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2">消費税率</label>
          <div className="flex gap-2">
            {([0.10, 0.08] as TaxRate[]).map(rate => (
              <button key={rate} onClick={() => set({ taxRate: rate })}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  state.taxRate === rate
                    ? "border-amber-500 bg-amber-900 text-amber-300"
                    : "border-slate-600 text-slate-400 hover:border-slate-500"
                }`}>
                {rate === 0.10 ? "10%" : "8%"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onSave} disabled={busy}
          className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all active:scale-95">
          {busy ? "保存中..." : saveLabel}
        </button>
        <button onClick={onCancel}
          className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-semibold transition-all active:scale-95">
          キャンセル
        </button>
      </div>
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────
export default function ProductManagementPage() {
  const [pageTab, setPageTab]     = useState<PageTab>("items");
  const [items, setItems]         = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // 商品タブの状態
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editState, setEditState]     = useState<ItemEditState | null>(null);
  const [filterCat, setFilterCat]     = useState<string>("all");
  const [busy, setBusy]               = useState(false);

  // 商品追加モーダル
  const [showAdd, setShowAdd]     = useState(false);
  const [newItem, setNewItem]     = useState<ItemEditState>({
    name: "", price: "", category: "", emoji: "🍔", taxRate: 0.10,
  });
  const [addError, setAddError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [menuData, catData] = await Promise.all([fetchMenuItems(), fetchCategories()]);
      setItems(menuData);
      // UUID 形式でないカテゴリーはState に入れない
      setCategories(catData.filter(c => isValidUUID(c.id)));
      if (filterCat === "all") setFilterCat("all");
    } catch (e: unknown) {
      setError((e as Error).message ?? "読み込みエラー");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cleanupLegacyCategories();
    load();
  }, [load]);

  // カテゴリー別商品数
  const itemsByCat: Record<string, number> = {};
  for (const item of items) {
    itemsByCat[item.category] = (itemsByCat[item.category] ?? 0) + 1;
  }

  const filtered = filterCat === "all" ? items : items.filter(i => i.category === filterCat);
  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? id;

  // ─ 商品編集 ─
  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setEditState({ name: item.name, price: String(item.price), category: item.category, emoji: item.emoji, taxRate: item.taxRate });
  }
  function cancelEdit() { setEditingId(null); setEditState(null); }

  async function saveEdit(id: string) {
    if (!editState) return;
    const price = parseInt(editState.price, 10);
    if (!editState.name.trim() || isNaN(price) || price <= 0) return;
    setBusy(true);
    try {
      await updateMenuItem(id, { name: editState.name.trim(), price, category: editState.category, emoji: editState.emoji });
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...editState, price, taxRate: editState.taxRate } : i));
      setEditingId(null); setEditState(null);
    } catch (e: unknown) { alert("保存に失敗しました: " + (e as Error).message); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除してよろしいですか？`)) return;
    try {
      await deleteMenuItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e: unknown) { alert("削除に失敗しました: " + (e as Error).message); }
  }

  // ─ 商品追加 ─
  async function handleAdd() {
    setAddError("");
    const price = parseInt(newItem.price, 10);
    if (!newItem.name.trim()) { setAddError("名前を入力してください"); return; }
    if (isNaN(price) || price <= 0) { setAddError("正しい価格を入力してください"); return; }
    if (!newItem.category) { setAddError("カテゴリーを選択してください"); return; }
    setBusy(true);
    try {
      const item: MenuItem = {
        id: crypto.randomUUID(),
        name: newItem.name.trim(), price,
        category: newItem.category,
        emoji: newItem.emoji,
        taxRate: newItem.taxRate,
      };
      await saveMenuItem(item);
      await load();
      setNewItem({ name: "", price: "", category: categories[0]?.id ?? "", emoji: "🍔", taxRate: 0.10 });
      setShowAdd(false);
    } catch (e: unknown) { setAddError("追加に失敗しました: " + (e as Error).message); }
    finally { setBusy(false); }
  }

  // 追加モーダルを開く時にデフォルトカテゴリーをセット
  function openAddModal() {
    setNewItem(prev => ({ ...prev, category: categories[0]?.id ?? "" }));
    setAddError("");
    setShowAdd(true);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white text-sm transition-colors">← HOME</Link>
          <span className="text-slate-600">|</span>
          <span className="text-xl">🍽️</span>
          <h1 className="text-lg font-bold">商品管理</h1>
        </div>
        {pageTab === "items" && (
          <button onClick={openAddModal}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all active:scale-95">
            ＋ 商品を追加
          </button>
        )}
      </header>

      {/* タブバー */}
      <div className="flex border-b border-slate-800 bg-slate-900">
        {(["items", "categories"] as PageTab[]).map(tab => (
          <button key={tab} onClick={() => setPageTab(tab)}
            className={`flex-1 py-3 text-sm font-semibold transition-all ${
              pageTab === tab
                ? "text-teal-300 border-b-2 border-teal-400 bg-slate-800"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
            }`}>
            {tab === "items" ? `🍽️ 商品一覧（${items.length}件）` : "🗂️ カテゴリー設定"}
          </button>
        ))}
      </div>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="text-center py-16 text-slate-500">読み込み中...</div>
        ) : error ? (
          <div className="text-center py-16 text-red-400">{error}</div>
        ) : pageTab === "categories" ? (
          /* ── カテゴリー設定タブ ─────────────────────── */
          <CategoriesTab
            categories={categories}
            itemsByCat={itemsByCat}
            onRefresh={load}
          />
        ) : (
          /* ── 商品一覧タブ ───────────────────────────── */
          <>
            {/* カテゴリーフィルター */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFilterCat("all")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  filterCat === "all" ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}>
                すべて
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setFilterCat(cat.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    filterCat === cat.id ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}>
                  {cat.name}
                  {(itemsByCat[cat.id] ?? 0) > 0 && (
                    <span className="ml-1.5 text-xs opacity-70">{itemsByCat[cat.id]}</span>
                  )}
                </button>
              ))}
              <span className="ml-auto text-slate-500 text-sm self-center">{filtered.length}件</span>
            </div>

            {/* 商品リスト */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-slate-500">商品がありません</div>
            ) : (
              <div className="space-y-2">
                {filtered.map(item => (
                  <div key={item.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                    {editingId === item.id && editState ? (
                      <div className="p-4">
                        <ItemForm
                          state={editState}
                          categories={categories}
                          onChange={setEditState}
                          onSave={() => saveEdit(item.id)}
                          onCancel={cancelEdit}
                          saveLabel="✓ 保存する"
                          busy={busy}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 px-4 py-3">
                        <span className="text-3xl w-10 text-center flex-shrink-0">{item.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400">{catName(item.category)}</span>
                            <span className="text-xs text-slate-600">·</span>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
                              item.taxRate === 0.08 ? "bg-amber-900 text-amber-400" : "bg-slate-700 text-slate-400"
                            }`}>
                              税{item.taxRate === 0.08 ? "8%" : "10%"}
                            </span>
                          </div>
                        </div>
                        <p className="text-base font-bold text-white flex-shrink-0 mr-2">
                          ¥{item.price.toLocaleString()}
                        </p>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => startEdit(item)}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-semibold transition-all active:scale-95">
                            編集
                          </button>
                          <button onClick={() => handleDelete(item.id, item.name)}
                            className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-400 rounded-lg text-xs font-semibold transition-all active:scale-95">
                            削除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* 商品追加モーダル */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="text-base font-bold">商品を追加</h2>
              <button onClick={() => setShowAdd(false)}
                className="w-8 h-8 rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 flex items-center justify-center text-sm transition-colors">
                ✕
              </button>
            </div>
            <div className="p-5">
              {categories.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-3xl">🗂️</p>
                  <p className="text-sm text-amber-400 font-semibold">まずカテゴリーを登録してください</p>
                  <p className="text-xs text-slate-500">「カテゴリー設定」タブから追加できます</p>
                  <button onClick={() => { setShowAdd(false); setPageTab("categories"); }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold transition-all active:scale-95">
                    カテゴリー設定へ →
                  </button>
                </div>
              ) : (
                <>
                  <ItemForm
                    state={newItem}
                    categories={categories}
                    onChange={setNewItem}
                    onSave={handleAdd}
                    onCancel={() => setShowAdd(false)}
                    saveLabel="＋ 追加する"
                    busy={busy}
                  />
                  {addError && <p className="text-sm text-red-400 font-medium mt-2">{addError}</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
