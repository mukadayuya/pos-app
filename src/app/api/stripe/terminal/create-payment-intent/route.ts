// Stripe Terminal PaymentIntent 作成（Phase 4-⑮）
// レジ画面から呼び出し、カードリーダーに送るPaymentIntentを事前に作る。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";

interface Body {
  amount: number;         // 税込金額（円）
  description?: string;   // 明細（"レジ会計 #12345"）
  metadata?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "amount required" }, { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(body.amount),
      currency: "jpy",
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      description: body.description,
      metadata: body.metadata ?? {},
    });
    return NextResponse.json({ id: intent.id, client_secret: intent.client_secret, status: intent.status });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
