#!/usr/bin/env node
// 写真クレジット台帳の自動生成スクリプト（依存パッケージなし）
//
// やること:
//   1. scripts/setup_*_menu.mjs を「テキストとして」読み、Wikimedia Commons の写真ファイル名を全部集める
//      （scripts/photo_credits_extra.txt に書いたファイル名も足す。setup スクリプトがこのブランチに無いデモ用）
//      （※ これらのスクリプトを import / 実行してはいけない。実行するとDBのメニューが消えて入れ直される）
//   2. Commons API に問い合わせて 作者・ライセンス・元ページURL を取得
//   3. src/data/photoCredits.json に書き出す
//
// 使い方:  node scripts/gen_photo_credits.mjs
//   （この Mac では /usr/local/bin/node scripts/gen_photo_credits.mjs ）
//
// 注意: Wikimedia は短時間の連続アクセスに厳しい（HTTP 429）。リクエスト間隔 1.5 秒以上＋リトライ付き。

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(SCRIPTS_DIR, "..", "src", "data", "photoCredits.json");
const EXTRA_LIST = path.join(SCRIPTS_DIR, "photo_credits_extra.txt");

const API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "pos-app-photo-credits/1.0 (contact: project owner)";
const BATCH_SIZE = 40;
const MIN_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 6;

// ─── ファイル名の取り出し（src/lib/photoCredits.ts の commonsFileName と同じ規則） ─────────

/** URL → Commons のファイル名（アンダースコア区切り）。Commons 以外は null。 */
export function commonsFileName(url) {
  if (typeof url !== "string") return null;
  let u;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  let raw = null;

  if (host === "upload.wikimedia.org") {
    const m = u.pathname.match(/^\/wikipedia\/commons\/(.+)$/);
    if (!m) return null;
    const segs = m[1].split("/").filter(Boolean);
    if (segs[0] === "thumb") {
      // thumb/<a>/<ab>/<File>/<960px-File>  → 後ろから2番目
      raw = segs.length >= 2 ? segs[segs.length - 2] : null;
    } else {
      raw = segs[segs.length - 1] ?? null;
    }
  } else if (host === "commons.wikimedia.org") {
    const fp = u.pathname.match(/^\/wiki\/Special:(?:FilePath|Redirect\/file)\/(.+)$/i);
    const fl = u.pathname.match(/^\/wiki\/File:(.+)$/i);
    raw = fp ? fp[1] : fl ? fl[1] : null;
  } else {
    return null;
  }

  if (!raw) return null;
  let name = raw;
  try {
    name = decodeURIComponent(raw);
  } catch {
    // 壊れたエンコードはそのまま使う（捨てない）
  }
  name = name.replace(/ /g, "_").trim();
  return name || null;
}

/** スクリプトのソーステキストから Commons ファイル名を全部集める（重複なし・出現順） */
export function extractCommonsFileNames(text) {
  const found = [];
  const push = (n) => {
    if (n && !found.includes(n)) found.push(n);
  };

  // 1) 完全なURL（upload.wikimedia.org / commons.wikimedia.org）。テンプレート変数 ${...} を含むものは除く
  for (const m of text.matchAll(/https:\/\/(?:upload|commons)\.wikimedia\.org\/[^"'`\s)]+/g)) {
    if (m[0].includes("${")) continue;
    push(commonsFileName(m[0]));
  }

  // 2) FP("...") 形式（引数は URLエンコード済みのファイル名）
  for (const m of text.matchAll(/\bFP\(\s*(["'])(.+?)\1\s*\)/g)) {
    push(commonsFileName(`https://commons.wikimedia.org/wiki/Special:FilePath/${m[2]}`));
  }
  return found;
}

// ─── HTML → プレーンテキスト ─────────────────────────────────────

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©" };

export function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : all;
      }
      return ENTITIES[e.toLowerCase()] ?? all;
    })
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "") // ゼロ幅文字（作者名の頭に混じっていることがある）
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Commons API ─────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequestAt = 0;

async function politeFetchJson(url) {
  let lastErr = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    let backoff = Math.min(60000, 5000 * 2 ** (attempt - 1));
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
      const retryAfter = Number(res.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) backoff = Math.max(backoff, retryAfter * 1000);
      const body = await res.text();

      if (res.status === 429 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
      } else {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
          lastErr = `JSONではない応答（HTTP ${res.status}）: ${body.slice(0, 80).replace(/\s+/g, " ")}`;
        }
        if (json) {
          if (json.error) lastErr = `APIエラー ${json.error.code ?? ""}: ${json.error.info ?? ""}`;
          else if (res.ok) return json;
          else lastErr = `HTTP ${res.status}`;
        }
      }
    } catch (e) {
      lastErr = `通信エラー: ${e?.message ?? e}`;
    }
    if (attempt < MAX_ATTEMPTS) {
      console.warn(`  ... ${lastErr} → ${Math.round(backoff / 1000)}秒待って再試行 (${attempt}/${MAX_ATTEMPTS - 1})`);
      await sleep(backoff);
    }
  }
  throw new Error(`Commons API の取得に失敗: ${lastErr}`);
}

