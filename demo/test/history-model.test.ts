import { describe, it, expect } from "vitest";
import {
  countByFilter, decodedCall, describe as describeRecord, ethText, filterRecords, iconFor, matchesFilter,
  type Context, type HistoryFilter,
} from "../src/screens/history-model";
import type { TxRecord } from "../src/types";

const A = "0x51B2aB3c4D5e6F7a8B9c0D1e2F3a4B5c60aE9";
const B = "0x1c7Fd0e3a1b2c3d4e5f60718293a4b5c6d7ed0e3";
const WEI = 10n ** 18n;

const rec = (over: Partial<TxRecord>): TxRecord => ({
  hash: "0x9c1e00000000000000000000000000000000000000000000000000000047d0",
  kind: "transfer", status: "confirmed", from: B, params: {}, timestamp: 1000, ...over,
});

/** Stub translator: returns the key plus its params, so tests can see what the screen would ask for. */
const t = (key: string, p?: Record<string, string | number>) => (p ? `${key}${JSON.stringify(p)}` : key);
const cx = (lang: "en" | "fa" = "en", names: Record<string, string> = { [A]: "Story Bot" }): Context => ({
  lang, t, nameOf: (a) => names[a], errorText: (r) => `err:${r}`,
});

describe("filters", () => {
  const kinds: TxRecord["kind"][] = ["chapter", "choice", "transfer", "deposit", "allowance", "guardian", "threshold", "recovery", "owner"];
  it("groups kinds as the filter buttons do", () => {
    expect(matchesFilter("chapter", "chapters")).toBe(true);
    expect(matchesFilter("choice", "chapters")).toBe(true);
    expect(matchesFilter("deposit", "transfers")).toBe(true);
    expect(matchesFilter("allowance", "allowances")).toBe(true);
    for (const k of ["guardian", "threshold", "recovery", "owner"] as const) expect(matchesFilter(k, "recovery")).toBe(true);
    expect(matchesFilter("transfer", "recovery")).toBe(false);
    expect(matchesFilter("chapter", "transfers")).toBe(false);
    for (const k of kinds) expect(matchesFilter(k, "all")).toBe(true);
  });

  it("counts every filter and keeps the order of the records", () => {
    const rows = [rec({ kind: "chapter" }), rec({ kind: "transfer" }), rec({ kind: "guardian" }), rec({ kind: "choice" })];
    expect(countByFilter(rows)).toEqual({ all: 4, chapters: 2, transfers: 1, allowances: 0, recovery: 1 });
    expect(filterRecords(rows, "chapters").map((r) => r.kind)).toEqual(["chapter", "choice"]);
    expect(filterRecords(rows, "allowances" as HistoryFilter)).toEqual([]);
  });

  it("maps every kind to an icon name", () => {
    for (const k of kinds) expect(typeof iconFor(k)).toBe("string");
  });
});

describe("ethText", () => {
  it("drops trailing zeros and keeps small amounts", () => {
    expect(ethText(String(WEI / 20n), "en")).toBe("0.05");
    expect(ethText(String(WEI), "en")).toBe("1");
    expect(ethText("0", "en")).toBe("0");
    expect(ethText(undefined, "en")).toBe("0");
    expect(ethText("400000000000000", "en")).toBe("0.0004");
  });

  it("shows digits in Persian for fa", () => {
    expect(ethText(String(WEI / 20n), "fa")).toBe("۰.۰۵");
  });
});

