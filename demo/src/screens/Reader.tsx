import { useState } from "preact/hooks";
import type { ChainAdapter } from "../adapter";
import type { ChapterData } from "../types";
import { Revert } from "../chain/errors";
import { errorName, useAdapter, useChain, useSession, useTx } from "../hooks";
import { useI18n } from "../i18n";
import { num } from "../format";
import { href, useRoute } from "../router";
import { titleFor } from "../titles";
import { Address } from "../ui/Address";
import { TxStatusCard } from "../ui/TxStatusCard";

const SIZE_KEY = "shahnameh-reader-size";
const SIZE_STEPS = 3;
const DEFAULT_SIZE = 1;

function readSize(): number {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (raw === null) return DEFAULT_SIZE;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n < SIZE_STEPS) return n;
  } catch { /* storage unavailable: use the default */ }
  return DEFAULT_SIZE;
}
function saveSize(n: number) {
  try { localStorage.setItem(SIZE_KEY, String(n)); } catch { /* storage unavailable: ignore */ }
}

/** The chapters from chapter 1 down to `id`, in reading order. Chapter 0 is its own parent, so the walk stops there. */
async function loadPath(a: ChainAdapter, id: number): Promise<ChapterData[]> {
  const out: ChapterData[] = [await a.chapter(id)];
  while (out[0].id !== 0 && out[0].parent !== out[0].id && out.length < 1000) {
    out.unshift(await a.chapter(out[0].parent));
  }
  return out;
}

