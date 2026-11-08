import { Adventure } from "./adventure";
import storyJson from "../content/story.json";

export type Lang = "en" | "fa";
export interface Node { ep: number; next: (string | null)[]; en: { text: string; choices: string[] }; fa: { text: string; choices: string[] } }
export interface Story { root: string; episodes: Record<string, Record<Lang, string>>; nodes: Record<string, Node> }
export const story = storyJson as unknown as Story;

export const OPEN = "open";
const choiceKeys = (n: Node) => n.next.map((k) => k ?? OPEN);

/** Deploys the story into the Adventure port: situation text = node key, choice text = target key. */
export function seedStory(s: Story = story): Adventure {
  const root = s.nodes[s.root];
  const chain = new Adventure("author", s.root, choiceKeys(root));
  const queue: [string, number][] = [[s.root, 0]];
  while (queue.length) {
    const [key, id] = queue.shift()!;
    s.nodes[key].next.forEach((child, choice) => {
      if (child === null) return;
      const childId = chain.addSituation("author", id, choice, child, choiceKeys(s.nodes[child]));
      queue.push([child, childId]);
    });
  }
  return chain;
}
