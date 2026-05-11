// stress-test.mjs — Concurrent 15-language stress test for /api/gemini
// Usage: node scripts/stress-test.mjs
//        BASE_URL=https://your-deploy.vercel.app node scripts/stress-test.mjs

import { performance } from "perf_hooks";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const LANGUAGES = [
  { lang: "ja", message: "おすすめは何ですか？" },
  { lang: "en", message: "What do you recommend?" },
  { lang: "zh", message: "推荐什么？" },
  { lang: "ko", message: "추천해주세요" },
  { lang: "fr", message: "Que recommandez-vous?" },
  { lang: "de", message: "Was empfehlen Sie?" },
  { lang: "es", message: "¿Qué recomienda?" },
  { lang: "it", message: "Cosa consiglia?" },
  { lang: "pt", message: "O que você recomenda?" },
  { lang: "ru", message: "Что вы рекомендуете?" },
  { lang: "ar", message: "ماذا توصي؟" },
  { lang: "hi", message: "क्या सुझाव है?" },
  { lang: "th", message: "คุณแนะนำอะไร?" },
  { lang: "vi", message: "Bạn đề xuất gì?" },
  { lang: "id", message: "Apa yang Anda rekomendasikan?" },
];

/**
 * @param {string} lang
 * @param {string} message
 * @returns {Promise<{ lang: string, ok: boolean, durationMs: number, preview?: string, error?: string }>}
 */
async function testOne(lang, message) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  const start = performance.now();

  try {
    const res = await fetch(`${BASE_URL}/api/gemini`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "chat",
        message,
        conversationHistory: [],
      }),
      signal: controller.signal,
    });

    const durationMs = Math.round(performance.now() - start);
    const json = await res.json();

    if (!res.ok || !json.ok) {
      return {
        lang,
        ok: false,
        durationMs,
        error: json.error ?? `HTTP ${res.status}`,
      };
    }

    return {
      lang,
      ok: true,
      durationMs,
      preview: String(json.result ?? "").slice(0, 30),
    };
  } catch (e) {
    const durationMs = Math.round(performance.now() - start);
    const isTimeout = e.name === "AbortError";
    return {
      lang,
      ok: false,
      durationMs,
      error: isTimeout ? "timeout (15s)" : e.message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  console.log(`\n🌐 Concurrent stress test: 15 languages`);
  console.log(`   Target: ${BASE_URL}/api/gemini\n`);

  const settled = await Promise.allSettled(
    LANGUAGES.map(({ lang, message }) => testOne(lang, message))
  );

  const results = settled.map((s) =>
    s.status === "fulfilled"
      ? s.value
      : { lang: "?", ok: false, durationMs: 0, error: s.reason?.message ?? "unknown" }
  );

  // ── Table header ──────────────────────────────────────────────
  const COL = { lang: 4, status: 6, ms: 8, preview: 32 };
  const line = (lang, status, ms, preview) =>
    `  ${lang.padEnd(COL.lang)} ${status.padEnd(COL.status)} ${String(ms).padStart(COL.ms - 2).padEnd(COL.ms)} ${preview}`;

  console.log(line("LANG", "STATUS", "  MS", "RESPONSE (first 30 chars)"));
  console.log("  " + "─".repeat(COL.lang + COL.status + COL.ms + COL.preview + 3));

  for (const r of results) {
    const icon   = r.ok ? "✅" : "❌";
    const status = `${icon} ${r.ok ? "ok" : "fail"}`;
    const ms     = r.durationMs;
    const detail = r.ok ? (r.preview ?? "") : (r.error ?? "");
    console.log(line(r.lang, status, ms, detail));
  }

  console.log("");

  // ── Summary ───────────────────────────────────────────────────
  const successes = results.filter((r) => r.ok);
  const failures  = results.filter((r) => !r.ok);
  const avgMs     = successes.length
    ? Math.round(successes.reduce((s, r) => s + r.durationMs, 0) / successes.length)
    : 0;
  const maxMs     = results.reduce((m, r) => Math.max(m, r.durationMs), 0);

  console.log(`  Passed : ${successes.length} / ${results.length}`);
  console.log(`  Failed : ${failures.length}`);
  if (successes.length) console.log(`  Avg ms : ${avgMs}`);
  console.log(`  Max ms : ${maxMs}`);

  if (failures.length) {
    console.log("\n  Failed languages:");
    for (const r of failures) {
      console.log(`    ❌ ${r.lang}: ${r.error}`);
    }
  }

  console.log("");
  process.exit(failures.length > 0 ? 1 : 0);
}

main();
