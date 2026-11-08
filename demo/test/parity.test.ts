import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { Adventure, Revert } from "../src/adventure";
import { SmartContractWallet } from "../src/wallet";

const load = (f: string) => JSON.parse(readFileSync(new URL(`../parity/${f}`, import.meta.url), "utf8")).scenarios;

describe("Adventure port matches Adventure.sol scenarios", () => {
  for (const sc of load("adventure-scenarios.json")) {
    it(sc.name, () => {
      const mk = () => new Adventure("a0", sc.init.text, sc.init.choices);
      if (sc.deployRevert) return expect(mk).toThrow(sc.deployRevert);
      const c = mk();
      for (const s of sc.steps) {
        const run = () =>
          s.call === "addSituation" ? c.addSituation(s.as, s.args[0], s.args[1], s.args[2], s.args[3]) : c.addSignature(s.as, s.args[0]);
        if (s.revert) expect(run).toThrow(s.revert);
        else run();
      }
      const ex = sc.expect ?? {};
      if (ex.pathways !== undefined) expect(c.getPathwayCount()).toBe(ex.pathways);
      for (const [f, ch, to] of ex.next ?? []) expect(c.getNextSituation(f, ch)).toBe(to);
      for (const [id, n] of Object.entries(ex.author ?? {})) expect(c.getAuthor(Number(id))).toBe(n);
      for (const [id, sig] of Object.entries(ex.signature ?? {})) expect(c.getSignature(Number(id))).toBe(sig);
    });
  }
  it("Revert is an Error", () => expect(new Revert("x")).toBeInstanceOf(Error));
});

describe("Wallet port matches SmartContractWallet.sol scenarios", () => {
  for (const sc of load("wallet-scenarios.json")) {
    it(sc.name, () => {
      const w = new SmartContractWallet("owner");
      for (const s of sc.steps) {
        const a = s.args;
        const run = () => {
          switch (s.call) {
            case "fund": return w.fund(a[0]);
            case "setAllowance": return w.setAllowance(s.as, a[0], a[1]);
            case "setGuardian": return w.setGuardian(s.as, a[0], a[1]);
            case "transfer": return w.transfer(s.as, a[0], a[1]);
            case "proposeNewOwner": return w.proposeNewOwner(s.as, a[0]);
          }
          throw new Error("unknown " + s.call);
        };
        if (s.revert) expect(run).toThrow(s.revert);
        else run();
      }
      const ex = sc.expect ?? {};
      if (ex.owner) expect(w.owner).toBe(ex.owner);
      if (ex.balance !== undefined) expect(w.balance).toBe(ex.balance);
      for (const [n, v] of Object.entries(ex.allowance ?? {})) expect(w.getAllowance(n)).toBe(v);
    });
  }
});
