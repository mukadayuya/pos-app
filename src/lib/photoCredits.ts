// メニュー写真のクレジット（作者・ライセンス）を組み立てる。
// 台帳 src/data/photoCredits.json は `node scripts/gen_photo_credits.mjs` で自動生成する。
import photoCreditsJson from "@/data/photoCredits.json";

/** 台帳1件ぶん（gen_photo_credits.mjs の出力形式） */
export interface CreditRecord {
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  attributionRequired: boolean;
}

/** クレジット画面に出す1枚ぶん */
export interface PhotoCredit {
  /** Commons のファイル名（アンダースコア区切り） */
  fileName: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  /** サムネイルに使う画像URL（メニューが実際に使っているもの） */
  imageUrl: string;
  /** この写真を使っているメニュー名 */
  itemNames: string[];
}

/** 台帳に載っていない写真に出す作者欄の文言 */
export const UNKNOWN_AUTHOR_TEXT = "作者・ライセンスは元ページをご覧ください";

const FILES = (photoCreditsJson as { files: Record<string, CreditRecord> }).files;

/**
 * 画像URL → Commons のファイル名（スペースはアンダースコア、URLエンコードは戻す）。
 * Commons の写真でなければ null。
 *   upload.wikimedia.org/wikipedia/commons/thumb/2/23/Name.jpg/960px-Name.jpg → Name.jpg
 *   upload.wikimedia.org/wikipedia/commons/c/c9/Name.jpg                      → Name.jpg
 *   commons.wikimedia.org/wiki/Special:FilePath/Name.jpg?width=960            → Name.jpg
 * ※ scripts/gen_photo_credits.mjs の commonsFileName と同じ規則（テストで一致を確認）
 */
export function commonsFileName(url: string): string | null {
  if (typeof url !== "string") return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  let raw: string | null = null;

  if (host === "upload.wikimedia.org") {
    const m = u.pathname.match(/^\/wikipedia\/commons\/(.+)$/);
    if (!m) return null;
    const segs = m[1].split("/").filter(Boolean);
    if (segs[0] === "thumb") {
      // thumb/<a>/<ab>/<File>/<960px-File> → 後ろから2番目がファイル名
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
    // 壊れたエンコードはそのまま使う（写真を捨てない）
  }
  name = name.replace(/ /g, "_").trim();
  return name || null;
}

/** URLに埋め込むためのファイル名（日本語などは%エンコード、? と # も念のため） */
function encodeFileName(fileName: string): string {
  return encodeURI(fileName).replace(/[?#]/g, encodeURIComponent);
}

/** 台帳から探す。Commons はファイル名の先頭1文字の大小を区別しないので、見つからなければ大文字化して再検索 */
function lookup(files: Record<string, CreditRecord>, fileName: string): CreditRecord | undefined {
  if (Object.prototype.hasOwnProperty.call(files, fileName)) return files[fileName];
  const cap = fileName.charAt(0).toUpperCase() + fileName.slice(1);
  if (Object.prototype.hasOwnProperty.call(files, cap)) return files[cap];
  return undefined;
}

/**
 * メニューの写真のうち、クレジット表示が必要なものだけを返す。
 *  - 同じ写真を複数の品が使っていれば1件にまとめ、使っている品名を並べる
 *  - 順番は初めて登場した順
 *  - 台帳にない Commons 写真は「表示が必要」扱いで必ず返す（黙って落とさない）
 * files は台帳の差し替え用（テスト用）。通常は指定しない。
 */
export function buildCredits(
  items: { name: string; imageUrl?: string }[],
  files: Record<string, CreditRecord> = FILES,
): PhotoCredit[] {
  const byFile = new Map<string, PhotoCredit>();

  for (const item of items) {
    if (!item.imageUrl) continue;
    const fileName = commonsFileName(item.imageUrl);
    if (!fileName) continue;

    const existing = byFile.get(fileName);
    if (existing) {
      if (!existing.itemNames.includes(item.name)) existing.itemNames.push(item.name);
      continue;
    }

    const rec = lookup(files, fileName);
    if (rec && rec.attributionRequired === false) continue; // CC0・パブリックドメインなど

    byFile.set(fileName, {
      fileName,
      author: rec?.author || UNKNOWN_AUTHOR_TEXT,
      license: rec?.license ?? "",
      licenseUrl: rec?.licenseUrl ?? "",
      sourceUrl: rec?.sourceUrl || `https://commons.wikimedia.org/wiki/File:${encodeFileName(fileName)}`,
      imageUrl: item.imageUrl,
      itemNames: [item.name],
    });
  }

  return [...byFile.values()];
}
