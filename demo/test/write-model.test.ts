import { describe, it, expect } from "vitest";
import {
  buildInput, emptyDraft, firstError, isBlankDraft, labelTooLong, openBranches, parseIndex,
  readDraft, targetProblem, textBytes, titleBytes, type Draft,
} from "../src/screens/write-model";
import { joinTitle } from "../src/titles";
import type { ChapterData } from "../src/types";

const valid = (over: Partial<Draft> = {}): Draft => ({
  titleEn: "Takes up the bow", titleFa: "کمان برمی‌گیرد",
  textEn: "He draws the bow.", textFa: "کمان را برمی‌گیرد.",
  branches: [{ en: "Fire", fa: "رها کن" }, { en: "Wait", fa: "صبر کن" }],
  ending: false, ...over,
});

describe("buildInput", () => {
  it("packs the title and trims every field", () => {
    const i = buildInput(valid({ titleEn: "  Bow ", titleFa: " کمان ", textEn: " a ", branches: [{ en: " Fire ", fa: " رها " }, { en: "Wait", fa: "صبر" }] }));
    expect(i.title).toBe(joinTitle("Bow", "کمان"));
    expect(i.textEn).toBe("a");
    expect(i.labelsEn).toEqual(["Fire", "Wait"]);
    expect(i.labelsFa).toEqual(["رها", "صبر"]);
  });

  it("sends no labels for an ending, even if rows were filled", () => {
    const i = buildInput(valid({ ending: true }));
    expect(i.labelsEn).toEqual([]);
    expect(i.labelsFa).toEqual([]);
  });
});

describe("firstError", () => {
  it("accepts a valid chapter", () => {
    expect(firstError(valid())).toBeNull();
  });

  it("accepts an ending with no labels", () => {
    expect(firstError(valid({ ending: true, branches: [{ en: "", fa: "" }, { en: "", fa: "" }] }))).toBeNull();
  });

  it("needs the title and text in both languages", () => {
    expect(firstError(valid({ titleFa: "  " }))).toBe("EmptyTitle");
    expect(firstError(valid({ textEn: "" }))).toBe("EmptyText");
  });

  it("needs every label filled", () => {
    expect(firstError(valid({ branches: [{ en: "Fire", fa: "" }, { en: "Wait", fa: "صبر" }] }))).toBe("EmptyLabel");
  });

  it("allows an English label of 31 bytes and rejects 32", () => {
    expect(labelTooLong("a".repeat(31))).toBe(false);
    expect(firstError(valid({ branches: [{ en: "a".repeat(31), fa: "ب" }, { en: "b", fa: "ب" }] }))).toBeNull();
    expect(labelTooLong("a".repeat(32))).toBe(true);
    expect(firstError(valid({ branches: [{ en: "a".repeat(32), fa: "ب" }, { en: "b", fa: "ب" }] }))).toBe("LabelTooLong");
  });

  it("allows a Persian label of 15 letters (30 bytes) and rejects 16 (32 bytes)", () => {
    const ok = "ب".repeat(15), bad = "ب".repeat(16);
    expect(labelTooLong(ok)).toBe(false);
    expect(firstError(valid({ branches: [{ en: "a", fa: ok }, { en: "b", fa: "ب" }] }))).toBeNull();
    expect(labelTooLong(bad)).toBe(true);
    expect(firstError(valid({ branches: [{ en: "a", fa: bad }, { en: "b", fa: "ب" }] }))).toBe("LabelTooLong");
  });

  it("allows 1200 bytes of text in both languages together and rejects 1201", () => {
    const d = valid({ textEn: "a".repeat(600), textFa: "a".repeat(600) });
    expect(textBytes(d)).toBe(1200);
    expect(firstError(d)).toBeNull();
    expect(firstError(valid({ textEn: "a".repeat(601), textFa: "a".repeat(600) }))).toBe("TextTooLong");
  });

  it("keeps the packed title within 63 bytes", () => {
    const fine = valid({ titleEn: "a".repeat(30), titleFa: "b" });
    expect(titleBytes(fine)).toBeLessThanOrEqual(63);
    expect(firstError(fine)).toBeNull();
    expect(firstError(valid({ titleEn: "a".repeat(60), titleFa: "ب".repeat(10) }))).toBe("TitleTooLong");
  });
});

describe("drafts", () => {
  it("treats an empty draft (two empty rows) as blank", () => {
    expect(isBlankDraft(emptyDraft())).toBe(true);
    expect(isBlankDraft(valid())).toBe(false);
  });

  it("restores a saved draft and rejects malformed JSON", () => {
    const d = valid();
    expect(readDraft(JSON.stringify(d))).toEqual(d);
    expect(readDraft(null)).toBeNull();
    expect(readDraft("{not json")).toBeNull();
    expect(readDraft(JSON.stringify({ ...d, branches: [{ en: "x", fa: "y" }] }))).toBeNull();
    expect(readDraft(JSON.stringify({ ...d, titleEn: 4 }))).toBeNull();
  });
});

const chapter = (over: Partial<ChapterData>): ChapterData => ({
  id: 0, title: "t", textEn: "", textFa: "", labelsEn: [], labelsFa: [], author: "0x0", createdAt: 0,
  parent: 0, parentBranch: 0, children: [], choices: [], ...over,
});

describe("branches", () => {
  it("reports taken and unknown branches", () => {
    const c = chapter({ labelsEn: ["a", "b"], labelsFa: ["x", "y"], children: [0, 5] });
    expect(targetProblem(c, 0)).toBeNull();
    expect(targetProblem(c, 1)).toBe("BranchTaken");
    expect(targetProblem(c, 2)).toBe("UnknownBranch");
    expect(targetProblem(chapter({}), 0)).toBe("UnknownBranch");
  });

  it("lists only open branches, in story order", () => {
    const chapters = [
      chapter({ id: 0, title: "one", labelsEn: ["a", "b"], labelsFa: ["x", "y"], children: [3, 0] }),
      chapter({ id: 1, title: "two", labelsEn: [], labelsFa: [], children: [] }),
      chapter({ id: 2, title: "three", labelsEn: ["c"], labelsFa: ["z"], children: [0] }),
    ];
    expect(openBranches(chapters)).toEqual([
      { parent: 0, branch: 1, parentTitle: "one", labelEn: "b", labelFa: "y" },
      { parent: 2, branch: 0, parentTitle: "three", labelEn: "c", labelFa: "z" },
    ]);
  });

  it("parses query indexes strictly", () => {
    expect(parseIndex("7")).toBe(7);
    expect(parseIndex("0")).toBe(0);
    expect(parseIndex("-1")).toBeNull();
    expect(parseIndex("1.5")).toBeNull();
    expect(parseIndex("abc")).toBeNull();
    expect(parseIndex(null)).toBeNull();
  });
});
