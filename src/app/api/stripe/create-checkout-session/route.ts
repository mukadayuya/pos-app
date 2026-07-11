// SaaS 契約開始 Checkout Session（Phase 5 課金）
// クライアントから plan_id を受けて Stripe Checkout URL を返す。
// success_url → /account, cancel_url → /pricing

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStripeClient, priceIdForPlan } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase_admin";

interface Body {
  planId: "basic" | "standard" | "pro";
  storeId: string;         // NEXT_PUBLIC_STORE_ID から送る
  storeName?: string;
  email?: string;          // 契約者メール
}

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  if (!body.planId || !body.storeId) {
    return NextResponse.json({ error: "planId and storeId required" }, { status: 400 });
  }

  const priceId = priceIdForPlan(body.planId);
  if (!priceId) {
    return NextResponse.json({ error: `Price ID not configured for plan '${body.planId}'` }, { status: 400 });
  }

  const stripe = getStripeClient();
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;

  // 既存Subscription確認
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("store_id", body.storeId)
    .maybeSingle();

  let customerId: string | undefined = existing?.stripe_customer_id;

  // 新規契約時は Customer を作成
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: body.email,
      name:  body.storeName ?? undefined,
      metadata: { store_id: body.storeId, plan_id: body.planId },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: customerId,
    success_url: `${origin}/account?checkout=success`,
    cancel_url:  `${origin}/pricing?checkout=cancel`,
    metadata: { store_id: body.storeId, plan_id: body.planId },
    subscription_data: {
      metadata: { store_id: body.storeId, plan_id: body.planId },
    },
    // クーポン適用可能に
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
