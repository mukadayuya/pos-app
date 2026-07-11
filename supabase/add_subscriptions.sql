-- SaaS 契約管理（Phase 5 課金）
-- Stripe Subscription との紐付け。1店舗=1契約。
-- Webhook で customer.subscription.* イベントを受けて同期。

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
  stripe_customer_id    TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  plan_id               TEXT NOT NULL,      -- 'basic' | 'standard' | 'pro'
  status                TEXT NOT NULL,      -- 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid'
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
  trial_end             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer
  ON subscriptions(stripe_customer_id);

-- RLS: 認証ユーザーは自店舗のみ閲覧
DROP POLICY IF EXISTS store_isolation ON subscriptions;
CREATE POLICY store_isolation ON subscriptions
  FOR ALL TO authenticated
  USING (store_id::text = current_store_id())
  WITH CHECK (store_id::text = current_store_id());

-- Webhook (service_role) は全レコード操作可能なため RLS bypass
