import type { ComponentChildren } from "preact";
import { useAdapter, useSession } from "../hooks";
import { useI18n } from "../i18n";
import { href } from "../router";
import { useState } from "preact/hooks";

/** Wrap a screen that needs a connected wallet on the right network. Shows the right prompt otherwise. */
export function RequireWallet({ children }: { children: ComponentChildren }) {
  const { t, lang } = useI18n();
  const a = useAdapter();
  const { session, networkOk } = useSession();
  const [switching, setSwitching] = useState(false);
  if (!session) {
    return (
      <div class="empty" data-testid="needs-wallet">
        <h2>{t("gate.title")}</h2><p class="muted">{t("gate.body")}</p>
        <a class="btn btn-lg" href={href("/connect")}>{t("nav.connect")}</a>
      </div>
    );
  }
  if (!networkOk) {
    return (
      <div class="notice notice-bad" role="alert" data-testid="wrong-network">
        <div class="stack grow">
          <strong>{t("gate.wrongTitle")}</strong><p>{t("err.WrongNetwork", { chain: a.chainName[lang] })}</p>
          <div><button class="btn" disabled={switching} onClick={async () => { setSwitching(true); try { await a.switchNetwork(); } finally { setSwitching(false); } }}>{t("gate.switch", { chain: a.chainName[lang] })}</button></div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
