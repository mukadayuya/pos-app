// Stripe Customer Portal Session（Phase 5 課金）
// 契約中の店舗が支払方法・請求書・解約を管理できる URL を発行。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase_admin";

interface Body {
  storeId: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  if (!body.storeId) {
    return NextResponse.json({ error: "storeId required" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: sub, error } = await sb
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("store_id", body.storeId)
    .single();

  if (error || !sub?.stripe_customer_id) {
    return NextResponse.json({ error: "No subscription found for this store" }, { status: 404 });
  }

  const stripe = getStripeClient();
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/account`,
  });

  return NextResponse.json({ url: session.url });
}
