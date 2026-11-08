import { useState } from "preact/hooks";
import type { ChainAdapter } from "../adapter";
import { num } from "../format";
import { useI18n } from "../i18n";
import { useAdapter, useChain, useSession, useTx } from "../hooks";
import { href } from "../router";
import type { GuardianInfo, WalletInfo } from "../types";
import { Address } from "../ui/Address";
import { RequireWallet } from "../ui/RequireWallet";
import { TxStatusCard } from "../ui/TxStatusCard";
import {
  guardianProblem, newOwnerProblem, sameAddress, stepStates, thresholdOptions,
  type GuardianProblem, type NewOwnerProblem,
} from "./wallet-model";

export function Recovery() {
  return <RequireWallet><RecoveryScreen /></RequireWallet>;
}

const STEP_KEYS = ["propose", "approve", "handover"] as const;
const addrMsg: Record<NewOwnerProblem | GuardianProblem, string> = {
  notAddress: "recovery.err.notAddress", zero: "recovery.err.zero", owner: "recovery.err.owner",
  guardian: "recovery.err.guardian", duplicate: "recovery.err.duplicate",
};
const val = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLSelectElement).value;

function RecoveryScreen() {
  const adapter = useAdapter();
  const { t, lang } = useI18n();
  const { session } = useSession();
  const me = session?.address ?? "";
  const info = useChain((x) => x.wallet());
  const recoveryTx = useTx();

  if (info.data === undefined) {
    if (info.error) {
      return (
        <div class="wrap page"><div class="notice notice-bad" role="alert" data-testid="recovery-load-error">
          <div class="stack grow"><strong>{t("state.error")}</strong>
            <div><button type="button" class="btn btn-ghost" onClick={info.reload}>{t("state.retry")}</button></div>
          </div>
        </div></div>
      );
    }
    return (
      <div class="wrap page stack" role="status" aria-live="polite">
        <p class="muted">{t("state.loading")}</p>
        <div class="skeleton recovery-skeleton" aria-hidden="true" />
      </div>
    );
  }

  const w = info.data;
  const isOwner = sameAddress(w.owner, me);
  const guardian = w.guardians.find((g) => sameAddress(g.address, me)) ?? null;
  const inProgress = w.recovery !== null;
  const states = stepStates(inProgress);
  const count = w.guardians.length;

  return (
    <div class="wrap page stack-lg" data-testid="recovery-screen">
      <div class="page-head">
        <a class="btn-link recovery-back" href={href("/wallet")}>{t("recovery.back")}</a>
        <h1>{t("recovery.title")}</h1>
        <p class="muted">{t("recovery.intro", { threshold: num(w.threshold, lang), count: num(count, lang) })}</p>
      </div>

      <ol class="recovery-steps" data-testid="recovery-steps" aria-label={t("recovery.steps.label")}>
        {STEP_KEYS.map((key, i) => (
          <li class="recovery-step" key={key} data-state={states[i]} aria-current={states[i] === "current" ? "step" : undefined}>
            <span class="step-num" aria-hidden="true">{num(i + 1, lang)}</span>
            <span class="step-text">
              <strong>{t(`recovery.steps.${key}`)}</strong>
              <span class="small muted">{t(`recovery.steps.${key}Note`)}</span>
            </span>
          </li>
        ))}
      </ol>

      <div class="recovery-layout">
        <div class="recovery-main stack-lg">
          {w.recovery ? (
            <ActiveRecovery adapter={adapter} info={w} isOwner={isOwner} guardian={guardian} tx={recoveryTx} />
          ) : (
            <section class="empty" data-testid="recovery-empty">
              <strong>{t("recovery.empty.title")}</strong>
              <p class="small muted">{t("recovery.empty.body")}</p>
            </section>
          )}

          <TxStatusCard state={recoveryTx.state} onDismiss={() => recoveryTx.reset()} />

          <ProposeForm adapter={adapter} info={w} isGuardian={guardian !== null} tx={recoveryTx} />
        </div>

        <aside class="recovery-aside stack-lg">
          <GuardiansCard adapter={adapter} info={w} isOwner={isOwner} />
          <section class="card stack" aria-labelledby="next-title" data-testid="what-next">
            <h2 id="next-title">{t("recovery.next.title")}</h2>
            <p class="small muted">{t("recovery.next.body")}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

interface ActiveProps {
  adapter: ChainAdapter;
  info: WalletInfo;
  isOwner: boolean;
  guardian: GuardianInfo | null;
  tx: ReturnType<typeof useTx>;
}

function ActiveRecovery({ adapter, info, isOwner, guardian, tx }: ActiveProps) {
  const { t, lang } = useI18n();
  const rec = info.recovery;
  if (!rec) return null;
  const votes = rec.votes;
  const max = info.threshold;
  const canApprove = guardian !== null && !guardian.approved && !tx.busy;
  const label = t("recovery.approvals", { n: num(votes, lang), max: num(max, lang) });

  return (
    <section class="card stack" aria-labelledby="active-title" data-testid="recovery-active">
      <div class="row recovery-active-head">
        <h2 id="active-title">{t("recovery.active.title")}</h2>
        <span class="tag tag-warn" data-testid="approvals-count">{label}</span>
      </div>
      <progress class="recovery-meter" value={votes} max={Math.max(1, max)} aria-label={label} />

      <dl class="recovery-facts">
        <div class="fact">
          <dt class="small muted">{t("recovery.current")}</dt>
          <dd><Address value={info.owner} withName /></dd>
        </div>
        <div class="fact">
          <dt class="small muted">{t("recovery.proposed")}</dt>
          <dd><Address value={rec.proposed} withName /></dd>
        </div>
        <div class="fact">
          <dt class="small muted">{t("recovery.proposedBy")}</dt>
          <dd>{rec.proposer ? <Address value={rec.proposer} withName /> : t("recovery.unknown")}</dd>
        </div>
      </dl>

      <ul class="guardian-list">
        {info.guardians.map((g) => (
          <li class="guardian-row" key={g.address} data-testid="guardian-row">
            <span class="guardian-who"><Address value={g.address} withName /></span>
            <span class={`tag ${g.approved ? "tag-ok" : "tag-warn"}`} data-approved={g.approved ? "true" : "false"}>
              {g.approved ? t("recovery.state.approved") : t("recovery.state.waiting")}
            </span>
          </li>
        ))}
      </ul>

      {canApprove ? (
        <div>
          <button type="button" class="btn btn-seal" data-testid="approve-btn" disabled={tx.busy}
            onClick={() => void tx.run(() => adapter.proposeNewOwner(rec.proposed))}>
            {t("recovery.approve")}
          </button>
        </div>
      ) : null}

      {isOwner ? (
        <div class="stack recovery-cancel">
          <div>
            <button type="button" class="btn btn-danger" data-testid="cancel-recovery" disabled={tx.busy}
              onClick={() => void tx.run(() => adapter.cancelRecovery())}>
              {t("recovery.cancel")}
            </button>
          </div>
          <p class="small muted">{t("recovery.cancelNote")}</p>
        </div>
      ) : null}
    </section>
  );
}

function ProposeForm({ adapter, info, isGuardian, tx }: {
  adapter: ChainAdapter; info: WalletInfo; isGuardian: boolean; tx: ReturnType<typeof useTx>;
}) {
  const { t } = useI18n();
  const [addr, setAddr] = useState("");
  const problem: NewOwnerProblem | null = addr.trim() === "" ? null : newOwnerProblem(addr, info);
  const ready = isGuardian && addr.trim() !== "" && problem === null && !tx.busy;

  if (!isGuardian) {
    return (
      <section class="notice" role="note" data-testid="propose-notice">
        <div class="stack grow"><p>{t("recovery.propose.notGuardian")}</p></div>
      </section>
    );
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (!ready) return;
    const rec = await tx.run(() => adapter.proposeNewOwner(addr.trim()));
    if (rec?.status === "confirmed") setAddr("");
  }

  return (
    <form class="card stack" aria-labelledby="propose-title" data-testid="propose-form" noValidate onSubmit={submit}>
      <h2 id="propose-title">{t("recovery.propose.title")}</h2>
      <p class="small muted">{t("recovery.propose.lede")}</p>
      <div class="field">
        <label htmlFor="propose-addr">{t("recovery.propose.label")}</label>
        <input id="propose-addr" data-testid="propose-addr" class="input mono" value={addr} dir="ltr" lang="en"
          autoComplete="off" spellcheck={false}
          aria-invalid={problem ? "true" : undefined} aria-describedby="propose-error propose-rejected"
          onInput={(e) => setAddr(val(e))} />
        <span id="propose-error" class="hint bad" data-testid="propose-error" role="status">
          {problem ? t(addrMsg[problem]) : null}
        </span>
        <span id="propose-rejected" class="hint">{t("recovery.propose.rejected")}</span>
      </div>
      <div>
        <button type="submit" class="btn btn-seal btn-lg" data-testid="propose-submit" disabled={!ready}>
          {t("recovery.propose.submit")}
        </button>
      </div>
    </form>
  );
}

function GuardiansCard({ adapter, info, isOwner }: { adapter: ChainAdapter; info: WalletInfo; isOwner: boolean }) {
  const { t, lang } = useI18n();
  const tx = useTx();
  const [addr, setAddr] = useState("");
  const count = info.guardians.length;
  const problem: GuardianProblem | null = addr.trim() === "" ? null : guardianProblem(addr, info);
  const canAdd = addr.trim() !== "" && problem === null && !tx.busy;
  const options = thresholdOptions(count);

  async function add(e: Event) {
    e.preventDefault();
    if (!canAdd) return;
    const rec = await tx.run(() => adapter.setGuardian(addr.trim(), true));
    if (rec?.status === "confirmed") setAddr("");
  }

  return (
    <section class="card stack" aria-labelledby="guardians-title" data-testid="guardians-card">
      <h2 id="guardians-title">{t("recovery.guardians.title")}</h2>
      {!isOwner ? <p class="small muted">{t("recovery.guardians.readonly")}</p> : null}

      {count === 0 ? (
        <p class="muted" data-testid="guardians-empty">{t("recovery.guardians.empty")}</p>
      ) : (
        <ul class="guardian-list">
          {info.guardians.map((g) => (
            <li class="guardian-row" key={g.address} data-testid="guardian-item">
              <span class="guardian-who"><Address value={g.address} withName /></span>
              {isOwner ? (
                <button type="button" class="btn btn-danger" data-testid="guardian-remove" disabled={tx.busy}
                  aria-label={`${t("recovery.guardians.remove")}: ${g.address}`}
                  onClick={() => void tx.run(() => adapter.setGuardian(g.address, false))}>
                  {t("recovery.guardians.remove")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {isOwner && count > 0 ? <p class="small muted">{t("recovery.guardians.removeNote")}</p> : null}

      {isOwner ? (
        <form class="stack" data-testid="guardian-add-form" noValidate onSubmit={add}>
          <div class="field">
            <label htmlFor="guardian-add-addr">{t("recovery.guardians.address")}</label>
            <input id="guardian-add-addr" data-testid="guardian-add-addr" class="input mono" value={addr} dir="ltr" lang="en"
              autoComplete="off" spellcheck={false}
              aria-invalid={problem ? "true" : undefined} aria-describedby="guardian-add-error"
              onInput={(e) => setAddr(val(e))} />
            <span id="guardian-add-error" class="hint bad" role="status">{problem ? t(addrMsg[problem]) : null}</span>
          </div>
          <div>
            <button type="submit" class="btn" data-testid="guardian-add" disabled={!canAdd}>{t("recovery.guardians.add")}</button>
          </div>
        </form>
      ) : null}

      <div class="field">
        <label htmlFor="threshold-select">{t("recovery.threshold.label")}</label>
        {isOwner ? (
          <select id="threshold-select" data-testid="threshold-select" class="select" value={String(info.threshold)}
            disabled={tx.busy || count === 0} aria-describedby="threshold-note"
            onChange={(e) => void tx.run(() => adapter.setThreshold(Number(val(e))))}>
            {options.map((n) => (
              <option key={n} value={String(n)}>{t("recovery.threshold.option", { n: num(n, lang), count: num(count, lang) })}</option>
            ))}
          </select>
        ) : (
          <span data-testid="threshold-text">{t("recovery.threshold.current", { n: num(info.threshold, lang), count: num(count, lang) })}</span>
        )}
        <span id="threshold-note" class="hint">{count === 0 ? t("recovery.threshold.none") : null}</span>
      </div>

      {count > 0 && count < info.threshold ? (
        <p class="notice notice-warn" role="status" data-testid="threshold-short">{t("recovery.threshold.short")}</p>
      ) : null}

      <TxStatusCard state={tx.state} onDismiss={() => tx.reset()} />
    </section>
  );
}
