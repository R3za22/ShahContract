import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { ContractFactory } from "ethers";
import { LiveAdapter } from "../demo/src/chain/live.ts";
import { UserRejected, NoWallet } from "../demo/src/chain/errors.ts";

const conn = await network.create();
const { ethers } = conn;
const WALLET_ARTIFACT = "../basic-eth-wallet/hh-artifacts/contracts/SmartContractWallet.sol/SmartContractWallet.json";

/** Wrap Hardhat's provider as a wallet: eth_requestAccounts exists, and a flag can decline signing. */
function fakeWallet(declineNext = { v: false }) {
  return {
    declineNext,
    async request({ method, params }: { method: string; params?: any[] }) {
      if (method === "eth_requestAccounts") return conn.provider.request({ method: "eth_accounts" });
      if (declineNext.v && (method === "eth_sendTransaction" || method === "eth_requestAccounts")) { declineNext.v = false; throw Object.assign(new Error("User rejected"), { code: 4001 }); }
      return conn.provider.request({ method, params } as any);
    },
  };
}
const input = { title: "Takes up the bow | کمان برمی‌گیرد", textEn: "He draws the bow.", textFa: "کمان را برمی‌گیرد.", labelsEn: ["Fire", "Wait"], labelsFa: ["رها کن", "صبر کن"] };

describe("LiveAdapter against the real contracts (Hardhat in-process chain)", () => {
  it("connects, writes a chapter, reads it back, records a choice, lists history", async () => {
    const [deployer] = await ethers.getSigners();
    const story = await ethers.deployContract("ShahnamehStory", [0, ["Zal", "A child on Alborz.", "کودکی در البرز.", ["Go", "Stay"], ["برو", "بمان"]]], deployer);
    const wallet = fakeWallet();
    const a = new LiveAdapter({ storyAddress: await story.getAddress(), walletAddress: "0x" + "0".repeat(40), chainId: 31337, provider: wallet as any });
    assert.equal(a.detect().injected, true);
    assert.equal(a.session(), null);
    await assert.rejects(() => a.writeChapter(0, 0, input), (e) => e instanceof NoWallet);
    await assert.rejects(() => a.connect("simulated"), (e) => e instanceof NoWallet);
    const s = await a.connect("injected");
    assert.equal(s.address, deployer.address);
    assert.equal(a.networkOk(), true);

    const h = await a.writeChapter(0, 0, input);
    const rec = await h.confirmed;
    assert.equal(rec.status, "confirmed");
    assert.equal(rec.params.chapter, 1);
    const ch = await a.chapter(1);
    assert.equal(ch.title, input.title);
    assert.deepEqual(ch.labelsFa, input.labelsFa);
    assert.equal((await a.chapter(0)).children[0], 1);
    assert.equal(await a.chapterCount(), 2);
    assert.equal(await a.openBranches(), 3);

    const c = await (await a.chooseBranch(0, 0)).confirmed;
    assert.equal(c.status, "confirmed");
    assert.equal(await a.hasChosen(0, s.address), true);
    assert.equal((await a.chapter(0)).choices[0], 1);

    // a revert is decoded to the contract's custom error name before anything is sent
    await assert.rejects(() => a.writeChapter(0, 0, input), (e: any) => e.reason === "BranchTaken");

    const hist = await a.history();
    assert.deepEqual(hist.map((r) => r.kind).sort(), ["chapter", "chapter", "choice"]);
  });

  it("a declined signature is UserRejected and sends nothing", async () => {
    const [deployer] = await ethers.getSigners();
    const story = await ethers.deployContract("ShahnamehStory", [0, ["Zal", "x", "y", ["a", "b"], ["c", "d"]]], deployer);
    const w = fakeWallet();
    const a = new LiveAdapter({ storyAddress: await story.getAddress(), walletAddress: "0x" + "0".repeat(40), chainId: 31337, provider: w as any });
    await a.connect("injected");
    w.declineNext.v = true;
    await assert.rejects(() => a.writeChapter(0, 0, input), (e) => e instanceof UserRejected);
    assert.equal(await a.chapterCount(), 1);
  });

  it("wrong network is reported", async () => {
    const [deployer] = await ethers.getSigners();
    const story = await ethers.deployContract("ShahnamehStory", [0, ["Zal", "x", "y", ["a", "b"], ["c", "d"]]], deployer);
    const a = new LiveAdapter({ storyAddress: await story.getAddress(), walletAddress: "0x" + "0".repeat(40), chainId: 11155111, provider: fakeWallet() as any });
    await a.connect("injected");
    assert.equal(a.networkOk(), false);
  });

  (existsSync(WALLET_ARTIFACT) ? it : it.skip)("wallet reads/writes (needs ../basic-eth-wallet compiled)", async () => {
    const [owner, g1, g2, newOwner] = await ethers.getSigners();
    const art = JSON.parse(readFileSync(WALLET_ARTIFACT, "utf8"));
    const factory = new ContractFactory(art.abi, art.bytecode, owner);
    const wc: any = await factory.deploy(2);
    await wc.waitForDeployment();
    const walletAddress = await wc.getAddress();
    const story = await ethers.deployContract("ShahnamehStory", [0, ["Zal", "x", "y", ["a", "b"], ["c", "d"]]], owner);
    const a = new LiveAdapter({ storyAddress: await story.getAddress(), walletAddress, chainId: 31337, provider: fakeWallet() as any });
    await a.connect("injected");
    await (await a.deposit(10n ** 18n)).confirmed;
    await (await a.setGuardian(g1.address, true)).confirmed;
    await (await a.setGuardian(g2.address, true)).confirmed;
    await (await a.setAllowance(newOwner.address, 5n * 10n ** 16n)).confirmed;
    let w = await a.wallet();
    assert.equal(w.balance, 10n ** 18n);
    assert.equal(w.guardians.length, 2);
    assert.equal(w.allowances[0].limit, 5n * 10n ** 16n);
    assert.equal((await (await a.send(g1.address, 10n ** 17n)).confirmed).status, "confirmed");
    assert.equal((await a.wallet()).balance, 9n * 10n ** 17n);
    await wc.connect(g1).proposeNewOwner(newOwner.address);
    w = await a.wallet();
    assert.equal(w.recovery?.votes, 1);
    assert.equal(w.recovery?.proposed, newOwner.address);
    assert.equal(w.recovery?.proposer, g1.address);
    await (await a.cancelRecovery()).confirmed;
    assert.equal((await a.wallet()).recovery, null);
    const kinds = new Set((await a.history()).map((r) => r.kind));
    for (const k of ["deposit", "guardian", "allowance", "transfer", "recovery"]) assert.ok(kinds.has(k as any), k);
  });
});
