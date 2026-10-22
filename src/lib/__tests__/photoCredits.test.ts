import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  commonsFileName,
  buildCredits,
  UNKNOWN_AUTHOR_TEXT,
  type CreditRecord,
} from "../photoCredits";
import photoCreditsJson from "@/data/photoCredits.json";
// 生成スクリプトとの規則ズレを検出するために読み込む（main は import 時には動かない）
import {
  commonsFileName as scriptCommonsFileName,
  extractCommonsFileNames,
} from "../../../scripts/gen_photo_credits.mjs";

const THUMB =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg/960px-Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg";
const DIRECT =
  "https://upload.wikimedia.org/wikipedia/commons/c/c9/Japanese_Caramel_Custard_Pudding%2C_Purin%2C_Flan.jpg";
const FP_ENCODED = "https://commons.wikimedia.org/wiki/Special:FilePath/Deluxe%20sashimi%20platter%2001.jpg?width=960";
const FP_PLAIN = "https://commons.wikimedia.org/wiki/Special:FilePath/Taco%20Rice.jpg";

describe("commonsFileName", () => {
  it("サムネイルURL: 960px- の手前のファイル名を返す", () => {
    expect(commonsFileName(THUMB)).toBe("Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg");
  });

  it("サムネイルURL: %エンコードを戻す（%2C → , / %28 %29 → ( )）", () => {
    expect(
      commonsFileName(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Tokkuri_and_Choko_%28sake_cup%29_in_Osaka_-_Apr_18%2C_2019.jpg/960px-Tokkuri_and_Choko_%28sake_cup%29_in_Osaka_-_Apr_18%2C_2019.jpg",
      ),
    ).toBe("Tokkuri_and_Choko_(sake_cup)_in_Osaka_-_Apr_18,_2019.jpg");
  });

  it("サムネイルではない upload URL: 最後の区切りがファイル名", () => {
    expect(commonsFileName(DIRECT)).toBe("Japanese_Caramel_Custard_Pudding,_Purin,_Flan.jpg");
  });

  it("日本語のファイル名（%E3...）も戻る", () => {
    expect(
      commonsFileName(
        "https://upload.wikimedia.org/wikipedia/commons/b/bc/Mugi-sh%C5%8Dch%C5%AB_Gunkanjima.jpg",
      ),
    ).toBe("Mugi-shōchū_Gunkanjima.jpg");
    expect(
      commonsFileName(
        "https://commons.wikimedia.org/wiki/Special:FilePath/%E7%84%BC%E3%81%8D%E3%81%AA%E3%81%99.jpg?width=960",
      ),
    ).toBe("焼きなす.jpg");
  });

  it("Special:FilePath（?width= 付き）: スペース→アンダースコア", () => {
    expect(commonsFileName(FP_ENCODED)).toBe("Deluxe_sashimi_platter_01.jpg");
  });

  it("Special:FilePath（クエリなし）", () => {
    expect(commonsFileName(FP_PLAIN)).toBe("Taco_Rice.jpg");
  });

  it("Commons 以外のURLは null", () => {
    expect(commonsFileName("https://example.com/images/ramen.jpg")).toBeNull();
    expect(commonsFileName("https://images.unsplash.com/photo-123?w=800")).toBeNull();
    expect(commonsFileName("/images/menu/ramen.jpg")).toBeNull();
    expect(commonsFileName("https://upload.wikimedia.org/wikipedia/en/a/ab/Some_fair_use.png")).toBeNull();
    expect(commonsFileName("")).toBeNull();
    expect(commonsFileName("not a url")).toBeNull();
  });
});

