// ─── AI Stats Tracker (localStorage-based) ───────────────────────────────────
// No Supabase required. SSR-safe: all localStorage access is gated on
// typeof window !== "undefined".

export interface AiStats {
  chatCount: number;       // AIコンシェルジュ接客数（累計）
  upsellShown: number;     // アップセルバナー表示回数
  upsellClicked: number;   // アップセルCTAクリック数
  upsellTotalYen: number;  // アップセルで追加された推定金額（円）
  sessionStart: string;    // ISO date of first recording
}

const STORAGE_KEY = "flows_ai_stats_v1";

function zeroStats(): AiStats {
  return {
    chatCount: 0,
    upsellShown: 0,
    upsellClicked: 0,
    upsellTotalYen: 0,
    sessionStart: new Date().toISOString(),
  };
}

function readStorage(): AiStats {
  if (typeof window === "undefined") return zeroStats();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return zeroStats();
    return JSON.parse(raw) as AiStats;
  } catch {
    return zeroStats();
  }
}

function writeStorage(stats: AiStats): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Storage quota exceeded or private mode — fail silently
  }
}

/** localStorage から現在の AI 統計を取得する */
export function getAiStats(): AiStats {
  return readStorage();
}

/** AIコンシェルジュ接客数を 1 増やす */
export function incrementChatCount(): void {
  const stats = readStorage();
  writeStorage({ ...stats, chatCount: stats.chatCount + 1 });
}

/** アップセルバナー表示回数を 1 増やす */
export function recordUpsellShown(): void {
  const stats = readStorage();
  writeStorage({ ...stats, upsellShown: stats.upsellShown + 1 });
}

/** アップセル CTA クリックを記録し、追加金額を合計に加える */
export function recordUpsellClick(itemPrice: number): void {
  const stats = readStorage();
  writeStorage({
    ...stats,
    upsellClicked: stats.upsellClicked + 1,
    upsellTotalYen: stats.upsellTotalYen + itemPrice,
  });
}

/** 全統計をゼロにリセットする */
export function resetAiStats(): void {
  if (typeof window === "undefined") return;
  writeStorage(zeroStats());
}
