import { describe, it, expect } from "vitest";
import { seedStory, story } from "../src/story";

describe("story content", () => {
  const keys = Object.keys(story.nodes);
  it("has both languages with matching choice counts, and short keys", () => {
    for (const k of keys) {
      const n = story.nodes[k];
      expect(new TextEncoder().encode(k).length, k).toBeLessThanOrEqual(31);
      expect(n.en.choices.length, k).toBe(n.next.length);
      expect(n.fa.choices.length, k).toBe(n.next.length);
      expect(n.en.text.length).toBeGreaterThan(20);
      expect(n.fa.text.length).toBeGreaterThan(20);
      expect(story.episodes[n.ep], k).toBeTruthy();
    }
  });
  it("covers six episodes, and every node is reachable exactly once (tree)", () => {
    expect(new Set(keys.map((k) => story.nodes[k].ep)).size).toBe(6);
    const seen = new Map<string, number>();
    const walk = (k: string) => { seen.set(k, (seen.get(k) ?? 0) + 1); story.nodes[k].next.forEach((c) => c && walk(c)); };
    walk(story.root);
    expect([...seen.keys()].sort()).toEqual([...keys].sort());
    expect([...seen.values()].every((v) => v === 1)).toBe(true);
  });
  it("seeds the contract port and leaves exactly one open pathway", () => {
    const chain = seedStory();
    expect(chain.events.length).toBe(keys.length);
    const open = keys.reduce((n, k) => n + story.nodes[k].next.filter((c) => c === null).length, 0);
    expect(open).toBe(1);
    expect(chain.getPathwayCount()).toBe(1);
    expect(chain.getNextSituation(0, 0)).toBeGreaterThan(0);
  });
});
