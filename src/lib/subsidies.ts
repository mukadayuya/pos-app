// 補助金・助成金の判定ロジック（Phase 3-⑦）
// 店舗プロフィールと売上データから利用可能な補助金を自動抽出する。

import { supabase } from "./supabase";
import { STORE_ID } from "./db";

export type SubsidyCategory = "national" | "prefecture" | "city";

export interface SubsidyConditions {
  industries?: string[];
  employee_max?: number;
  employee_min?: number;
  annual_revenue_max?: number;
  capital_max?: number;
  prefecture?: string;
  requires?: string[];
}

export interface Subsidy {
  id: string;
  name: string;
  short_name: string | null;
  provider: string;
  category: SubsidyCategory;
  max_amount: number;
  typical_amount: number | null;
  deadline_date: string | null;
  conditions_json: SubsidyConditions;
  description: string;
  benefits: string | null;
  application_url: string | null;
  priority: number;
  created_at?: string;
  updated_at?: string;
}

/** 直近30日以内に登録された補助金かどうか（Phase 3-⑨ 新制度アラート） */
export function isNewSubsidy(subsidy: Subsidy): boolean {
  if (!subsidy.created_at) return false;
  const days = (Date.now() - new Date(subsidy.created_at).getTime()) / (24 * 60 * 60 * 1000);
  return days <= 30;
}

// 店舗プロフィール（判定に使うマスター情報）
export interface StoreProfile {
  industry: string;              // 業種（デフォルト "飲食業"）
  employee_count: number;        // 従業員数
  capital?: number | null;       // 資本金（万円）
  prefecture?: string | null;    // 都道府県
  annual_revenue?: number | null; // 年商（自動計算）
  updated_at?: string;
}

export const DEFAULT_PROFILE: StoreProfile = {
  industry: "飲食業",
  employee_count: 5,
  capital: null,
  prefecture: null,
  annual_revenue: null,
};

const PROFILE_KEY = `store_profile_${STORE_ID}`;

// ─── プロフィール保存・取得 ─────────────────────────────────
export async function fetchStoreProfile(): Promise<StoreProfile> {
  if (!supabase) return DEFAULT_PROFILE;
  const { data } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", PROFILE_KEY)
    .maybeSingle();
  if (!data?.value) return DEFAULT_PROFILE;
  return { ...DEFAULT_PROFILE, ...(data.value as Partial<StoreProfile>) };
}

export async function saveStoreProfile(profile: StoreProfile): Promise<void> {
  if (!supabase) return;
  const ts = new Date().toISOString();
  const payload = { ...profile, updated_at: ts };
  const { data: updated, error: updateErr } = await supabase
    .from("store_settings")
    .update({ value: payload, updated_at: ts })
    .eq("key", PROFILE_KEY)
    .select("key");
  if (updateErr) throw updateErr;
  if (!updated || updated.length === 0) {
    const { error: insertErr } = await supabase
      .from("store_settings")
      .insert({ key: PROFILE_KEY, value: payload, updated_at: ts });
    if (insertErr) throw insertErr;
  }
}

// ─── 年商の自動計算（過去365日分の売上合計） ────────────────
export async function computeAnnualRevenue(): Promise<number> {
  if (!supabase) return 0;
  const to = new Date();
  const from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);
  const { data } = await supabase
    .from("sales")
    .select("total_amount")
    .eq("store_id", STORE_ID)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString());
  return (data ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0);
}

// ─── 補助金一覧の取得 ────────────────────────────────────
export async function fetchAllSubsidies(): Promise<Subsidy[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("subsidies")
    .select("id, name, short_name, provider, category, max_amount, typical_amount, deadline_date, conditions_json, description, benefits, application_url, priority, created_at, updated_at")
    .eq("is_active", true)
    .order("priority", { ascending: false });
  if (error) return [];
  return (data ?? []) as Subsidy[];
}

// ─── 判定ロジック ───────────────────────────────────────
export interface Eligibility {
  subsidy: Subsidy;
  eligible: boolean;
  reasons: string[];      // 適合理由（利用可能な場合）
  blockers: string[];     // 不適合理由（利用不可の場合）
}

export function evaluateEligibility(subsidy: Subsidy, profile: StoreProfile): Eligibility {
  const c = subsidy.conditions_json ?? {};
  const reasons: string[] = [];
  const blockers: string[] = [];

  // 業種
  if (c.industries && c.industries.length > 0) {
    if (c.industries.includes(profile.industry)) {
      reasons.push(`業種「${profile.industry}」対象`);
    } else {
      blockers.push(`業種「${profile.industry}」は対象外（対象: ${c.industries.join("・")}）`);
    }
  }

  // 従業員数
  if (typeof c.employee_max === "number") {
    if (profile.employee_count <= c.employee_max) {
      reasons.push(`従業員${profile.employee_count}人 (上限${c.employee_max}人)`);
    } else {
      blockers.push(`従業員${profile.employee_count}人 > 上限${c.employee_max}人`);
    }
  }
  if (typeof c.employee_min === "number") {
    if (profile.employee_count >= c.employee_min) {
      reasons.push(`従業員${profile.employee_count}人 (最低${c.employee_min}人)`);
    } else {
      blockers.push(`従業員${profile.employee_count}人 < 最低${c.employee_min}人`);
    }
  }

  // 年商
  if (typeof c.annual_revenue_max === "number" && typeof profile.annual_revenue === "number") {
    if (profile.annual_revenue <= c.annual_revenue_max) {
      reasons.push(`年商¥${profile.annual_revenue.toLocaleString()} (上限¥${c.annual_revenue_max.toLocaleString()})`);
    } else {
      blockers.push(`年商¥${profile.annual_revenue.toLocaleString()} > 上限¥${c.annual_revenue_max.toLocaleString()}`);
    }
  }

  // 資本金
  if (typeof c.capital_max === "number" && typeof profile.capital === "number" && profile.capital > 0) {
    if (profile.capital <= c.capital_max) {
      reasons.push(`資本金${profile.capital}万円 (上限${c.capital_max}万円)`);
    } else {
      blockers.push(`資本金${profile.capital}万円 > 上限${c.capital_max}万円`);
    }
  }

  // 都道府県（地方補助金の場合）
  if (c.prefecture && profile.prefecture) {
    if (c.prefecture === profile.prefecture) {
      reasons.push(`${c.prefecture}対象`);
    } else {
      blockers.push(`${c.prefecture}限定（現在: ${profile.prefecture}）`);
    }
  }

  return {
    subsidy,
    eligible: blockers.length === 0,
    reasons,
    blockers,
  };
}

/** プロフィールから利用可能な補助金だけを抽出（優先度順） */
export async function findAvailableSubsidies(profile: StoreProfile): Promise<Eligibility[]> {
  const all = await fetchAllSubsidies();
  return all
    .map(s => evaluateEligibility(s, profile))
    .sort((a, b) => {
      // eligible が先、次に priority 降順、次に max_amount 降順
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      if (a.subsidy.priority !== b.subsidy.priority) return b.subsidy.priority - a.subsidy.priority;
      return b.subsidy.max_amount - a.subsidy.max_amount;
    });
}

// ─── 締切カウントダウン用 ────────────────────────────────
export function daysUntilDeadline(deadlineIso: string | null): number | null {
  if (!deadlineIso) return null;
  const days = Math.floor((new Date(deadlineIso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return days;
}
