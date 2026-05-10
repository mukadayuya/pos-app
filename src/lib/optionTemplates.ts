import { OptionGroup } from "@/types/pos";

/** テンプレートフォームのバリデーション。エラーメッセージ or null を返す。商品名は不要。 */
export function validateTemplateForm(name: string, _groups: OptionGroup[]): string | null {
  if (!name.trim()) return "テンプレート名を入力してください";
  return null;
}

/** OptionGroup[] を deep-clone して返す（テンプレート適用時に使用）。 */
export function applyTemplate(groups: OptionGroup[]): OptionGroup[] {
  return groups.map(g => ({ ...g, items: g.items.map(it => ({ ...it })) }));
}
