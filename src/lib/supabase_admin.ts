// Supabase service_role クライアント（サーバー専用）
// RLSをバイパスして書き込むため、絶対に "use client" 側から import しない。
// CloudPRNT のようにプリンター（未認証機器）と通信するRoute Handlerでのみ使用する。

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isAdminConfigured = !!(url && key);

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!isAdminConfigured) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY が未設定です。Vercelの環境変数に追加してください。",
    );
  }
  if (!cached) {
    cached = createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
