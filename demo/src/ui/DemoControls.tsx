import { useAdapter, useVersion } from "../hooks";
import { useI18n } from "../i18n";
import { short } from "../format";

/** Only rendered for the simulated chain. */
export function DemoControls() {
  const a = useAdapter();
  const { t, lang } = useI18n();
  useVersion();
  const d = a.demo;
  if (!d) return null;
  const session = a.session();
  const actors = a.actors?.() ?? [];
  const flag = (key: "rejectNextSignature" | "failNextTransaction" | "wrongNetwork", label: string) => (
    <label><input type="checkbox" checked={d[key]} onChange={(e) => d.set(key, (e.currentTarget as HTMLInputElement).checked)} data-testid={`demo-${key}`} /> {label}</label>
  );
  return (
    <details class="demo-panel" data-testid="demo-controls">
      <summary><strong>{t("demo.title")}</strong></summary>
      <p class="hint">{t("demo.explain")}</p>
      {session && actors.length > 0 ? (
        <label>{t("demo.actAs")}
          <select class="select" data-testid="demo-actor" value={session.address} onChange={(e) => a.switchActor?.((e.currentTarget as HTMLSelectElement).value)}>
            {actors.map((x) => <option value={x}>{a.nameOf(x)?.[lang] ?? short(x)} · {short(x)}</option>)}
          </select>
        </label>
      ) : null}
      {flag("rejectNextSignature", t("demo.reject"))}
      {flag("failNextTransaction", t("demo.fail"))}
      {flag("wrongNetwork", t("demo.wrongNetwork"))}
      <div><button class="btn btn-ghost" onClick={() => d.reset()} data-testid="demo-reset">{t("demo.reset")}</button></div>
    </details>
  );
}
