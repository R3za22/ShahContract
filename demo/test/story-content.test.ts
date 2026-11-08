import { describe, it, expect } from "vitest";
import { storyFile, seedStory } from "../src/chain/seed";
import { validate } from "../src/chain/story-core";
import { joinTitle } from "../src/titles";

describe("draft story content fits the contract limits", () => {
  for (const [key, n] of Object.entries(storyFile.nodes)) {
    it(key, () => {
      expect(() => validate({ title: joinTitle(n.title.en, n.title.fa), textEn: n.en.text, textFa: n.fa.text, labelsEn: n.en.choices, labelsFa: n.fa.choices })).not.toThrow();
      expect(n.next.length).toBe(n.en.choices.length);
      expect(n.fa.choices.length).toBe(n.en.choices.length);
    });
  }
  it("seeds into 15 chapters with two open branches", () => {
    const c = seedStory(1_800_000_000);
    expect(c.chapterCount).toBe(15);
    expect(c.openBranches).toBe(2);
  });
});
