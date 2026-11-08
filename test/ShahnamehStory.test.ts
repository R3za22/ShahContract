import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { network } from "hardhat";

const { ethers } = await network.create();
const { scenarios } = JSON.parse(readFileSync("demo/parity/story-scenarios.json", "utf8"));
const expand = (v: any): any =>
  typeof v === "string" ? v.replace(/^\$(.)(\d+)$/u, (_m, c, n) => c.repeat(Number(n))) : Array.isArray(v) ? v.map(expand) : v;
const failsWith = (name: string) => (e: any) => String(e.message + (e.shortMessage ?? "")).includes(name);
const bytes = (s: string) => new TextEncoder().encode(s).length;

async function deploy(init: any, signer?: any) {
  const i = Object.fromEntries(Object.entries(init).map(([k, v]) => [k, expand(v)])) as any;
  return ethers.deployContract("ShahnamehStory", [i.cooldown, [i.title, i.textEn, i.textFa, i.labelsEn, i.labelsFa]], signer);
}
const OPEN = { cooldown: 60, title: "Zal", textEn: "A child on Alborz.", textFa: "کودکی در البرز.", labelsEn: ["Go", "Stay"], labelsFa: ["برو", "بمان"] };
// scenario args are [parent, branch, title, textEn, textFa, labelsEn, labelsFa]; the contract takes a struct
const write = (c: any, a: any[]) => c.writeChapter(a[0], a[1], [a[2], a[3], a[4], a[5], a[6]]);

describe("ShahnamehStory (shared scenarios)", () => {
  for (const sc of scenarios) {
    it(sc.name, async () => {
      const signers = await ethers.getSigners();
      const who: Record<string, any> = { a0: signers[0], a1: signers[1], a2: signers[2] };
      if (sc.deployRevert) return assert.rejects(() => deploy(sc.init, who.a0), failsWith(sc.deployRevert));
      const c = await deploy(sc.init, who.a0);
      for (const s of sc.steps) {
        const a = expand(s.args);
        const send = async () => {
          if (s.call === "wait") { await ethers.provider.send("evm_increaseTime", [a[0]]); return ethers.provider.send("evm_mine", []); }
          const w = c.connect(who[s.as]) as any;
          return (await (s.call === "writeChapter" ? write(w, a) : w[s.call](...a))).wait();
        };
        if (s.revert) await assert.rejects(send, failsWith(s.revert));
        else await send();
      }
      const ex = sc.expect ?? {};
      if (ex.chapters !== undefined) assert.equal(await c.chapterCount(), BigInt(ex.chapters));
      if (ex.open !== undefined) assert.equal(await c.openBranches(), BigInt(ex.open));
      for (const [p, b, to] of ex.child ?? []) assert.equal(await c.childOf(p, b), BigInt(to));
      for (const [id, name] of Object.entries(ex.author ?? {})) assert.equal((await c.getChapter(Number(id))).author, who[name as string].address);
      for (const [ch, br, n] of ex.choices ?? []) assert.equal(await c.branchChoices(ch, br), BigInt(n));
    });
  }
});

