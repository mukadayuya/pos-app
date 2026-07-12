// Stripe SDK 初期化（サーバー専用）

import Stripe from "stripe";

let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  // apiVersion は @stripe/terminal-js が nested 依存として持つ古い stripe SDK 型
  // (2020-08-27) と TypeScript 上で衝突するため、後方互換保証されている "2020-08-27" に
  // 固定する。実際の API 呼び出しはこのバージョンでレスポンスを返すが Checkout /
  // Subscription / PaymentIntent は全て互換範囲内。
  cachedClient = new Stripe(key, { apiVersion: "2020-08-27" });
  return cachedClient;
}

// プランID → Stripe Price ID の対応表（環境変数で切替）
// Vercelに以下を設定:
//   STRIPE_PRICE_BASIC    = price_xxx
//   STRIPE_PRICE_STANDARD = price_xxx
//   STRIPE_PRICE_PRO      = price_xxx
export const PRICE_ID_MAP: Record<string, string | undefined> = {
  basic:    process.env.STRIPE_PRICE_BASIC,
  standard: process.env.STRIPE_PRICE_STANDARD,
  pro:      process.env.STRIPE_PRICE_PRO,
};

export function priceIdForPlan(planId: string): string | null {
  return PRICE_ID_MAP[planId] ?? null;
}
