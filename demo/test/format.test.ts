import { describe, it, expect } from "vitest";
import { formatEth, parseEth, isAddress } from "../src/format";
import { joinTitle, titleFor } from "../src/titles";
import { dictionaries } from "../src/i18n";

describe("format", () => {
  it("formats and parses ETH", () => {
    expect(formatEth(1_240_000_000_000_000_000n)).toBe("1.2400");
    expect(parseEth("0.05")).toBe(50_000_000_000_000_000n);
    expect(parseEth("۰٫۰۵")).toBe(50_000_000_000_000_000n);
    expect(parseEth("۱")).toBe(10n ** 18n);
    expect(parseEth("1e3")).toBeNull();
    expect(parseEth("-1")).toBeNull();
    expect(parseEth("0.1234567890123456789")).toBeNull();
  });
  it("checks addresses", () => {
    expect(isAddress("0x" + "a".repeat(40))).toBe(true);
    expect(isAddress("0x123")).toBe(false);
  });
  it("packs and unpacks bilingual titles", () => {
    const t = joinTitle("Rakhsh", "رخش");
    expect(titleFor(t, "en")).toBe("Rakhsh");
    expect(titleFor(t, "fa")).toBe("رخش");
    expect(titleFor("Plain", "fa")).toBe("Plain");
  });
});

describe("i18n", () => {
  it("has the same keys in English and Persian", () => {
    const en = Object.keys(dictionaries.en).sort(), fa = Object.keys(dictionaries.fa).sort();
    expect(fa.filter((k) => !en.includes(k))).toEqual([]);
    expect(en.filter((k) => !fa.includes(k))).toEqual([]);
  });
});
