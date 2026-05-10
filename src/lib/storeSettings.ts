// 店舗機能設定
// fetchIsTakeoutEnabled: localStorage を一切参照しない。DB 値のみを権威とする。

import { supabase } from "./supabase";

const LS_KEY = "pos_store_settings";

export interface StoreSettings {
  isTakeoutEnabled: boolean;
}

export interface EmojiSettings {
  isEmojiEnabled: boolean;
  availableEmojis: string[];
}

export const DEFAULT_EMOJIS: string[] = [
  "🍔","🍕","🍜","🍣","🍱","🥗","🍗","🍟",
  "🍰","🍦","🍮","🎂","☕","🥤","🍺","🍵",
  "🫖","🍊","🧃","🍶","🥩","🍛","🍝","🫕",
];

// ─── localStorage ヘルパー（保存専用。フェッチでは使わない）──────

export function loadStoreSettings(): StoreSettings {
  if (typeof window === "undefined") return { isTakeoutEnabled: true };
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed: Partial<StoreSettings> = raw ? JSON.parse(raw) : {};
    return { isTakeoutEnabled: true, ...parsed };
  } catch {
    return { isTakeoutEnabled: true };
  }
}

export function saveStoreSettings(patch: Partial<StoreSettings>): void {
  if (typeof window === "undefined") return;
  const current = loadStoreSettings();
  localStorage.setItem(LS_KEY, JSON.stringify({ ...current, ...patch }));
}

// ─── フェッチ（localStorage を完全に排除したシンプル実装）────────

/**
 * DB から is_takeout_enabled を取得する。
 *
 * ルール（localStorage には一切触れない）:
 *   - DB が明示的に false を返した → false
 *   - DB が true を返した          → true
 *   - エラー / 行なし / 例外        → true（デフォルト）
 *   - Supabase 未設定              → true（デフォルト）
 *
 * false になるのは「DB が明示的に false を持つ場合のみ」に限定する。
 */
export async function fetchIsTakeoutEnabled(): Promise<boolean> {
  if (!supabase) {
    return true;
  }

  try {
    const { data, error } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "is_takeout_enabled")
      .maybeSingle();

    if (error) {
      // テーブル未作成・権限エラーなど
      // (コメントアウト: return loadStoreSettings().isTakeoutEnabled;)
      console.warn("[storeSettings] DB エラー → true を返す:", error.code, error.message);
      return true;
    }

    if (!data) return true;

    const rawValue = data.value;
    return rawValue !== false;

  } catch (e) {
    // 予期せぬ例外
    // (コメントアウト: return loadStoreSettings().isTakeoutEnabled;)
    console.warn("[storeSettings] 例外 → true を返す:", e);
    return true;
  }
}

// ─── DB 書き込みヘルパー ─────────────────────────────────────────
//
// upsert(onConflict: "key") は key カラムに UNIQUE 制約がある場合のみ動作する。
// Supabase Dashboard でテーブルを再作成した場合、id UUID PRIMARY KEY が自動付与され
// key はただのカラム（UNIQUE なし）になるため upsert が失敗する。
//
// このヘルパーは：
//   1. まず UPDATE を試みる（key カラムは UNIQUE 不要）
//   2. 更新対象行が 0 件ならば INSERT する
// という2段階で、スキーマに依存せず確実に書き込む。
//
async function dbUpsertSetting(key: string, value: unknown): Promise<void> {
  if (!supabase) return;

  const ts = new Date().toISOString();

  // Step 1: 既存行を UPDATE
  const { data: updated, error: updateErr } = await supabase
    .from("store_settings")
    .update({ value, updated_at: ts })
    .eq("key", key)
    .select("key");

  if (updateErr) {
    throw new Error(`UPDATE失敗 [${updateErr.code}] ${updateErr.message}`);
  }

  // Step 2: 0行しか更新されなかった → 行が存在しないので INSERT
  if (!updated || updated.length === 0) {
    const { error: insertErr } = await supabase
      .from("store_settings")
      .insert({ key, value, updated_at: ts });

    if (insertErr) {
      throw new Error(`INSERT失敗 [${insertErr.code}] ${insertErr.message}`);
    }

    return;
  }
}

/**
 * is_takeout_enabled を Supabase に保存する。
 * DB エラーは throw して呼び出し元がトーストで通知できるようにする。
 */
export async function persistIsTakeoutEnabled(value: boolean): Promise<void> {
  // localStorage は fetch パスでは参照されないが、将来の拡張のために維持
  saveStoreSettings({ isTakeoutEnabled: value });

  if (!supabase) {
    console.warn("[storeSettings] Supabase 未設定 — DB 保存をスキップ");
    return;
  }

  await dbUpsertSetting("is_takeout_enabled", value);
}

/**
 * DB から is_emoji_enabled と available_emojis を取得する。
 * エラー・行なし・Supabase未設定の場合はデフォルト値を返す。
 */
export async function fetchEmojiSettings(): Promise<EmojiSettings> {
  if (!supabase) return { isEmojiEnabled: true, availableEmojis: DEFAULT_EMOJIS };

  try {
    const { data, error } = await supabase
      .from("store_settings")
      .select("key, value")
      .in("key", ["is_emoji_enabled", "available_emojis"]);

    if (error || !data) return { isEmojiEnabled: true, availableEmojis: DEFAULT_EMOJIS };

    const map: Record<string, unknown> = {};
    for (const row of data) map[row.key as string] = row.value;

    const isEmojiEnabled = map["is_emoji_enabled"] !== false;
    const availableEmojis = Array.isArray(map["available_emojis"])
      ? (map["available_emojis"] as string[])
      : DEFAULT_EMOJIS;

    return { isEmojiEnabled, availableEmojis };
  } catch {
    return { isEmojiEnabled: true, availableEmojis: DEFAULT_EMOJIS };
  }
}

/**
 * is_emoji_enabled と available_emojis を Supabase に保存する。
 * DB エラーは throw して呼び出し元がトーストで通知できるようにする。
 */
export async function persistEmojiSettings(settings: EmojiSettings): Promise<void> {
  if (!supabase) return;

  await Promise.all([
    dbUpsertSetting("is_emoji_enabled",  settings.isEmojiEnabled),
    dbUpsertSetting("available_emojis",  settings.availableEmojis),
  ]);
}

// ─── 客層分析モード ──────────────────────────────────────────────
export type AnalysisMode = "SIMPLE" | "STATISTICAL";

export async function fetchAnalysisMode(): Promise<AnalysisMode> {
  if (!supabase) return "SIMPLE";
  try {
    const { data, error } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "analysis_mode")
      .maybeSingle();
    if (error || !data) return "SIMPLE";
    return data.value === "STATISTICAL" ? "STATISTICAL" : "SIMPLE";
  } catch {
    return "SIMPLE";
  }
}

export async function persistAnalysisMode(mode: AnalysisMode): Promise<void> {
  if (!supabase) return;
  await dbUpsertSetting("analysis_mode", mode);
}
