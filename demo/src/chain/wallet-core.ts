import { Revert } from "./errors";
import type { Address } from "../types";

/**
 * TypeScript port of basic-eth-wallet/contracts/SmartContractWallet.sol (amounts in wei as bigint).
 * Behaviour is pinned by demo/parity/wallet-scenarios.json. The zero address is "".
 */
export interface WalletState {
  address: Address;
  owner: Address;
  threshold: number;
  balance: bigint;
  guardians: Address[];
  allowance: Record<Address, bigint>;
  proposedOwner: Address; // "" = none
  recoveryRound: number;
  recoveryVotes: number;
  voted: Record<string, boolean>; // `${round}|${guardian}`
}

export class WalletCore {
  state: WalletState;
  constructor(address: Address, owner: Address, threshold: number) {
    if (threshold === 0) throw new Revert("InvalidThreshold");
    this.state = { address, owner, threshold, balance: 0n, guardians: [], allowance: {}, proposedOwner: "", recoveryRound: 0, recoveryVotes: 0, voted: {} };
  }
  static from(state: WalletState): WalletCore {
    const w = Object.create(WalletCore.prototype) as WalletCore;
    w.state = state;
    return w;
  }
  get owner() { return this.state.owner; }
  isGuardian(a: Address) { return this.state.guardians.includes(a); }
  allowanceOf(a: Address) { return this.state.allowance[a] ?? 0n; }
  hasApproved(g: Address) { return this.state.proposedOwner !== "" && !!this.state.voted[`${this.state.recoveryRound}|${g}`]; }

  deposit(amount: bigint) { this.state.balance += amount; }

  private onlyOwner(sender: Address) { if (sender !== this.state.owner) throw new Revert("NotOwner"); }

  setGuardian(sender: Address, guardian: Address, on: boolean) {
    this.onlyOwner(sender);
    if (guardian === "") throw new Revert("ZeroAddress");
    const s = this.state;
    if (this.isGuardian(guardian) === on) return;
    if (on) s.guardians.push(guardian);
    else {
      s.guardians = s.guardians.filter((g) => g !== guardian);
      const key = `${s.recoveryRound}|${guardian}`;
      if (s.voted[key]) { delete s.voted[key]; s.recoveryVotes--; }
    }
  }

  setThreshold(sender: Address, n: number) {
    this.onlyOwner(sender);
    if (n === 0 || n > this.state.guardians.length) throw new Revert("InvalidThreshold");
    this.state.threshold = n;
  }

  setAllowance(sender: Address, spender: Address, amount: bigint) {
    this.onlyOwner(sender);
    this.state.allowance[spender] = amount;
  }

  /** Plain ETH only. Throws TransferFailed when the wallet cannot cover it (the Solidity call fails). */
  transfer(sender: Address, to: Address, amount: bigint) {
    const s = this.state;
    if (to === "") throw new Revert("ZeroAddress");
    let left = 0n;
    if (sender !== s.owner) {
      left = this.allowanceOf(sender);
      if (left === 0n) throw new Revert("NotAllowed");
      if (left < amount) throw new Revert("ExceedsAllowance");
    }
    if (amount > s.balance) throw new Revert("TransferFailed");
    if (sender !== s.owner) s.allowance[sender] = left - amount;
    s.balance -= amount;
  }

  proposeNewOwner(sender: Address, newOwner: Address) {
    const s = this.state;
    if (!this.isGuardian(sender)) throw new Revert("NotGuardian");
    if (newOwner === "" || newOwner === s.owner || newOwner === s.address || this.isGuardian(newOwner)) throw new Revert("InvalidNewOwner");
    const fresh = newOwner !== s.proposedOwner;
    if (!fresh && s.voted[`${s.recoveryRound}|${sender}`]) throw new Revert("AlreadyVoted");
    if (fresh) {
      s.recoveryRound++;
      s.proposedOwner = newOwner;
      s.recoveryVotes = 0;
    }
    s.voted[`${s.recoveryRound}|${sender}`] = true;
    s.recoveryVotes++;
    if (s.recoveryVotes >= s.threshold) {
      s.owner = newOwner;
      this.clearRecovery();
    }
  }

  cancelRecovery(sender: Address) {
    this.onlyOwner(sender);
    if (this.state.proposedOwner === "") throw new Revert("NoRecovery");
    this.clearRecovery();
  }

  private clearRecovery() {
    const s = this.state;
    s.recoveryRound++;
    s.proposedOwner = "";
    s.recoveryVotes = 0;
  }
}
