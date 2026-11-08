import { useEffect, useState } from "preact/hooks";
import type { ChainAdapter } from "../adapter";
import { Revert } from "../chain/errors";
import { formatEth, num } from "../format";
import { useI18n } from "../i18n";
import { useAdapter, useChain, useNow, useSession, useTx } from "../hooks";
import { href, navigate, useRoute } from "../router";
import { titleFor } from "../titles";
import { type ChapterData, LIMITS } from "../types";
import { RequireWallet } from "../ui/RequireWallet";
import { TxStatusCard } from "../ui/TxStatusCard";
import {
  type Draft, DRAFT_KEY, type OpenBranch, buildInput, emptyBranch, emptyDraft, firstError, isBlankDraft,
  labelBytes, openBranches, parseIndex, readDraft, targetProblem, textBytes, titleBytes,
} from "./write-model";

export function Write() {
  return <RequireWallet><WriteScreen /></RequireWallet>;
}

/** Where the new chapter goes. `problem` is a contract reason when that branch cannot be continued. */
interface Target { parent: ChapterData | null; branch: number; problem: string | null }
interface Board { target: Target | null; open: OpenBranch[] }

async function resolveTarget(a: ChainAdapter, parentId: number, branch: number): Promise<Target> {
  try {
    const parent = await a.chapter(parentId);
    return { parent, branch, problem: targetProblem(parent, branch) };
  } catch (e) {
    if (e instanceof Revert) return { parent: null, branch, problem: e.reason };
    throw e;
  }
}

async function listOpen(a: ChainAdapter): Promise<OpenBranch[]> {
  const n = await a.chapterCount();
  const chapters = await Promise.all(Array.from({ length: n }, (_, i) => a.chapter(i)));
  return openBranches(chapters);
}

function restoreDraft(): Draft {
  try { return readDraft(localStorage.getItem(DRAFT_KEY)) ?? emptyDraft(); } catch { return emptyDraft(); }
}

