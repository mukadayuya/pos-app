import { SaleDetailRow } from "@/lib/db";

export interface ItemBreakdown {
  name: string;
  emoji: string;
  quantity: number;
  unitPriceExTax: number; // 税抜単価（最初の会計から取得）
  taxRate: number;
  totalIncTax: number;   // 税込小計
}

/**
 * SaleDetailRow[] から商品別に集計して売上降順で返す。
 * 事前に orders をフィルタリングしてから渡すことで任意の切り口に対応できる。
 * - カテゴリー別: items を税率でフィルタした仮想 orders を渡す
 * - スタッフ別:   staff_name でフィルタした orders を渡す
 * - 時間帯別:     getHours() でフィルタした orders を渡す
 */
export function buildItemBreakdown(orders: SaleDetailRow[]): ItemBreakdown[] {
  const map = new Map<string, ItemBreakdown>();

  for (const order of orders) {
    for (const item of order.items ?? []) {
      const qty   = Number(item.quantity);
      const price = Number(item.unit_price);
      if (!isFinite(qty) || qty <= 0 || !isFinite(price)) continue;

      const taxN  = Number(item.tax_rate ?? 0.10);
      const tax   = isFinite(taxN) ? (taxN > 1 ? taxN / 100 : taxN) : 0.10;
      const total = Math.round(price * (1 + tax) * qty);
      const name  = item.name  || "（不明）";
      const emoji = item.emoji || "🍽️";
      const prev  = map.get(name);

      if (prev) {
        map.set(name, { ...prev, quantity: prev.quantity + qty, totalIncTax: prev.totalIncTax + total });
      } else {
        map.set(name, { name, emoji, quantity: qty, unitPriceExTax: price, taxRate: tax, totalIncTax: total });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalIncTax - a.totalIncTax);
}
