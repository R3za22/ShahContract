import { useRef, useState } from "preact/hooks";
import type { TxRecord } from "../types";
import { dictionaries, useI18n } from "../i18n";
import { useAdapter, useChain, useNow } from "../hooks";
import { num, short, timeAgo } from "../format";
import { RequireWallet } from "../ui/RequireWallet";
import { Icon, ICONS } from "../ui/icons";
import {
  type Context, type HistoryFilter, HISTORY_FILTERS, STATUS_TAG, countByFilter, decodedCall, describe,
  ethText, filterRecords, iconFor,
} from "./history-model";

export function History() {
  return <RequireWallet><HistoryScreen /></RequireWallet>;
}

function HistoryScreen() {
  const a = useAdapter();
  const { t, lang } = useI18n();
  const now = useNow(10_000);
  const history = useChain((ad) => ad.history());
  // useChain drops its data when a reload fails; keep the last good rows on screen.
  const lastGood = useRef<TxRecord[] | undefined>(undefined);
  if (history.data) lastGood.current = history.data;
  const records = history.data ?? lastGood.current;
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const cx: Context = {
    lang,
    t,
    nameOf: (address) => a.nameOf(address)?.[lang],
    errorText: (reason) => (dictionaries[lang][`err.${reason}`] ? t(`err.${reason}`) : t("err.generic", { message: reason })),
  };
  const counts = countByFilter(records ?? []);
  const visible = filterRecords(records ?? [], filter);
  const chosen = records?.find((r) => r.hash === selected) ?? null;

  return (
    <div class="wrap page stack-lg" data-testid="history-screen">
      <div class="page-head">
        <div class="row">
          <h1>{t("history.title")}</h1>
          {a.mode === "mock" ? <span class="tag tag-demo">{t("tag.sample")}</span> : null}
        </div>
        <p class="muted">{t("history.lede", { chain: a.chainName[lang] })}</p>
      </div>

      <div class="history-layout">
        <div class="history-main">
          <div class="history-filters" role="group" aria-label={t("history.filters")} data-testid="history-filters">
            {HISTORY_FILTERS.map((f) => (
              <button
                type="button"
                class="history-filter"
                aria-pressed={filter === f}
                data-testid={`filter-${f}`}
                onClick={() => setFilter(f)}
              >
                {t(`history.filter.${f}`)} <span class="history-count">{num(counts[f], lang)}</span>
              </button>
            ))}
          </div>

          {history.error && !history.loading ? (
            <div class="notice notice-bad" role="alert" data-testid="history-error">
              <div class="stack grow">
                <strong>{t("history.error.title")}</strong>
                <p>{t("err.generic", { message: history.error.message })}</p>
                <div><button type="button" class="btn" data-testid="history-retry" onClick={history.reload}>{t("state.retry")}</button></div>
              </div>
            </div>
          ) : null}

          {!records && history.loading ? (
            <div class="history-list" role="status" aria-busy="true" data-testid="history-loading">
              <span class="sr-only">{t("history.loading")}</span>
              {[0, 1, 2, 3].map((i) => (
                <div class="history-skel-row" key={i}>
                  <span class="skeleton history-skel-dot" />
                  <span class="history-skel-text"><span class="skeleton" /><span class="skeleton" /></span>
                </div>
              ))}
            </div>
          ) : null}

          {records && visible.length === 0 ? (
            <div class="empty" data-testid="history-empty">
              <strong>{t(`history.empty.${filter}.title`)}</strong>
              <p class="muted">{t(`history.empty.${filter}.body`)}</p>
            </div>
          ) : null}

          {records && visible.length > 0 ? (
            <ul class="history-list" aria-label={t("history.list")} data-testid="history-list">
              {visible.map((r) => {
                const d = describe(r, cx);
                const isSel = r.hash === selected;
                return (
                  <li key={r.hash}>
                    <button
                      type="button"
                      class="history-row"
                      aria-pressed={isSel}
                      data-testid="history-row"
                      data-status={r.status}
                      data-kind={r.kind}
                      onClick={() => setSelected(r.hash)}
                    >
                      <span class="history-icon" aria-hidden="true"><Icon d={ICONS[iconFor(r.kind)]} size={20} /></span>
                      <span class="history-body">
                        <span class="history-title" dir="auto">{d.title}</span>
                        {d.detail ? <span class="history-sub" dir="auto">{d.detail}</span> : null}
                        <span class="history-meta">
                          <span class="mono">{short(r.hash)}</span>
                          <span>{timeAgo(r.timestamp, now, lang)}</span>
                          <span class={`tag ${STATUS_TAG[r.status]}`}>{t(`tx.status.${r.status}`)}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <aside class="history-detail" aria-labelledby="history-detail-title" data-testid="history-detail">
          <h2 id="history-detail-title" class="history-detail-title">{t("history.panel.title")}</h2>
          {chosen ? (
            <dl class="history-facts">
              <div><dt>{t("tx.hash")}</dt><dd><span class="mono history-full">{chosen.hash}</span></dd></div>
              <div>
                <dt>{t("history.panel.status")}</dt>
                <dd><span role="status" class={`tag ${STATUS_TAG[chosen.status]}`}>{t(`tx.status.${chosen.status}`)}</span></dd>
              </div>
              <div>
                <dt>{t("history.panel.block")}</dt>
                <dd>{chosen.block != null ? num(chosen.block, lang) : t("history.panel.notConfirmed")}</dd>
              </div>
              <div>
                <dt>{t("history.panel.fee")}</dt>
                <dd>{chosen.fee ? `${ethText(chosen.fee, lang)} ${t("unit.eth")}` : t("history.panel.none")}</dd>
              </div>
              <div><dt>{t("history.panel.from")}</dt><dd><span class="addr history-full">{chosen.from}</span></dd></div>
              <div>
                <dt>{t("history.panel.to")}</dt>
                <dd>{chosen.to ? <span class="addr history-full">{chosen.to}{cx.nameOf(chosen.to) ? ` · ${cx.nameOf(chosen.to)}` : ""}</span> : t("history.panel.none")}</dd>
              </div>
              <div><dt>{t("history.panel.call")}</dt><dd><code class="history-call">{decodedCall(chosen, cx)}</code></dd></div>
              {chosen.status === "failed" && chosen.reason ? (
                <div><dt>{t("history.panel.reason")}</dt><dd>{cx.errorText(chosen.reason)}</dd></div>
              ) : null}
            </dl>
          ) : (
            <p class="history-placeholder">{t("history.panel.placeholder")}</p>
          )}
          {a.mode === "mock" ? <p class="history-note">{t("tx.simulatedExplorer")}</p> : null}
        </aside>
      </div>
    </div>
  );
}
