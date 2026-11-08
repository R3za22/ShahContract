import { createStore } from "../store";
import type { Lang } from "../types";
import { common } from "./common";
import { landing } from "./landing";
import { connect } from "./connect";
import { reader } from "./reader";
import { write } from "./write";
import { wallet } from "./wallet";
import { recovery } from "./recovery";
import { history } from "./history";

export type Dict = Record<string, string>;
const parts = [common, landing, connect, reader, write, wallet, recovery, history];
export const dictionaries: Record<Lang, Dict> = {
  en: Object.assign({}, ...parts.map((p) => p.en)),
  fa: Object.assign({}, ...parts.map((p) => p.fa)),
};

function initialLang(): Lang {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "fa" || q === "en") return q;
    const saved = localStorage.getItem("shahnameh-lang");
    if (saved === "fa" || saved === "en") return saved;
  } catch { /* ignore */ }
  return "en";
}
export const langStore = createStore<Lang>(initialLang());

export function setLang(lang: Lang) {
  langStore.set(lang);
  try { localStorage.setItem("shahnameh-lang", lang); } catch { /* ignore */ }
  applyLang(lang);
}
export function applyLang(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
}

export type Translate = (key: string, params?: Record<string, string | number>) => string;
export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let s = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
/** const { t, lang } = useI18n(); t("nav.read") */
export function useI18n(): { lang: Lang; t: Translate; dir: "rtl" | "ltr" } {
  const lang = langStore.use();
  return { lang, dir: lang === "fa" ? "rtl" : "ltr", t: (key, params) => translate(lang, key, params) };
}
