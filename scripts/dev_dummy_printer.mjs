// ダミープリンター — Star mPOP の CloudPRNT ポーリング挙動を模擬
// 実機なしでレシート印刷フロー全体（レジ→キュー→CloudPRNT→印刷）を検証する。
//
// 使い方:
//   node scripts/dev_dummy_printer.mjs --mac 001122334455 --url http://localhost:3000
//   node scripts/dev_dummy_printer.mjs --mac 001122334455 --url https://shoten-pos.vercel.app
//   node scripts/dev_dummy_printer.mjs --mac 001122334455 --interval 3
//   PRINTER_ACCESS_TOKEN=xxxx node scripts/... （エンドポイントがトークン認証している場合）
//
// 事前準備: settings/printers 画面で同じMACを店舗に登録しておくこと。

import { argv, env, exit } from "node:process";

const args = Object.fromEntries(
  argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "true"]);
    return acc;
  }, []),
);

const MAC      = (args.mac || "0011223344AA").toUpperCase().replace(/[^0-9A-F]/g, "");
const BASE_URL = args.url || "http://localhost:3000";
const INTERVAL = Number(args.interval || 5) * 1000;
const TOKEN    = env.PRINTER_ACCESS_TOKEN || "";
const ENDPOINT = `${BASE_URL}/api/print/cloudprnt${TOKEN ? `?t=${encodeURIComponent(TOKEN)}` : ""}`;

if (MAC.length !== 12) {
  console.error("❌ --mac は 12桁の16進数で指定してください (例: --mac 0011223344AA)");
  exit(1);
}

console.log(`🖨️  ダミープリンター起動`);
console.log(`   MAC:      ${MAC.match(/.{2}/g).join(":")}`);
console.log(`   URL:      ${ENDPOINT}`);
console.log(`   間隔:     ${INTERVAL / 1000}秒`);
console.log(`   トークン: ${TOKEN ? "設定済み" : "なし"}`);
console.log(`\n   settings/printers 画面で同じMACを登録しておいてください。\n`);

// ─── ESC/POS 簡易デコーダ（人間可読な出力に変換）───────────────
const iconv = await import("iconv-lite").then(m => m.default).catch(() => null);
function decodeEscPos(bytes) {
  if (!iconv) return "(iconv-lite未インストール・生バイト列表示)\n" + Buffer.from(bytes).toString("hex");
  const out = [];
  let i = 0;
  let bold = false, big = false, align = "left";
  let buf = [];
  const flush = () => {
    if (buf.length) {
      const text = iconv.decode(Buffer.from(buf), "shift_jis");
      const pref = align === "center" ? "         " : align === "right" ? "                  " : "";
      out.push(pref + (bold ? "*" : "") + (big ? text.toUpperCase() : text) + (bold ? "*" : ""));
      buf = [];
    }
  };
  while (i < bytes.length) {
    const b = bytes[i];
    if (b === 0x1b) {
      // ESC ...
      const c = bytes[i + 1];
      if (c === 0x40) { flush(); i += 2; }                         // ESC @ init
      else if (c === 0x61) { flush(); align = bytes[i + 2] === 1 ? "center" : bytes[i + 2] === 2 ? "right" : "left"; i += 3; }
      else if (c === 0x45) { flush(); bold = !!bytes[i + 2]; i += 3; }
      else if (c === 0x70) { flush(); out.push("🔔 [ドロワーキック]"); i += 5; }
      else if (c === 0x64) { flush(); out.push(""); i += 3; }      // ESC d n = feed n lines
      else { i += 2; }
    } else if (b === 0x1d) {
      const c = bytes[i + 1];
      if (c === 0x21) { flush(); big = bytes[i + 2] !== 0; i += 3; }
      else if (c === 0x56) { flush(); out.push("─".repeat(42)); out.push("✂ [カット]"); i += 3; }
      else { i += 2; }
    } else if (b === 0x0a) { flush(); out.push(""); i += 1; }
    else { buf.push(b); i += 1; }
  }
  flush();
  return out.join("\n");
}

// ─── メインループ ─────────────────────────────────────────────
let polls = 0;
let processed = 0;

async function pollOnce() {
  polls++;
  // 1) POST: 状態通知＋ジョブ問合せ
  let job;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printerMAC: MAC,
        statusCode: "200 OK",
        statusMessage: "READY",
        printingInProgress: false,
      }),
    });
    if (!res.ok) {
      console.warn(`[poll #${polls}] POST ${res.status}`);
      return;
    }
    job = await res.json();
  } catch (err) {
    console.warn(`[poll #${polls}] 通信エラー: ${err.message}`);
    return;
  }

  if (!job.jobReady) {
    process.stdout.write(`.`);
    return;
  }

  console.log(`\n\n[poll #${polls}] 📥 ジョブあり (token=${job.jobToken})`);

  // 2) GET: 本体取得
  const getUrl = new URL(ENDPOINT);
  getUrl.searchParams.set("mac", MAC);
  if (job.jobToken) getUrl.searchParams.set("token", job.jobToken);
  const bin = await fetch(getUrl, { method: "GET" });
  if (!bin.ok) {
    console.warn(`[poll #${polls}] GET ${bin.status}`);
    return;
  }
  const bytes = new Uint8Array(await bin.arrayBuffer());
  console.log(`   ペイロード: ${bytes.length} bytes  Content-Type: ${bin.headers.get("content-type")}`);

  // 3) デコードして表示
  const rendered = decodeEscPos(bytes);
  console.log("\n┌─────────── レシートプレビュー ───────────┐");
  rendered.split("\n").forEach(l => console.log("│ " + l.padEnd(42) + " │"));
  console.log("└" + "─".repeat(44) + "┘\n");

  // 4) DELETE: 完了報告
  const delUrl = new URL(ENDPOINT);
  delUrl.searchParams.set("mac", MAC);
  delUrl.searchParams.set("token", job.jobToken);
  delUrl.searchParams.set("code", "200");
  delUrl.searchParams.set("message", "printed by dummy");
  const del = await fetch(delUrl, { method: "DELETE" });
  console.log(`   → DELETE ${del.status} (完了報告)`);
  processed++;
}

console.log("停止は Ctrl+C。ポーリング開始...\n");
setInterval(pollOnce, INTERVAL);
// 起動直後にも1回叩く
pollOnce().catch(err => console.error(err));

// SIGINT時のサマリ
process.on("SIGINT", () => {
  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`ポーリング回数: ${polls}`);
  console.log(`印刷ジョブ処理数: ${processed}`);
  exit(0);
});
