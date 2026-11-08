import { formatEth, isAddress, parseEth } from "../format";
import type { WalletInfo } from "../types";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Parses a typed ETH amount. Accepts Persian (U+06F0) and Arabic-Indic digits and the Persian decimal separator.
 * parseEth in format.ts only converts Arabic-Indic digits, so the Persian ones are mapped here first.
 */
export function parseAmount(text: string): bigint | null {
  const ascii = text.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/\u066B/g, ".");
  return parseEth(ascii);
}

export const sameAddress = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const isZeroAddress = (a: string) => sameAddress(a, ZERO_ADDRESS);

/** Wei as plain decimal ETH with trailing zeros removed, so the review shows exactly what will be sent. */
export function exactEth(wei: bigint): string {
  const s = formatEth(wei, 18);
  return s.replace(/0+$/, "").replace(/\.$/, "") || "0";
}

/** The allowance this address has on the wallet, 0 when none is recorded. */
export function remainingFor(info: Pick<WalletInfo, "allowances">, address: string): bigint {
  const row = info.allowances.find((r) => sameAddress(r.address, address));
  return row ? row.remaining : 0n;
}

export interface SpendLimits { isOwner: boolean; balance: bigint; remaining: bigint }

/** The owner may send the whole balance; a spender may send the smaller of the balance and their own allowance. */
export function available(l: SpendLimits): bigint {
  if (l.isOwner) return l.balance;
  return l.remaining < l.balance ? l.remaining : l.balance;
}

export type ToProblem = "address" | "zeroAddress";
export type AmountProblem = "amount" | "zeroAmount" | "noAllowance" | "overAllowance" | "overBalance";

export function toProblem(to: string): ToProblem | null {
  if (!isAddress(to)) return "address";
  if (isZeroAddress(to)) return "zeroAddress";
  return null;
}

/** Parses the typed amount and checks it against what this session may send. */
export function amountProblem(amount: string, l: SpendLimits): AmountProblem | null {
  const wei = parseAmount(amount);
  if (wei === null) return "amount";
  if (wei === 0n) return "zeroAmount";
  if (!l.isOwner && l.remaining === 0n) return "noAllowance";
  if (!l.isOwner && wei > l.remaining) return "overAllowance";
  if (wei > l.balance) return "overBalance";
  return null;
}

export type SpenderProblem = "address" | "zeroAddress" | "owner";
/** Who may be added as a spender: any address except the zero address and the owner (who already has full access). */
export function spenderProblem(address: string, owner: string): SpenderProblem | null {
  if (!isAddress(address)) return "address";
  if (isZeroAddress(address)) return "zeroAddress";
  if (sameAddress(address, owner)) return "owner";
  return null;
}

export type NewOwnerProblem = "notAddress" | "zero" | "owner" | "guardian";
/** Why an address cannot become the new owner in a recovery, or null when it can. */
export function newOwnerProblem(address: string, info: Pick<WalletInfo, "owner" | "guardians">): NewOwnerProblem | null {
  if (!isAddress(address)) return "notAddress";
  if (isZeroAddress(address)) return "zero";
  if (sameAddress(address, info.owner)) return "owner";
  if (info.guardians.some((g) => sameAddress(g.address, address))) return "guardian";
  return null;
}

export type GuardianProblem = "notAddress" | "zero" | "owner" | "duplicate";
export function guardianProblem(address: string, info: Pick<WalletInfo, "owner" | "guardians">): GuardianProblem | null {
  if (!isAddress(address)) return "notAddress";
  if (isZeroAddress(address)) return "zero";
  if (sameAddress(address, info.owner)) return "owner";
  if (info.guardians.some((g) => sameAddress(g.address, address))) return "duplicate";
  return null;
}

export type StepState = "done" | "current" | "todo";
/** Propose / Approve / Handover. Idle: propose is next. In progress: proposal made, approvals are next. */
export function stepStates(inProgress: boolean): [StepState, StepState, StepState] {
  return inProgress ? ["done", "current", "todo"] : ["current", "todo", "todo"];
}

/** Choices for the approval threshold: 1 up to the number of guardians. */
export function thresholdOptions(guardianCount: number): number[] {
  return Array.from({ length: Math.max(0, guardianCount) }, (_, i) => i + 1);
}