describe("describe", () => {
  it("titles a chapter with the reader's number and language half", () => {
    const d = describeRecord(rec({ kind: "chapter", params: { chapter: 7, title: "Bow | کمان" } }), cx());
    expect(d.title).toBe(`history.chapter${JSON.stringify({ n: "8", title: "Bow" })}`);
    expect(d.detail).toBeNull();
    const fa = describeRecord(rec({ kind: "chapter", params: { chapter: 7, title: "Bow | کمان" } }), cx("fa"));
    expect(fa.title).toBe(`history.chapter${JSON.stringify({ n: "۸", title: "کمان" })}`);
  });

  it("shows a failed chapter as new with the revert reason", () => {
    const d = describeRecord(rec({ kind: "chapter", status: "failed", reason: "LabelTooLong", params: { title: "Bow | کمان", parent: 7, branch: 2 } }), cx());
    expect(d.title).toBe(`history.chapter.new${JSON.stringify({ title: "Bow" })}`);
    expect(d.detail).toBe(`history.detail.rejected${JSON.stringify({ reason: "err:LabelTooLong" })}`);
  });

  it("describes choices with a 1-based branch", () => {
    const d = describeRecord(rec({ kind: "choice", params: { chapter: 3, branch: 0 } }), cx());
    expect(d.title).toBe(`history.choice${JSON.stringify({ n: "4" })}`);
    expect(d.detail).toBe(`history.detail.branch${JSON.stringify({ n: "1" })}`);
  });

  it("names transfer counterparts and amounts", () => {
    const d = describeRecord(rec({ kind: "transfer", to: A, value: String(WEI / 20n) }), cx());
    expect(d.title).toBe(`history.transfer${JSON.stringify({ amount: "0.05" })}`);
    expect(d.detail).toContain("history.detail.to");
    expect(d.detail).toContain("Story Bot");
  });

  it("shows a zero allowance as revoked", () => {
    expect(describeRecord(rec({ kind: "allowance", value: "0", to: A }), cx()).title).toBe("history.allowance.revoked");
    expect(describeRecord(rec({ kind: "allowance", value: String(WEI / 10n), to: A }), cx()).title)
      .toBe(`history.allowance${JSON.stringify({ amount: "0.1" })}`);
  });

  it("uses add or remove for guardians and the value for thresholds", () => {
    expect(describeRecord(rec({ kind: "guardian", params: { on: true }, to: B }), cx()).title).toBe("history.guardian.added");
    expect(describeRecord(rec({ kind: "guardian", params: { on: false }, to: B }), cx()).title).toBe("history.guardian.removed");
    expect(describeRecord(rec({ kind: "threshold", params: { threshold: 2 } }), cx()).title).toBe(`history.threshold${JSON.stringify({ n: "2" })}`);
  });

  it("names each recovery action", () => {
    expect(describeRecord(rec({ kind: "recovery", params: { action: "approve" }, to: B }), cx()).title).toBe("history.recovery.approve");
    expect(describeRecord(rec({ kind: "recovery", params: { action: "cancel" } }), cx()).title).toBe("history.recovery.cancel");
    expect(describeRecord(rec({ kind: "recovery", params: { action: "handover" }, to: B }), cx()).title).toBe("history.recovery.handover");
  });
});

describe("decodedCall", () => {
  it("writes the call the way the contract names it", () => {
    expect(decodedCall(rec({ kind: "chapter", params: { parent: 7, branch: 2 } }), cx())).toBe("writeChapter(7, 2)");
    expect(decodedCall(rec({ kind: "transfer", to: A, value: String(WEI / 5n) }), cx())).toBe("transfer(0x51B2…0aE9, 0.2 ETH)");
    expect(decodedCall(rec({ kind: "allowance", to: A, value: String(WEI / 10n) }), cx())).toBe("setAllowance(0x51B2…0aE9, 0.1 ETH)");
    expect(decodedCall(rec({ kind: "guardian", to: B, params: { on: true } }), cx())).toBe("setGuardian(0x1c7F…d0e3, true)");
    expect(decodedCall(rec({ kind: "recovery", to: B, params: { action: "approve" } }), cx())).toBe("proposeNewOwner(0x1c7F…d0e3)");
    expect(decodedCall(rec({ kind: "recovery", params: { action: "cancel" } }), cx())).toBe("cancelRecovery()");
  });
});
