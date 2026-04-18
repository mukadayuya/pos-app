export type Category = "lunch" | "dinner";
export type RiceType = "white" | "mochi";
export type RiceSize = "small" | "regular" | "large" | "extra";

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
}

export interface OrderItem {
  itemKey: string; // `${menuItem.id}_${riceType}_${riceSize}`
  menuItem: MenuItem;
  quantity: number;
  options: OrderOptions;
  unitPrice: number;
}

export interface SalesRecord {
  id: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: Date;
}
