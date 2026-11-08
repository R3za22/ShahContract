import storyJson from "../../content/story.json";
import { StoryCore } from "./story-core";
import { WalletCore } from "./wallet-core";
import { ADDR } from "./accounts";
import { joinTitle } from "../titles";
import { WEI } from "../format";
import type { Address, TxRecord } from "../types";
import type { MockState } from "./mock-state";

interface Node { ep: number; title: { en: string; fa: string }; next: (string | null)[]; en: { text: string; choices: string[] }; fa: { text: string; choices: string[] } }
export interface StoryFile { root: string; nodes: Record<string, Node> }
export const storyFile = storyJson as unknown as StoryFile;

const AUTHORS: Address[] = [ADDR.farzaneh, ADDR.kaveh, ADDR.bahar, ADDR.storybot, ADDR.you];
export const DEMO_COOLDOWN = 60;

/** Writes the draft story into the story-core breadth-first, as if different readers had written it over the past weeks. */
export function seedStory(now: number, file: StoryFile = storyFile): StoryCore {
  const asInput = (n: Node) => ({ title: joinTitle(n.title.en, n.title.fa), textEn: n.en.text, textFa: n.fa.text, labelsEn: n.en.choices, labelsFa: n.fa.choices });
  const root = file.nodes[file.root];
  const t0 = now - 21 * 86400;
  const core = new StoryCore(0, asInput(root), AUTHORS[0], t0);
  const queue: [string, number][] = [[file.root, 0]];
  let step = 0;
  while (queue.length) {
    const [key, id] = queue.shift()!;
    file.nodes[key].next.forEach((child, branch) => {
      if (child === null) return;
      step++;
      const childId = core.writeChapter(AUTHORS[step % AUTHORS.length], id, branch, asInput(file.nodes[child]), t0 + step * 86400 * 1.2);
      queue.push([child, childId]);
    });
  }
  core.state.cooldown = DEMO_COOLDOWN;
  core.state.nextWriteAt = {};
  // a few earlier readers' choices, so branch counts are not all zero
  core.chooseBranch(ADDR.reader, 0, 0);
  core.chooseBranch(ADDR.kaveh, 0, 0);
  core.chooseBranch(ADDR.bahar, 0, 1);
  return core;
}

let counter = 0;
export function fakeHash(seed: string | number): string {
  let h1 = 0xdeadbeef ^ ++counter, h2 = 0x41c6ce57 ^ counter;
  const s = String(seed) + counter;
  let out = "";
  for (let r = 0; r < 8; r++) {
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    out += ((h1 >>> 0).toString(16).padStart(8, "0"));
  }
  return "0x" + out.slice(0, 64);
}

export function seedMockState(now: number): MockState {
  const story = seedStory(now);
  const wallet = new WalletCore(ADDR.wallet, ADDR.you, 2);
  const limits: Record<Address, string> = {};
  const history: TxRecord[] = [];
  let block = 6_100_000;
  const rec = (kind: TxRecord["kind"], ago: number, extra: Partial<TxRecord> & { from?: Address }) => {
    block += 37;
    history.push({ hash: fakeHash(kind + ago), kind, status: "confirmed", from: ADDR.you, params: {}, timestamp: now - ago, block, fee: "400000000000000", ...extra });
  };
  const day = 86400;
  for (const g of [ADDR.farzaneh, ADDR.kaveh, ADDR.bahar]) wallet.setGuardian(ADDR.you, g, true);
  rec("guardian", 8 * day, { to: ADDR.farzaneh, params: { on: true } });
  rec("guardian", 8 * day - 600, { to: ADDR.kaveh, params: { on: true } });
  rec("guardian", 7 * day, { to: ADDR.bahar, params: { on: true } });
  wallet.deposit(129n * WEI / 100n);
  rec("deposit", 6 * day, { value: (129n * WEI / 100n).toString(), params: {} });
  wallet.setAllowance(ADDR.you, ADDR.storybot, WEI / 10n);
  limits[ADDR.storybot] = (WEI / 10n).toString();
  rec("allowance", 3 * day, { to: ADDR.storybot, value: (WEI / 10n).toString() });
  wallet.setAllowance(ADDR.you, ADDR.farzaneh, WEI / 50n);
  limits[ADDR.farzaneh] = (WEI / 50n).toString();
  rec("allowance", 3 * day - 300, { to: ADDR.farzaneh, value: (WEI / 50n).toString() });
  rec("chapter", day, { status: "failed", reason: "LabelTooLong", params: { parent: 7, branch: 2 } });
  wallet.transfer(ADDR.storybot, ADDR.reader, WEI / 20n);
  rec("transfer", 2 * 3600, { from: ADDR.storybot, to: ADDR.reader, value: (WEI / 20n).toString() });
  return {
    v: 1, story: story.state, wallet: wallet.state, history: history.reverse(), block, actor: ADDR.you,
    connected: false, limits, recoveryProposer: "",
  };
}
