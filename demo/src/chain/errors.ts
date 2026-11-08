/** A contract revert. `name` is the Solidity custom error name, e.g. "BranchTaken". */
export class Revert extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = "Revert";
    this.reason = reason;
  }
}
/** The user declined the signature or connection request in their wallet. */
export class UserRejected extends Error {
  constructor() {
    super("UserRejected");
    this.name = "UserRejected";
  }
}
export class WrongNetwork extends Error {
  constructor() {
    super("WrongNetwork");
    this.name = "WrongNetwork";
  }
}
export class NoWallet extends Error {
  constructor() {
    super("NoWallet");
    this.name = "NoWallet";
  }
}
