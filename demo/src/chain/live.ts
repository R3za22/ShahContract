import { BrowserProvider, Contract, Interface, getAddress, type Eip1193Provider, type Log, type Signer } from "ethers";
import type { ChainAdapter, Detect } from "../adapter";
import type { Address, ChapterData, ChapterInput, Session, TxHandle, TxKind, TxRecord, WalletInfo, WalletKind } from "../types";
import { NoWallet, Revert, UserRejected, WrongNetwork } from "./errors";
import { STORY_ABI, WALLET_ABI } from "./abi";
import type { Named } from "./accounts";

export interface LiveOptions {
  storyAddress: string;
  walletAddress: string;
  chainId: number;
  /** EIP-1193 provider; defaults to window.ethereum */
  provider?: Eip1193Provider;
}
const GAS: Record<string, bigint> = { chapter: 600_000n, transfer: 60_000n, other: 80_000n };

/** Adapter for a real EIP-1193 wallet (window.ethereum) and the deployed contracts. */
export class LiveAdapter implements ChainAdapter {
  readonly mode = "live" as const;
  readonly chainName = { en: "Sepolia", fa: "سپولیا" };
  readonly storyAddress: Address;
  readonly walletAddress: Address;
  readonly chainId: number;
  limits = { cooldown: 300 };
  version = 0;

  private raw?: Eip1193Provider;
  private provider?: BrowserProvider;
  private signer?: Signer;
  private current: Session | null = null;
  private subs = new Set<() => void>();
  private local: TxRecord[] = [];

  constructor(opts: LiveOptions) {
    this.storyAddress = opts.storyAddress;
    this.walletAddress = opts.walletAddress;
    this.chainId = opts.chainId;
    this.raw = opts.provider ?? (globalThis as any).window?.ethereum;
    if (this.raw) {
      this.provider = new BrowserProvider(this.raw, "any", { cacheTimeout: -1 });
      const on = (this.raw as any).on;
      if (typeof on === "function") {
        on.call(this.raw, "accountsChanged", () => { void this.refreshSession(); });
        on.call(this.raw, "chainChanged", () => { void this.refreshSession(); });
      }
      this.story().COOLDOWN().then((c: bigint) => { this.limits = { cooldown: Number(c) }; this.changed(); }).catch(() => undefined);
    }
  }

  // ---- plumbing ----
  now() { return Math.floor(Date.now() / 1000); }
  subscribe(fn: () => void) { this.subs.add(fn); return () => { this.subs.delete(fn); }; }
  private changed() { this.version++; this.subs.forEach((f) => f()); }
  private needProvider(): BrowserProvider { if (!this.provider) throw new NoWallet(); return this.provider; }
  private story(w: Signer | BrowserProvider = this.needProvider()) { return new Contract(this.storyAddress, STORY_ABI, w); }
  private wallet_(w: Signer | BrowserProvider = this.needProvider()) { return new Contract(this.walletAddress, WALLET_ABI, w); }

  // ---- session ----
  detect(): Detect { return { injected: !!this.raw, walletconnect: false, simulated: false }; }
  session() { return this.current; }
  networkOk() { return !this.current || this.current.chainId === this.chainId; }
  private async refreshSession() {
    if (!this.provider) return;
    try {
      const accounts: string[] = await this.provider.send("eth_accounts", []);
      if (!accounts.length) { this.current = null; this.signer = undefined; }
      else {
        const net = await this.provider.getNetwork();
        this.signer = await this.provider.getSigner(accounts[0]);
        this.current = { address: getAddress(accounts[0]), chainId: Number(net.chainId), kind: "injected" };
      }
    } catch { this.current = null; }
    this.changed();
  }
  async connect(kind: WalletKind): Promise<Session> {
    if (kind !== "injected") throw new NoWallet();
    const p = this.needProvider();
    try { await p.send("eth_requestAccounts", []); } catch (e) { throw mapError(e); }
    await this.refreshSession();
    if (!this.current) throw new NoWallet();
    return this.current;
  }
  async switchNetwork() {
    const p = this.needProvider();
    try { await p.send("wallet_switchEthereumChain", [{ chainId: "0x" + this.chainId.toString(16) }]); } catch (e) { throw mapError(e); }
    await this.refreshSession();
  }
  disconnect() { this.current = null; this.signer = undefined; this.changed(); }
  nameOf(_a: Address): Named | undefined { return undefined; }

