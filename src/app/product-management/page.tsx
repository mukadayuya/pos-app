"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NumpadModal from "@/components/NumpadModal";
import { MenuItem, MenuItemOptions, OptionGroup, OptionItem, TaxRate } from "@/types/pos";
import { validateTemplateForm, applyTemplate } from "@/lib/optionTemplates";
import { fetchIsTakeoutEnabled, persistIsTakeoutEnabled, fetchEmojiSettings, persistEmojiSettings, EmojiSettings, DEFAULT_EMOJIS, fetchAnalysisMode, persistAnalysisMode, AnalysisMode } from "@/lib/storeSettings";
import {
  fetchMenuItems, saveMenuItem, updateMenuItem, deleteMenuItem,
  fetchCategories, saveCategory, updateCategoryRecord, deleteCategoryRecord,
  cleanupLegacyCategories, isValidUUID,
  CategoryRecord,
  OptionTemplate,
  fetchOptionTemplates, saveOptionTemplate, updateOptionTemplate, deleteOptionTemplate, seedDefaultOptionTemplates,
} from "@/lib/db";
import { broncoMenuItems, broncoCategories } from "@/data/broncoMenu";

const IS_BRONCO = process.env.NEXT_PUBLIC_STORE_ID === "bronco";

type PageTab = "items" | "categories" | "options" | "display";

interface ItemEditState {
  name: string; price: string; category: string; emoji: string;
  taxRate: TaxRate; taxInclusive: boolean;
  options: MenuItemOptions;
  isTakeoutAvailable: boolean;
}

const TAX_RATES: { rate: TaxRate; label: string }[] = [
  { rate: 0.10, label: "10%" },
  { rate: 0.08, label: "8%" },
  { rate: 0.01, label: "1%" },
  { rate: 0,    label: "0%" },
];

function taxBadgeCls(r: TaxRate) {
  if (r === 0.08) return "bg-amber-900 text-amber-400";
  if (r === 0.01) return "bg-purple-900 text-purple-400";
  if (r === 0)    return "bg-slate-700 text-slate-500";
  return "bg-slate-700 text-slate-400";
}

