import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { StoryCore } from "../src/chain/story-core";
import { WalletCore } from "../src/chain/wallet-core";
import type { ChapterInput } from "../src/types";

const load = (f: string) => JSON.parse(readFileSync(new URL(`../parity/${f}`, import.meta.url), "utf8")).scenarios;
const expand = (v: any): any =>
  typeof v === "string" ? v.replace(/^\$(.)(\d+)$/u, (_m, c, n) => c.repeat(Number(n))) : Array.isArray(v) ? v.map(expand) : v;
const input = (a: any[]): ChapterInput => ({ title: a[0], textEn: a[1], textFa: a[2], labelsEn: a[3], labelsFa: a[4] });

describe("StoryCore matches ShahnamehStory.sol scenarios", () => {
  for (const sc of load("story-scenarios.json")) {
    it(sc.name, () => {
      const i = Object.fromEntries(Object.entries(sc.init).map(([k, v]) => [k, expand(v)])) as any;
      let now = 1000;
      const mk = () => new StoryCore(i.cooldown, input([i.title, i.textEn, i.textFa, i.labelsEn, i.labelsFa]), "a0", now);
      if (sc.deployRevert) return expect(mk).toThrow(sc.deployRevert);
      const c = mk();
      for (const s of sc.steps) {
        const a = expand(s.args);
        const run = () => {
          if (s.call === "wait") { now += a[0]; return; }
          if (s.call === "writeChapter") return c.writeChapter(s.as, a[0], a[1], input(a.slice(2)), now);
          return c.chooseBranch(s.as, a[0], a[1]);
        };
        if (s.revert) expect(run).toThrow(s.revert);
        else run();
      }
      const ex = sc.expect ?? {};
      if (ex.chapters !== undefined) expect(c.chapterCount).toBe(ex.chapters);
      if (ex.open !== undefined) expect(c.openBranches).toBe(ex.open);
      for (const [p, b, to] of ex.child ?? []) expect(c.childOf(p, b)).toBe(to);
      for (const [id, name] of Object.entries(ex.author ?? {})) expect(c.chapter(Number(id)).author).toBe(name);
      for (const [ch, br, n] of ex.choices ?? []) expect(c.branchChoices(ch, br)).toBe(n);
    });
  }
});

describe("WalletCore matches SmartContractWallet.sol scenarios", () => {
  for (const sc of load("wallet-scenarios.json")) {
    it(sc.name, () => {
      const w = new WalletCore("wallet", "owner", sc.threshold ?? 2);
      const addr = (n: string) => (n === "zero" ? "" : n);
      for (const s of sc.steps) {
        const a = s.args;
        const run = () => {
          switch (s.call) {
            case "fund": return w.deposit(BigInt(a[0]));
            case "setAllowance": return w.setAllowance(s.as, addr(a[0]), BigInt(a[1]));
            case "setGuardian": return w.setGuardian(s.as, addr(a[0]), a[1]);
            case "setThreshold": return w.setThreshold(s.as, a[0]);
            case "transfer": return w.transfer(s.as, addr(a[0]), BigInt(a[1]));
            case "proposeNewOwner": return w.proposeNewOwner(s.as, addr(a[0]));
            case "cancelRecovery": return w.cancelRecovery(s.as);
          }
          throw new Error("unknown call " + s.call);
        };
        if (s.revert) expect(run).toThrow(s.revert);
        else run();
      }
      const ex = sc.expect ?? {};
      if (ex.owner) expect(w.owner).toBe(ex.owner);
      if (ex.balance !== undefined) expect(w.state.balance).toBe(BigInt(ex.balance));
      if (ex.votes !== undefined) expect(w.state.recoveryVotes).toBe(ex.votes);
      if (ex.threshold !== undefined) expect(w.state.threshold).toBe(ex.threshold);
      if (ex.proposed !== undefined) expect(w.state.proposedOwner).toBe(ex.proposed === null ? "" : ex.proposed);
      for (const [n, v] of Object.entries(ex.allowance ?? {})) expect(w.allowanceOf(n)).toBe(BigInt(v as number));
    });
  }
});
