import type { Lang } from "./types";

export const WEI = 10n ** 18n;
export const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** wei -> "1.2400" (4 decimals by default, rounded down). */
export function formatEth(wei: bigint, decimals = 4): string {
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const unit = 10n ** BigInt(18 - decimals);
  const scaled = v / unit;
  const whole = scaled / 10n ** BigInt(decimals);
  const frac = (scaled % 10n ** BigInt(decimals)).toString().padStart(decimals, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

/** "0.05" -> wei. Returns null for anything that is not a plain non-negative decimal with at most 18 digits after the point. */
export function parseEth(text: string): bigint | null {
  const t = text.trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace("٫", ".");
  if (!/^\d+(\.\d{1,18})?$/.test(t)) return null;
  const [w, f = ""] = t.split(".");
  return BigInt(w) * WEI + BigInt(f.padEnd(18, "0"));
}

export const isAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s.trim());

const faDigits = "۰۱۲۳۴۵۶۷۸۹";
export const num = (n: number | string, lang: Lang) => (lang === "fa" ? String(n).replace(/\d/g, (d) => faDigits[Number(d)]) : String(n));

export function timeAgo(ts: number, now: number, lang: Lang): string {
  const s = Math.max(0, now - ts);
  const units: [number, string, string][] = [[86400 * 7, "week", "هفته"], [86400, "day", "روز"], [3600, "hour", "ساعت"], [60, "minute", "دقیقه"]];
  if (s < 30) return lang === "fa" ? "همین الان" : "Just now";
  for (const [sec, en, fa] of units) {
    if (s >= sec) {
      const n = Math.floor(s / sec);
      return lang === "fa" ? `${num(n, lang)} ${fa} پیش` : `${n} ${en}${n > 1 ? "s" : ""} ago`;
    }
  }
  return lang === "fa" ? "کمتر از یک دقیقه پیش" : "Less than a minute ago";
}
