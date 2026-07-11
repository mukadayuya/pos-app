// Stripe Webhook（Phase 5 課金）
// customer.subscription.* / checkout.session.completed をハンドリングして
// subscriptions テーブルに同期する。
//
// Vercel環境変数: STRIPE_WEBHOOK_SECRET
// Stripe Dashboard で以下イベントを購読:
//   - checkout.session.completed
//   - customer.subscription.created
//   - customer.subscription.updated
//   - customer.subscription.deleted

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase_admin";

async function upsertSubscription(
  subscription: Stripe.Subscription,
  fallbackStoreId?: string,
  fallbackPlanId?: string,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const storeId = subscription.metadata?.store_id ?? fallbackStoreId;
  if (!storeId) {
    console.warn("[stripe webhook] subscription missing store_id metadata", subscription.id);
    return;
  }
  const planId = subscription.metadata?.plan_id ?? fallbackPlanId ?? "basic";
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

  // current_period_end is Unix seconds
  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const trialEnd = subscription.trial_end;

  const payload = {
    store_id: storeId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    plan_id: planId,
    status: subscription.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    trial_end: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  // upsert by store_id (UNIQUE)
  const { data: existing } = await sb
    .from("subscriptions")
    .select("id")
    .eq("store_id", storeId)
    .maybeSingle();

  if (existing) {
    await sb.from("subscriptions").update(payload).eq("id", existing.id);
  } else {
    await sb.from("subscriptions").insert(payload);
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const rawBody = await req.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscription(
            sub,
            session.metadata?.store_id ?? undefined,
            session.metadata?.plan_id ?? undefined,
          );
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub);
        break;
      }
      default:
        // 未処理イベントは無視（HTTP 200 で ACK）
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