  // ---- story reads ----
  async chapterCount() { return Number(await this.story().chapterCount()); }
  async chapter(id: number): Promise<ChapterData> {
    const s = this.story();
    let c: any;
    try { c = await s.getChapter(id); } catch (e) { throw mapError(e); }
    const n = c.labelsEn.length;
    const children = await Promise.all(Array.from({ length: n }, (_, b) => s.childOf(id, b).then(Number)));
    const choices = await Promise.all(Array.from({ length: n }, (_, b) => s.branchChoices(id, b).then(Number)));
    return {
      id, author: c.author, createdAt: Number(c.createdAt), parent: Number(c.parent), parentBranch: Number(c.parentBranch),
      title: c.title, textEn: c.textEn, textFa: c.textFa, labelsEn: [...c.labelsEn], labelsFa: [...c.labelsFa], children, choices,
    };
  }
  async openBranches() { return Number(await this.story().openBranches()); }
  async cooldownRemaining(a: Address) {
    const [next, block] = await Promise.all([this.story().nextWriteAt(a), this.needProvider().getBlock("latest")]);
    return Math.max(0, Number(next) - (block?.timestamp ?? this.now()));
  }
  hasChosen(chapter: number, a: Address) { return this.story().hasChosen(chapter, a) as Promise<boolean>; }
  async estimateFee(kind: "chapter" | "transfer" | "other") {
    try { const f = await this.needProvider().getFeeData(); const p = f.maxFeePerGas ?? f.gasPrice; return p ? p * GAS[kind] : null; } catch { return null; }
  }

  // ---- writes ----
  private requireReady(): Signer {
    if (!this.current || !this.signer) throw new NoWallet();
    if (!this.networkOk()) throw new WrongNetwork();
    return this.signer;
  }
  private async send_(kind: TxKind, to: Address | undefined, params: TxRecord["params"], value: bigint | undefined, call: (s: Signer) => Promise<any>): Promise<TxHandle> {
    const signer = this.requireReady();
    let tx: any;
    try { tx = await call(signer); } catch (e) { throw mapError(e); }
    const rec: TxRecord = { hash: tx.hash, kind, status: "pending", from: this.current!.address, to, params, value: value?.toString(), timestamp: this.now() };
    this.local.unshift(rec);
    this.changed();
    const confirmed = (async () => {
      try {
        const r = await tx.wait();
        rec.status = r?.status === 1 ? "confirmed" : "failed";
        rec.block = r?.blockNumber;
        if (r) { rec.fee = (BigInt(r.gasUsed) * BigInt(r.gasPrice ?? 0)).toString(); }
        if (kind === "chapter" && r) {
          for (const l of r.logs as Log[]) {
            try { const p = this.story().interface.parseLog(l); if (p?.name === "ChapterWritten") rec.params.chapter = Number(p.args.id); } catch { /* other log */ }
          }
        }
        if (rec.status === "failed") rec.reason = "ExecutionReverted";
      } catch (e) {
        rec.status = "failed";
        const m = mapError(e);
        rec.reason = m instanceof Revert ? m.reason : "ExecutionReverted";
      }
      this.changed();
      return { ...rec, params: { ...rec.params } } as TxRecord;
    })();
    return { hash: tx.hash, confirmed };
  }
  chooseBranch(chapter: number, branch: number) { return this.send_("choice", undefined, { chapter, branch }, undefined, (s) => this.story(s).chooseBranch(chapter, branch)); }
  writeChapter(parent: number, branch: number, i: ChapterInput) {
    return this.send_("chapter", undefined, { parent, branch, title: i.title }, undefined,
      (s) => this.story(s).writeChapter(parent, branch, [i.title, i.textEn, i.textFa, i.labelsEn, i.labelsFa]));
  }

  // ---- wallet ----
  async wallet(): Promise<WalletInfo> {
    const p = this.needProvider(), w = this.wallet_();
    const [owner, threshold, balance, proposed, votes, gLogs, aLogs, rLogs] = await Promise.all([
      w.owner(), w.threshold(), p.getBalance(this.walletAddress), w.proposedOwner(), w.recoveryVotes(),
      w.queryFilter(w.filters.GuardianSet()), w.queryFilter(w.filters.AllowanceSet()), w.queryFilter(w.filters.RecoveryProposed()),
    ]);
    const guardianSet = new Map<string, boolean>();
    for (const l of gLogs as any[]) guardianSet.set(l.args.guardian, l.args.isGuardian);
    const guardians = await Promise.all([...guardianSet].filter(([, on]) => on).map(async ([address]) => ({ address, approved: (await w.hasApproved(address)) as boolean })));
    const limits = new Map<string, bigint>();
    for (const l of aLogs as any[]) limits.set(l.args.spender, l.args.amount);
    const allowances = (await Promise.all([...limits].filter(([, v]) => v > 0n).map(async ([address, limit]) => ({ address, limit, remaining: (await w.allowance(address)) as bigint }))));
    const last: any = (rLogs as any[]).filter((l) => l.args.newOwner === proposed).pop();
    const none = proposed === "0x0000000000000000000000000000000000000000";
    return {
      address: this.walletAddress, owner, balance, threshold: Number(threshold), guardians, allowances,
      recovery: none ? null : { proposed, votes: Number(votes), proposer: last?.args.proposer },
    };
  }
  deposit(amount: bigint) {
    return this.send_("deposit", this.walletAddress, {}, amount, (s) => s.sendTransaction({ to: this.walletAddress, value: amount }));
  }
  send(to: Address, amount: bigint) { return this.send_("transfer", to, {}, amount, (s) => this.wallet_(s).transfer(to, amount)); }
  setAllowance(spender: Address, amount: bigint) { return this.send_("allowance", spender, {}, amount, (s) => this.wallet_(s).setAllowance(spender, amount)); }
  setGuardian(guardian: Address, on: boolean) { return this.send_("guardian", guardian, { on }, undefined, (s) => this.wallet_(s).setGuardian(guardian, on)); }
  setThreshold(n: number) { return this.send_("threshold", undefined, { threshold: n }, undefined, (s) => this.wallet_(s).setThreshold(n)); }
  proposeNewOwner(newOwner: Address) { return this.send_("recovery", newOwner, { action: "approve" }, undefined, (s) => this.wallet_(s).proposeNewOwner(newOwner)); }
  cancelRecovery() { return this.send_("recovery", undefined, { action: "cancel" }, undefined, (s) => this.wallet_(s).cancelRecovery()); }

