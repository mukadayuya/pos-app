export type Category = string; // dynamic: references categories.id in DB
export type ServiceTab = "dinner" | "lunch" | "takeout";
export type RiceType = "white" | "mochi";
export type RiceSize = "small" | "regular" | "large" | "extra";
export type TaxRate = 0.08 | 0.10;
export type PaymentMethod = "cash" | "card" | "voucher" | "card_manual";

export interface OrderOptions {
  riceType: RiceType;
  riceSize: RiceSize;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: Category;
  emoji: string;
  taxRate: TaxRate;
}

export interface OrderItem {
  itemKey: string;
  menuItem: MenuItem;
  quantity: number;
  options: OrderOptions;
  unitPrice: number;
  taxRate: TaxRate;
}

export interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
}

export interface SalesRecord {
  id: string;
  items: OrderItem[];
  subtotal: number;
  tax8: number;
  tax10: number;
  tax: number;
  total: number;
  payments: PaymentEntry[];
  serviceTab: ServiceTab;
  createdAt: Date;
}
