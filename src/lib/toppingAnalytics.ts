const ANALYTICS_KEY = "flows_topping_analytics_v1";

export interface ToppingAnalytics {
  orderCount: number;
  itemCounts: Record<string, number>;
  pairCounts: Record<string, number>;
}

export interface SynergyResult {
  itemName: string;
  confidence: number;
  lift: number;
  coOccurrences: number;
}

function emptyAnalytics(): ToppingAnalytics {
  return { orderCount: 0, itemCounts: {}, pairCounts: {} };
}

function readAnalytics(): ToppingAnalytics {
  if (typeof window === "undefined") return emptyAnalytics();
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    if (!raw) return emptyAnalytics();
    return JSON.parse(raw) as ToppingAnalytics;
  } catch {
    return emptyAnalytics();
  }
}

function writeAnalytics(data: ToppingAnalytics): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data));
  } catch {
    // storage quota or private mode — silently ignore
  }
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

export function recordOrder(itemNames: string[]): void {
  const data = readAnalytics();
  data.orderCount += 1;

  const unique = Array.from(new Set(itemNames));

  for (const name of unique) {
    data.itemCounts[name] = (data.itemCounts[name] ?? 0) + 1;
  }

  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const key = pairKey(unique[i], unique[j]);
      data.pairCounts[key] = (data.pairCounts[key] ?? 0) + 1;
    }
  }

  writeAnalytics(data);
}

export function getTopSynergies(
  itemName: string,
  topN: number = 5
): SynergyResult[] {
  const data = readAnalytics();
  const { orderCount, itemCounts, pairCounts } = data;

  if (orderCount === 0) return [];

  const thisCount = itemCounts[itemName] ?? 0;
  if (thisCount === 0) return [];

  const results: SynergyResult[] = [];

  for (const [otherName, otherCount] of Object.entries(itemCounts)) {
    if (otherName === itemName) continue;

    const key = pairKey(itemName, otherName);
    const coOccurrences = pairCounts[key] ?? 0;

    if (coOccurrences < 2) continue;

    const confidence = coOccurrences / thisCount;
    const pOther = otherCount / orderCount;
    const lift = pOther > 0 ? confidence / pOther : 0;

    results.push({ itemName: otherName, confidence, lift, coOccurrences });
  }

  return results.sort((a, b) => b.lift - a.lift).slice(0, topN);
}

export function getAnalytics(): ToppingAnalytics {
  return readAnalytics();
}
