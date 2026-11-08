import { validate } from "../chain/story-core";
import { Revert } from "../chain/errors";
import { byteLength, joinTitle } from "../titles";
import { LIMITS, type ChapterData, type ChapterInput } from "../types";

/** What the writer has typed. Labels stay in the draft even while "ending" hides them. */
export interface BranchDraft { en: string; fa: string }
export interface Draft {
  titleEn: string;
  titleFa: string;
  textEn: string;
  textFa: string;
  branches: BranchDraft[];
  ending: boolean;
}

export const DRAFT_KEY = "shahnameh-draft";
export const emptyBranch = (): BranchDraft => ({ en: "", fa: "" });
export function emptyDraft(): Draft {
  return { titleEn: "", titleFa: "", textEn: "", textFa: "", branches: [emptyBranch(), emptyBranch()], ending: false };
}

export function isBlankDraft(d: Draft): boolean {
  return !d.ending && d.titleEn === "" && d.titleFa === "" && d.textEn === "" && d.textFa === ""
    && d.branches.every((b) => b.en === "" && b.fa === "");
}

/** The ChapterInput that is sent on chain. Everything is trimmed, so counters match what is stored. */
export function buildInput(d: Draft): ChapterInput {
  const en = d.titleEn.trim(), fa = d.titleFa.trim();
  const rows = d.ending ? [] : d.branches;
  return {
    title: en && fa ? joinTitle(en, fa) : "",
    textEn: d.textEn.trim(),
    textFa: d.textFa.trim(),
    labelsEn: rows.map((b) => b.en.trim()),
    labelsFa: rows.map((b) => b.fa.trim()),
  };
}

export const labelBytes = (s: string) => byteLength(s.trim());
export const labelTooLong = (s: string) => labelBytes(s) > LIMITS.labelBytes;

/**
 * The first rule the draft breaks, as a contract reason name (the i18n key is `err.<reason>`), or null.
 * Empty-field checks run first; the rest is the contract's own validate().
 */
export function firstError(d: Draft): string | null {
  if (!d.titleEn.trim() || !d.titleFa.trim()) return "EmptyTitle";
  if (!d.textEn.trim() || !d.textFa.trim()) return "EmptyText";
  if (!d.ending) {
    for (const b of d.branches) if (!b.en.trim() || !b.fa.trim()) return "EmptyLabel";
  }
  try {
    validate(buildInput(d));
    return null;
  } catch (e) {
    if (e instanceof Revert) return e.reason;
    throw e;
  }
}

export function titleBytes(d: Draft): number { return byteLength(buildInput(d).title); }
export function textBytes(d: Draft): number {
  const i = buildInput(d);
  return byteLength(i.textEn) + byteLength(i.textFa);
}

/** A query value such as "7" -> 7. Anything that is not a plain non-negative integer -> null. */
export function parseIndex(s: string | null): number | null {
  if (s === null || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/** Why `branch` of `c` cannot be continued, or null when it is open. */
export function targetProblem(c: ChapterData, branch: number): "UnknownBranch" | "BranchTaken" | null {
  if (!Number.isInteger(branch) || branch < 0 || branch >= c.labelsEn.length) return "UnknownBranch";
  if (c.children[branch] !== 0) return "BranchTaken";
  return null;
}

export interface OpenBranch {
  parent: number;
  branch: number;
  parentTitle: string;
  labelEn: string;
  labelFa: string;
}
/** Every branch that has no continuation yet, in story order. */
export function openBranches(chapters: ChapterData[]): OpenBranch[] {
  const out: OpenBranch[] = [];
  for (const c of chapters) {
    c.labelsEn.forEach((labelEn, branch) => {
      if (c.children[branch] === 0) out.push({ parent: c.id, branch, parentTitle: c.title, labelEn, labelFa: c.labelsFa[branch] ?? "" });
    });
  }
  return out;
}

/** Parses the saved draft. Returns null for anything that does not have the right shape. */
export function readDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const strs = ["titleEn", "titleFa", "textEn", "textFa"] as const;
  if (!strs.every((k) => typeof o[k] === "string")) return null;
  if (!Array.isArray(o.branches) || o.branches.length < LIMITS.minBranches || o.branches.length > LIMITS.maxBranches) return null;
  const branches: BranchDraft[] = [];
  for (const b of o.branches) {
    if (!b || typeof b !== "object") return null;
    const r = b as Record<string, unknown>;
    if (typeof r.en !== "string" || typeof r.fa !== "string") return null;
    branches.push({ en: r.en, fa: r.fa });
  }
  return {
    titleEn: o.titleEn as string, titleFa: o.titleFa as string,
    textEn: o.textEn as string, textFa: o.textFa as string,
    branches, ending: o.ending === true,
  };
}
