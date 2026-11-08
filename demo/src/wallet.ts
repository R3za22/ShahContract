import { Revert } from "./adventure";

// TypeScript port of basic-eth-wallet/contracts/SmartContractWallet.sol (amounts are plain integers).
// Behaviour pinned by parity/wallet-scenarios.json. Faithful quirks kept on purpose:
// vote flags are never cleared, and a removed guardian's earlier votes still count.
export class SmartContractWallet {
  static readonly CONFIRMATIONS = 3;
  owner: string;
  balance = 0;
  allowance = new Map<string, number>();
  isAllowedToSend = new Map<string, boolean>();
  guardians = new Map<string, boolean>();
  nextOwner = "";
  guardianResetCount = 0;
  private voted = new Set<string>();
  /** ETH that left the wallet, per recipient (demo display only). */
  sent = new Map<string, number>();

  constructor(sender: string) {
    this.owner = sender;
  }

  fund(amount: number): void {
    this.balance += amount;
  }

  setGuardian(sender: string, guardian: string, isGuardian: boolean): void {
    if (sender !== this.owner) throw new Revert("you are not the owner");
    this.guardians.set(guardian, isGuardian);
  }

  proposeNewOwner(sender: string, newOwner: string): void {
    if (!this.guardians.get(sender)) throw new Revert("you are not a guardian of this wallet");
    if (this.voted.has(`${newOwner}|${sender}`)) throw new Revert("you already Voted");
    if (newOwner !== this.nextOwner) {
      this.nextOwner = newOwner;
      this.guardianResetCount = 0;
    }
    this.voted.add(`${newOwner}|${sender}`);
    this.guardianResetCount++;
    if (this.guardianResetCount >= SmartContractWallet.CONFIRMATIONS) {
      this.owner = this.nextOwner;
      this.nextOwner = "";
      this.guardianResetCount = 0;
    }
  }

  setAllowance(sender: string, who: string, amount: number): void {
    if (sender !== this.owner) throw new Revert("you are not the owner");
    this.allowance.set(who, amount);
    this.isAllowedToSend.set(who, amount > 0);
  }

  transfer(sender: string, to: string, amount: number): void {
    if (sender !== this.owner) {
      if (!this.isAllowedToSend.get(sender)) throw new Revert("you are not allowed to send anything from this smart contract");
      if (!((this.allowance.get(sender) ?? 0) >= amount)) throw new Revert("you are trying to send more than you are allowed to");
      this.allowance.set(sender, (this.allowance.get(sender) ?? 0) - amount);
    }
    if (amount > this.balance) {
      // the EVM call fails, the whole tx (including the allowance decrement) reverts
      if (sender !== this.owner) this.allowance.set(sender, (this.allowance.get(sender) ?? 0) + amount);
      throw new Revert("transfer failed");
    }
    this.balance -= amount;
    this.sent.set(to, (this.sent.get(to) ?? 0) + amount);
  }

  getAllowance(who: string): number {
    return this.allowance.get(who) ?? 0;
  }
  hasVoted(newOwner: string, guardian: string): boolean {
    return this.voted.has(`${newOwner}|${guardian}`);
  }
}
