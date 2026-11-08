import { describe, it, expect } from "vitest";
import {
  amountProblem, available, exactEth, guardianProblem, newOwnerProblem, remainingFor, spenderProblem,
  stepStates, thresholdOptions, toProblem, ZERO_ADDRESS,
} from "../src/screens/wallet-model";
import { WEI } from "../src/format";
import type { WalletInfo } from "../src/types";

const OWNER = "0x3f9Abb0347a468d97e98a9c00e37cebec1abb21C";
const GUARD = "0x7aD3c4f6ac64fb08da1f43d94f479bea2d17c11F";
const OTHER = "0xC4d847273da4472cbddf62462a129a9499a67e02";
const info = {
  owner: OWNER,
  guardians: [{ address: GUARD, approved: false }],
  allowances: [{ address: OTHER, limit: WEI, remaining: WEI / 2n }],
} as unknown as Pick<WalletInfo, "owner" | "guardians" | "allowances">;

describe("available", () => {
  it("is the whole balance for the owner", () => {
    expect(available({ isOwner: true, balance: 5n * WEI, remaining: 0n })).toBe(5n * WEI);
  });
  it("is the smaller of balance and own allowance for a spender", () => {
    expect(available({ isOwner: false, balance: 5n * WEI, remaining: WEI })).toBe(WEI);
    expect(available({ isOwner: false, balance: WEI / 4n, remaining: WEI })).toBe(WEI / 4n);
  });
});

describe("amountProblem", () => {
  const owner = { isOwner: true, balance: WEI, remaining: 0n };
  it("flags empty, zero and over-balance amounts", () => {
    expect(amountProblem("", owner)).toBe("amount");
    expect(amountProblem("abc", owner)).toBe("amount");
    expect(amountProblem("0", owner)).toBe("zeroAmount");
    expect(amountProblem("1.5", owner)).toBe("overBalance");
    expect(amountProblem("0.5", owner)).toBeNull();
  });
  it("uses the allowance for spenders", () => {
    const spender = { isOwner: false, balance: WEI, remaining: WEI / 10n };
    expect(amountProblem("0.2", spender)).toBe("overAllowance");
    expect(amountProblem("0.05", spender)).toBeNull();
    expect(amountProblem("0.05", { ...spender, remaining: 0n })).toBe("noAllowance");
  });
  it("accepts Persian digits", () => {
    expect(amountProblem("۰٫۵", owner)).toBeNull();
  });
});

describe("toProblem", () => {
  it("validates the recipient", () => {
    expect(toProblem("nope")).toBe("address");
    expect(toProblem(ZERO_ADDRESS)).toBe("zeroAddress");
    expect(toProblem(OTHER)).toBeNull();
  });
});

describe("recovery and guardian address rules", () => {
  it("rejects the zero address, the owner and guardians as new owner", () => {
    expect(newOwnerProblem("x", info)).toBe("notAddress");
    expect(newOwnerProblem(ZERO_ADDRESS, info)).toBe("zero");
    expect(newOwnerProblem(OWNER.toLowerCase(), info)).toBe("owner");
    expect(newOwnerProblem(GUARD, info)).toBe("guardian");
    expect(newOwnerProblem(OTHER, info)).toBeNull();
  });
  it("rejects duplicate guardians and the owner", () => {
    expect(guardianProblem(GUARD, info)).toBe("duplicate");
    expect(guardianProblem(OWNER, info)).toBe("owner");
    expect(guardianProblem(OTHER, info)).toBeNull();
  });
  it("rejects a spender that is the owner or zero", () => {
    expect(spenderProblem(OWNER, OWNER)).toBe("owner");
    expect(spenderProblem(ZERO_ADDRESS, OWNER)).toBe("zeroAddress");
    expect(spenderProblem(OTHER, OWNER)).toBeNull();
  });
});

describe("helpers", () => {
  it("looks up remaining allowance case-insensitively, 0 when absent", () => {
    expect(remainingFor(info, OTHER.toUpperCase().replace("0X", "0x"))).toBe(WEI / 2n);
    expect(remainingFor(info, GUARD)).toBe(0n);
  });
  it("formats exact ETH without trailing zeros", () => {
    expect(exactEth(WEI / 20n)).toBe("0.05");
    expect(exactEth(WEI)).toBe("1");
    expect(exactEth(0n)).toBe("0");
  });
  it("derives step states from recovery progress", () => {
    expect(stepStates(false)).toEqual(["current", "todo", "todo"]);
    expect(stepStates(true)).toEqual(["done", "current", "todo"]);
  });
  it("lists thresholds from 1 to the guardian count", () => {
    expect(thresholdOptions(3)).toEqual([1, 2, 3]);
    expect(thresholdOptions(0)).toEqual([]);
  });
});
