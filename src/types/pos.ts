export type Category = string;
export type ServiceTab = "dinner" | "lunch" | "takeout";
export type RiceType = "white" | "mochi";
export type RiceSize = "small" | "regular" | "large" | "extra" | "none";
export type TaxRate = 0 | 0.01 | 0.08 | 0.10;
export type PaymentMethod = "cash" | "card" | "voucher" | "qr";

// ─── Dynamic option system ────────────────────────────────────────
export interface OptionItem {
  id: string;
  name: string;
  price: number; // tax-exclusive price delta (negative = discount)
}

export interface OptionGroup {
  id: string;
  name: string;
  items: OptionItem[];
}

export interface MenuItemOptions {
  optionGroups: OptionGroup[];
}

// One selection from a group (what the customer chose)
export interface OptionSelection {
  groupId: string;
  groupName: string;
  itemId: string;
  itemName: string;
  price: number;
}

// ─── Order types ──────────────────────────────────────────────────
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: Category;
  emoji?: string;
  taxRate: TaxRate;
  options?: MenuItemOptions;
  isTakeoutAvailable?: boolean; // undefined は true と同義
}

export interface OrderOptions {
  riceType: RiceType;  // legacy — kept so old in-session items don't break
  riceSize: RiceSize;  // legacy
  selections: OptionSelection[]; // dynamic (new system)
}

export interface OrderItem {
  itemKey: string;
  menuItem: MenuItem;
  quantity: number;
  options: OrderOptions;
  unitPrice: number;
  taxRate: TaxRate;
  priceAdjustReason?: string;
  itemDiscount?: OrderDiscount | null;
}

export interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
}

export interface OrderDiscount {
  type: "fixed" | "percent";
  value: number;
  inclusive: boolean; // true = 税込ベースで引く, false = 税抜ベースで引く
}

export interface HoldEntry {
  id: string;
  items: OrderItem[];
  maleCount: number;
  femaleCount: number;
  discount: OrderDiscount | null;
  heldAt: string; // ISO string
}

export interface SalesRecord {
  id: string;
  items: OrderItem[];
  subtotal: number;           // post-item-discount taxable base (課税対象・税抜)
  itemDiscountTotal: number;  // sum of per-item discount amounts
  tax8: number;
  tax10: number;
  tax: number;
  total: number;
  payments: PaymentEntry[];
  serviceTab: ServiceTab;
  maleCount?: number;
  femaleCount?: number;
  staff?: string;
  discount?: OrderDiscount | null;
  createdAt: Date;
}
