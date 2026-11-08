import type { Lang, TxKind, TxRecord, TxStatus } from "../types";
import type { Translate } from "../i18n";
import { formatEth, num, short } from "../format";
import type { ICONS } from "../ui/icons";

export type HistoryFilter = "all" | "chapters" | "transfers" | "allowances" | "recovery";
export const HISTORY_FILTERS: readonly HistoryFilter[] = ["all", "chapters", "transfers", "allowances", "recovery"];

const FILTER_KINDS: Record<Exclude<HistoryFilter, "all">, readonly TxKind[]> = {
  chapters: ["chapter", "choice"],
  transfers: ["transfer", "deposit"],
  allowances: ["allowance"],
  recovery: ["recovery", "guardian", "threshold", "owner"],
};

export function matchesFilter(kind: TxKind, filter: HistoryFilter): boolean {
  return filter === "all" || FILTER_KINDS[filter].includes(kind);
}

export function filterRecords<T extends { kind: TxKind }>(records: readonly T[], filter: HistoryFilter): T[] {
  return records.filter((r) => matchesFilter(r.kind, filter));
}

export function countByFilter(records: readonly { kind: TxKind }[]): Record<HistoryFilter, number> {
  const out = { all: records.length } as Record<HistoryFilter, number>;
  for (const f of HISTORY_FILTERS) if (f !== "all") out[f] = filterRecords(records, f).length;
  return out;
}

export type IconName = keyof typeof ICONS;
export function iconFor(kind: TxKind): IconName {
  switch (kind) {
    case "chapter": case "choice": return "chapter";
    case "transfer": return "send";
    case "deposit": return "wallet";
    case "allowance": return "diamond";
    case "guardian": case "threshold": return "shield";
    case "recovery": case "owner": return "key";
  }
}

export const STATUS_TAG: Record<TxStatus, string> = { pending: "tag-warn", confirmed: "tag-ok", failed: "tag-bad" };

/** Everything the screen needs to show a record in the reader's language. */
export interface Context {
  lang: Lang;
  t: Translate;
  /** Friendly name for an address, already in the reader's language. */
  nameOf: (address: string) => string | undefined;
  /** Human text for a contract error name, e.g. "LabelTooLong". */
  errorText: (reason: string) => string;
}

/** "0.05" for 50000000000000000 wei; whole numbers lose their decimals, numbers are shown through num(). */
export function ethText(wei: string | undefined, lang: Lang): string {
  let s = formatEth(BigInt(wei ?? "0"), 6).replace(/\.?0+$/, "");
  if (s === "") s = "0";
  return num(s, lang);
}

/** Short address with the friendly name in brackets when known. */
export function who(address: string, cx: Context): string {
  const name = cx.nameOf(address);
  return name ? `${short(address)} (${name})` : short(address);
}

export interface Described { title: string; detail: string | null }

const chapterNo = (params: TxRecord["params"], lang: Lang) =>
  typeof params.chapter === "number" ? num(params.chapter + 1, lang) : null;

/** Row title and detail line. Chapters are shown with the number the reader sees (id + 1). */
export function describe(r: TxRecord, cx: Context): Described {
  const { t, lang } = cx;
  const amount = () => ethText(r.value, lang);
  const to = r.to ? who(r.to, cx) : null;
  switch (r.kind) {
    case "chapter": {
      const n = chapterNo(r.params, lang);
      const title = typeof r.params.title === "string" ? titleOf(r.params.title, lang) : "";
      const head = n
        ? (title ? t("history.chapter", { n, title }) : t("history.chapter.bare", { n }))
        : (title ? t("history.chapter.new", { title }) : t("history.chapter.newBare"));
      return { title: head, detail: r.status === "failed" && r.reason ? t("history.detail.rejected", { reason: cx.errorText(r.reason) }) : null };
    }
    case "choice":
      return {
        title: t("history.choice", { n: num(Number(r.params.chapter ?? 0) + 1, lang) }),
        detail: typeof r.params.branch === "number" ? t("history.detail.branch", { n: num(r.params.branch + 1, lang) }) : null,
      };
    case "transfer":
      return { title: t("history.transfer", { amount: amount() }), detail: to ? t("history.detail.to", { who: to }) : null };
    case "deposit":
      return { title: t("history.deposit", { amount: amount() }), detail: t("history.detail.from", { who: who(r.from, cx) }) };
    case "allowance":
      return {
        title: BigInt(r.value ?? "0") === 0n ? t("history.allowance.revoked") : t("history.allowance", { amount: amount() }),
        detail: to ? t("history.detail.spender", { who: to }) : null,
      };
    case "guardian":
      return { title: t(r.params.on ? "history.guardian.added" : "history.guardian.removed"), detail: to };
    case "threshold":
      return { title: t("history.threshold", { n: num(String(r.params.threshold ?? "?"), lang) }), detail: null };
    case "recovery": {
      const action = r.params.action;
      if (action === "cancel") return { title: t("history.recovery.cancel"), detail: null };
      if (action === "handover") return { title: t("history.recovery.handover"), detail: to ? t("history.detail.newOwner", { who: to }) : null };
      return { title: t("history.recovery.approve"), detail: to ? t("history.detail.proposed", { who: to }) : null };
    }
    case "owner":
      return { title: t("history.owner"), detail: to ? t("history.detail.newOwner", { who: to }) : null };
  }
}

function titleOf(packed: string, lang: Lang): string {
  const sep = " | ";
  const i = packed.indexOf(sep);
  if (i < 0) return packed;
  return lang === "en" ? packed.slice(0, i) : packed.slice(i + sep.length);
}

/** The call behind the transaction, written the way the contract function is named. */
export function decodedCall(r: TxRecord, cx: Context): string {
  const amount = `${ethText(r.value, cx.lang)} ETH`;
  const to = r.to ? short(r.to) : "?";
  switch (r.kind) {
    case "chapter": return `writeChapter(${r.params.parent ?? "?"}, ${r.params.branch ?? "?"})`;
    case "choice": return `chooseBranch(${r.params.chapter ?? "?"}, ${r.params.branch ?? "?"})`;
    case "transfer": return `transfer(${to}, ${amount})`;
    case "deposit": return `deposit(${amount})`;
    case "allowance": return `setAllowance(${to}, ${amount})`;
    case "guardian": return `setGuardian(${to}, ${r.params.on ? "true" : "false"})`;
    case "threshold": return `setThreshold(${r.params.threshold ?? "?"})`;
    case "recovery":
      if (r.params.action === "cancel") return "cancelRecovery()";
      return `proposeNewOwner(${to})`;
    case "owner": return `setOwner(${to})`;
  }
}
