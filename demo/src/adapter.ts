import type { Address, ChapterData, ChapterInput, Lang, Session, TxHandle, TxRecord, WalletInfo, WalletKind } from "./types";
import type { Named } from "./chain/accounts";

export interface Detect { injected: boolean; walletconnect: boolean; simulated: boolean }

/** Switches that only exist on the simulated chain, to show every state on demand. */
export interface DemoControls {
  rejectNextSignature: boolean;
  failNextTransaction: boolean;
  wrongNetwork: boolean;
  set(flag: "rejectNextSignature" | "failNextTransaction" | "wrongNetwork", on: boolean): void;
  reset(): void;
}

/**
 * The only thing the UI knows about the chain. `mock` is an in-browser simulated chain (localStorage);
 * `live` talks to an EIP-1193 provider (window.ethereum) and the deployed contracts.
 * Writes reject with UserRejected (declined signature), NoWallet / WrongNetwork (not ready),
 * or resolve with a TxHandle whose `confirmed` promise settles with a confirmed or failed record.
 */
export interface ChainAdapter {
  readonly mode: "mock" | "live";
  readonly chainName: Record<Lang, string>;
  readonly chainId: number;
  readonly storyAddress: Address;
  readonly walletAddress: Address;
  readonly demo?: DemoControls;

  /** Called after any state change (tx submitted, confirmed, account switched). Returns an unsubscribe. */
  subscribe(fn: () => void): () => void;
  /** Bumps on every change; use as a hook dependency. */
  readonly version: number;

  // ---- session ----
  detect(): Detect;
  session(): Session | null;
  networkOk(): boolean;
  connect(kind: WalletKind): Promise<Session>;
  switchNetwork(): Promise<void>;
  disconnect(): void;
  /** Simulated wallet only: accounts to act as, and the switch. */
  actors?(): Address[];
  switchActor?(address: Address): void;
  /** Display names for addresses (guardian names etc.). */
  nameOf(address: Address): Named | undefined;

  // ---- story ----
  readonly limits: { cooldown: number };
  chapterCount(): Promise<number>;
  chapter(id: number): Promise<ChapterData>;
  openBranches(): Promise<number>;
  /** Seconds until `address` may write again (0 = now). */
  cooldownRemaining(address: Address): Promise<number>;
  hasChosen(chapter: number, address: Address): Promise<boolean>;
  chooseBranch(chapter: number, branch: number): Promise<TxHandle>;
  writeChapter(parent: number, branch: number, input: ChapterInput): Promise<TxHandle>;
  /** Estimated network fee in wei for one transaction of this kind, or null if unknown. */
  estimateFee(kind: "chapter" | "transfer" | "other"): Promise<bigint | null>;

  // ---- wallet ----
  wallet(): Promise<WalletInfo>;
  deposit(amountWei: bigint): Promise<TxHandle>;
  send(to: Address, amountWei: bigint): Promise<TxHandle>;
  setAllowance(spender: Address, amountWei: bigint): Promise<TxHandle>;
  setGuardian(guardian: Address, on: boolean): Promise<TxHandle>;
  setThreshold(n: number): Promise<TxHandle>;
  proposeNewOwner(newOwner: Address): Promise<TxHandle>;
  cancelRecovery(): Promise<TxHandle>;

  // ---- history ----
  /** Newest first. */
  history(): Promise<TxRecord[]>;
  now(): number;
}
