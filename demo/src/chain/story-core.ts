import { Revert } from "./errors";
import { LIMITS, type Address, type ChapterData, type ChapterInput } from "../types";
import { byteLength } from "../titles";

/**
 * TypeScript port of contracts/ShahnamehStory.sol. Same rules, same custom error names.
 * Behaviour is pinned to the Solidity by demo/parity/story-scenarios.json (run in Hardhat and Vitest).
 */
export interface StoryState {
  cooldown: number;
  chapters: ChapterData[];
  nextWriteAt: Record<Address, number>;
  hasChosen: Record<string, boolean>; // `${chapter}|${address}`
  openBranches: number;
}

export class StoryCore {
  state: StoryState;

  constructor(cooldown: number, opening: ChapterInput, author: Address, now: number) {
    if (cooldown > 86400) throw new Revert("InvalidCooldown");
    this.state = { cooldown, chapters: [], nextWriteAt: {}, hasChosen: {}, openBranches: 0 };
    validate(opening);
    if (opening.labelsEn.length === 0) throw new Revert("BadBranchCount");
    this.store(0, 0, opening, author, now);
    this.state.openBranches = opening.labelsEn.length;
  }

  static from(state: StoryState): StoryCore {
    const core = Object.create(StoryCore.prototype) as StoryCore;
    core.state = state;
    return core;
  }

  get chapterCount() { return this.state.chapters.length; }
  get openBranches() { return this.state.openBranches; }
  get cooldown() { return this.state.cooldown; }
  chapter(id: number): ChapterData {
    const c = this.state.chapters[id];
    if (!c) throw new Revert("UnknownChapter");
    return c;
  }
  childOf(id: number, branch: number): number { return this.state.chapters[id]?.children[branch] ?? 0; }
  nextWriteAt(who: Address): number { return this.state.nextWriteAt[who] ?? 0; }
  branchChoices(id: number, branch: number): number { return this.state.chapters[id]?.choices[branch] ?? 0; }
  hasChosen(id: number, who: Address): boolean { return !!this.state.hasChosen[`${id}|${who}`]; }

  writeChapter(sender: Address, parent: number, branch: number, input: ChapterInput, now: number): number {
    const s = this.state;
    const availableAt = s.nextWriteAt[sender] ?? 0;
    if (now < availableAt) throw new Revert("CooldownActive");
    if (parent >= s.chapters.length) throw new Revert("UnknownChapter");
    if (branch >= s.chapters[parent].labelsEn.length) throw new Revert("UnknownBranch");
    if (s.chapters[parent].children[branch] !== 0) throw new Revert("BranchTaken");
    validate(input);
    const openAfter = s.openBranches - 1 + input.labelsEn.length;
    if (openAfter === 0) throw new Revert("LastOpenBranch");
    s.nextWriteAt[sender] = now + s.cooldown;
    s.openBranches = openAfter;
    const id = this.store(parent, branch, input, sender, now);
    s.chapters[parent].children[branch] = id;
    return id;
  }

  chooseBranch(sender: Address, chapter: number, branch: number): number {
    const s = this.state;
    if (chapter >= s.chapters.length) throw new Revert("UnknownChapter");
    const c = s.chapters[chapter];
    if (branch >= c.labelsEn.length) throw new Revert("UnknownBranch");
    const next = c.children[branch];
    if (next === 0) throw new Revert("BranchNotWritten");
    if (s.hasChosen[`${chapter}|${sender}`]) throw new Revert("AlreadyChosen");
    s.hasChosen[`${chapter}|${sender}`] = true;
    c.choices[branch] += 1;
    return next;
  }

  private store(parent: number, branch: number, input: ChapterInput, author: Address, now: number): number {
    const id = this.state.chapters.length;
    const n = input.labelsEn.length;
    this.state.chapters.push({
      ...input,
      labelsEn: [...input.labelsEn],
      labelsFa: [...input.labelsFa],
      id, author, createdAt: now, parent, parentBranch: branch,
      children: new Array(n).fill(0),
      choices: new Array(n).fill(0),
    });
    return id;
  }
}

/** Same checks, in the same order, as ShahnamehStory._validate. */
export function validate(n: ChapterInput): void {
  const t = byteLength(n.title);
  if (t === 0) throw new Revert("EmptyTitle");
  if (t > LIMITS.titleBytes) throw new Revert("TitleTooLong");
  const en = byteLength(n.textEn), fa = byteLength(n.textFa);
  if (en === 0 || fa === 0) throw new Revert("EmptyText");
  if (en + fa > LIMITS.textBytes) throw new Revert("TextTooLong");
  const count = n.labelsEn.length;
  if (count !== n.labelsFa.length) throw new Revert("LabelCountMismatch");
  if (count !== 0 && (count < LIMITS.minBranches || count > LIMITS.maxBranches)) throw new Revert("BadBranchCount");
  for (let i = 0; i < count; i++) for (const l of [n.labelsEn[i], n.labelsFa[i]]) {
    const len = byteLength(l);
    if (len === 0) throw new Revert("EmptyLabel");
    if (len > LIMITS.labelBytes) throw new Revert("LabelTooLong");
  }
}
