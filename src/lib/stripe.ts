// Stripe SDK 初期化（サーバー専用）

import Stripe from "stripe";

let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  cachedClient = new Stripe(key, { apiVersion: "2025-06-30.basil" });
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
