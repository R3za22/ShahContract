import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { useAdapter, useSession } from "../hooks";
import { setLang, useI18n } from "../i18n";
import { href, useRoute } from "../router";
import { config } from "../config";
import { short } from "../format";
import { DemoControls } from "./DemoControls";
import { Logo } from "./icons";

const NAV: [string, string, string][] = [["/read", "nav.read", "read"], ["/write", "nav.write", "write"], ["/wallet", "nav.wallet", "wallet"], ["/history", "nav.history", "history"]];

export function Layout({ children }: { children: ComponentChildren }) {
  const { t, lang } = useI18n();
  const a = useAdapter();
  const route = useRoute();
  const { session } = useSession();
  const [bannerOpen, setBannerOpen] = useState(config.demoBanner);
  const current = route.segments[0] ?? "";
  return (
    <>
      <a class="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>{t("nav.skip")}</a>
      {bannerOpen ? (
        <div class="banner" role="note" data-testid="banner">
          <a href={t("banner.home")}>{t("banner.text")}</a>
          <button class="btn btn-link" style="min-height:32px;color:inherit" aria-label={t("banner.dismiss")} onClick={() => setBannerOpen(false)}>×</button>
        </div>
      ) : null}
      <header class="site-header">
        <a class="brand" href={href("/")}><Logo /><span>{t("app.name")}</span></a>
        <nav class="nav" aria-label={t("nav.main")}>
          {NAV.map(([path, key, seg]) => <a href={href(path)} aria-current={current === seg ? "page" : undefined}>{t(key)}</a>)}
        </nav>
        <div class="row">
          <div class="lang" role="group" aria-label={t("lang.label")}>
            <button aria-pressed={lang === "en"} onClick={() => setLang("en")} lang="en">EN</button>
            <button aria-pressed={lang === "fa"} onClick={() => setLang("fa")} lang="fa" aria-label={t("lang.fa")}>فا</button>
          </div>
          {session ? (
            <a class="session-pill" href={href("/connect")} data-testid="session-pill"><span class="dot" /><span class="addr">{short(session.address)}</span></a>
          ) : (
            <a class="btn" href={href("/connect")} data-testid="connect-link">{t("nav.connect")}</a>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer class="site-footer">
        <div class="wrap">
          <span>{t("footer.licence")}</span>
          <span data-testid="mode-note">{a.mode === "mock" ? t("footer.mode.mock") : t("footer.mode.live", { chain: a.chainName[lang] })}</span>
        </div>
        {a.mode === "mock" ? <div class="wrap" style="margin-top:16px"><DemoControls /></div> : null}
      </footer>
    </>
  );
}