function buildApiUrl(fileNames) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "imageinfo",
    iiprop: "extmetadata|url",
    iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|Attribution|AttributionRequired|Credit",
    iiextmetadatalanguage: "en",
    titles: fileNames.map((n) => `File:${n}`).join("|"),
  });
  return `${API}?${params.toString()}`;
}

/** 1バッチ分の応答を {元のファイル名 → entry | null(Commonsに存在しない)} に変換 */
function parseBatch(fileNames, json) {
  const q = json.query ?? {};
  const mapFrom = (list) => new Map((list ?? []).map((x) => [x.from, x.to]));
  const normalized = mapFrom(q.normalized);
  const redirects = mapFrom(q.redirects);
  const pages = new Map((q.pages ?? []).map((p) => [p.title, p]));

  const result = new Map();
  for (const name of fileNames) {
    let title = `File:${name}`;
    title = normalized.get(title) ?? title;
    title = redirects.get(title) ?? title;
    const page = pages.get(title);
    const info = page && !page.missing && !page.invalid ? page.imageinfo?.[0] : null;
    if (!info) {
      result.set(name, null);
      continue;
    }
    const meta = info.extmetadata ?? {};
    const v = (k) => meta[k]?.value;

    const attribution = stripHtml(v("Attribution"));
    const artist = stripHtml(v("Artist"));
    const credit = stripHtml(v("Credit"));
    const license = stripHtml(v("LicenseShortName"));
    const licenseUrl = (v("LicenseUrl") ?? "").trim();

    result.set(name, {
      author: attribution || artist || credit || "",
      license: license || "",
      licenseUrl,
      sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/File:${name}`,
      attributionRequired: decideAttributionRequired(license, v("AttributionRequired")),
    });
  }
  return result;
}

// 表示義務のない（クレジット不要の）ライセンス
const NO_ATTRIBUTION_LICENSE = /^(cc0|cc[- ]?zero|public domain|pd\b|pdm|no known copyright)/i;

/** Commons の AttributionRequired を尊重しつつ、迷ったら「必要」に倒す */
function decideAttributionRequired(license, flag) {
  const noNeedByLicense = NO_ATTRIBUTION_LICENSE.test(license ?? "");
  if (noNeedByLicense) return false;
  if (String(flag).toLowerCase() === "false" && license) {
    // ライセンスが CC BY 系なのに flag が false の矛盾は「必要」を優先
    return /^cc[- ]by|gfdl|free art/i.test(license);
  }
  return true;
}

// ─── メイン ─────────────────────────────────────────────

async function main() {
  const scriptFiles = readdirSync(SCRIPTS_DIR)
    .filter((f) => /^setup_.*_menu\.mjs$/.test(f))
    .sort();
  const names = new Set();
  for (const f of scriptFiles) {
    const text = readFileSync(path.join(SCRIPTS_DIR, f), "utf8"); // テキストとして読むだけ
    const list = extractCommonsFileNames(text);
    console.log(`${f}: Commons写真 ${list.length} 枚`);
    list.forEach((n) => names.add(n));
  }
  // このブランチに setup スクリプトが無いデモ（甚句・まちかんてぃ～など）の写真は、ファイル名の一覧で補う
  if (existsSync(EXTRA_LIST)) {
    const extra = readFileSync(EXTRA_LIST, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    console.log(`${path.basename(EXTRA_LIST)}: Commons写真 ${extra.length} 枚`);
    extra.forEach((n) => names.add(n));
  }
  const all = [...names].sort();
  console.log(`ユニークなファイル数: ${all.length}`);
  if (all.length === 0) throw new Error("Commons写真が1枚も見つかりません");

  const files = {};
  const missing = [];
  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE);
    console.log(`Commons API: ${i + 1}-${i + batch.length} / ${all.length}`);
    const json = await politeFetchJson(buildApiUrl(batch));
    for (const [name, entry] of parseBatch(batch, json)) {
      if (entry) files[name] = entry;
      else missing.push(name);
    }
  }

  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

  // 中身が前回と同じなら generatedAt を変えない（再実行しても差分が出ない）
  let generatedAt = new Date().toISOString();
  if (existsSync(OUT_FILE)) {
    try {
      const prev = JSON.parse(readFileSync(OUT_FILE, "utf8"));
      if (JSON.stringify(prev.files) === JSON.stringify(sorted) && prev.generatedAt) generatedAt = prev.generatedAt;
    } catch {
      /* 壊れていたら作り直す */
    }
  }

  mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify({ generatedAt, files: sorted }, null, 2) + "\n");

  const entries = Object.values(sorted);
  const need = entries.filter((e) => e.attributionRequired).length;
  console.log(`書き出し: ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`  ${entries.length} 枚（クレジット表示が必要 ${need} / 不要 ${entries.length - need}）`);
  const noAuthor = Object.entries(sorted).filter(([, e]) => !e.author).map(([n]) => n);
  if (noAuthor.length) console.warn(`WARNING 作者が取れなかった写真 ${noAuthor.length} 枚（元ページへのリンクで補う）:\n  ${noAuthor.join("\n  ")}`);
  if (missing.length) {
    console.warn(`WARNING Commons に存在しない写真 ${missing.length} 枚（削除/改名の可能性。台帳に入っていません）:\n  ${missing.join("\n  ")}`);
  }
}

// import されたとき（テスト等）は何も実行しない
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