describe("ShahnamehStory (direct)", () => {
  it("emits ChapterWritten with all fields and BranchChosen", async () => {
    const [a0, a1, a2] = await ethers.getSigners();
    const c = await deploy(OPEN, a0);
    const r = await (await write(c.connect(a1), [0, 1, "Rakhsh", "Horse", "اسب", ["Ride", "Walk"], ["سوار", "پیاده"]])).wait();
    const ev = c.interface.parseLog(r.logs[0])!;
    assert.equal(ev.name, "ChapterWritten");
    assert.equal(ev.args.id, 1n);
    assert.equal(ev.args.parent, 0n);
    assert.equal(ev.args.parentBranch, 1n);
    assert.equal(ev.args.author, a1.address);
    assert.equal(ev.args.title, "Rakhsh");
    assert.deepEqual([...ev.args.labelsFa], ["سوار", "پیاده"]);
    const r2 = await (await (c.connect(a2) as any).chooseBranch(0, 1)).wait();
    const ev2 = c.interface.parseLog(r2.logs[0])!;
    assert.equal(ev2.name, "BranchChosen");
    assert.equal(ev2.args.next, 1n);
  });

  it("the opening chapter emits an event at deploy", async () => {
    const [a0] = await ethers.getSigners();
    const c = await deploy(OPEN, a0);
    const logs = await c.queryFilter(c.filters.ChapterWritten());
    assert.equal(logs.length, 1);
    assert.equal(logs[0].args.id, 0n);
  });

  it("chapters are immutable: no edit-style function exists and the stored record matches", async () => {
    const [a0] = await ethers.getSigners();
    const c = await deploy(OPEN, a0);
    const ch = await c.getChapter(0);
    assert.equal(ch.title, "Zal");
    assert.equal(ch.textFa, "کودکی در البرز.");
    const fns = c.interface.fragments.filter((f: any) => f.type === "function").map((f: any) => f.name);
    assert.ok(!fns.some((n: string) => /^(edit|update|delete|remove|set)/i.test(n)));
  });

  it("reading an unknown chapter reverts", async () => {
    const [a0] = await ethers.getSigners();
    const c = await deploy(OPEN, a0);
    await assert.rejects(() => c.getChapter(7), failsWith("UnknownChapter"));
  });

  it("exposes its limits", async () => {
    const [a0] = await ethers.getSigners();
    const c = await deploy(OPEN, a0);
    assert.equal(await c.MAX_LABEL_BYTES(), 31n);
    assert.equal(await c.MAX_TEXT_BYTES(), 1200n);
    assert.equal(await c.MAX_BRANCHES(), 3n);
    assert.equal(await c.COOLDOWN(), 60n);
  });
});

// ---- randomised property tests against a model ----
function prng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
const ALPHA = ["a", "z", "é", "ا", "ش", "و", "x"];

describe("ShahnamehStory (randomised properties)", () => {
  for (const seed of [11, 12, 13, 14, 15, 16]) {
    it(`random writes keep every invariant (seed ${seed})`, async () => {
      const rnd = prng(seed);
      const int = (n: number) => Math.floor(rnd() * n);
      const word = (max: number) => { let s = ""; const n = int(max + 4); for (let i = 0; i < n; i++) s += ALPHA[int(ALPHA.length)]; return s; };
      const signers = await ethers.getSigners();
      const c = await deploy({ ...OPEN, cooldown: 0 }, signers[0]);
      const filled = new Map<string, number>([["0:0", 0], ["0:1", 0]]);
      let count = 1, open = 2;
      for (let i = 0; i < 70; i++) {
        const who = signers[1 + int(4)];
        const parent = int(count + 1), branch = int(4);
        const nLabels = [0, 0, 2, 2, 3, 1, 4][int(7)];
        const le = Array.from({ length: nLabels }, () => word(33)), lf = Array.from({ length: nLabels }, () => word(33));
        const title = word(66), en = word(20), fa = word(20);
        const labelsOk = [...le, ...lf].every((l) => bytes(l) >= 1 && bytes(l) <= 31);
        const branchesOk = nLabels === 0 || (nLabels >= 2 && nLabels <= 3);
        const free = filled.get(`${parent}:${branch}`) === 0;
        const expectOk = free && bytes(title) >= 1 && bytes(title) <= 63 && labelsOk && branchesOk && open - 1 + nLabels >= 1;
        let ok = true;
        try { await (await write(c.connect(who), [parent, branch, title, en, fa, le, lf])).wait(); } catch { ok = false; }
        assert.equal(ok, expectOk, `write ${parent}:${branch} labels=${nLabels}`);
        if (ok) {
          filled.set(`${parent}:${branch}`, count);
          for (let b = 0; b < nLabels; b++) filled.set(`${count}:${b}`, 0);
          count++; open = open - 1 + nLabels;
        }
        assert.equal(await c.chapterCount(), BigInt(count));
        assert.equal(await c.openBranches(), BigInt(open));
        assert.ok(open >= 1, "story must never run out of open branches");
      }
      let scanned = 0;
      for (let id = 0; id < count; id++) {
        const chp = await c.getChapter(id);
        for (let b = 0; b < chp.labelsEn.length; b++) {
          assert.ok(bytes(chp.labelsEn[b]) <= 31 && bytes(chp.labelsFa[b]) <= 31);
          if ((await c.childOf(id, b)) === 0n) scanned++;
        }
        assert.ok(bytes(chp.textEn) + bytes(chp.textFa) <= 1200);
      }
      assert.equal(BigInt(scanned), await c.openBranches());
    });
  }
});
