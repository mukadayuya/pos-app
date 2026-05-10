import { describe, it, expect } from "vitest";
import { validateTemplateForm, applyTemplate } from "@/lib/optionTemplates";
import { OptionGroup } from "@/types/pos";

const sampleGroups: OptionGroup[] = [
  {
    id: "g1",
    name: "ご飯の量",
    items: [
      { id: "i1", name: "普通", price: 0 },
      { id: "i2", name: "大盛", price: 50 },
    ],
  },
];

describe("validateTemplateForm", () => {
  it("テンプレート名が空の場合はエラーを返す", () => {
    expect(validateTemplateForm("", sampleGroups)).toBe("テンプレート名を入力してください");
  });

  it("スペースのみの名前もエラーになる", () => {
    expect(validateTemplateForm("   ", sampleGroups)).toBe("テンプレート名を入力してください");
  });

  it("テンプレート名があればグループが空でも保存できる（商品名は不要）", () => {
    expect(validateTemplateForm("ご飯セット", [])).toBeNull();
  });

  it("テンプレート名とグループが揃っていれば保存できる", () => {
    expect(validateTemplateForm("ご飯セット", sampleGroups)).toBeNull();
  });

  it("商品名を空にした状態でもオプションテンプレートが保存できること", () => {
    // テンプレートの保存に商品名（productName）は不要
    const productName = "";
    const templateName = "ご飯の量テンプレート";
    expect(validateTemplateForm(templateName, sampleGroups)).toBeNull();
    // 商品名バリデーションはテンプレートとは独立している
    expect(productName).toBe("");
  });
});

describe("applyTemplate", () => {
  it("グループを deep-clone して返す", () => {
    const applied = applyTemplate(sampleGroups);
    applied[0].name = "変更後";
    expect(sampleGroups[0].name).toBe("ご飯の量"); // 元データは変化しない
  });

  it("items も独立してコピーされる", () => {
    const applied = applyTemplate(sampleGroups);
    applied[0].items[0].name = "変更後";
    expect(sampleGroups[0].items[0].name).toBe("普通"); // 元データは変化しない
  });

  it("空配列は空配列を返す", () => {
    expect(applyTemplate([])).toEqual([]);
  });

  it("複数グループを正しくコピーする", () => {
    const twoGroups: OptionGroup[] = [
      { id: "g1", name: "量", items: [{ id: "i1", name: "普通", price: 0 }] },
      { id: "g2", name: "種類", items: [{ id: "i2", name: "白米", price: 0 }] },
    ];
    const result = applyTemplate(twoGroups);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("量");
    expect(result[1].name).toBe("種類");
  });
});
