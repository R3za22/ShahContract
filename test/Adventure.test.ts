import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { network } from "hardhat";

const { ethers } = await network.create();
const { scenarios } = JSON.parse(readFileSync("demo/parity/adventure-scenarios.json", "utf8"));
const enc = (c: string) => ethers.encodeBytes32String(c);

describe("Adventure (shared parity scenarios)", () => {
  for (const sc of scenarios) {
    it(sc.name, async () => {
      const [a0, a1] = await ethers.getSigners();
      const who: Record<string, any> = { a0, a1 };
      const deploy = () => ethers.deployContract("Adventure", [sc.init.text, sc.init.choices.map(enc)], a0);
      if (sc.deployRevert) {
        await assert.rejects(deploy, (e: any) => String(e.message).includes(sc.deployRevert));
        return;
      }
      const c = await deploy();
      for (const s of sc.steps) {
        const w = c.connect(who[s.as]) as any;
        const send = () =>
          s.call === "addSituation"
            ? w.addSituation(s.args[0], s.args[1], s.args[2], s.args[3].map(enc))
            : w.addSignature(s.args[0]);
        if (s.revert) await assert.rejects(send, (e: any) => String(e.message).includes(s.revert));
        else await (await send()).wait();
      }
      const ex = sc.expect ?? {};
      if (ex.pathways !== undefined) assert.equal(await c.getPathwayCount(), BigInt(ex.pathways));
      for (const [f, ch, to] of ex.next ?? []) assert.equal(await c.getNextSituation(f, ch), BigInt(to));
      for (const [id, n] of Object.entries(ex.author ?? {}))
        assert.equal(await c.getAuthor(BigInt(id)), who[n as string].address);
      for (const [id, sig] of Object.entries(ex.signature ?? {}))
        assert.equal(await c.getSignature(BigInt(id)), sig);
    });
  }

  it("emits the Situation event with text and choices", async () => {
    const c = await ethers.deployContract("Adventure", ["Hello", [enc("A")]]);
    const ev = await c.queryFilter(c.filters.Situation());
    assert.equal(ev.length, 1);
    assert.equal(ev[0].args.situationText, "Hello");
  });
});
