import type { Lang } from "./types";

/** The contract stores one title string. We pack "English | فارسی" and show the half for the reader's language. */
export const TITLE_SEP = " | ";
export const joinTitle = (en: string, fa: string) => `${en.trim()}${TITLE_SEP}${fa.trim()}`;
export function titleFor(title: string, lang: Lang): string {
  const i = title.indexOf(TITLE_SEP);
  if (i < 0) return title;
  return lang === "en" ? title.slice(0, i) : title.slice(i + TITLE_SEP.length);
}
export const byteLength = (s: string) => new TextEncoder().encode(s).length;
