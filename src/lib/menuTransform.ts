import { MenuItem } from "@/types/pos";

/**
 * Returns a new MenuItem with taxRate forced to 0.08 (テイクアウト軽減税率).
 * All other properties — emoji, options.optionGroups, id, name, price, category — are
 * preserved via spread so no prop can be accidentally dropped in future edits.
 */
export function toTakeoutMenuItem(item: MenuItem): MenuItem {
  return {
    ...item,
    taxRate: 0.08,
  };
}
