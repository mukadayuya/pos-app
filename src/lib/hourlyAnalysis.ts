import { HourlySales, SaleDetailRow } from "@/lib/db";

/**
 * 0〜23 時の 24 要素配列を返す。売上がない時間帯は total=0, count=0 で埋める。
 * 入力の順序・重複は問わない。出力は hour 昇順で固定。
 */
export function padHourlyData(data: HourlySales[]): HourlySales[] {
  const map = new Map(data.map(d => [d.hour, d]));
  return Array.from({ length: 24 }, (_, h) => map.get(h) ?? { hour: h, total: 0, count: 0 });
}

// ─── Drill-down ───────────────────────────────────────────────

export interface HourlyItemBreakdown {
  name: string;
  emoji: string;
  quantity: number;
  total: number; // tax-inclusive
}

/**
 * 指定した時間帯（0〜23）に売れた商品の内訳を集計して売上降順で返す。
 * 8%/10% どちらの税率も正しく計算。欠損フィールドにはフォールバックを適用。
 */
export function drilldownHour(orders: SaleDetailRow[], hour: number): HourlyItemBreakdown[] {
  const hourOrders = orders.filter(o =>
    parseInt(new Date(o.created_at).toLocaleTimeString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 2), 10) === hour
  );
  const map = new Map<string, HourlyItemBreakdown>();

  for (const order of hourOrders) {
    for (const item of order.items ?? []) {
      const qty   = Number(item.quantity);
      const price = Number(item.unit_price);
      if (!isFinite(qty) || qty <= 0 || !isFinite(price)) continue;

      const taxN  = Number(item.tax_rate ?? 0.10);
      const tax   = isFinite(taxN) ? taxN : 0.10;
      const total = Math.round(price * (1 + tax) * qty);

      const name  = item.name  || "（不明）";
      const emoji = item.emoji || "🍽️";
      const prev  = map.get(name);

      if (prev) {
        map.set(name, { ...prev, quantity: prev.quantity + qty, total: prev.total + total });
      } else {
        map.set(name, { name, emoji, quantity: qty, total });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
