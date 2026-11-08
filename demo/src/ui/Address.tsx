import { useAdapter } from "../hooks";
import { useI18n } from "../i18n";
import { short } from "../format";

/** Shortened address (0x3f9A…b21C) with the full value in the tooltip, and the friendly name if the adapter knows one. */
export function Address({ value, withName = false }: { value: string; withName?: boolean }) {
  const a = useAdapter();
  const { lang } = useI18n();
  const name = a.nameOf(value)?.[lang];
  return (
    <span>
      {withName && name ? <span>{name} </span> : null}
      <span class="addr" title={value} data-full={value}>{short(value)}</span>
    </span>
  );
}