function WriteScreen() {
  const a = useAdapter();
  const { t, lang } = useI18n();
  const route = useRoute();
  const { session } = useSession();
  const address = session?.address ?? "";
  const parentRaw = route.query.get("parent");
  const branchRaw = route.query.get("branch");

  const board = useChain<Board>(async (x) => {
    let target: Target | null = null;
    if (parentRaw !== null && branchRaw !== null) {
      const p = parseIndex(parentRaw), b = parseIndex(branchRaw);
      target = p === null ? { parent: null, branch: b ?? 0, problem: "UnknownChapter" }
        : b === null ? { parent: null, branch: 0, problem: "UnknownBranch" }
        : await resolveTarget(x, p, b);
    }
    const writable = target !== null && target.problem === null;
    return { target, open: writable ? [] : await listOpen(x) };
  }, [parentRaw, branchRaw]);

  const cool = useChain(async (x) => x.now() + (await x.cooldownRemaining(address)), [address]);
  const fee = useChain((x) => x.estimateFee("chapter"), []);
  const now = useNow(1000);
  const remaining = cool.data === undefined ? null : Math.max(0, cool.data - now);

  const [draft, setDraft] = useState<Draft>(restoreDraft);
  const [touched, setTouched] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const tx = useTx();

  // Keep the draft in localStorage; an empty draft removes the key.
  useEffect(() => {
    const blank = isBlankDraft(draft);
    let ok = true;
    try {
      if (blank) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch { ok = false; }
    setSaved(ok && !blank);
  }, [draft]);

  const patch = (p: Partial<Draft>) => { setTouched(true); setDraft((d) => ({ ...d, ...p })); };
  const setBranch = (i: number, field: "en" | "fa", value: string) => {
    setTouched(true);
    setDraft((d) => ({ ...d, branches: d.branches.map((b, j) => (j === i ? (field === "en" ? { ...b, en: value } : { ...b, fa: value }) : b)) }));
  };
  const val = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;

  const input = buildInput(draft);
  const err = firstError(draft);
  const tgt = board.data?.target ?? null;
  const parent = tgt && tgt.problem === null ? tgt.parent : null;
  const phase = tx.state.phase;
  const canSign = parent !== null && err === null && remaining === 0 && !tx.busy;
  const showErr = touched && err !== null;

  async function submit() {
    if (!parent || !tgt || !canSign) return;
    const rec = await tx.run(() => a.writeChapter(parent.id, tgt.branch, buildInput(draft)));
    if (rec?.status === "confirmed") { setTouched(false); setDraft(emptyDraft()); }
  }

  const rec = tx.state.record;
  const newId = rec ? Number(rec.params.chapter) : NaN;
  // The branch we just sealed is taken now; show the success card instead of a "taken" error for it.
  const justWritten = phase === "confirmed" && !!rec && !!tgt
    && Number(rec.params.parent) === tgt.parent?.id && Number(rec.params.branch) === tgt.branch;
  const confirmedTitle = phase === "confirmed" && Number.isFinite(newId) ? t("write.confirmed.title", { n: num(newId, lang) }) : undefined;
  const confirmedNote = phase === "confirmed" && rec ? t("write.confirmed.note", {
    parent: num(String(rec.params.parent), lang), branch: num(Number(rec.params.branch) + 1, lang),
  }) : undefined;
  const txActions = phase === "confirmed" && Number.isFinite(newId) ? (
    <a class="btn btn-ghost" href={href(`/read/${newId}`)}>{t("write.confirmed.read")}</a>
  ) : phase === "failed" ? (
    <button type="button" class="btn btn-ghost" onClick={() => tx.reset()}>{t("write.failed.retry")}</button>
  ) : phase === "rejected" ? (
    <button type="button" class="btn" disabled={!canSign} onClick={() => void submit()}>{t("write.rejected.again")}</button>
  ) : undefined;

  const showPicker = board.data !== undefined && (tgt === null || tgt.problem !== null);
  const previewTitle = lang === "fa" ? draft.titleFa : draft.titleEn;
  const previewText = lang === "fa" ? draft.textFa : draft.textEn;
  const previewLabels = lang === "fa" ? input.labelsFa : input.labelsEn;

  return (
    <div class="wrap page stack-lg" data-testid="write-screen">
      <div class="page-head">
        <h1>{t("write.title")}</h1>
        <p class="muted">{t("write.lede")}</p>
      </div>

      <div class="write-layout">
        <div class="write-main stack-lg">
          {remaining !== null && remaining > 0 ? (
            <p class="notice notice-warn" role="status" data-testid="cooldown-note">
              {t("write.cooldown", { n: num(remaining, lang) })}
            </p>
          ) : null}

          {board.error ? (
            <div class="notice notice-bad" role="alert" data-testid="write-load-error">
              <div class="stack grow">
                <strong>{t("state.error")}</strong>
                <div><button type="button" class="btn btn-ghost" onClick={board.reload}>{t("state.retry")}</button></div>
              </div>
            </div>
          ) : null}

          {board.data === undefined && !board.error ? (
            <div class="stack" role="status" aria-live="polite">
              <p class="muted">{t("state.loading")}</p>
              <div class="skeleton write-skeleton" aria-hidden="true" />
            </div>
          ) : null}

          {tgt && tgt.problem === null && tgt.parent ? (
            <section class="stack" data-testid="write-target">
              <span class="eyebrow" lang={lang}>{t("write.continuing", {
                title: titleFor(tgt.parent.title, lang),
                chapter: num(tgt.parent.id, lang),
                branch: num(tgt.branch + 1, lang),
              })}</span>
              <div class="row">
                <span class="tag" lang={lang} dir={lang === "fa" ? "rtl" : "ltr"} data-testid="write-branch-label">
                  {lang === "fa" ? tgt.parent.labelsFa[tgt.branch] : tgt.parent.labelsEn[tgt.branch]}
                </span>
              </div>
            </section>
          ) : null}

          {tgt && tgt.problem !== null && !justWritten ? (
            <div class="notice notice-bad" role="alert" data-testid="write-target-error">
              <div class="stack grow"><p>{t(`err.${tgt.problem}`)}</p></div>
            </div>
          ) : null}

          {showPicker && board.data ? (
            <section class="stack" data-testid="branch-picker" aria-labelledby="picker-title">
              <h2 id="picker-title">{t("write.picker.title")}</h2>
              <p class="muted">{t("write.picker.lede")}</p>
              {board.data.open.length === 0 ? (
                <div class="empty"><p class="muted">{t("write.picker.none")}</p></div>
              ) : (
                <ul class="write-picks">
                  {board.data.open.map((o) => (
                    <li key={`${o.parent}-${o.branch}`}>
                      <button
                        type="button"
                        class="card write-pick"
                        data-testid={`pick-${o.parent}-${o.branch}`}
                        onClick={() => navigate("/write", { parent: o.parent, branch: o.branch })}
                      >
                        <span class="small muted">{t("write.picker.card", { chapter: num(o.parent, lang), branch: num(o.branch + 1, lang) })}</span>
                        <strong lang={lang} dir={lang === "fa" ? "rtl" : "ltr"}>{lang === "fa" ? o.labelFa : o.labelEn}</strong>
                        <span class="small muted" lang={lang}>{t("write.picker.from", { title: titleFor(o.parentTitle, lang) })}</span>
                        <span class="btn btn-ghost btn-link" aria-hidden="true">{t("write.picker.pick")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {parent !== null ? (
            <form
              class="card write-form"
              data-testid="write-form"
              noValidate
              onSubmit={(e) => { e.preventDefault(); void submit(); }}
            >
              <h2>{t("write.form.title")}</h2>

              <div class="field">
                <label htmlFor="title-en">{t("write.title.en")}</label>
                <input id="title-en" data-testid="title-en" class="input" value={draft.titleEn} lang="en" dir="ltr"
                  aria-invalid={titleBytes(draft) > LIMITS.titleBytes ? "true" : undefined}
                  onInput={(e) => patch({ titleEn: val(e) })} />
              </div>
              <div class="field">
                <label htmlFor="title-fa">{t("write.title.fa")}</label>
                <input id="title-fa" data-testid="title-fa" class="input" value={draft.titleFa} lang="fa" dir="rtl"
                  aria-invalid={titleBytes(draft) > LIMITS.titleBytes ? "true" : undefined}
                  onInput={(e) => patch({ titleFa: val(e) })} />
                <span class={`hint${titleBytes(draft) > LIMITS.titleBytes ? " bad" : ""}`} data-testid="title-count">
                  {t("write.title.count", { n: num(titleBytes(draft), lang), max: num(LIMITS.titleBytes, lang) })}
                </span>
              </div>

              <div class="field">
                <label htmlFor="text-en">{t("write.text.en")}</label>
                <textarea id="text-en" data-testid="text-en" class="textarea" rows={4} value={draft.textEn} lang="en" dir="ltr"
                  aria-invalid={textBytes(draft) > LIMITS.textBytes ? "true" : undefined}
                  onInput={(e) => patch({ textEn: val(e) })} />
              </div>
              <div class="field">
                <label htmlFor="text-fa">{t("write.text.fa")}</label>
                <textarea id="text-fa" data-testid="text-fa" class="textarea" rows={4} value={draft.textFa} lang="fa" dir="rtl"
                  aria-invalid={textBytes(draft) > LIMITS.textBytes ? "true" : undefined}
                  onInput={(e) => patch({ textFa: val(e) })} />
                <span class={`hint${textBytes(draft) > LIMITS.textBytes ? " bad" : ""}`} data-testid="text-count" aria-live="polite">
                  {t("write.text.count", { n: num(textBytes(draft), lang), max: num(LIMITS.textBytes, lang) })}
                </span>
                <span class="hint">{t("write.text.faNote")}</span>
              </div>

              <div class="write-check">
                <input id="is-ending" data-testid="is-ending" type="checkbox" checked={draft.ending}
                  onChange={(e) => patch({ ending: (e.currentTarget as HTMLInputElement).checked })} />
                <label htmlFor="is-ending">{t("write.ending")}</label>
              </div>

              {!draft.ending ? (
                <fieldset class="write-branches" data-testid="branch-rows">
                  <legend>{t("write.branches.legend")}</legend>
                  {draft.branches.map((b, i) => {
                    const enLong = labelBytes(b.en) > LIMITS.labelBytes;
                    const faLong = labelBytes(b.fa) > LIMITS.labelBytes;
                    return (
                      <div class="write-branch-group" key={i} data-testid={`branch-row-${i}`}>
                        <div class="row">
                          <strong class="small">{t("write.branch.row", { n: num(i + 1, lang) })}</strong>
                          {i === 2 ? (
                            <button type="button" class="btn btn-link" data-testid="remove-branch"
                              onClick={() => patch({ branches: draft.branches.filter((_, j) => j !== i) })}>
                              {t("write.branch.remove")}
                            </button>
                          ) : null}
                        </div>
                        <div class="write-branch">
                          <div class="field">
                            <label htmlFor={`label-en-${i}`}>{t("write.branch.en", { n: num(i + 1, lang) })}</label>
                            <input id={`label-en-${i}`} data-testid={`label-en-${i}`} class="input" value={b.en} lang="en" dir="ltr"
                              aria-invalid={enLong ? "true" : undefined} aria-describedby={`label-en-count-${i}`}
                              onInput={(e) => setBranch(i, "en", val(e))} />
                            <span id={`label-en-count-${i}`} class={`hint${enLong ? " bad" : ""}`}>
                              {enLong
                                ? t("write.label.long", { n: num(labelBytes(b.en), lang), max: num(LIMITS.labelBytes, lang) })
                                : t("write.label.count", { n: num(labelBytes(b.en), lang), max: num(LIMITS.labelBytes, lang) })}
                            </span>
                          </div>
                          <div class="field">
                            <label htmlFor={`label-fa-${i}`}>{t("write.branch.fa", { n: num(i + 1, lang) })}</label>
                            <input id={`label-fa-${i}`} data-testid={`label-fa-${i}`} class="input" value={b.fa} lang="fa" dir="rtl"
                              aria-invalid={faLong ? "true" : undefined} aria-describedby={`label-fa-count-${i}`}
                              onInput={(e) => setBranch(i, "fa", val(e))} />
                            <span id={`label-fa-count-${i}`} class={`hint${faLong ? " bad" : ""}`}>
                              {faLong
                                ? t("write.label.long", { n: num(labelBytes(b.fa), lang), max: num(LIMITS.labelBytes, lang) })
                                : t("write.label.count", { n: num(labelBytes(b.fa), lang), max: num(LIMITS.labelBytes, lang) })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {draft.branches.length < LIMITS.maxBranches ? (
                    <button type="button" class="btn btn-ghost" data-testid="add-branch"
                      onClick={() => patch({ branches: [...draft.branches, emptyBranch()] })}>
                      {t("write.branch.add")}
                    </button>
                  ) : null}
                </fieldset>
              ) : null}

              {showErr ? (
                <p class="notice notice-bad" role="status" data-testid="write-error">{t(`err.${err}`)}</p>
              ) : null}

              <div class="write-actions">
                <div class="write-fee">
                  <span class="small" data-testid="fee-line">
                    {fee.data === undefined ? t("state.loading") : fee.data === null ? t("write.feeUnknown") : t("write.fee", { eth: num(formatEth(fee.data), lang) })}
                  </span>
                  <div class="row small muted">
                    {saved ? <span data-testid="draft-saved" role="status">{t("write.draft.saved")}</span> : null}
                    {!isBlankDraft(draft) ? (
                      <button type="button" class="btn btn-link" data-testid="clear-draft"
                        onClick={() => { setTouched(false); setDraft(emptyDraft()); }}>
                        {t("write.draft.clear")}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div class="row">
                  <button type="button" class="btn btn-ghost" data-testid="preview-btn" aria-expanded={previewOpen}
                    aria-controls="write-preview" onClick={() => setPreviewOpen((o) => !o)}>
                    {previewOpen ? t("write.previewHide") : t("write.preview")}
                  </button>
                  <button type="submit" class="btn btn-seal btn-lg" data-testid="submit-chapter"
                    disabled={!canSign}>
                    {t("write.submit")}
                  </button>
                </div>
              </div>

              {previewOpen ? (
                <section id="write-preview" class="write-preview" data-testid="write-preview" aria-label={t("write.preview.title")}>
                  <h3>{t("write.preview.title")}</h3>
                  <strong lang={lang} dir={lang === "fa" ? "rtl" : "ltr"} class="write-preview-title">{previewTitle}</strong>
                  <p lang={lang} dir={lang === "fa" ? "rtl" : "ltr"} class="write-preview-text">{previewText}</p>
                  {draft.ending ? (
                    <p class="muted small">{t("write.preview.ending")}</p>
                  ) : (
                    <>
                      <span class="small muted">{t("write.preview.branches")}</span>
                      <ol class="write-preview-labels" lang={lang} dir={lang === "fa" ? "rtl" : "ltr"}>
                        {previewLabels.map((l, i) => <li key={i}>{l}</li>)}
                      </ol>
                    </>
                  )}
                </section>
              ) : null}
            </form>
          ) : null}
        </div>

        <aside class="write-aside stack">
          <TxStatusCard
            state={tx.state}
            title={confirmedTitle}
            confirmedNote={confirmedNote}
            actions={txActions}
            onDismiss={() => tx.reset()}
          />
          {phase === "failed" || phase === "rejected" ? (
            <p class="small muted" data-testid="draft-kept">
              {phase === "rejected" ? t("write.rejected.kept") : t("write.failed.kept")}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
