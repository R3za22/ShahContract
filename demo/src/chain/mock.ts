import type { ChainAdapter, DemoControls, Detect } from "../adapter";
import type { Address, ChapterData, ChapterInput, Session, TxHandle, TxKind, TxRecord, WalletInfo, WalletKind } from "../types";
import { Revert, UserRejected, NoWallet, WrongNetwork } from "./errors";
import { StoryCore } from "./story-core";
import { WalletCore } from "./wallet-core";
import { ADDR, MOCK_ACTORS, MOCK_NAMES, type Named } from "./accounts";
import { deserialize, serialize, type MockState } from "./mock-state";
import { fakeHash, seedMockState, DEMO_COOLDOWN } from "./seed";

export const SEPOLIA = 11155111;
export const STORAGE_KEY = "shahnameh-demo-v1";

export interface MockOptions {
  /** milliseconds a transaction stays pending; default 1400 */
  latencyMs?: number;
  /** where to persist; pass null to keep everything in memory */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  /** unix seconds */
  now?: () => number;
}

const FEE: Record<TxKind, bigint> = {
  chapter: 400_000_000_000_000n, choice: 90_000_000_000_000n, transfer: 60_000_000_000_000n, allowance: 70_000_000_000_000n,
  guardian: 70_000_000_000_000n, threshold: 60_000_000_000_000n, recovery: 90_000_000_000_000n, owner: 90_000_000_000_000n, deposit: 50_000_000_000_000n,
};
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class MockAdapter implements ChainAdapter {
  readonly mode = "mock" as const;
  readonly chainName = { en: "Sepolia (simulated)", fa: "سپولیا (شبیه‌سازی‌شده)" };
  readonly chainId = SEPOLIA;
  readonly storyAddress = ADDR.story;
  readonly walletAddress = ADDR.wallet;
  readonly limits = { cooldown: DEMO_COOLDOWN };
  version = 0;

  private st!: MockState;
  private subs = new Set<() => void>();
  private latency: number;
  private storage: MockOptions["storage"];
  private clock: () => number;
  private flags = { rejectNextSignature: false, failNextTransaction: false, wrongNetwork: false };

  readonly demo: DemoControls;

  constructor(opts: MockOptions = {}) {
    this.latency = opts.latencyMs ?? 1400;
    this.storage = opts.storage === undefined ? safeLocalStorage() : opts.storage;
    this.clock = opts.now ?? (() => Math.floor(Date.now() / 1000));
    this.st = this.load() ?? seedMockState(this.clock());
    this.persist();
    const self = this;
    this.demo = {
      get rejectNextSignature() { return self.flags.rejectNextSignature; },
      get failNextTransaction() { return self.flags.failNextTransaction; },
      get wrongNetwork() { return self.flags.wrongNetwork; },
      set(flag, on) { self.flags[flag] = on; self.changed(); },
      reset() { self.st = seedMockState(self.clock()); self.flags = { rejectNextSignature: false, failNextTransaction: false, wrongNetwork: false }; self.changed(); },
    };
  }

  // ---- plumbing ----
  now() { return this.clock(); }
  subscribe(fn: () => void) { this.subs.add(fn); return () => { this.subs.delete(fn); }; }
  private changed() { this.version++; this.persist(); this.subs.forEach((f) => f()); }
  private load(): MockState | null {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = deserialize(raw);
      if (s.v !== 1) return null;
      // a transaction that was still pending when the page closed can never confirm: show it as failed
      for (const r of s.history) if (r.status === "pending") { r.status = "failed"; r.reason = "ExecutionReverted"; }
      return s;
    } catch { return null; }
  }
  private persist() { try { this.storage?.setItem(STORAGE_KEY, serialize(this.st)); } catch { /* storage full or blocked: keep running in memory */ } }
  private get story() { return StoryCore.from(this.st.story); }
  private get walletCore() { return WalletCore.from(this.st.wallet); }

  // ---- session ----
  detect(): Detect { return { injected: false, walletconnect: false, simulated: true }; }
  session(): Session | null {
    return this.st.connected ? { address: this.st.actor, chainId: this.flags.wrongNetwork ? 1 : SEPOLIA, kind: "simulated" } : null;
  }
  networkOk() { return !this.flags.wrongNetwork; }
  async connect(kind: WalletKind): Promise<Session> {
    if (kind !== "simulated") throw new NoWallet();
    await delay(Math.min(this.latency, 700));
    if (this.flags.rejectNextSignature) { this.flags.rejectNextSignature = false; this.changed(); throw new UserRejected(); }
    this.st.connected = true;
    this.changed();
    return this.session()!;
  }
  async switchNetwork() { await delay(Math.min(this.latency, 400)); this.flags.wrongNetwork = false; this.changed(); }
  disconnect() { this.st.connected = false; this.changed(); }
  actors() { return MOCK_ACTORS; }
  switchActor(address: Address) { if (MOCK_ACTORS.includes(address)) { this.st.actor = address; this.changed(); } }
  nameOf(a: Address): Named | undefined { return MOCK_NAMES[a]; }

  // ---- story reads ----
  async chapterCount() { return this.story.chapterCount; }
  async chapter(id: number): Promise<ChapterData> { return structuredClone(this.story.chapter(id)); }
  async openBranches() { return this.story.openBranches; }
  async cooldownRemaining(a: Address) { return Math.max(0, this.story.nextWriteAt(a) - this.now()); }
  async hasChosen(chapter: number, a: Address) { return this.story.hasChosen(chapter, a); }
  async estimateFee(kind: "chapter" | "transfer" | "other") { return FEE[kind === "other" ? "allowance" : kind]; }

  // ---- story writes ----
  chooseBranch(chapter: number, branch: number) {
    return this.submit("choice", undefined, { chapter, branch }, undefined, (who) => { this.story.chooseBranch(who, chapter, branch); });
  }
  writeChapter(parent: number, branch: number, input: ChapterInput) {
    return this.submit("chapter", undefined, { parent, branch, title: input.title }, undefined, (who, now) => {
      const id = this.story.writeChapter(who, parent, branch, input, now);
      rec_params(this.lastRecord(), { chapter: id });
    });
  }

  // ---- wallet ----
  async wallet(): Promise<WalletInfo> {
    const w = this.walletCore, s = this.st.wallet;
    const spenders = Object.keys(this.st.limits).filter((a) => BigInt(this.st.limits[a]) > 0n);
    return {
      address: s.address, owner: s.owner, balance: s.balance, threshold: s.threshold,
      guardians: s.guardians.map((address) => ({ address, name: MOCK_NAMES[address]?.en, approved: w.hasApproved(address) })),
      allowances: spenders.map((address) => ({ address, name: MOCK_NAMES[address]?.en, limit: BigInt(this.st.limits[address]), remaining: w.allowanceOf(address) })),
      recovery: s.proposedOwner ? { proposed: s.proposedOwner, votes: s.recoveryVotes, proposer: this.st.recoveryProposer || undefined } : null,
    };
  }
  deposit(amount: bigint) {
    return this.submit("deposit", undefined, {}, amount, () => { this.walletCore.deposit(amount); }, ADDR.wallet);
  }
  send(to: Address, amount: bigint) {
    return this.submit("transfer", to, {}, amount, (who) => { this.walletCore.transfer(who, to, amount); });
  }
  setAllowance(spender: Address, amount: bigint) {
    return this.submit("allowance", spender, {}, amount, (who) => {
      this.walletCore.setAllowance(who, spender, amount);
      this.st.limits[spender] = amount.toString();
    });
  }
  setGuardian(guardian: Address, on: boolean) {
    return this.submit("guardian", guardian, { on }, undefined, (who) => { this.walletCore.setGuardian(who, guardian, on); });
  }
  setThreshold(n: number) {
    return this.submit("threshold", undefined, { threshold: n }, undefined, (who) => { this.walletCore.setThreshold(who, n); });
  }
  proposeNewOwner(newOwner: Address) {
    return this.submit("recovery", newOwner, { action: "approve" }, undefined, (who) => {
      const before = this.st.wallet.proposedOwner;
      this.walletCore.proposeNewOwner(who, newOwner);
      if (before !== newOwner) this.st.recoveryProposer = who;
      if (this.st.wallet.owner === newOwner) rec_params(this.lastRecord(), { action: "handover" });
    });
  }
  cancelRecovery() {
    return this.submit("recovery", undefined, { action: "cancel" }, undefined, (who) => { this.walletCore.cancelRecovery(who); this.st.recoveryProposer = ""; });
  }

  // ---- history ----
  async history() { return this.st.history.map((r) => ({ ...r, params: { ...r.params } })); }

  // ---- transaction pipeline ----
  private lastRecord() { return this.st.history.find((r) => r.status === "pending")!; }

  private async submit(
    kind: TxKind, to: Address | undefined, params: TxRecord["params"], value: bigint | undefined,
    exec: (who: Address, now: number) => void, recipientOverride?: Address,
  ): Promise<TxHandle> {
    const session = this.session();
    if (!session) throw new NoWallet();
    if (!this.networkOk()) throw new WrongNetwork();
    await delay(Math.min(this.latency, 300)); // the wallet window
    if (this.flags.rejectNextSignature) { this.flags.rejectNextSignature = false; this.changed(); throw new UserRejected(); }
    const rec: TxRecord = {
      hash: fakeHash(kind), kind, status: "pending", from: session.address, to: to ?? recipientOverride, params,
      value: value?.toString(), timestamp: this.now(),
    };
    this.st.history.unshift(rec);
    this.changed();
    const confirmed = (async () => {
      await delay(this.latency);
      try {
        if (this.flags.failNextTransaction) { this.flags.failNextTransaction = false; throw new Revert("ExecutionReverted"); }
        exec(session.address, this.now());
        rec.status = "confirmed";
      } catch (e) {
        if (!(e instanceof Revert)) throw e;
        rec.status = "failed";
        rec.reason = e.reason;
      }
      rec.block = ++this.st.block;
      rec.fee = FEE[kind].toString();
      this.changed();
      return { ...rec, params: { ...rec.params } } as TxRecord;
    })();
    return { hash: rec.hash, confirmed };
  }
}

function rec_params(rec: TxRecord | undefined, extra: Record<string, string | number | boolean>) {
  if (rec) Object.assign(rec.params, extra);
}

function safeLocalStorage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
