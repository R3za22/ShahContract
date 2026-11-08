import { useState } from "preact/hooks";
import type { ChainAdapter } from "../adapter";
import { formatEth, num, WEI } from "../format";
import { useI18n } from "../i18n";
import { useAdapter, useChain, useSession, useTx } from "../hooks";
import { href } from "../router";
import { type WalletInfo } from "../types";
import { Address } from "../ui/Address";
import { RequireWallet } from "../ui/RequireWallet";
import { TxStatusCard } from "../ui/TxStatusCard";
import {
  amountProblem, available, exactEth, parseAmount, remainingFor, sameAddress, spenderProblem, toProblem,
  type AmountProblem, type SpendLimits, type SpenderProblem, type ToProblem,
} from "./wallet-model";

export function Wallet() {
  return <RequireWallet><WalletScreen /></RequireWallet>;
}

const DEPOSIT_WEI = WEI / 10n;
const val = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLSelectElement).value;

function WalletScreen() {
  const adapter = useAdapter();
  const { t, lang } = useI18n();
  const { session } = useSession();
  const me = session?.address ?? "";
  const info = useChain((x) => x.wallet());
  const fee = useChain((x) => x.estimateFee("transfer"));

  if (info.data === undefined) {
    if (info.error) {
      return (
        <div class="wrap page"><div class="notice notice-bad" role="alert" data-testid="wallet-load-error">
          <div class="stack grow"><strong>{t("state.error")}</strong>
            <div><button type="button" class="btn btn-ghost" onClick={info.reload}>{t("state.retry")}</button></div>
          </div>
        </div></div>
      );
    }
    return (
      <div class="wrap page stack" role="status" aria-live="polite">
        <p class="muted">{t("state.loading")}</p>
        <div class="skeleton wallet-skeleton" aria-hidden="true" />
      </div>
    );
  }

  const w = info.data;
  const isOwner = sameAddress(w.owner, me);
  const remaining = isOwner ? 0n : remainingFor(w, me);
  const limits: SpendLimits = { isOwner, balance: w.balance, remaining };
  const activeAllowances = w.allowances.filter((r) => r.remaining > 0n).length;

  return (
    <div class="wrap page stack-lg" data-testid="wallet-screen">
      <div class="page-head">
        <h1>{t("wallet.title")}</h1>
        <p class="small muted wallet-contract" lang={lang}>
          {t("wallet.contract")} <Address value={adapter.walletAddress} />
          <span aria-hidden="true"> · </span>
          <span lang="en">{adapter.chainName[lang]}</span>
          {adapter.mode === "mock" ? <span class="tag tag-demo">{t("tag.sample")}</span> : null}
        </p>
      </div>

      {!isOwner ? (
        <p class="notice notice-warn" role="status" data-testid="not-owner-notice">{t("wallet.notOwner")}</p>
      ) : null}

      <div class="wallet-top">
        <section class="card-ink wallet-hero" aria-labelledby="balance-label">
          <span class="wallet-label" id="balance-label">{t("wallet.balance")}</span>
          <div class="wallet-amount" data-testid="wallet-balance">
            <strong>{num(formatEth(w.balance), lang)}</strong>
            <span class="wallet-unit">{t("unit.eth")}</span>
          </div>
          <div class="wallet-stats">
            <div class="wallet-stat" data-testid="wallet-owner">
              <span class="wallet-label">{t("wallet.owner")}</span>
              <span class="wallet-stat-value">
                <Address value={w.owner} />
                {isOwner ? <span class="tag tag-ok">{t("wallet.you")}</span> : null}
              </span>
            </div>
            <div class="wallet-stat" data-testid="guardian-summary">
              <span class="wallet-label">{t("wallet.guardians")}</span>
              <span class="wallet-stat-value">{t("wallet.guardianSummary", {
                set: num(w.guardians.length, lang), needed: num(w.threshold, lang),
              })}</span>
            </div>
            <div class="wallet-stat" data-testid="allowance-count">
              <span class="wallet-label">{t("wallet.allowances")}</span>
              <span class="wallet-stat-value">{num(activeAllowances, lang)}</span>
            </div>
          </div>
          <a class="wallet-link" data-testid="manage-recovery-link" href={href("/recovery")}>{t("wallet.manageRecovery")}</a>
        </section>

        <SendForm adapter={adapter} info={w} limits={limits} fee={fee.data} feeLoading={fee.loading && fee.data === undefined} />
      </div>

      <div class="wallet-row">
        <DepositCard adapter={adapter} />
        <section class="empty wallet-tokens" data-testid="no-tokens">
          <strong>{t("wallet.noTokens.title")}</strong>
          <p class="small muted">{t("wallet.noTokens.body")}</p>
        </section>
      </div>

      <AllowancesCard adapter={adapter} info={w} isOwner={isOwner} />
    </div>
  );
}

