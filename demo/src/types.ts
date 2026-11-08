export type Lang = "en" | "fa";
export type Address = string;

export interface ChapterInput {
  title: string; // on-chain single string; use titles.ts to pack/unpack the two languages
  textEn: string;
  textFa: string;
  labelsEn: string[]; // empty = ending, otherwise 2 or 3
  labelsFa: string[];
}

export interface ChapterData extends ChapterInput {
  id: number;
  author: Address;
  createdAt: number; // unix seconds
  parent: number;
  parentBranch: number;
  /** per branch: id of the chapter that continues it, 0 while the branch is open */
  children: number[];
  /** per branch: how many readers chose it */
  choices: number[];
}

export const LIMITS = { labelBytes: 31, titleBytes: 63, textBytes: 1200, minBranches: 2, maxBranches: 3 } as const;

export type TxKind = "chapter" | "choice" | "transfer" | "allowance" | "guardian" | "threshold" | "recovery" | "owner" | "deposit";
export type TxStatus = "pending" | "confirmed" | "failed";

export interface TxRecord {
  hash: string;
  kind: TxKind;
  status: TxStatus;
  from: Address;
  /** counterpart address when there is one (recipient, spender, guardian, new owner) */
  to?: Address;
  /** chapter id, branch, etc. Plain values only, so the record can be saved as JSON. */
  params: Record<string, string | number | boolean>;
  /** wei, as a decimal string */
  value?: string;
  /** custom error name when failed, e.g. "LabelTooLong" */
  reason?: string;
  block?: number;
  /** unix seconds */
  timestamp: number;
  /** wei, decimal string */
  fee?: string;
}

export interface TxHandle {
  hash: string;
  /** Resolves with the final record (confirmed or failed). Never rejects once the tx is submitted. */
  confirmed: Promise<TxRecord>;
}

export type WalletKind = "injected" | "walletconnect" | "simulated";
export interface Session {
  address: Address;
  chainId: number;
  kind: WalletKind;
}

export interface GuardianInfo { address: Address; name?: string; approved: boolean }
export interface AllowanceInfo { address: Address; name?: string; limit: bigint; remaining: bigint }
export interface RecoveryInfo { proposed: Address; votes: number; proposer?: Address }
export interface WalletInfo {
  address: Address;
  owner: Address;
  balance: bigint; // wei
  threshold: number;
  guardians: GuardianInfo[];
  allowances: AllowanceInfo[]; // only spenders with a recorded allowance
  recovery: RecoveryInfo | null;
}