describe("buildCredits", () => {
  const files: Record<string, CreditRecord> = {
    "Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg": {
      author: "Dllu",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg",
      attributionRequired: true,
    },
    "Deluxe_sashimi_platter_01.jpg": {
      author: "T.Tseng",
      license: "CC BY 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by/2.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Deluxe_sashimi_platter_01.jpg",
      attributionRequired: true,
    },
    "Japanese_Caramel_Custard_Pudding,_Purin,_Flan.jpg": {
      author: "Someone",
      license: "CC0",
      licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Japanese_Caramel_Custard_Pudding,_Purin,_Flan.jpg",
      attributionRequired: false,
    },
  };

  it("表示が必要な写真だけ返す（CC0 / 写真なし / Commons以外は除く）", () => {
    const r = buildCredits(
      [
        { name: "冷奴", imageUrl: THUMB },
        { name: "プリン", imageUrl: DIRECT }, // CC0 → 不要
        { name: "ごはん" }, // 写真なし
        { name: "ラーメン", imageUrl: "https://example.com/ramen.jpg" }, // Commons以外
      ],
      files,
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({
      fileName: "Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg",
      author: "Dllu",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg",
      imageUrl: THUMB,
      itemNames: ["冷奴"],
    });
  });

  it("同じ写真は1件にまとめ、使っている品名を並べる（同名は重複させない）", () => {
    const r = buildCredits(
      [
        { name: "冷奴", imageUrl: THUMB },
        { name: "刺身", imageUrl: FP_ENCODED },
        { name: "ミニ冷奴", imageUrl: THUMB },
        { name: "冷奴", imageUrl: THUMB },
        // 同じファイルでもURLの形が違うものはファイル名で同一視する
        { name: "冷奴セット", imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg" },
      ],
      files,
    );
    expect(r.map((c) => c.fileName)).toEqual([
      "Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg",
      "Deluxe_sashimi_platter_01.jpg",
    ]);
    expect(r[0].itemNames).toEqual(["冷奴", "ミニ冷奴", "冷奴セット"]);
    expect(r[1].itemNames).toEqual(["刺身"]);
    // サムネイルは最初に出てきたURL
    expect(r[0].imageUrl).toBe(THUMB);
  });

  it("並びは最初に登場した順", () => {
    const r = buildCredits(
      [
        { name: "B", imageUrl: FP_ENCODED },
        { name: "A", imageUrl: THUMB },
      ],
      files,
    );
    expect(r.map((c) => c.itemNames[0])).toEqual(["B", "A"]);
  });

  it("台帳にない Commons 写真も落とさず返す（作者欄は案内文・元ページは File: URL）", () => {
    const r = buildCredits([{ name: "タコライス", imageUrl: FP_PLAIN }], files);
    expect(r).toHaveLength(1);
    expect(r[0].fileName).toBe("Taco_Rice.jpg");
    expect(r[0].author).toBe(UNKNOWN_AUTHOR_TEXT);
    expect(r[0].author).toBe("作者・ライセンスは元ページをご覧ください");
    expect(r[0].sourceUrl).toBe("https://commons.wikimedia.org/wiki/File:Taco_Rice.jpg");
    expect(r[0].license).toBe("");
    expect(r[0].licenseUrl).toBe("");
    expect(r[0].itemNames).toEqual(["タコライス"]);
  });

  it("台帳が空でも Commons 写真は全部返る", () => {
    const r = buildCredits(
      [
        { name: "冷奴", imageUrl: THUMB },
        { name: "プリン", imageUrl: DIRECT },
      ],
      {},
    );
    expect(r).toHaveLength(2);
    expect(r.every((c) => c.author === UNKNOWN_AUTHOR_TEXT)).toBe(true);
  });

  it("台帳の作者が空文字のときも案内文で補う", () => {
    const r = buildCredits([{ name: "冷奴", imageUrl: THUMB }], {
      "Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg": {
        author: "",
        license: "CC BY 2.0",
        licenseUrl: "",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Hiyayakko_with_bonito_flakes_and_welsh_onion_2.jpg",
        attributionRequired: true,
      },
    });
    expect(r[0].author).toBe(UNKNOWN_AUTHOR_TEXT);
    expect(r[0].license).toBe("CC BY 2.0");
  });

  it("Commons 以外・写真なしだけなら空配列", () => {
    expect(buildCredits([], files)).toEqual([]);
    expect(
      buildCredits([{ name: "a" }, { name: "b", imageUrl: "https://example.com/x.jpg" }], files),
    ).toEqual([]);
  });
});

// ─── 実際の台帳（src/data/photoCredits.json）と setup スクリプトの突き合わせ ───────────
describe("photoCredits.json が setup_*_menu.mjs の写真を全部カバーしている", () => {
  const scriptsDir = fileURLToPath(new URL("../../../scripts/", import.meta.url));
  const setupFiles = readdirSync(scriptsDir).filter((f) => /^setup_.*_menu\.mjs$/.test(f));
  const registry = (photoCreditsJson as { files: Record<string, CreditRecord> }).files;

  it("setup スクリプトが見つかる", () => {
    expect(setupFiles.length).toBeGreaterThan(0);
  });

  for (const f of setupFiles) {
    it(`${f}: 使っている Commons 写真がすべて台帳にある（足りなければ node scripts/gen_photo_credits.mjs を再実行）`, () => {
      // 注意: スクリプトは「テキストとして」読むだけ。import すると DB のメニューが消える
      const text = readFileSync(path.join(scriptsDir, f), "utf8");
      const names = extractCommonsFileNames(text);
      expect(names.length).toBeGreaterThan(0);
      const missing = names.filter((n) => !registry[n]);
      expect(missing).toEqual([]);
    });

    it(`${f}: 生成スクリプトと photoCredits.ts のファイル名規則が一致している`, () => {
      const text = readFileSync(path.join(scriptsDir, f), "utf8");
      const urls = [
        ...text.matchAll(/https:\/\/(?:upload|commons)\.wikimedia\.org\/[^"'`\s)]+/g),
      ]
        .map((m) => m[0])
        .filter((u) => !u.includes("${"));
      const fps = [...text.matchAll(/\bFP\(\s*(["'])(.+?)\1\s*\)/g)].map(
        (m) => `https://commons.wikimedia.org/wiki/Special:FilePath/${m[2]}?width=960`,
      );
      for (const u of [...urls, ...fps]) {
        expect(commonsFileName(u), u).toBe(scriptCommonsFileName(u));
        expect(commonsFileName(u), u).not.toBeNull();
      }
    });
  }

  it("台帳の各エントリに作者とライセンスと元ページがある（表示が必要なもの）", () => {
    for (const [name, rec] of Object.entries(registry)) {
      if (!rec.attributionRequired) continue;
      expect(rec.author, name).not.toBe("");
      expect(rec.license, name).not.toBe("");
      expect(rec.licenseUrl, name).toMatch(/^https?:\/\//);
      expect(rec.sourceUrl, name).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });
});