interface SendProps {
  adapter: ChainAdapter;
  info: WalletInfo;
  limits: SpendLimits;
  fee: bigint | null | undefined;
  feeLoading: boolean;
}

function SendForm({ adapter, limits, fee, feeLoading }: SendProps) {
  const { t, lang } = useI18n();
  const tx = useTx();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState(false);

  const avail = available(limits);
  const blocked = !limits.isOwner && limits.remaining === 0n;
  const toErr: ToProblem | null = to.trim() === "" ? null : toProblem(to);
  const amountErr: AmountProblem | null = amount.trim() === "" ? null : amountProblem(amount, limits);
  const wei = parseAmount(amount);
  const ready = toErr === null && amountErr === null && wei !== null && wei > 0n && !blocked;
  // The review only shows while the draft stays valid (a reload can change the balance under it).
  const showReview = review && ready;
  const phase = tx.state.phase;

  const edit = (fn: () => void) => { setReview(false); fn(); };
  const availableText = num(formatEth(avail), lang);
  const toMsg: Record<ToProblem, string> = { address: "wallet.addr.bad", zeroAddress: "err.ZeroAddress" };
  const amountMsg: Record<AmountProblem, string> = {
    amount: "wallet.send.badAmount", zeroAmount: "wallet.send.zeroAmount", noAllowance: "err.NotAllowed",
    overAllowance: "err.ExceedsAllowance", overBalance: "wallet.send.overBalance",
  };

  async function confirm() {
    if (wei === null || !ready) return;
    const rec = await tx.run(() => adapter.send(to.trim(), wei));
    if (rec?.status === "confirmed") { setTo(""); setAmount(""); setReview(false); }
  }

  const rec = tx.state.record;
  const sentWei = rec?.value !== undefined ? BigInt(rec.value) : 0n;
  const confirmedTitle = phase === "confirmed" ? t("wallet.send.sent.title") : undefined;
  const confirmedNote = phase === "confirmed" ? t("wallet.send.sent.note", { amount: num(exactEth(sentWei), lang) }) : undefined;

  return (
    <div class="wallet-send stack">
      <form
        class="card send-form"
        data-testid="send-form"
        noValidate
        onSubmit={(e) => { e.preventDefault(); if (ready) setReview(true); }}
      >
        <h2>{t("wallet.send.title")}</h2>

        <div class="field">
          <label htmlFor="send-to">{t("wallet.send.to")}</label>
          <input id="send-to" data-testid="send-to" class="input mono" value={to} dir="ltr" lang="en"
            autoComplete="off" spellcheck={false} inputMode="text"
            aria-invalid={toErr ? "true" : undefined} aria-describedby="send-to-error"
            onInput={(e) => edit(() => setTo(val(e)))} />
          <span id="send-to-error" class="hint bad" data-testid="send-to-error" role="status">
            {toErr ? t(toMsg[toErr]) : null}
          </span>
        </div>

        <div class="field">
          <label htmlFor="send-amount">{t("wallet.send.amount")}</label>
          <input id="send-amount" data-testid="send-amount" class="input mono" value={amount} dir="ltr" lang="en"
            inputMode="decimal" autoComplete="off"
            aria-invalid={amountErr && amountErr !== "noAllowance" ? "true" : undefined} aria-describedby="send-amount-hint send-amount-error"
            onInput={(e) => edit(() => setAmount(val(e)))} />
          <span id="send-amount-hint" class="hint" data-testid="send-available">
            {t("wallet.send.available", { amount: availableText })}
            {" · "}
            {feeLoading ? t("state.loading") : fee === null || fee === undefined
              ? t("wallet.send.feeUnknown")
              : t("wallet.send.fee", { fee: num(formatEth(fee, 6), lang) })}
          </span>
          <span id="send-amount-error" class="hint bad" data-testid="send-amount-error" role="status">
            {amountErr && amountErr !== "noAllowance" ? t(amountMsg[amountErr], { amount: availableText }) : null}
          </span>
        </div>

        {blocked ? (
          <p class="notice notice-warn" role="status" data-testid="send-no-allowance">{t("err.NotAllowed")}</p>
        ) : null}

        <div class="send-actions">
          <button type="submit" class="btn btn-lg" data-testid="send-review" disabled={!ready || tx.busy}>
            {t("wallet.send.review")}
          </button>
          <span class="small muted">{t("wallet.send.reviewNote")}</span>
        </div>
      </form>

      {showReview && wei !== null ? (
        <section class="card review-panel" aria-labelledby="review-title" data-testid="send-review-panel">
          <h3 id="review-title">{t("wallet.send.panelTitle")}</h3>
          <dl class="review-list">
            <dt>{t("wallet.send.toLabel")}</dt>
            <dd><Address value={to.trim()} withName /></dd>
            <dt>{t("wallet.send.amountLabel")}</dt>
            <dd class="review-amount">{num(exactEth(wei), lang)} ETH</dd>
            <dt>{t("wallet.send.feeLabel")}</dt>
            <dd>{fee === null || fee === undefined ? t("wallet.send.feeUnknown") : `${num(formatEth(fee, 6), lang)} ETH`}</dd>
          </dl>
          <p class="small muted">{t("wallet.send.reviewNote")}</p>
          <div class="row">
            <button type="button" class="btn btn-seal btn-lg" data-testid="send-confirm" disabled={tx.busy}
              onClick={() => void confirm()}>{t("wallet.send.confirm")}</button>
            <button type="button" class="btn btn-ghost" onClick={() => setReview(false)}>{t("wallet.send.edit")}</button>
          </div>
        </section>
      ) : null}

      <TxStatusCard state={tx.state} title={confirmedTitle} confirmedNote={confirmedNote} onDismiss={() => tx.reset()} />
    </div>
  );
}

