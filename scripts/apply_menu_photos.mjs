// メニュー写真を、作者表示のいらない写真（CC0・パブリックドメイン）に入れ替える（2026-10-22 向田さん承認）
//
// 使い方（既定は「表示だけ」で何も変えない）:
//   node scripts/apply_menu_photos.mjs scripts/menu_photo_plan_20261022.json . [--download] [--apply]
//   --download: 計画の Commons 写真（960px）を public/menu-photos/<store>/ に保存（ライセンスが CC0/PD でなければ中止）
//   --apply:    menus.image_url の欄だけを書き換える（DELETE/INSERT はしない）。変更前の値をバックアップJSONに保存
//   ※ 写真ファイルを公開（デプロイ）してから --apply すること（先にやるとデモの写真が一時的に出なくなる）
//   ※ 笑路は .env.local（NEXT_PUBLIC_STORE_ID=waraji の設定）、ABC は .env.local.abc（ABC用 Supabase の設定）を読む
//   ※ setup_waraji_menu.mjs / setup_yakitori_abc_menu.mjs を再実行すると写真が元に戻るので、そのあとこれも再実行する
//
// 計画JSON: [{ "store": "waraji"|"abc", "item": "<品名>", "file": "<Commonsファイル名>"|null, "slug": "<保存名>" }]
//   file が null の品は image_url を空にする（アプリは品の絵文字を表示する）
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const [planPath, wt, ...flags] = process.argv.slice(2);
const DOWNLOAD = flags.includes("--download");
const APPLY = flags.includes("--apply");
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const UA = { "User-Agent": "pos-app-photo-swap/1.0 (owner-approved menu photo update)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STORES = {
  waraji: { id: "a1c2b3d4-e5f6-4789-abcd-ef1234567890", envFile: ".env.local" },
  abc: { id: "6f0842d5-7fe6-4278-818c-86e8a8731130", envFile: ".env.local.abc" },
};

function env(file) {
  const e = {};
  for (const line of readFileSync(join(wt, file), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) e[m[1]] = m[2].trim();
  }
  return e;
}

async function getJson(url) {
  for (let a = 1; a <= 5; a++) {
    const res = await fetch(url, { headers: UA });
    const text = await res.text();
    if (res.ok) { try { return JSON.parse(text); } catch {} }
    await sleep(30000 * a);
  }
  throw new Error("Commons API kept failing: " + url);
}

async function verifyAndUrl(file) {
  const p = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", prop: "imageinfo",
    iiprop: "extmetadata|url", iiurlwidth: "960", iiextmetadatafilter: "LicenseShortName", titles: "File:" + file,
  });
  const j = await getJson("https://commons.wikimedia.org/w/api.php?" + p);
  const ii = j.query.pages[0].imageinfo?.[0];
  const lic = ii?.extmetadata?.LicenseShortName?.value ?? "";
  if (!/^(CC0|Public domain)/i.test(lic)) throw new Error(`${file}: license is "${lic}", not CC0/PD — refusing`);
  return ii.thumburl ?? ii.url;
}

const changes = [];
for (const s of Object.keys(STORES)) {
  const rows = plan.filter((p) => p.store === s);
  if (!rows.length) continue;
  const e = env(STORES[s].envFile);
  const key = e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const base = `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
  const auth = { apikey: key, Authorization: `Bearer ${key}` };
  const live = await (await fetch(`${base}/menus?store_id=eq.${STORES[s].id}&select=id,name,image_url`, { headers: auth })).json();
  for (const r of rows) {
    const hits = live.filter((m) => m.name === r.item);
    if (hits.length !== 1) throw new Error(`${s}: "${r.item}" matched ${hits.length} rows — fix the plan`);
    const target = r.file ? `/menu-photos/${s}/${r.slug}.jpg` : null;
    changes.push({ store: s, id: hits[0].id, item: r.item, from: hits[0].image_url, to: target, file: r.file, base, auth });
  }
}

for (const c of changes) console.log(`${c.store}\t${c.item}\t${c.file ?? "(emoji)"}\t-> ${c.to ?? "null"}`);
console.log(`${changes.length} rows planned. download=${DOWNLOAD} apply=${APPLY}`);

if (DOWNLOAD) {
  const done = new Set();
  for (const c of changes.filter((c) => c.file)) {
    const out = join(wt, "public", c.to);
    if (done.has(out) || existsSync(out)) { done.add(out); continue; }
    const url = await verifyAndUrl(c.file);
    await sleep(1500);
    let buf;
    for (let a = 1; a <= 5; a++) {
      const res = await fetch(url, { headers: UA });
      if (res.ok) { buf = Buffer.from(await res.arrayBuffer()); break; }
      await sleep(30000 * a);
    }
    if (!buf) throw new Error("download failed: " + c.file);
    mkdirSync(join(wt, "public", "menu-photos", c.store), { recursive: true });
    writeFileSync(out, buf);
    done.add(out);
    console.log("saved", c.to, buf.length, "bytes");
    await sleep(3000);
  }
}

if (APPLY) {
  const backup = changes.map(({ store, id, item, from }) => ({ store, id, item, image_url: from }));
  const bpath = join(wt, `menu-photos-backup-${Date.now()}.json`);
  writeFileSync(bpath, JSON.stringify(backup, null, 1));
  console.log("backup of old image_url values:", bpath);
  for (const c of changes) {
    if (c.to && !existsSync(join(wt, "public", c.to))) throw new Error("missing local file " + c.to);
    const res = await fetch(`${c.base}/menus?id=eq.${c.id}`, {
      method: "PATCH",
      headers: { ...c.auth, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ image_url: c.to }),
    });
    if (!res.ok) throw new Error(`PATCH ${c.item} -> ${res.status} ${await res.text()}`);
  }
  console.log("applied", changes.length, "rows");
}
