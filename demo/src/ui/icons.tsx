import type { ComponentChildren } from "preact";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect x="5" y="5" width="18" height="18" fill="none" stroke="#1E3A72" stroke-width="2" />
      <rect x="5" y="5" width="18" height="18" transform="rotate(45 14 14)" fill="none" stroke="#A63A22" stroke-width="2" />
    </svg>
  );
}
/** The gold lozenge band used as a divider. `id` must be unique per page. */
export function Band({ id = "band" }: { id?: string }) {
  return (
    <svg class="band" aria-hidden="true">
      <defs><pattern id={id} width="28" height="14" patternUnits="userSpaceOnUse"><path d="M14 1 L26 7 L14 13 L2 7Z" fill="none" stroke="#7A5710" stroke-width="1.2" /><circle cx="14" cy="7" r="1.6" fill="#A63A22" /></pattern></defs>
      <rect width="100%" height="14" fill={`url(#${id})`} />
    </svg>
  );
}
export function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
export const ICONS = {
  chapter: "M5 4h14v16H5z M9 9h6 M9 13h6", send: "M5 12h14 M13 6l6 6-6 6", diamond: "M12 3l9 9-9 9-9-9z M12 8v8 M8 12h8",
  shield: "M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z", wallet: "M3 7h18v12H3z M3 7l3-3h12l3 3 M16 13h3", check: "M5 12l4 4 10-10", x: "M6 6l12 12 M18 6L6 18",
  clock: "M12 7v5l3 2 M12 3a9 9 0 100 18 9 9 0 000-18z", key: "M14 10a4 4 0 11-3-3.9 M11 11l9 9 M17 17l2-2", plus: "M12 5v14 M5 12h14",
  walletconnect: "M4 9c5-5 11-5 16 0 M7 12c3-3 7-3 10 0 M12 16v.5",
};
export function Spin({ label }: { label?: string }): ComponentChildren { return <span class="spinner" role="status" aria-label={label} />; }
