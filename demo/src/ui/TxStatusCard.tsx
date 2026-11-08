import type { ComponentChildren } from "preact";
import type { TxState } from "../hooks";
import { errorName } from "../hooks";
import { useAdapter } from "../hooks";
import { useI18n } from "../i18n";
import { short } from "../format";
import { Icon, ICONS, Spin } from "./icons";

/**
 * The shared transaction banner. Renders nothing while idle.
 * Props: `state` from useTx(); `confirmedNote` replaces the default text on success;
 * `actions` are extra buttons/links shown in the confirmed, failed and rejected states.
 */
export function TxStatusCard({ state, title, confirmedNote, actions, onDismiss }: {
  state: TxState; title?: string; confirmedNote?: ComponentChildren; actions?: ComponentChildren; onDismiss?: () => void;
}) {
  const { t } = useI18n();
  const a = useAdapter();
  if (state.phase === "idle") return null;
  const hash = state.hash ? <span class="addr" title={state.hash} data-testid="tx-hash">{short(state.hash)}</span> : null;
  const block = state.record?.block ? <span class="small muted"> · {t("tx.block", { n: state.record.block })}</span> : null;
  const chain = a.chainName;
  const reason = state.record?.reason ?? (state.error ? errorName(state.error) : undefined);
  const reasonText = reason ? t(`err.${reason}`, { chain: a.chainName.en, message: state.error?.message ?? "" }) : "";
  const dismiss = onDismiss ? <button class="btn btn-link" onClick={onDismiss}>{t("tx.dismiss")}</button> : null;
  void chain;
  switch (state.phase) {
    case "signing":
      return (
        <div class="tx tx-pending" role="status" data-testid="tx-signing" data-phase="signing">
          <div class="tx-head"><Spin /><strong>{t("tx.signing")}</strong></div><p class="small">{t("tx.signingNote")}</p>
        </div>
      );
    case "pending":
      return (
        <div class="tx tx-pending" role="status" data-testid="tx-pending" data-phase="pending">
          <div class="tx-head"><Spin /><strong>{title ?? t("tx.pending")}</strong><span class="tag tag-warn">{t("tx.status.pending")}</span></div>
          <p class="small">{t("tx.pendingNote")}</p><div>{hash}</div>
        </div>
      );
    case "confirmed":
      return (
        <div class="tx tx-confirmed" role="status" data-testid="tx-confirmed" data-phase="confirmed">
          <div class="tx-head"><Icon d={ICONS.check} /><strong>{title ?? t("tx.confirmed")}</strong><span class="tag tag-ok">{t("tx.status.confirmed")}</span></div>
          {confirmedNote ? <p class="small">{confirmedNote}</p> : null}
          <div>{hash}{block}</div>
          <div class="row">{actions}{dismiss}</div>
        </div>
      );
    case "failed":
      return (
        <div class="tx tx-failed" role="alert" data-testid="tx-failed" data-phase="failed">
          <div class="tx-head"><Icon d={ICONS.x} /><strong>{t("tx.failed")}</strong><span class="tag tag-bad">{t("tx.status.failed")}</span></div>
          <p class="small">{reasonText} {t("tx.failedNote")}</p><div>{hash}{block}</div>
          <div class="row">{actions}{dismiss}</div>
        </div>
      );
    case "rejected":
      return (
        <div class="tx tx-rejected" role="alert" data-testid="tx-rejected" data-phase="rejected">
          <div class="tx-head"><Icon d={ICONS.x} /><strong>{t("tx.rejected")}</strong></div><p class="small">{t("tx.rejectedNote")}</p>
          <div class="row">{actions}{dismiss}</div>
        </div>
      );
    default:
      return (
        <div class="tx tx-failed" role="alert" data-testid="tx-error" data-phase="error">
          <div class="tx-head"><Icon d={ICONS.x} /><strong>{t("state.error")}</strong></div><p class="small">{reasonText}</p>
          <div class="row">{actions}{dismiss}</div>
        </div>
      );
  }
}