  // ---- history ----
  async history(): Promise<TxRecord[]> {
    const me = this.current?.address;
    const p = this.needProvider(), s = this.story(), w = this.wallet_();
    const out: TxRecord[] = [];
    const stamp = new Map<number, number>();
    const ts = async (b: number) => { if (!stamp.has(b)) stamp.set(b, (await p.getBlock(b))?.timestamp ?? 0); return stamp.get(b)!; };
    const add = async (l: any, kind: TxKind, from: Address, to: Address | undefined, params: TxRecord["params"], value?: bigint) =>
      out.push({ hash: l.transactionHash, kind, status: "confirmed", from, to, params, value: value?.toString(), block: l.blockNumber, timestamp: await ts(l.blockNumber) });
    if (me) {
      for (const l of (await s.queryFilter(s.filters.ChapterWritten())).filter((l: any) => l.args.author === me) as any[]) await add(l, "chapter", me, undefined, { chapter: Number(l.args.id), parent: Number(l.args.parent), branch: Number(l.args.parentBranch), title: l.args.title });
      for (const l of (await s.queryFilter(s.filters.BranchChosen(me))) as any[]) await add(l, "choice", me, undefined, { chapter: Number(l.args.chapter), branch: Number(l.args.branch) });
    }
    for (const l of (await w.queryFilter("*")) as any[]) {
      const a = l.args;
      switch (l.eventName) {
        case "Deposited": await add(l, "deposit", a.from, this.walletAddress, {}, a.amount); break;
        case "Sent": await add(l, "transfer", a.by, a.to, {}, a.amount); break;
        case "GuardianSet": await add(l, "guardian", me ?? a.guardian, a.guardian, { on: a.isGuardian }); break;
        case "ThresholdSet": await add(l, "threshold", me ?? this.walletAddress, undefined, { threshold: Number(a.threshold) }); break;
        case "AllowanceSet": await add(l, "allowance", me ?? this.walletAddress, a.spender, {}, a.amount); break;
        case "RecoveryApproved": await add(l, "recovery", a.guardian, a.newOwner, { action: "approve" }); break;
        case "RecoveryCancelled": await add(l, "recovery", a.by, a.newOwner, { action: "cancel" }); break;
        case "OwnerChanged": await add(l, "recovery", a.newOwner, a.newOwner, { action: "handover" }); break;
      }
    }
    const known = new Set(out.map((r) => r.hash + r.kind));
    const pending = this.local.filter((r) => r.status !== "confirmed" && !known.has(r.hash + r.kind));
    return [...pending, ...out].sort((x, y) => (y.block ?? Infinity) - (x.block ?? Infinity) || y.timestamp - x.timestamp);
  }
}

/** Turn a wallet/ethers error into one of our error types. */
export function mapError(e: any): Error {
  if (e instanceof Revert || e instanceof UserRejected || e instanceof NoWallet || e instanceof WrongNetwork) return e;
  if (e?.code === 4001 || e?.code === "ACTION_REJECTED" || e?.info?.error?.code === 4001) return new UserRejected();
  const name = e?.revert?.name ?? e?.errorName ?? decodeRevert(e);
  if (name) return new Revert(name);
  return e instanceof Error ? e : new Error(String(e));
}

const ERRORS = [new Interface(STORY_ABI), new Interface(WALLET_ABI)];
/** Find the custom error name inside whatever shape the wallet/RPC used for the revert data. */
function decodeRevert(e: any): string | undefined {
  const candidates = [e?.data, e?.error?.data, e?.info?.error?.data, e?.info?.error?.data?.data, e?.error?.error?.data]
    .filter((d) => typeof d === "string" && /^0x[0-9a-fA-F]{8,}/.test(d));
  const m = /0x[0-9a-fA-F]{8}[0-9a-fA-F]*/.exec(String(e?.message ?? ""));
  if (m) candidates.push(m[0]);
  for (const data of candidates) for (const i of ERRORS) {
    try { const p = i.parseError(data); if (p) return p.name; } catch { /* try next */ }
  }
  const named = /custom error '([A-Za-z0-9_]+)\(/.exec(String(e?.message ?? ""));
  return named?.[1];
}
