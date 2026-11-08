// TypeScript port of ethereum/contracts/Adventure.sol. Behaviour is pinned to the Solidity
// by parity/adventure-scenarios.json (run in both Hardhat and Vitest).
export class Revert extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Revert";
  }
}

export interface SituationEvent {
  id: number;
  situationText: string;
  choiceTexts: string[];
}

export class Adventure {
  readonly events: SituationEvent[] = [];
  private links = new Map<string, number>();
  private options = new Map<number, number>();
  private authors = new Map<number, string>();
  private signatures = new Map<string, string>();
  private situationCount = 0;
  private pathwayCount: number;

  constructor(sender: string, situationText: string, choiceTexts: string[]) {
    if (choiceTexts.length === 0) throw new Revert("constructor failed because choises were empty");
    if (situationText.length === 0) throw new Revert("constructor failed because situationText were empty");
    this.options.set(0, choiceTexts.length);
    this.pathwayCount = choiceTexts.length;
    this.authors.set(0, sender);
    this.events.push({ id: 0, situationText, choiceTexts });
  }

  addSituation(sender: string, fromSituation: number, fromChoice: number, situationText: string, choiceTexts: string[]): number {
    if (!(this.pathwayCount + choiceTexts.length > 1)) throw new Revert("there was no open pathway");
    if (situationText.length === 0) throw new Revert("situation text was blank");
    if (!(fromChoice < (this.options.get(fromSituation) ?? 0))) throw new Revert("options");
    if ((this.links.get(`${fromSituation}:${fromChoice}`) ?? 0) !== 0) throw new Revert("choice");
    for (const c of choiceTexts) if (c === "") throw new Revert("choice text cannot be empty");
    this.situationCount++;
    this.pathwayCount = this.pathwayCount + choiceTexts.length - 1;
    this.links.set(`${fromSituation}:${fromChoice}`, this.situationCount);
    this.options.set(this.situationCount, choiceTexts.length);
    this.authors.set(this.situationCount, sender);
    this.events.push({ id: this.situationCount, situationText, choiceTexts });
    return this.situationCount;
  }

  addSignature(sender: string, signature: string): void {
    if (signature.length === 0) throw new Revert("signature cannot be empty");
    this.signatures.set(sender, signature);
  }

  getSignature(situation: number): string {
    return this.signatures.get(this.authors.get(situation) ?? "") ?? "";
  }
  getAuthor(situation: number): string | undefined {
    return this.authors.get(situation);
  }
  getPathwayCount(): number {
    return this.pathwayCount;
  }
  getNextSituation(fromSituation: number, fromChoice: number): number {
    return this.links.get(`${fromSituation}:${fromChoice}`) ?? 0;
  }
  situation(id: number): SituationEvent | undefined {
    return this.events[id];
  }
}
