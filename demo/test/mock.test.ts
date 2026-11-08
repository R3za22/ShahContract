import { describe, it, expect } from "vitest";
import { MockAdapter, STORAGE_KEY } from "../src/chain/mock";
import { ADDR } from "../src/chain/accounts";
import { NoWallet, UserRejected, WrongNetwork } from "../src/chain/errors";
import { WEI } from "../src/format";
import { joinTitle } from "../src/titles";

class MemStorage { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }
const make = (storage: any = new MemStorage(), now = { t: 1_800_000_000 }) => ({ a: new MockAdapter({ latencyMs: 5, storage, now: () => now.t }), storage, now });
const input = (over = {}) => ({ title: joinTitle("Takes up the bow", "کمان برمی‌گیرد"), textEn: "He draws the bow.", textFa: "کمان را برمی‌گیرد.", labelsEn: ["Fire", "Wait"], labelsFa: ["رها کن", "صبر کن"], ...over });

describe("MockAdapter", () => {
  it("seeds the draft story and a wallet", async () => {
    const { a } = make();
    expect(await a.chapterCount()).toBe(15);
    expect(await a.openBranches()).toBe(2);
    const w = await a.wallet();
    expect(w.balance).toBe(124n * WEI / 100n);
    expect(w.guardians.length).toBe(3);
    expect(w.allowances.map((x) => x.remaining)).toEqual([WEI / 20n, WEI / 50n]);
    expect(w.owner).toBe(ADDR.you);
    expect((await a.history()).length).toBeGreaterThan(5);
  });

  it("needs a connected wallet on the right network", async () => {
    const { a } = make();
    await expect(a.send(ADDR.reader, 1n)).rejects.toBeInstanceOf(NoWallet);
    await a.connect("simulated");
    a.demo.set("wrongNetwork", true);
    expect(a.networkOk()).toBe(false);
    await expect(a.send(ADDR.reader, 1n)).rejects.toBeInstanceOf(WrongNetwork);
    await a.switchNetwork();
    expect(a.networkOk()).toBe(true);
  });

  it("connect can be declined", async () => {
    const { a } = make();
    a.demo.set("rejectNextSignature", true);
    await expect(a.connect("simulated")).rejects.toBeInstanceOf(UserRejected);
    expect(a.session()).toBeNull();
    await expect(a.connect("injected")).rejects.toBeInstanceOf(NoWallet);
  });

  it("writes a chapter: pending then confirmed, state updated, cooldown applied", async () => {
    const { a } = make();
    await a.connect("simulated");
    const h = await a.writeChapter(7, 1, input());
    expect((await a.history())[0].status).toBe("pending");
    expect(await a.chapterCount()).toBe(15);
    const rec = await h.confirmed;
    expect(rec.status).toBe("confirmed");
    expect(rec.block).toBeGreaterThan(0);
    expect(await a.chapterCount()).toBe(16);
    expect((await a.chapter(7)).children[1]).toBe(15);
    expect(await a.cooldownRemaining(ADDR.you)).toBe(60);
    const again = await a.writeChapter(2, 1, input());
    expect((await again.confirmed).reason).toBe("CooldownActive");
  });

  it("a contract revert becomes a failed record with the error name", async () => {
    const { a } = make();
    await a.connect("simulated");
    const rec = await (await a.writeChapter(0, 0, input())).confirmed;
    expect(rec).toMatchObject({ status: "failed", reason: "BranchTaken" });
    expect(await a.chapterCount()).toBe(15);
  });

  it("declined signature sends nothing; forced revert fails once", async () => {
    const { a } = make();
    await a.connect("simulated");
    const before = (await a.history()).length;
    a.demo.set("rejectNextSignature", true);
    await expect(a.send(ADDR.reader, 1n)).rejects.toBeInstanceOf(UserRejected);
    expect((await a.history()).length).toBe(before);
    a.demo.set("failNextTransaction", true);
    expect((await (await a.send(ADDR.reader, 1n)).confirmed).reason).toBe("ExecutionReverted");
    expect((await (await a.send(ADDR.reader, 1n)).confirmed).status).toBe("confirmed");
  });

  it("guardian recovery end to end through account switching", async () => {
    const { a } = make();
    await a.connect("simulated");
    a.switchActor(ADDR.farzaneh);
    await (await a.proposeNewOwner(ADDR.newowner)).confirmed;
    let w = await a.wallet();
    expect(w.recovery).toMatchObject({ proposed: ADDR.newowner, votes: 1, proposer: ADDR.farzaneh });
    expect(w.guardians.find((g) => g.address === ADDR.farzaneh)!.approved).toBe(true);
    a.switchActor(ADDR.you);
    await (await a.cancelRecovery()).confirmed;
    w = await a.wallet();
    expect(w.recovery).toBeNull();
    expect(w.guardians.every((g) => !g.approved)).toBe(true);
    a.switchActor(ADDR.farzaneh);
    await (await a.proposeNewOwner(ADDR.newowner)).confirmed;
    a.switchActor(ADDR.kaveh);
    const done = await (await a.proposeNewOwner(ADDR.newowner)).confirmed;
    expect(done.params.action).toBe("handover");
    expect((await a.wallet()).owner).toBe(ADDR.newowner);
  });

  it("allowance flow keeps limit and remaining apart", async () => {
    const { a } = make();
    await a.connect("simulated");
    await (await a.setAllowance(ADDR.kaveh, WEI / 10n)).confirmed;
    a.switchActor(ADDR.kaveh);
    await (await a.send(ADDR.reader, WEI / 25n)).confirmed;
    const row = (await a.wallet()).allowances.find((x) => x.address === ADDR.kaveh)!;
    expect(row.limit).toBe(WEI / 10n);
    expect(row.remaining).toBe(WEI / 10n - WEI / 25n);
    a.switchActor(ADDR.you);
    await (await a.setAllowance(ADDR.kaveh, 0n)).confirmed;
    expect((await a.wallet()).allowances.find((x) => x.address === ADDR.kaveh)).toBeUndefined();
  });

  it("persists to storage and reloads; reset restores the seed", async () => {
    const { a, storage, now } = make();
    await a.connect("simulated");
    await (await a.send(ADDR.reader, WEI / 100n)).confirmed;
    expect(storage.getItem(STORAGE_KEY)).toContain("transfer");
    const b = new MockAdapter({ latencyMs: 5, storage, now: () => now.t });
    expect((await b.wallet()).balance).toBe(124n * WEI / 100n - WEI / 100n);
    expect(b.session()?.address).toBe(ADDR.you);
    b.demo.reset();
    expect((await b.wallet()).balance).toBe(124n * WEI / 100n);
  });

  it("subscribers hear about changes", async () => {
    const { a } = make();
    let n = 0;
    const off = a.subscribe(() => n++);
    await a.connect("simulated");
    expect(n).toBeGreaterThan(0);
    off();
    const seen = n;
    a.disconnect();
    expect(n).toBe(seen);
  });
});