export function Reader() {
  const { t, lang, dir } = useI18n();
  const route = useRoute();
  const raw = route.segments[1] ?? "0";
  const id = /^\d+$/.test(raw) ? Number(raw) : -1;
  const valid = id >= 0 && Number.isSafeInteger(id);
  const chapter = useChain(async (a) => {
    if (!valid) throw new Revert("UnknownChapter");
    return a.chapter(id);
  }, [id, valid]);
  const [size, setSize] = useState(readSize);
  const changeSize = (n: number) => { setSize(n); saveSize(n); };

  const data = chapter.data && chapter.data.id === id ? chapter.data : undefined;
  if (!data) {
    if (chapter.error && !chapter.loading) {
      if (errorName(chapter.error) === "UnknownChapter") {
        return (
          <div class="wrap reader page">
            <div class="empty" data-testid="chapter-missing">
              <h2>{t("reader.missing.title")}</h2>
              <p class="muted">{t("reader.missing.body")}</p>
              <a class="btn btn-lg" href={href("/read/0")}>{t("reader.missing.link")}</a>
            </div>
          </div>
        );
      }
      return (
        <div class="wrap reader page">
          <div class="notice notice-bad" role="alert" data-testid="reader-error">
            <div class="stack grow">
              <strong>{t("state.error")}</strong>
              <p>{t("err.generic", { message: chapter.error.message })}</p>
              <div><button type="button" class="btn" data-testid="reader-retry" onClick={chapter.reload}>{t("state.retry")}</button></div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div class="wrap reader page">
        <div class="reader-skel" role="status" aria-busy="true">
          <span class="sr-only">{t("state.loading")}</span>
          <div class="skeleton skel-title" />
          <div class="skeleton skel-line" />
          <div class="skeleton skel-line" />
          <div class="skeleton skel-line short" />
        </div>
      </div>
    );
  }

  const text = lang === "fa" ? data.textFa : data.textEn;
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const chapterNo = num(id + 1, lang);

  return (
    <div class="wrap reader page">
      <div class="reader-top">
        <span class="eyebrow">{t("reader.chapter", { n: chapterNo })}</span>
        <div class="text-controls" role="group" aria-label={t("reader.size.label")}>
          <button type="button" class="btn btn-ghost" data-testid="text-smaller" aria-label={t("reader.size.smaller")} disabled={size === 0} onClick={() => changeSize(size - 1)}>{t("reader.size.minus")}</button>
          <button type="button" class="btn btn-ghost" data-testid="text-bigger" aria-label={t("reader.size.bigger")} disabled={size === SIZE_STEPS - 1} onClick={() => changeSize(size + 1)}>{t("reader.size.plus")}</button>
        </div>
      </div>

      <div class="reader-grid">
        <div class="reader-main">
          <article class="reader-page" data-testid="chapter">
            <header class="reader-head">
              <h1 class="chapter-title" lang={lang} dir={dir} data-testid="chapter-title">{titleFor(data.title, lang)}</h1>
            </header>

            <div class="notice notice-warn draft-notice" role="note" data-testid="draft-notice">
              <div class="stack grow">
                <strong>{t("reader.draft.title")}</strong>
                <p class="small">{t("reader.draft.body")}</p>
              </div>
            </div>

            <div class="reader-text" lang={lang} dir={dir} data-size={size} data-testid="chapter-text">
              {paragraphs.map((p) => <p>{p}</p>)}
            </div>

            <div class="reader-meta">
              <span>{t("reader.author")}: <Address value={data.author} /></span>
            </div>
          </article>

          <Choices chapter={data} />
          {id > 0 ? <RecordChoice key={data.id} chapter={data} /> : null}
        </div>

        <aside class="reader-aside">
          <PathPanel id={id} />
        </aside>
      </div>
    </div>
  );
}

function Choices({ chapter }: { chapter: ChapterData }) {
  const { t, lang, dir } = useI18n();
  const count = chapter.labelsEn.length;

  if (count === 0) {
    return (
      <section class="choices" data-testid="chapter-end">
        <h2 class="choices-title">{t("reader.end.title")}</h2>
        <p class="muted">{t("reader.end.body")}</p>
        <div><a class="btn btn-ghost" href={href("/read/0")}>{t("reader.path.restart")}</a></div>
      </section>
    );
  }

  return (
    <section class="choices" aria-labelledby="choices-title">
      <h2 id="choices-title" class="choices-title">{t("reader.choices.title")}</h2>
      <div class="choices-list" data-testid="choices">
        {Array.from({ length: count }, (_, i) => {
          const label = (lang === "fa" ? chapter.labelsFa[i] : chapter.labelsEn[i]) || chapter.labelsEn[i];
          const child = chapter.children[i] ?? 0;
          const readers = chapter.choices[i] ?? 0;
          const badge = <span class="choice-num" aria-hidden="true">{num(i + 1, lang)}</span>;
          const labelEl = <strong class="choice-label" lang={lang} dir={dir}>{label}</strong>;

          if (child > 0) {
            const readersText = readers === 1 ? t("reader.choice.readers.one") : t("reader.choice.readers.other", { n: num(readers, lang) });
            return (
              <a class="choice" href={href(`/read/${child}`)} data-testid={`choice-${i}`}>
                {badge}
                <span class="choice-body">
                  {labelEl}
                  <span class="small muted">{readersText}</span>
                </span>
                <span class="tag tag-ok">{t("reader.choice.written")}</span>
              </a>
            );
          }

          return (
            <div class="choice choice-open" data-testid={`choice-open-${i}`}>
              <div class="choice-head">
                {badge}
                <span class="choice-body">
                  {labelEl}
                  <span class="small muted">{t("reader.choice.openBody")}</span>
                </span>
                <span class="tag tag-warn">{t("reader.choice.open")}</span>
              </div>
              <div>
                <a class="btn btn-seal" href={href("/write", { parent: chapter.id, branch: i })} data-testid={`write-branch-${i}`}>{t("reader.choice.write")}</a>
              </div>
            </div>
          );
        })}
      </div>
      <p class="small muted">{t("reader.choices.free")}</p>
    </section>
  );
}

/** Optional on-chain record of the choice that led here. Hidden once the wallet has recorded it. */
function RecordChoice({ chapter }: { chapter: ChapterData }) {
  const { t } = useI18n();
  const a = useAdapter();
  const { session } = useSession();
  const tx = useTx();
  const address = session?.address;
  const parentId = chapter.parent;
  const branch = chapter.parentBranch;
  const status = useChain(async (ad) => {
    if (!address) return null;
    const parent = await ad.chapter(parentId);
    return { chosen: await ad.hasChosen(parent.id, address) };
  }, [chapter.id, parentId, address]);

  const canRecord = !!address && !!status.data && !status.data.chosen;
  return (
    <div class="record-choice">
      {canRecord ? (
        <>
          <div>
            <button type="button" class="btn btn-ghost" data-testid="record-choice" disabled={tx.busy} onClick={() => tx.run(() => a.chooseBranch(parentId, branch))}>
              {t("reader.record.button")}
            </button>
          </div>
          <p class="small muted">{t("reader.record.note")}</p>
        </>
      ) : null}
      <TxStatusCard state={tx.state} onDismiss={tx.reset} />
    </div>
  );
}

function PathPanel({ id }: { id: number }) {
  const { t, lang, dir } = useI18n();
  const path = useChain((a) => loadPath(a, id), [id]);
  const chapters = path.data && path.data[path.data.length - 1]?.id === id ? path.data : undefined;
  const prev = chapters && chapters.length > 1 ? chapters[chapters.length - 2] : undefined;

  return (
    <section class="path-panel" aria-labelledby="path-title">
      <h2 id="path-title" class="path-title">{t("reader.path.title")}</h2>
      {chapters ? (
        <ol class="path-list" data-testid="path-list">
          {chapters.map((c) => {
            const current = c.id === id;
            return (
              <li class="path-step" data-current={current ? "true" : undefined} key={c.id}>
                <span class="path-rail" aria-hidden="true"><span class="path-dot" /><span class="path-line" /></span>
                <span class="path-text">
                  {current ? (
                    <strong lang={lang} dir={dir} aria-current="page">{titleFor(c.title, lang)}</strong>
                  ) : (
                    <a href={href(`/read/${c.id}`)} lang={lang} dir={dir}>{titleFor(c.title, lang)}</a>
                  )}
                  <span class="path-meta">
                    {t("reader.chapter", { n: num(c.id + 1, lang) })}
                    {current ? ` · ${t("reader.path.here")}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      ) : path.error && !path.loading ? (
        <div class="stack">
          <p class="small">{t("err.generic", { message: path.error.message })}</p>
          <div><button type="button" class="btn btn-ghost on-ink" onClick={path.reload}>{t("state.retry")}</button></div>
        </div>
      ) : (
        <div class="stack" role="status" aria-busy="true">
          <span class="sr-only">{t("state.loading")}</span>
          <div class="skeleton skel-line" />
          <div class="skeleton skel-line short" />
        </div>
      )}
      {prev ? <a class="btn btn-ghost on-ink" href={href(`/read/${prev.id}`)} data-testid="prev-chapter">{t("reader.path.prev")}</a> : null}
      <a class="btn" href={href("/read/0")} data-testid="restart">{t("reader.path.restart")}</a>
    </section>
  );
}