// ─── 共通：オプショングループエディター ──────────────────────────
function OptionGroupsEditor({
  groups,
  onChange,
  templates = [],
  isTaxInclusive = false,
  taxRate,
}: {
  groups: OptionGroup[];
  onChange: (groups: OptionGroup[]) => void;
  templates?: OptionTemplate[];
  isTaxInclusive?: boolean;
  taxRate?: number;
}) {
  const [showTmplPicker, setShowTmplPicker] = useState(false);

  const addGroup = () => {
    const newGroup: OptionGroup = {
      id: crypto.randomUUID(),
      name: "",
      items: [{ id: crypto.randomUUID(), name: "", price: 0 }],
    };
    onChange([...groups, newGroup]);
  };

  const appendFromTemplate = (tmpl: OptionTemplate) => {
    const toAdd = applyTemplate(tmpl.groups).filter(
      g => !groups.some(e => e.name === g.name)
    );
    onChange([...groups, ...toAdd]);
    setShowTmplPicker(false);
  };

  const updateGroup = (gi: number, partial: Partial<OptionGroup>) => {
    onChange(groups.map((g, i) => i === gi ? { ...g, ...partial } : g));
  };

  const removeGroup = (gi: number) => onChange(groups.filter((_, i) => i !== gi));

  const updateItem = (gi: number, ii: number, partial: Partial<OptionItem>) => {
    const nextItems = groups[gi].items.map((it, i) => i === ii ? { ...it, ...partial } : it);
    updateGroup(gi, { items: nextItems });
  };

  const removeItem = (gi: number, ii: number) => {
    updateGroup(gi, { items: groups[gi].items.filter((_, i) => i !== ii) });
  };

  const addItem = (gi: number) => {
    updateGroup(gi, { items: [...groups[gi].items, { id: crypto.randomUUID(), name: "", price: 0 }] });
  };

  return (
    <div className="space-y-3">
      {groups.length === 0 && (
        <p className="text-xs text-slate-600 text-center py-2">オプションなし</p>
      )}
      {groups.map((group, gi) => (
        <div key={group.id} className="border border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-2">
            <input
              type="text"
              value={group.name}
              onChange={e => updateGroup(gi, { name: e.target.value })}
              placeholder="カテゴリ名（例：ご飯の量）"
              className="flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder-slate-600"
            />
            <button
              type="button"
              onClick={() => removeGroup(gi)}
              className="w-6 h-6 rounded-md bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-red-400 flex items-center justify-center text-xs transition-all"
            >
              ✕
            </button>
          </div>
          <div className="p-3 space-y-1.5">
            {group.items.map((optItem, ii) => (
              <div key={optItem.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={optItem.name}
                  onChange={e => updateItem(gi, ii, { name: e.target.value })}
                  placeholder="項目名"
                  className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-500 transition-all"
                />
                <input
                  type="number"
                  value={optItem.price}
                  onChange={e => updateItem(gi, ii, { price: Number(e.target.value) })}
                  className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-500 transition-all text-right tabular-nums"
                />
                <span className="text-[10px] text-slate-500 flex-shrink-0">円</span>
                {taxRate !== undefined && optItem.price !== 0 && (
                  <span className="text-[10px] text-slate-400 flex-shrink-0 whitespace-nowrap">
                    {isTaxInclusive
                      ? `≈税抜${Math.floor(optItem.price / (1 + taxRate))}円`
                      : `→税込${Math.round(optItem.price * (1 + taxRate))}円`}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeItem(gi, ii)}
                  className="w-6 h-6 rounded-md bg-slate-700 hover:bg-red-900 text-slate-500 hover:text-red-400 flex items-center justify-center text-xs transition-all flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addItem(gi)}
              className="text-[10px] text-teal-500 hover:text-teal-400 font-semibold mt-1 transition-colors"
            >
              ＋ 項目を追加
            </button>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={addGroup}
          className="text-xs bg-teal-700 hover:bg-teal-600 text-teal-200 px-2.5 py-1.5 rounded-lg font-semibold transition-all active:scale-95"
        >
          ＋ 空のカテゴリを追加
        </button>
        {templates.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTmplPicker(v => !v)}
              className="text-xs bg-slate-700 hover:bg-indigo-800 border border-slate-600 hover:border-indigo-500 text-slate-300 hover:text-indigo-200 px-2.5 py-1.5 rounded-lg font-semibold transition-all active:scale-95"
            >
              📋 テンプレートから引用
            </button>
            {showTmplPicker && (
              <div className="absolute bottom-full left-0 mb-1 z-20 bg-slate-800 border border-slate-600 rounded-xl shadow-xl py-1 min-w-[180px]">
                {templates.map(tmpl => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => appendFromTemplate(tmpl)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-indigo-900 hover:text-indigo-200 transition-colors"
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── オプションテンプレート管理タブ ──────────────────────────────
function OptionsTab({
  templates,
  onRefresh,
}: {
  templates: OptionTemplate[];
  onRefresh: () => void;
}) {
  const [adding, setAdding]           = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [formName, setFormName]       = useState("");
  const [formGroups, setFormGroups]   = useState<OptionGroup[]>([]);
  const [busy, setBusy]               = useState(false);
  const [err, setErr]                 = useState("");
  const [isTaxInclusive, setIsTaxInclusive] = useState(true); // trueなら税込入力、falseなら税抜入力

  function openAdd() {
    setEditingId(null);
    setFormName("");
    setFormGroups([]);
    setErr("");
    setIsTaxInclusive(true);
    setAdding(true);
  }

  function openEdit(tmpl: OptionTemplate) {
    setAdding(false);
    setEditingId(tmpl.id);
    setFormName(tmpl.name);
    setFormGroups(applyTemplate(tmpl.groups));
    setErr("");
    setIsTaxInclusive(false);
  }

  function cancelForm() {
    setAdding(false);
    setEditingId(null);
    setErr("");
  }

  async function handleSave() {
    const validationErr = validateTemplateForm(formName, formGroups);
    if (validationErr) { setErr(validationErr); return; }
    setBusy(true);
    // --- 税込・税抜の価格変換処理を追加 ---
  const processedGroups = formGroups.map(group => ({
    ...group,
    items: group.items.map(item => ({
      ...item,
      // 税込モードなら 1.1 で割って税抜価格を算出。小数点以下は四捨五入。
      price: isTaxInclusive
        ? Math.round(Number(item.price) / 1.1)
        : Number(item.price),
    })),
  }));
  // ------------------------------------
  
    try {
      if (editingId) {
        await updateOptionTemplate(editingId, { name: formName.trim(), groups: processedGroups});
      } else {
        await saveOptionTemplate({ name: formName.trim(), groups: processedGroups });
      }
      cancelForm();
      onRefresh();
    } catch (e: unknown) {
      setErr("保存に失敗しました: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(tmpl: OptionTemplate) {
    if (!confirm(`「${tmpl.name}」を削除しますか？`)) return;
    setBusy(true);
    try {
      await deleteOptionTemplate(tmpl.id);
      onRefresh();
    } catch (e: unknown) {
      alert("削除に失敗しました: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const showForm = adding || !!editingId;

  return (
    <div className="space-y-4">
      {/* 説明バナー */}
      <div className="bg-slate-800/60 border border-teal-800 rounded-2xl p-4">
        <p className="text-sm font-semibold text-teal-300 mb-1">📋 オプションテンプレートとは？</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          オプションセットをテンプレートとして保存し、商品登録時に一括で適用できます。
        </p>
      </div>

      {/* 追加ボタン */}
      {!showForm && (
        <button
          onClick={openAdd}
          className="w-full py-3 border-2 border-dashed border-slate-600 hover:border-teal-500 hover:bg-teal-900/20 text-slate-400 hover:text-teal-300 rounded-2xl text-sm font-semibold transition-all"
        >
          ＋ 新規テンプレートを追加
        </button>
      )}

      {/* 追加 / 編集フォーム */}
      {showForm && (
        <div className="bg-slate-800 rounded-2xl border border-teal-600 p-4 space-y-4">
          <p className="text-sm font-semibold text-teal-300">
            {editingId ? "テンプレートを編集" : "新規テンプレートを追加"}
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              テンプレート名 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={e => { setFormName(e.target.value); setErr(""); }}
              placeholder="例：ご飯セット、サイドメニュー選択"
              autoFocus
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-all placeholder-slate-600"
            />
            <p className="text-[10px] text-slate-500 mt-1">※ 商品名の入力は不要です</p>
            {/* 税込・税抜切り替えスイッチを追加 */}
<div className="flex items-center gap-4 my-6 p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">入力形式</span>
  <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
    <button
      type="button"
      onClick={() => setIsTaxInclusive(true)}
      className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${
        isTaxInclusive 
          ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20' 
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      税込
    </button>
    <button
      type="button"
      onClick={() => setIsTaxInclusive(false)}
      className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${
        !isTaxInclusive 
          ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20' 
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      税抜
    </button>
  </div>
  <span className="text-[10px] text-slate-500 italic">
    {isTaxInclusive ? '※入力価格を1.1で割って税抜で保存します' : '※入力価格をそのまま税抜として保存します'}
  </span>
</div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">オプション内容（{isTaxInclusive ? '税込' : '税抜'}・円）</p>
            <OptionGroupsEditor
              groups={formGroups}
              onChange={setFormGroups}
              templates={templates.filter(t => t.id !== editingId)}
              isTaxInclusive={isTaxInclusive}
              taxRate={0.10}
            />
          </div>

          {err && <p className="text-xs text-red-400">{err}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={busy}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all active:scale-95"
            >
              {busy ? "保存中..." : editingId ? "✓ 更新する" : "＋ 追加する"}
            </button>
            <button
              onClick={cancelForm}
              className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-semibold transition-all active:scale-95"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* テンプレート一覧 */}
      {templates.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          テンプレートがありません
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(tmpl => (
            <div
              key={tmpl.id}
              className="bg-slate-800 rounded-2xl border border-slate-700 px-4 py-3.5"
            >
              {editingId === tmpl.id ? null : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{tmpl.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tmpl.groups.length === 0
                        ? "グループなし"
                        : tmpl.groups.map(g => g.name || "（未設定）").join(" · ")}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-teal-900 text-teal-300 flex-shrink-0">
                    {tmpl.groups.length}グループ
                  </span>
                  <button
                    onClick={() => openEdit(tmpl)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-semibold transition-all active:scale-95 flex-shrink-0"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(tmpl)}
                    disabled={busy}
                    className="px-3 py-1.5 bg-red-900/60 hover:bg-red-900 text-red-400 rounded-lg text-xs font-semibold transition-all active:scale-95 flex-shrink-0 disabled:opacity-50"
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── カテゴリー設定タブ ────────────────────────────────────────
function CategoriesTab({
  categories,
  itemsByCat,
  allItems,
  onRefresh,
}: {
  categories: CategoryRecord[];
  itemsByCat: Record<string, number>;
  allItems: MenuItem[];
  onRefresh: () => void;
}) {
  const takeoutCatId = categories.find(c => c.name === "テイクアウト")?.id;
  const takeoutAvailableCount = allItems.filter(i => i.isTakeoutAvailable !== false).length;
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
      await saveCategory({
        name: newName.trim(),
        display_order: categories.length,
      });
      setNewName("");
      setAdding(false);
      setErr("");
      onRefresh();
    } catch (e: unknown) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {categories.length === 0 && (
        <div className="bg-amber-950 border border-amber-700 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-bold text-amber-300">⚠️ カテゴリーが見つかりません</p>
          <p className="text-xs text-amber-400 leading-relaxed">
            Supabase Dashboard → SQL Editor で <code className="bg-amber-900 px-1 rounded text-amber-200">supabase/migrate_categories_to_uuid.sql</code> を実行してください。
          </p>
        </div>
      )}

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

      {categories.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">カテゴリーがありません</div>
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
                  {(() => {
                    const count = cat.id === takeoutCatId
                      ? takeoutAvailableCount
                      : (itemsByCat[cat.id] ?? 0);
                    return (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                        count > 0 ? "bg-teal-900 text-teal-300" : "bg-slate-700 text-slate-500"
                      }`}>
                        {count}件{cat.id === takeoutCatId ? " (可)" : ""}
                      </span>
                    );
                  })()}
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

// ─── 商品編集フォーム ─────────────────────────────────────────
function ItemForm({
  state,
  categories,
  templates,
  isEmojiEnabled,
  availableEmojis,
  onChange,
  onSave,
  onCancel,
  saveLabel,
  busy,
}: {
  state: ItemEditState;
  categories: CategoryRecord[];
  templates: OptionTemplate[];
  isEmojiEnabled: boolean;
  availableEmojis: string[];
  onChange: (s: ItemEditState) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  busy: boolean;
}) {
  const set = (partial: Partial<ItemEditState>) => onChange({ ...state, ...partial });
  const [showPriceNumpad, setShowPriceNumpad] = useState(false);

  return (
    <div className="space-y-4">
      {/* 絵文字 */}
      {isEmojiEnabled && (
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">絵文字</p>
          <div className="flex flex-wrap gap-2">
            {availableEmojis.map(e => (
              <button key={e} onClick={() => set({ emoji: e })}
                className={`w-11 h-11 text-2xl rounded-xl border-2 transition-all ${
                  state.emoji === e ? "border-teal-500 bg-teal-900" : "border-slate-600 hover:border-slate-500"
                }`}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">商品名</label>
          <input type="text" value={state.name} onChange={e => set({ name: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">価格（円）</label>
          <div className="flex gap-2">
            <input type="number" value={state.price} min="1" onChange={e => set({ price: e.target.value })}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-all" />
            <button
              type="button"
              onClick={() => setShowPriceNumpad(true)}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-base transition-colors"
              title="テンキーで入力"
            >
              ⌨️
            </button>
          </div>
          {showPriceNumpad && (
            <NumpadModal
              label="価格入力"
              subtitle={state.taxInclusive ? "税込金額を入力" : "税抜金額を入力"}
              initialValue={parseInt(state.price || "0", 10) || 0}
              quickAdjusts={[+1000, +100, -100, -1000]}
              min={1}
              confirmLabel="価格を確定"
              onConfirm={value => { set({ price: String(value) }); setShowPriceNumpad(false); }}
              onClose={() => setShowPriceNumpad(false)}
            />
          )}
        </div>
      </div>

      {/* カテゴリー + 消費税率 */}
      <div className="grid grid-cols-2 gap-6 items-start">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2">カテゴリー</label>
          {categories.length === 0 ? (
            <p className="text-xs text-amber-400 py-2">まずカテゴリーを登録してください</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => set({ category: cat.id })}
                  className={`flex-1 min-w-fit py-2 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${
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
          <div className="grid grid-cols-4 gap-2">
            {TAX_RATES.map(({ rate, label }) => (
              <button key={rate} onClick={() => set({ taxRate: rate })}
                className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all text-center ${
                  state.taxRate === rate
                    ? "border-amber-500 bg-amber-900 text-amber-300"
                    : "border-slate-600 text-slate-400 hover:border-slate-500"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 価格入力（内税/外税） */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 flex-shrink-0">価格入力</span>
        <button
          type="button"
          onClick={() => set({ taxInclusive: !state.taxInclusive })}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 transition-all ${
            state.taxInclusive ? "bg-teal-600 border-teal-500" : "bg-slate-700 border-slate-600"
          }`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            state.taxInclusive ? "translate-x-5" : "translate-x-0.5"
          }`} />
        </button>
        <span className={`text-xs font-semibold ${state.taxInclusive ? "text-teal-400" : "text-slate-500"}`}>
          {state.taxInclusive ? "内税（税込入力）" : "外税（税抜入力）"}
        </span>
        {state.taxInclusive && state.price && !isNaN(parseInt(state.price, 10)) && (
          <span className="text-xs text-teal-400 ml-auto">
            税抜換算: ¥{Math.floor(parseInt(state.price, 10) / (1 + state.taxRate)).toLocaleString()}
          </span>
        )}
      </div>

      {/* テイクアウト設定 */}
      <div className="flex items-center gap-3 border-t border-slate-700/50 pt-3">
        <span className="text-xs font-semibold text-slate-400 flex-shrink-0">テイクアウト対応</span>
        <button
          type="button"
          onClick={() => set({ isTakeoutAvailable: !state.isTakeoutAvailable })}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 transition-all ${
            state.isTakeoutAvailable ? "bg-teal-600 border-teal-500" : "bg-slate-700 border-slate-600"
          }`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            state.isTakeoutAvailable ? "translate-x-5" : "translate-x-0.5"
          }`} />
        </button>
        <span className={`text-xs font-semibold ${state.isTakeoutAvailable ? "text-teal-400" : "text-slate-500"}`}>
          {state.isTakeoutAvailable ? "テイクアウト可" : "店内のみ"}
        </span>
      </div>

      {/* ── オプション設定 ──── */}
      <div className="bg-slate-900/60 rounded-2xl p-4 space-y-4 border border-slate-700">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">オプション設定（税抜・円）</p>
        </div>

        {/* テンプレートから追加（既存グループに append） */}
        {templates.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-1.5">テンプレートを追加</p>
            <div className="flex flex-wrap gap-1.5">
              {templates.map(tmpl => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => {
                    const existing = state.options.optionGroups;
                    const toAdd = applyTemplate(tmpl.groups).filter(
                      g => !existing.some(e => e.name === g.name)
                    );
                    if (toAdd.length > 0) {
                      set({ options: { optionGroups: [...existing, ...toAdd] } });
                    }
                  }}
                  className="px-2.5 py-1 bg-slate-700 hover:bg-teal-800 border border-slate-600 hover:border-teal-500 text-slate-300 hover:text-teal-200 rounded-lg text-xs font-semibold transition-all active:scale-95"
                >
                  📋 {tmpl.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => set({ options: { optionGroups: [] } })}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-500 hover:text-slate-300 rounded-lg text-xs font-semibold transition-all"
              >
                クリア
              </button>
            </div>
          </div>
        )}

        <OptionGroupsEditor
          groups={state.options.optionGroups}
          onChange={groups => set({ options: { optionGroups: groups } })}
          templates={templates}
          isTaxInclusive={false}
          taxRate={state.taxRate}
        />
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

// ─── 絵文字バリデーション ─────────────────────────────────────
// Intl.Segmenter でグラフェムクラスタが 1 つかを確認し、
// \p{Extended_Pictographic} で絵文字かどうかを判定する。
function isSingleEmoji(input: string): boolean {
  if (!input) return false;
  const segments = [...new Intl.Segmenter().segment(input)];
  return segments.length === 1 && /\p{Extended_Pictographic}/u.test(input);
}

// ─── 表示設定タブ ─────────────────────────────────────────────
function DisplayTab({
  emojiSettings,
  onEmojiSettingsChange,
}: {
  emojiSettings: EmojiSettings;
  onEmojiSettingsChange: (s: EmojiSettings) => void;
}) {
  const [isTakeoutEnabled, setIsTakeoutEnabled] = useState<boolean>(true);
  const [settingsLoaded, setSettingsLoaded]     = useState<boolean>(false);
  const [isTakeoutSaving, setIsTakeoutSaving]   = useState<boolean>(false);
  const [takeoutToast, setTakeoutToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [addEmojiInput, setAddEmojiInput]       = useState("");
  const [addEmojiError, setAddEmojiError]       = useState("");
  const [emojiSaving, setEmojiSaving]           = useState(false);
  const [analysisMode, setAnalysisMode]         = useState<AnalysisMode>("SIMPLE");
  const [analysisSaving, setAnalysisSaving]     = useState(false);
  const [analysisToast, setAnalysisToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetchIsTakeoutEnabled().then(enabled => {
      setIsTakeoutEnabled(enabled);
      setSettingsLoaded(true);
    }).catch(() => setSettingsLoaded(true));
    fetchAnalysisMode().then(setAnalysisMode).catch(() => {});
  }, []);

  const handleTakeoutToggle = async (value: boolean) => {
    setIsTakeoutEnabled(value);
    setIsTakeoutSaving(true);
    setTakeoutToast(null);
    try {
      await persistIsTakeoutEnabled(value);
      setTakeoutToast({ msg: "✓ 設定を保存しました", ok: true });
      setTimeout(() => setTakeoutToast(null), 3000);
    } catch (e: unknown) {
      // 保存失敗 → UI を元の値に戻す
      setIsTakeoutEnabled(!value);
      const detail = e instanceof Error ? e.message : String(e);
      setTakeoutToast({ msg: `✗ 保存に失敗しました — ${detail}`, ok: false });
      setTimeout(() => setTakeoutToast(null), 6000);
    } finally {
      setIsTakeoutSaving(false);
    }
  };

  const handleAnalysisModeToggle = async (next: AnalysisMode) => {
    setAnalysisMode(next);
    setAnalysisSaving(true);
    setAnalysisToast(null);
    try {
      await persistAnalysisMode(next);
      setAnalysisToast({ msg: "✓ 設定を保存しました", ok: true });
      setTimeout(() => setAnalysisToast(null), 3000);
    } catch (e: unknown) {
      setAnalysisMode(next === "STATISTICAL" ? "SIMPLE" : "STATISTICAL");
      const detail = e instanceof Error ? e.message : String(e);
      setAnalysisToast({ msg: `✗ 保存に失敗しました — ${detail}`, ok: false });
      setTimeout(() => setAnalysisToast(null), 6000);
    } finally {
      setAnalysisSaving(false);
    }
  };

  const saveEmoji = async (settings: EmojiSettings) => {
    setEmojiSaving(true);
    try {
      await persistEmojiSettings(settings);
      onEmojiSettingsChange(settings);
    } catch (e) {
      console.warn("[DisplayTab] 絵文字設定保存エラー:", e);
    } finally {
      setEmojiSaving(false);
    }
  };

  const removeEmoji = (emoji: string) => {
    saveEmoji({ ...emojiSettings, availableEmojis: emojiSettings.availableEmojis.filter(e => e !== emoji) });
  };

  const addEmoji = () => {
    const trimmed = addEmojiInput.trim();
    if (!trimmed) return;

    if (!isSingleEmoji(trimmed)) {
      const segments = [...new Intl.Segmenter().segment(trimmed)];
      setAddEmojiError(
        segments.length > 1
          ? "絵文字は1つだけ入力してください"
          : "絵文字のみ入力できます（例：🍣 🍕）"
      );
      return;
    }

    if (emojiSettings.availableEmojis.includes(trimmed)) {
      setAddEmojiError("すでにリストに含まれています");
      return;
    }

    setAddEmojiError("");
    saveEmoji({ ...emojiSettings, availableEmojis: [...emojiSettings.availableEmojis, trimmed] });
    setAddEmojiInput("");
  };

  const resetToDefault = () => {
    if (!confirm("絵文字リストをデフォルトに戻しますか？")) return;
    saveEmoji({ ...emojiSettings, availableEmojis: DEFAULT_EMOJIS });
  };

  return (
    <div className="space-y-4">
      {/* テイクアウト機能 */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">機能の表示 / 非表示</h2>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white">テイクアウト機能</p>
            <p className="text-xs text-slate-400">
              無効にするとレジ画面のテイクアウトボタンが完全に非表示になります
            </p>
          </div>
          <button
            onClick={() => handleTakeoutToggle(!isTakeoutEnabled)}
            disabled={!settingsLoaded || isTakeoutSaving}
            className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-wait ${
              isTakeoutEnabled ? "bg-teal-500" : "bg-slate-600"
            }`}
            role="switch"
            aria-checked={isTakeoutEnabled}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                isTakeoutEnabled ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className={`text-xs px-3 py-2 rounded-xl font-medium ${
          isTakeoutEnabled
            ? "bg-teal-900/40 text-teal-300 border border-teal-800/60"
            : "bg-slate-700 text-slate-400 border border-slate-600"
        }`}>
          {isTakeoutSaving
            ? "保存中..."
            : isTakeoutEnabled
              ? "テイクアウト機能：有効（レジ画面に表示）"
              : "テイクアウト機能：無効（レジ画面から非表示）"}
        </div>

        {takeoutToast && (
          <div className={`text-xs px-3 py-2 rounded-xl font-semibold transition-all ${
            takeoutToast.ok
              ? "bg-teal-950 text-teal-300 border border-teal-700"
              : "bg-red-950 text-red-300 border border-red-800"
          }`}>
            {takeoutToast.msg}
          </div>
        )}
      </div>

      {/* AI客層分析モード */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">売上分析設定</h2>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white">AI客層分析モード</p>
            <p className="text-xs text-slate-400">
              有効にすると、お一人様（ソロ客）の注文データを参考にして、複数人グループ客の男女別売上をAIが自動で予測・計算します
            </p>
          </div>
          <button
            onClick={() => handleAnalysisModeToggle(analysisMode === "STATISTICAL" ? "SIMPLE" : "STATISTICAL")}
            disabled={analysisSaving}
            className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-wait ${
              analysisMode === "STATISTICAL" ? "bg-teal-500" : "bg-slate-600"
            }`}
            role="switch"
            aria-checked={analysisMode === "STATISTICAL"}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                analysisMode === "STATISTICAL" ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className={`text-xs px-3 py-2 rounded-xl font-medium ${
          analysisMode === "STATISTICAL"
            ? "bg-teal-900/40 text-teal-300 border border-teal-800/60"
            : "bg-slate-700 text-slate-400 border border-slate-600"
        }`}>
          {analysisSaving
            ? "保存中..."
            : analysisMode === "STATISTICAL"
              ? "AI分析中：ソロ客の傾向から、グループ客の内訳を賢く予測しています"
              : "標準モード：全体の売上を人数で割った、シンプルな平均値を表示します"}
        </div>

        {analysisToast && (
          <div className={`text-xs px-3 py-2 rounded-xl font-semibold transition-all ${
            analysisToast.ok
              ? "bg-teal-950 text-teal-300 border border-teal-700"
              : "bg-red-950 text-red-300 border border-red-800"
          }`}>
            {analysisToast.msg}
          </div>
        )}
      </div>

      {/* 絵文字設定 */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">絵文字設定</h2>

        {/* 絵文字有効/無効 */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white">絵文字を使用する</p>
            <p className="text-xs text-slate-400">
              無効にすると商品登録時の絵文字選択UIが非表示になります
            </p>
          </div>
          <button
            onClick={() => saveEmoji({ ...emojiSettings, isEmojiEnabled: !emojiSettings.isEmojiEnabled })}
            disabled={emojiSaving}
            className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-wait ${
              emojiSettings.isEmojiEnabled ? "bg-teal-500" : "bg-slate-600"
            }`}
            role="switch"
            aria-checked={emojiSettings.isEmojiEnabled}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                emojiSettings.isEmojiEnabled ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* 絵文字リスト編集 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400">
              使用できる絵文字（{emojiSettings.availableEmojis.length}個）
            </p>
            <button
              onClick={resetToDefault}
              className="text-[10px] text-slate-500 hover:text-slate-300 underline transition-colors"
            >
              デフォルトに戻す
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {emojiSettings.availableEmojis.map(emoji => (
              <div key={emoji} className="relative group">
                <span className="text-2xl w-10 h-10 flex items-center justify-center bg-slate-700 rounded-lg cursor-default select-none">
                  {emoji}
                </span>
                <button
                  onClick={() => removeEmoji(emoji)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 hover:bg-red-500 text-white rounded-full text-[9px] hidden group-hover:flex items-center justify-center transition-all"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={addEmojiInput}
              onChange={e => { setAddEmojiInput(e.target.value); setAddEmojiError(""); }}
              onKeyDown={e => e.key === "Enter" && addEmoji()}
              placeholder="絵文字を入力して追加（例：🍣）"
              className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-teal-500 transition-all placeholder-slate-600"
            />
            <button
              onClick={addEmoji}
              disabled={!addEmojiInput.trim() || emojiSaving}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-teal-200 rounded-xl text-sm font-semibold transition-all active:scale-95"
            >
              追加
            </button>
          </div>
          {addEmojiError && (
            <p className="text-xs text-red-400">{addEmojiError}</p>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── 商品名自動翻訳 ──────────────────────────────────────────────
async function autoTranslateItemName(name: string): Promise<{ name_en: string; name_zh: string; name_ko: string }> {
  const langs = ["en", "zh", "ko"] as const;
  const results = await Promise.all(
    langs.map(async (targetLang) => {
      try {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "translate", text: name, targetLang }),
        });
        const data = await res.json();
        return data.ok ? (data.result as string) : name;
      } catch {
        return name;
      }
    })
  );
  return { name_en: results[0], name_zh: results[1], name_ko: results[2] };
}

// ─── メインページ ─────────────────────────────────────────────
export default function ProductManagementPage() {
  const [pageTab, setPageTab]         = useState<PageTab>("items");
  const [items, setItems]             = useState<MenuItem[]>([]);
  const [categories, setCategories]   = useState<CategoryRecord[]>([]);
  const [templates, setTemplates]     = useState<OptionTemplate[]>([]);
  const [emojiSettings, setEmojiSettings] = useState<EmojiSettings>({ isEmojiEnabled: true, availableEmojis: DEFAULT_EMOJIS });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // 商品タブの状態
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editState, setEditState]     = useState<ItemEditState | null>(null);
  const [filterCat, setFilterCat]     = useState<string>("all");
  const [busy, setBusy]               = useState(false);

  // 商品追加モーダル
  const [showAdd, setShowAdd]         = useState(false);
  const [newItem, setNewItem]         = useState<ItemEditState>({
    name: "", price: "", category: "", emoji: "🍔", taxRate: 0.10, taxInclusive: false,
    options: { optionGroups: [] },
    isTakeoutAvailable: true,
  });
  const [addError, setAddError]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (IS_BRONCO) {
        setItems(broncoMenuItems);
        setCategories(broncoCategories);
        setLoading(false);
        return;
      }
      const [menuData, catData, tmplRaw, emojiSettingsData] = await Promise.all([
        fetchMenuItems(),
        fetchCategories(),
        fetchOptionTemplates(),
        fetchEmojiSettings(),
      ]);
      const tmplData = await seedDefaultOptionTemplates(tmplRaw);
      setItems(menuData);
      setCategories(catData.filter(c => isValidUUID(c.id)));
      setTemplates(tmplData);
      setEmojiSettings(emojiSettingsData);
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

  const itemsByCat: Record<string, number> = {};
  for (const item of items) {
    itemsByCat[item.category] = (itemsByCat[item.category] ?? 0) + 1;
  }

  const filtered = filterCat === "all" ? items : items.filter(i => i.category === filterCat);
  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? id;

  // ─ 商品編集 ─
  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    const srcGroups = item.options?.optionGroups ?? [];
    setEditState({
      name: item.name, price: String(item.price), category: item.category, emoji: item.emoji ?? "",
      taxRate: item.taxRate, taxInclusive: false,
      options: { optionGroups: srcGroups.map(g => ({ ...g, items: [...g.items] })) },
      isTakeoutAvailable: item.isTakeoutAvailable !== false,
    });
  }
  function cancelEdit() { setEditingId(null); setEditState(null); }

  async function saveEdit(id: string) {
    if (!editState) return;
    const raw = parseInt(editState.price, 10);
    if (!editState.name.trim() || isNaN(raw) || raw <= 0) return;
    const price = editState.taxInclusive ? Math.floor(raw / (1 + editState.taxRate)) : raw;
    const trimmedName = editState.name.trim();
    setBusy(true);
    try {
      await updateMenuItem(id, { name: trimmedName, price, category: editState.category, emoji: editState.emoji || null, tax_rate: editState.taxRate, options: editState.options, is_takeout_available: editState.isTakeoutAvailable });
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...editState, price, taxRate: editState.taxRate, isTakeoutAvailable: editState.isTakeoutAvailable } : i));
      setEditingId(null); setEditState(null);
      autoTranslateItemName(trimmedName).then(t => updateMenuItem(id, t)).catch(() => {});
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

  // ─ 販売可否トグル ─
  async function handleToggleAvailability(item: MenuItem) {
    const next = !(item.isAvailable !== false);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, isAvailable: next } : i));
    try {
      await updateMenuItem(item.id, { is_available: next });
    } catch (e: unknown) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isAvailable: !next } : i));
      alert("販売可否の変更に失敗しました: " + (e as Error).message);
    }
  }

  // ─ 並び替え（同一カテゴリー内でスワップ） ─
  async function handleReorder(item: MenuItem, direction: "up" | "down") {
    const sameCat = items
      .filter(i => i.category === item.category)
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
    const idx = sameCat.findIndex(i => i.id === item.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameCat.length) return;
    const partner = sameCat[swapIdx];
    const orderA = item.displayOrder ?? 999;
    const orderB = partner.displayOrder ?? 999;
    setItems(prev => prev.map(i => {
      if (i.id === item.id) return { ...i, displayOrder: orderB };
      if (i.id === partner.id) return { ...i, displayOrder: orderA };
      return i;
    }));
    try {
      await Promise.all([
        updateMenuItem(item.id,    { display_order: orderB }),
        updateMenuItem(partner.id, { display_order: orderA }),
      ]);
    } catch (e: unknown) {
      setItems(prev => prev.map(i => {
        if (i.id === item.id) return { ...i, displayOrder: orderA };
        if (i.id === partner.id) return { ...i, displayOrder: orderB };
        return i;
      }));
      alert("並び替えに失敗しました: " + (e as Error).message);
    }
  }

  // ─ 商品追加 ─
  async function handleAdd() {
    setAddError("");
    const raw = parseInt(newItem.price, 10);
    if (!newItem.name.trim()) { setAddError("名前を入力してください"); return; }
    if (isNaN(raw) || raw <= 0) { setAddError("正しい価格を入力してください"); return; }
    if (!newItem.category) { setAddError("カテゴリーを選択してください"); return; }
    const price = newItem.taxInclusive ? Math.floor(raw / (1 + newItem.taxRate)) : raw;
    setBusy(true);
    try {
      const item: MenuItem = {
        id: crypto.randomUUID(),
        name: newItem.name.trim(), price,
        category: newItem.category,
        emoji: newItem.emoji || undefined,
        taxRate: newItem.taxRate,
        options: newItem.options,
        isTakeoutAvailable: newItem.isTakeoutAvailable,
      };
      await saveMenuItem(item);
      autoTranslateItemName(item.name).then(tr => updateMenuItem(item.id, tr)).catch(() => {});
      await load();
      setNewItem({ name: "", price: "", category: categories[0]?.id ?? "", emoji: "🍔", taxRate: 0.10, taxInclusive: false, options: { optionGroups: [] }, isTakeoutAvailable: true });
      setShowAdd(false);
    } catch (e: unknown) { setAddError("追加に失敗しました: " + (e as Error).message); }
    finally { setBusy(false); }
  }

  function openAddModal() {
    setNewItem(prev => ({
      ...prev,
      category: categories[0]?.id ?? "",
      emoji: emojiSettings.isEmojiEnabled ? (emojiSettings.availableEmojis[0] ?? "") : "",
      taxInclusive: false,
      options: { optionGroups: [] },
      isTakeoutAvailable: true,
    }));
    setAddError("");
    setShowAdd(true);
  }

  const TAB_CONFIG: { key: PageTab; label: string }[] = [
    { key: "items",      label: `🍽️ 商品一覧（${items.length}件）` },
    { key: "options",    label: `📋 オプション管理（${templates.length}件）` },
    { key: "categories", label: "🗂️ カテゴリー設定" },
    { key: "display",    label: "⚙️ 表示設定" },
  ];

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
        <div className="flex items-center gap-2">
          {process.env.NEXT_PUBLIC_STORE_ID !== "bronco" && (
            <Link href="/employees"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-500 hover:to-orange-600 transition-all active:scale-95 shadow-[0_2px_8px_rgba(251,191,36,0.35)]">
              <span>🏅</span>
              <span>補助金診断</span>
            </Link>
          )}
          {pageTab === "items" && (
            <button onClick={openAddModal}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all active:scale-95">
              ＋ 商品を追加
            </button>
          )}
        </div>
        {pageTab === "options" && (
          <p className="text-xs text-slate-500">テンプレートをまず作成し、商品登録時に適用できます</p>
        )}
      </header>

      {/* タブバー */}
      <div className="flex border-b border-slate-800 bg-slate-900">
        {TAB_CONFIG.map(({ key, label }) => (
          <button key={key} onClick={() => setPageTab(key)}
            className={`flex-1 py-3 text-sm font-semibold transition-all ${
              pageTab === key
                ? "text-teal-300 border-b-2 border-teal-400 bg-slate-800"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
            }`}>
            {label}
          </button>
        ))}
      </div>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="text-center py-16 text-slate-500">読み込み中...</div>
        ) : error ? (
          <div className="bg-amber-950 border border-amber-700 rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-amber-300 font-bold text-base">データベーステーブルが見つかりません</p>
                <p className="text-amber-400 text-sm mt-1">Supabase の SQL Editor で以下のファイルを実行してください。</p>
              </div>
            </div>
            <div className="bg-amber-900/40 rounded-xl p-4 font-mono text-xs text-amber-200 leading-relaxed">
              <p className="text-amber-400 font-semibold mb-2"># Supabase Dashboard → SQL Editor で実行</p>
              <p>supabase/setup_full.sql</p>
            </div>
            <p className="text-xs text-red-400 bg-red-950/50 rounded-lg px-3 py-2">詳細: {error}</p>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold transition-all active:scale-95"
            >
              🔄 再試行
            </button>
          </div>
        ) : pageTab === "display" ? (
          /* ── 表示設定タブ ───────────────────────────────── */
          <DisplayTab
            emojiSettings={emojiSettings}
            onEmojiSettingsChange={setEmojiSettings}
          />
        ) : pageTab === "options" ? (
          /* ── オプション管理タブ ─────────────────────────── */
          <OptionsTab templates={templates} onRefresh={load} />
        ) : pageTab === "categories" ? (
          /* ── カテゴリー設定タブ ─────────────────────────── */
          <CategoriesTab categories={categories} itemsByCat={itemsByCat} allItems={items} onRefresh={load} />
        ) : (
          /* ── 商品一覧タブ ───────────────────────────────── */
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
                          templates={templates}
                          isEmojiEnabled={emojiSettings.isEmojiEnabled}
                          availableEmojis={emojiSettings.availableEmojis}
                          onChange={setEditState}
                          onSave={() => saveEdit(item.id)}
                          onCancel={cancelEdit}
                          saveLabel="✓ 保存する"
                          busy={busy}
                        />
                      </div>
                    ) : (
                      <div className={`flex items-center gap-3 px-4 py-3 ${item.isAvailable === false ? "opacity-50" : ""}`}>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button onClick={() => handleReorder(item, "up")}
                            className="w-6 h-6 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs flex items-center justify-center transition-all active:scale-95"
                            title="上へ">▲</button>
                          <button onClick={() => handleReorder(item, "down")}
                            className="w-6 h-6 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs flex items-center justify-center transition-all active:scale-95"
                            title="下へ">▼</button>
                        </div>
                        <span className="text-3xl w-10 text-center flex-shrink-0">{item.emoji ?? ""}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {item.name}
                            {item.isAvailable === false && <span className="ml-2 text-xs text-red-400 font-bold">売り切れ</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400">{catName(item.category)}</span>
                            <span className="text-xs text-slate-600">·</span>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${taxBadgeCls(item.taxRate)}`}>
                              税{TAX_RATES.find(t => t.rate === item.taxRate)?.label ?? `${item.taxRate * 100}%`}
                            </span>
                          </div>
                        </div>
                        <p className="text-base font-bold text-white flex-shrink-0 mr-2">
                          ¥{item.price.toLocaleString()}
                        </p>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => handleToggleAvailability(item)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                              item.isAvailable === false
                                ? "bg-red-900 hover:bg-red-800 text-red-300"
                                : "bg-emerald-900 hover:bg-emerald-800 text-emerald-300"
                            }`}
                            title={item.isAvailable === false ? "販売再開" : "売り切れにする"}>
                            {item.isAvailable === false ? "🔴 売切" : "🟢 販売中"}
                          </button>
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
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
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
                    templates={templates}
                    isEmojiEnabled={emojiSettings.isEmojiEnabled}
                    availableEmojis={emojiSettings.availableEmojis}
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
