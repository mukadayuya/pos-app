import { OrderItem, OrderDiscount } from "@/types/pos";

export interface TaxTotals {
  subtotal: number;           // pre-item-discount: sum(unitPrice × qty)
  itemDiscountTotal: number;  // sum of per-item discount amounts
  tax8: number;               // computed on post-item-discount base
  tax10: number;
  taxOther: number;
  totalTax: number;
  baseTotal: number;          // (subtotal - itemDiscountTotal) + totalTax
}

export function computeItemDiscountAmount(
  discount: OrderDiscount,
  itemTotal: number,        // 税抜き合計
  taxRate: number = 0,      // inclusive 計算に使用
): number {
  if (discount.value <= 0) return 0;
  const pct = Math.min(100, discount.value);

  if (discount.type === "percent") {
    if (discount.inclusive && taxRate > 0) {
      // 税込金額に対する割引を税抜換算してから返す
      const taxIncl = itemTotal + Math.floor(itemTotal * taxRate);
      return Math.min(itemTotal, Math.round(taxIncl * pct / 100 / (1 + taxRate)));
    }
    return Math.round(itemTotal * pct / 100);
  }

  // 固定額
  if (discount.inclusive && taxRate > 0) {
    // 税込金額からの割引を税抜換算
    return Math.min(itemTotal, Math.round(discount.value / (1 + taxRate)));
  }
  return Math.min(itemTotal, discount.value);
}

export function computeTaxTotals(items: OrderItem[]): TaxTotals {
  let subtotal = 0;
  let itemDiscountTotal = 0;
  let tax10 = 0;
  let tax8 = 0;
  let taxOther = 0;

  for (const i of items) {
    const rawTotal = i.unitPrice * i.quantity;
    subtotal += rawTotal;
    const discAmt = i.itemDiscount ? computeItemDiscountAmount(i.itemDiscount, rawTotal, i.taxRate) : 0;
    itemDiscountTotal += discAmt;
    const effectiveTotal = rawTotal - discAmt;

    if (i.taxRate === 0.10)      tax10    += Math.floor(effectiveTotal * 0.10);
    else if (i.taxRate === 0.08) tax8     += Math.floor(effectiveTotal * 0.08);
    else                         taxOther += Math.floor(effectiveTotal * i.taxRate);
  }

  const totalTax  = tax8 + tax10 + taxOther;
  const baseTotal = (subtotal - itemDiscountTotal) + totalTax;
  return { subtotal, itemDiscountTotal, tax8, tax10, taxOther, totalTax, baseTotal };
}

export function computeItemDiscountDisplay(
  discount: OrderDiscount,
  rawTotal: number,
  taxRate: number = 0,
): number {
  if (discount.value <= 0) return 0;
  const pct = Math.min(100, discount.value);
  const taxIncl = rawTotal + Math.floor(rawTotal * taxRate);
  if (discount.type === "percent") {
    return discount.inclusive && taxRate > 0
      ? Math.round(taxIncl * pct / 100)
      : Math.round(rawTotal * pct / 100);
  }
  return discount.inclusive && taxRate > 0
    ? Math.min(taxIncl, discount.value)
    : Math.min(rawTotal, discount.value);
}

export function computeDiscountAmount(discount: OrderDiscount, subtotal: number, total: number): number {
  if (discount.value <= 0) return 0;
  if (discount.type === "percent") return Math.round(total * Math.min(100, discount.value) / 100);
  if (discount.inclusive) return Math.min(total, discount.value);
  const factor = subtotal > 0 ? total / subtotal : 1;
  return Math.min(total, Math.round(discount.value * factor));
}
