import { useRef, useState } from "preact/hooks";
import type { WalletKind } from "../types";
import { errorName, useAdapter, useSession } from "../hooks";
import { useI18n } from "../i18n";
import { href } from "../router";
import { Address } from "../ui/Address";
import { Icon, ICONS } from "../ui/icons";

interface Option {
  kind: WalletKind;
  name: string;
  note: string;
  tag: string;
  tagClass: string;
  enabled: boolean;
  icon: string;
  featured?: boolean;
}

export function Connect() {
  const { t, lang } = useI18n();
  const a = useAdapter();
  const { session, networkOk } = useSession();
  const [pending, setPending] = useState<WalletKind | null>(null);
  const [failed, setFailed] = useState<{ kind: WalletKind; error: Error } | null>(null);
  const [switching, setSwitching] = useState(false);
  /** Bumped on every attempt and on cancel, so a late result from an old attempt is ignored. */
  const attempt = useRef(0);
  const detect = a.detect();
  const chain = a.chainName[lang];

  const start = async (kind: WalletKind) => {
    const mine = ++attempt.current;
    setPending(kind);
    setFailed(null);
    try {
      await a.connect(kind);
      if (mine === attempt.current) setPending(null);
    } catch (e) {
      if (mine === attempt.current) {
        setFailed({ kind, error: e instanceof Error ? e : new Error(String(e)) });
        setPending(null);
      }
    }
  };

  const cancel = () => {
    attempt.current++;
    setPending(null);
  };

  const switchNetwork = async () => {
    setSwitching(true);
    try { await a.switchNetwork(); } finally { setSwitching(false); }
  };

  const options: Option[] = [
    {
      kind: "injected", name: t("connect.opt.injected.name"), note: t("connect.opt.injected.note"),
      tag: detect.injected ? t("connect.opt.injected.detected") : t("connect.opt.injected.missing"),
      tagClass: detect.injected ? "tag-ok" : "", enabled: detect.injected, icon: ICONS.wallet,
    },
    {
      kind: "walletconnect", name: t("connect.opt.wc.name"), note: t("connect.opt.wc.note"),
      tag: t("connect.opt.wc.tag"), tagClass: "", enabled: false, icon: ICONS.walletconnect,
    },
    {
      kind: "simulated", name: t("connect.opt.sim.name"), note: t("connect.opt.sim.note"),
      tag: t("tag.demo"), tagClass: "tag-demo", enabled: detect.simulated, icon: ICONS.diamond, featured: true,
    },
  ];

  const failedKey = failed
    ? (["UserRejected", "NoWallet", "WrongNetwork"].includes(errorName(failed.error)) ? `err.${errorName(failed.error)}` : "err.generic")
    : "";

  return (
    <div class="wrap page">
      <header class="page-head">
        <h1 data-testid="connect-title">{t("connect.title")}</h1>
        <p class="muted">{t("connect.lede")}</p>
      </header>

      <div class="connect-grid">
        <section class="card stack" aria-labelledby="connect-choose">
          <h2 id="connect-choose" class="connect-sub">{t("connect.choose")}</h2>
          <div class="stack">
            {options.map((o) => {
              const disabled = !o.enabled || pending !== null;
              return (
                <button
                  type="button"
                  class="option-card"
                  data-testid={`connect-option-${o.kind}`}
                  data-variant={o.featured ? "demo" : undefined}
                  disabled={disabled}
                  onClick={() => start(o.kind)}
                >
                  <span class="option-icon" aria-hidden="true"><Icon d={o.icon} size={22} /></span>
                  <span class="option-body">
                    <strong>{o.name}</strong>
                    <span class="small muted">{o.note}</span>
                  </span>
                  <span class={`tag ${o.tagClass}`}>{o.tag}</span>
                </button>
              );
            })}
          </div>
          <p class="small muted">{t("connect.foot")}</p>
        </section>

        <section class="connect-status">
          {pending ? (
            <div class="connect-waiting" role="status" data-testid="connect-waiting">
              <div class="connect-waiting-head">
                <span class="spinner" aria-hidden="true" />
                <div class="wait-text">
                  <strong>{t("connect.wait.title")}</strong>
                  <span class="small">{t("connect.wait.body")}</span>
                </div>
              </div>
              <ol class="wait-steps">
                <li data-state="done"><span class="wait-mark" aria-hidden="true"><Icon d={ICONS.check} size={16} /></span>{t("connect.wait.s1")}</li>
                <li data-state="active"><span class="wait-mark" aria-hidden="true" />{t("connect.wait.s2")}</li>
                <li data-state="todo"><span class="wait-mark" aria-hidden="true" />{t("connect.wait.s3")}</li>
              </ol>
              <div><button type="button" class="btn btn-ghost on-ink" data-testid="connect-cancel" onClick={cancel}>{t("connect.cancel")}</button></div>
            </div>
          ) : null}

          {!pending && failed ? (
            <div class="notice notice-bad" role="alert" data-testid="connect-error">
              <div class="stack grow">
                <strong>{t("connect.error.title")}</strong>
                <p>{t(failedKey, { chain, message: failed.error.message })}</p>
                <div>
                  <button type="button" class="btn" data-testid="connect-retry" onClick={() => start(failed.kind)}>{t("state.retry")}</button>
                </div>
              </div>
            </div>
          ) : null}

          {!pending && session && networkOk ? (
            <div class="connected-card" role="status" data-testid="connected-card">
              <div class="connected-head">
                <span class="connected-mark" aria-hidden="true"><Icon d={ICONS.check} size={20} /></span>
                <strong>{t("connect.connected.title")}</strong>
              </div>
              <div class="connected-meta">
                <Address value={session.address} />
                <span class="tag tag-ok">{chain}</span>
              </div>
              <div class="row">
                <a class="btn" href={href("/read")} data-testid="connect-continue">{t("connect.continue")}</a>
                <button type="button" class="btn btn-ghost" data-testid="disconnect" onClick={() => a.disconnect()}>{t("nav.disconnect")}</button>
              </div>
            </div>
          ) : null}

          {!pending && session && !networkOk ? (
            <div class="notice notice-bad" role="alert" data-testid="wrong-network">
              <div class="stack grow">
                <strong>{t("gate.wrongTitle")}</strong>
                <p>{t("err.WrongNetwork", { chain })}</p>
                <div class="row">
                  <button type="button" class="btn" disabled={switching} data-testid="connect-switch" onClick={switchNetwork}>{t("gate.switch", { chain })}</button>
                  <button type="button" class="btn btn-link" data-testid="disconnect" onClick={() => a.disconnect()}>{t("nav.disconnect")}</button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
