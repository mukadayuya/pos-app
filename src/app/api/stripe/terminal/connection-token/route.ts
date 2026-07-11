// Stripe Terminal Connection Token（Phase 4-⑮）
// カードリーダー(WisePOS E / Tap to Pay)接続用の一時的なトークンを発行する。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";

export async function POST() {
  try {
    const stripe = getStripeClient();
    const connectionToken = await stripe.terminal.connectionTokens.create();
    return NextResponse.json({ secret: connectionToken.secret });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