function DepositCard({ adapter }: { adapter: ChainAdapter }) {
  const { t, lang } = useI18n();
  const tx = useTx();
  return (
    <section class="card stack" aria-labelledby="deposit-title" data-testid="deposit-card">
      <h2 id="deposit-title">{t("wallet.deposit.title")}</h2>
      <p class="small muted">{t("wallet.deposit.hint")}</p>
      <div>
        <button type="button" class="btn btn-ghost" data-testid="deposit-btn" disabled={tx.busy}
          onClick={() => void tx.run(() => adapter.deposit(DEPOSIT_WEI))}>
          {t("wallet.deposit.button", { amount: num("0.1", lang) })}
        </button>
      </div>
      <TxStatusCard state={tx.state} onDismiss={() => tx.reset()} />
    </section>
  );
}

function AllowancesCard({ adapter, info, isOwner }: { adapter: ChainAdapter; info: WalletInfo; isOwner: boolean }) {
  const { t, lang } = useI18n();
  const tx = useTx();
  const [spender, setSpender] = useState("");
  const [limit, setLimit] = useState("");
  const spenderErr: SpenderProblem | null = spender.trim() === "" ? null : spenderProblem(spender, info.owner);
  const limitWei = parseAmount(limit);
  const limitErr = limit.trim() === "" ? null : limitWei === null ? "amount" : limitWei === 0n ? "zero" : null;
  const replaces = spenderErr === null && spender.trim() !== "" && info.allowances.some((r) => sameAddress(r.address, spender));
  const ready = spenderErr === null && spender.trim() !== "" && limitWei !== null && limitWei > 0n && !tx.busy;
  const spenderMsg: Record<SpenderProblem, string> = { address: "wallet.addr.bad", zeroAddress: "err.ZeroAddress", owner: "wallet.allow.add.ownerSelf" };

  async function add(e: Event) {
    e.preventDefault();
    if (!ready || limitWei === null) return;
    const rec = await tx.run(() => adapter.setAllowance(spender.trim(), limitWei));
    if (rec?.status === "confirmed") { setSpender(""); setLimit(""); }
  }

  return (
    <section class="card stack-lg wallet-allowances" aria-labelledby="allowances-title" data-testid="allowances-card">
      <div class="stack">
        <h2 id="allowances-title">{t("wallet.allow.title")}</h2>
        <p class="muted small">{t("wallet.allow.lede")}</p>
        <p class="notice notice-info small">{t("wallet.allow.explain")}</p>
      </div>

      {info.allowances.length === 0 ? (
        <div class="empty"><p class="muted" data-testid="allowances-empty">{t("wallet.allow.empty")}</p></div>
      ) : (
        <div class="table-wrap">
          <table class="table wallet-table">
            <caption class="sr-only">{t("wallet.allow.title")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("wallet.allow.col.spender")}</th>
                <th scope="col">{t("wallet.allow.col.address")}</th>
                <th scope="col">{t("wallet.allow.col.limit")}</th>
                <th scope="col">{t("wallet.allow.col.remaining")}</th>
                <th scope="col">{t("wallet.allow.col.action")}</th>
              </tr>
            </thead>
            <tbody>
              {info.allowances.map((r) => (
                <tr key={r.address} data-testid="allowance-row">
                  <td>{adapter.nameOf(r.address)?.[lang] ?? r.name ?? t("wallet.allow.unnamed")}</td>
                  <td><Address value={r.address} /></td>
                  <td>{num(formatEth(r.limit), lang)} ETH</td>
                  <td>{num(formatEth(r.remaining), lang)} ETH</td>
                  <td>
                    {isOwner ? (
                      <button type="button" class="btn btn-danger" data-testid="revoke-btn" disabled={tx.busy}
                        onClick={() => void tx.run(() => adapter.setAllowance(r.address, 0n))}>
                        {t("wallet.allow.revoke")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isOwner ? (
        <form class="stack" data-testid="add-spender-form" noValidate onSubmit={add}>
          <h3>{t("wallet.allow.add.title")}</h3>
          <div class="allow-form">
            <div class="field">
              <label htmlFor="spender-addr">{t("wallet.allow.add.address")}</label>
              <input id="spender-addr" data-testid="spender-addr" class="input mono" value={spender} dir="ltr" lang="en"
                autoComplete="off" spellcheck={false}
                aria-invalid={spenderErr ? "true" : undefined} aria-describedby="spender-addr-error"
                onInput={(e) => setSpender(val(e))} />
              <span id="spender-addr-error" class="hint bad" role="status">{spenderErr ? t(spenderMsg[spenderErr]) : null}</span>
            </div>
            <div class="field">
              <label htmlFor="spender-limit">{t("wallet.allow.add.limit")}</label>
              <input id="spender-limit" data-testid="spender-limit" class="input mono" value={limit} dir="ltr" lang="en"
                inputMode="decimal" autoComplete="off"
                aria-invalid={limitErr ? "true" : undefined} aria-describedby="spender-limit-error"
                onInput={(e) => setLimit(val(e))} />
              <span id="spender-limit-error" class="hint bad" role="status">
                {limitErr === "amount" ? t("wallet.send.badAmount") : limitErr === "zero" ? t("wallet.allow.add.zero") : null}
              </span>
              {replaces ? <span class="hint">{t("wallet.allow.add.replace")}</span> : null}
            </div>
          </div>
          <div>
            <button type="submit" class="btn" data-testid="add-spender" disabled={!ready}>{t("wallet.allow.add.submit")}</button>
          </div>
        </form>
      ) : null}

      <TxStatusCard state={tx.state} onDismiss={() => tx.reset()} />
    </section>
  );
}
