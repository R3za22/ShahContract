import type { StoryState } from "./story-core";
import type { WalletState } from "./wallet-core";
import type { Address, TxRecord } from "../types";

export interface MockState {
  v: 1;
  story: StoryState;
  wallet: WalletState;
  history: TxRecord[]; // newest first
  block: number;
  actor: Address;
  connected: boolean;
  /** latest allowance set by the owner, per spender (the contract only stores what is left) */
  limits: Record<Address, string>;
  recoveryProposer: Address;
}

const BIG = "$big";
export const serialize = (s: MockState) => JSON.stringify(s, (_k, v) => (typeof v === "bigint" ? { [BIG]: v.toString() } : v));
export const deserialize = (text: string): MockState =>
  JSON.parse(text, (_k, v) => (v && typeof v === "object" && BIG in v ? BigInt(v[BIG]) : v));
