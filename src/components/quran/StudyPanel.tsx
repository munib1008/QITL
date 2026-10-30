"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BookmarkButton } from "@/components/account/BookmarkButton";
import { EvidenceLabel } from "@/components/ui/evidence";
import { Icon } from "@/components/ui/icons";
import { Markdown } from "@/components/ui/Markdown";
import { interpretationT, type InterpretationStrings } from "@/lib/i18n/modules/interpretation";
import { attributionParts, groupDifferences } from "@/lib/interpretation/state";
import type { EditionInfo, RelatedItem, SlotState, StudyData, TafsirFlag } from "@/lib/interpretation/types";

export interface StudyTarget {
  surah: number;
  ayah: number;
  /** Verified Arabic from the pinned source import, or null when it is not loaded. Never typed in. */
  arabic: string | null;
  related: RelatedItem[];
}

const TAB_KEYS = ["translations", "words", "differences", "tafsir", "hadith", "related", "summary"] as const;
type TabKey = (typeof TAB_KEYS)[number];

/* ---------- small pieces ---------- */

function StateBadge({ state, t }: { state: SlotState; t: InterpretationStrings }) {
  return (
    <span className={`qs-state qs-state-${state}`} data-state={state}>
      {t.states[state]}
    </span>
  );
}

function Attribution({ edition, t, person }: { edition: EditionInfo; t: InterpretationStrings; person: string }) {
  const a = attributionParts(edition, t.unknown);
  return (
    <dl className="qs-attr">
      <div>
        <dt>{person}</dt>
        <dd>{a.person}</dd>
      </div>
      <div>
        <dt>{t.edition}</dt>
        <dd>{a.edition}</dd>
      </div>
      <div>
        <dt>{t.year}</dt>
        <dd>{a.year}</dd>
      </div>
      <div>
        <dt>{t.licence}</dt>
        <dd>
          {edition.licence?.url && (edition.licence.rightsStatus === "cleared" || edition.licence.rightsStatus === "public_domain") ? (
            <a href={edition.licence.url} rel="noopener noreferrer license">
              {a.licence}
            </a>
          ) : (
            a.licence
          )}
        </dd>
      </div>
    </dl>
  );
}

function Pending({ state, t }: { state: SlotState; t: InterpretationStrings }) {
  if (state === "shown") return null;
  return <p className="zq-licence zq-licence-pending qs-pending">{t.stateHelp[state]}</p>;
}

function Flags({ flags, t }: { flags: TafsirFlag[]; t: InterpretationStrings }) {
  if (!flags.length) return null;
  return (
    <ul className="qs-flags" aria-label="Review flags">
      {flags.map((f) => (
        <li key={f} className="qs-flag" data-flag={f}>
          <Icon.flag />
          {t.flags[f]}
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="qs-empty">
      <EvidenceLabel kind="unknown">Not available yet</EvidenceLabel>
      <p>{children}</p>
    </div>
  );
}

/* ---------- tab bodies ---------- */

function TranslationsTab({ data, t }: { data: StudyData; t: InterpretationStrings }) {
  const early = data.earlyTafsir;
  return (
    <div className="qs-stack">
      <p className="qs-intro">{t.translationsIntro}</p>
      {data.translations.length ? (
        <ol className="qs-cards" data-count={data.translations.length}>
          {data.translations.map((s) => (
            <li key={s.edition.id} className="qs-card" data-slot-state={s.state}>
              <div className="qs-card-head">
                <h4>{s.edition.title}</h4>
                <StateBadge state={s.state} t={t} />
              </div>
              {s.text ? (
                <p className="qs-text" lang={s.edition.language} dir="auto">
                  {s.text}
                </p>
              ) : (
                <Pending state={s.state} t={t} />
              )}
              <Attribution edition={s.edition} t={t} person={t.translator} />
            </li>
          ))}
        </ol>
      ) : (
        <Empty>{data.configured ? t.noEditions : t.notConnected}</Empty>
      )}

      {/* The 11th slot: early historical commentary, apart from the translations and never counted as one. */}
      <section className="qs-early" aria-labelledby="qs-early-h" data-slot="early-tafsir" data-slot-state={early.state}>
        <p className="zq-eyebrow">{t.earlySlotTitle}</p>
        <div className="qs-card-head">
          <h4 id="qs-early-h">{early.edition?.title ?? t.earlySlotWork}</h4>
          <StateBadge state={early.state} t={t} />
        </div>
        <EvidenceLabel kind="scholar">{t.earlySlotLabel}</EvidenceLabel>
        {early.edition?.reliabilityNote ? (
          <p className="qs-note">
            <b>{t.reliabilityNote}:</b> {early.edition.reliabilityNote}
          </p>
        ) : (
          <p className="qs-note">{t.earlySlotHelp}</p>
        )}
        <Flags flags={early.flags} t={t} />
        {early.text ? (
          <p className="qs-text" lang={early.edition?.language ?? "ar"} dir="auto">
            {early.text}
          </p>
        ) : (
          <Pending state={early.state} t={t} />
        )}
        {early.reviewNote ? <p className="zq-meta">{early.reviewNote}</p> : null}
        {early.edition ? <Attribution edition={early.edition} t={t} person={t.scholar} /> : null}
      </section>
    </div>
  );
}

function WordsTab({ data, t }: { data: StudyData; t: InterpretationStrings }) {
  if (!data.words.length) return <Empty>{data.configured ? t.words.none : t.notConnected}</Empty>;
  return (
    <div className="qs-stack">
      <p className="qs-intro">{t.words.intro}</p>
      <ol className="qs-words">
        {data.words.map((w) => (
          <li key={w.wordNo} className="qs-word">
            <p className="qs-word-ar" lang="ar" dir="rtl">
              {w.textAr}
            </p>
            {w.transliteration ? <p className="zq-meta">{w.transliteration}</p> : null}
            <dl className="qs-attr">
              <div>
                <dt>{t.words.root}</dt>
                <dd lang="ar" dir="rtl">
                  {w.root ?? t.unknown}
                </dd>
              </div>
              <div>
                <dt>{t.words.lemma}</dt>
                <dd lang="ar" dir="rtl">
                  {w.lemma ?? t.unknown}
                </dd>
              </div>
              <div>
                <dt>{t.words.pos}</dt>
                <dd>{w.pos}</dd>
              </div>
              <div>
                <dt>{t.words.morphology}</dt>
                <dd>{Object.entries(w.features).map(([k, v]) => `${k}: ${v}`).join(" · ") || t.unknown}</dd>
              </div>
              <div>
                <dt>{t.words.literal}</dt>
                <dd>{w.literalGloss ?? t.unknown}</dd>
              </div>
              <div>
                <dt>{t.words.contextual}</dt>
                <dd>{w.sense ? w.sense.contextualMeaning : <span className="zq-licence-pending">{t.words.contextualPending}</span>}</dd>
              </div>
            </dl>
            <p className="zq-meta">
              {w.occurrences.length ? t.words.occurrences(w.occurrences.length) : t.words.noOccurrences}
              {w.occurrences.slice(0, 6).map((o) => (
                <Link key={`${o.surah}:${o.ayah}:${o.word}`} className="zq-chip" href={`/quran/${o.surah}#ayah-${o.ayah}`} data-citation="">
                  <span dir="ltr">{`Q ${o.surah}:${o.ayah}`}</span>
                </Link>
              ))}
            </p>
          </li>
        ))}
      </ol>
      {data.wordsSource ? (
        <p className="zq-licence">
          {t.words.source}: {data.wordsSource.work ?? t.unknown} · {data.wordsSource.attribution ?? data.wordsSource.text ?? t.unknown}
        </p>
      ) : null}
    </div>
  );
}

function DifferencesTab({ data, t }: { data: StudyData; t: InterpretationStrings }) {
  const groups = groupDifferences(data.differences);
  return (
    <div className="qs-stack">
      <p className="qs-intro">{t.differences.intro}</p>
      {groups.length ? (
        groups.map((g) => (
          <section key={g.kind} className="qs-diff-group" data-kind={g.kind} aria-labelledby={`qs-diff-${g.kind}`}>
            <h4 id={`qs-diff-${g.kind}`}>{t.differences.kinds[g.kind]}</h4>
            <ul className="qs-cards">
              {g.items.map((d) => (
                <li key={d.id} className="qs-card">
                  {d.termAr ? (
                    <p className="qs-word-ar" lang="ar" dir="rtl">
                      {d.termAr}
                    </p>
                  ) : null}
                  <p>{d.summary}</p>
                  {d.recognised || d.kind === "exegetical" ? <EvidenceLabel kind="disputed">{t.differences.recognised}</EvidenceLabel> : <EvidenceLabel kind="scholar" />}
                  {d.editions.length ? (
                    <p className="zq-meta">
                      {t.differences.editions}: {d.editions.join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <Empty>{data.configured ? t.differences.none : t.notConnected}</Empty>
      )}
    </div>
  );
}

function TafsirTab({ data, t }: { data: StudyData; t: InterpretationStrings }) {
  return (
    <div className="qs-stack">
      <p className="qs-intro">{t.tafsir.intro}</p>
      {data.tafsir.length ? (
        <ol className="qs-cards">
          {data.tafsir.map((s) => (
            <li key={s.edition.id} className="qs-card" data-slot-state={s.state}>
              <div className="qs-card-head">
                <h4>{s.edition.title}</h4>
                <StateBadge state={s.state} t={t} />
              </div>
              <EvidenceLabel kind="scholar" />
              {s.edition.reliabilityNote ? (
                <p className="qs-note">
                  <b>{t.reliabilityNote}:</b> {s.edition.reliabilityNote}
                </p>
              ) : null}
              <Flags flags={s.flags} t={t} />
              {s.text ? (
                <p className="qs-text" lang={s.edition.language} dir="auto">
                  {s.text}
                </p>
              ) : (
                <Pending state={s.state} t={t} />
              )}
              {s.reviewNote ? <p className="zq-meta">{s.reviewNote}</p> : null}
              <Attribution edition={s.edition} t={t} person={t.scholar} />
            </li>
          ))}
        </ol>
      ) : (
        <Empty>{data.configured ? t.tafsir.none : t.notConnected}</Empty>
      )}
    </div>
  );
}

function HadithTab({ data, t }: { data: StudyData; t: InterpretationStrings }) {
  return (
    <div className="qs-stack">
      <p className="qs-intro">{t.hadith.intro}</p>
      {data.hadith.length ? (
        <ul className="qs-cards">
          {data.hadith.map((h) => (
            <li key={`${h.collectionId}-${h.numbering}-${h.number}`} className="qs-card" data-sahih={h.presentedAsSahih ? "yes" : "no"}>
              <div className="qs-card-head">
                <h4>
                  {h.collectionName} {h.number}
                </h4>
                {h.presentedAsSahih ? <EvidenceLabel kind="hadith">{t.hadith.sahih}</EvidenceLabel> : <EvidenceLabel kind="scholar">{t.hadith.notSahih}</EvidenceLabel>}
              </div>
              <p className="zq-meta">{h.numbering}</p>
              <ul className="zq-gradings">
                {h.gradings.map((g) => (
                  <li key={`${g.grader}-${g.grade}`}>
                    <b>{g.grader}</b>: {g.label} — <span className="zq-meta">{g.citation}</span>
                  </li>
                ))}
              </ul>
              <Link href={`/hadith/${h.collectionId}/${h.number}`}>{t.hadith.open} →</Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{data.configured ? t.hadith.none : t.notConnected}</Empty>
      )}
    </div>
  );
}

function RelatedTab({ related, t }: { related: RelatedItem[]; t: InterpretationStrings }) {
  return (
    <div className="qs-stack">
      <p className="qs-intro">{t.related.intro}</p>
      {related.length ? (
        <ul className="qs-cards">
          {related.map((r) => (
            <li key={r.id} className="qs-card">
              <h4>{r.name}</h4>
              <p className="qs-links">
                <Link href={`/prophets/${r.id}`}>{t.related.story} →</Link>
                <Link href={`/timeline?selected=${encodeURIComponent(r.id)}`}>{t.related.timeline} →</Link>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{t.related.none}</Empty>
      )}
    </div>
  );
}

function SummaryTab({ data, t }: { data: StudyData; t: InterpretationStrings }) {
  return (
    <div className="qs-stack">
      <p className="qs-intro">{t.summary.intro}</p>
      {data.explanations.length ? (
        data.explanations.map((e) => (
          <article key={e.id} className="qs-card" lang={e.language} data-origin={e.origin}>
            <div className="qs-card-head">
              <h4>{e.title}</h4>
              <span className="qs-state" data-origin={e.origin}>
                {e.origin === "human" ? t.summary.human : t.summary.ai(e.model ?? t.unknown)}
              </span>
            </div>
            <EvidenceLabel kind="scholar" />
            <Markdown source={e.bodyMd} />
            <p className="zq-meta">
              {t.summary.version(e.version)}
              {e.promptVersion ? ` · prompt ${e.promptVersion}` : ""}
            </p>
          </article>
        ))
      ) : (
        <Empty>{data.configured ? t.summary.none : t.notConnected}</Empty>
      )}
    </div>
  );
}

/* ---------- report an error ---------- */

function ReportForm({ surah, ayah, t, onDone }: { surah: number; ayah: number; t: InterpretationStrings; onDone: () => void }) {
  const id = useId();
  const [body, setBody] = useState("");
  const [evidence, setEvidence] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | "auth"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || body.trim().length < 10) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/corrections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entityType: "quran_ayah_study", entityId: `${surah}:${ayah}`, body: body.trim(), evidence: evidence.trim() || undefined }),
      });
      if (r.status === 401) setMsg({ tone: "auth", text: t.actions.reportSignIn });
      else if (r.status === 503) setMsg({ tone: "err", text: t.notConnected });
      else if (!r.ok) setMsg({ tone: "err", text: t.actions.reportFailed });
      else {
        setMsg({ tone: "ok", text: t.actions.reportSent });
        setBody("");
        setEvidence("");
      }
    } catch {
      setMsg({ tone: "err", text: t.actions.reportFailed });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="qs-report zq-form" onSubmit={submit} aria-labelledby={`${id}-h`}>
      <h4 id={`${id}-h`}>{t.actions.reportTitle}</h4>
      <div className="zq-field">
        <label htmlFor={`${id}-b`}>{t.actions.reportBody}</label>
        <textarea id={`${id}-b`} className="zq-input" rows={3} minLength={10} maxLength={5000} required value={body} onChange={(e) => setBody(e.target.value)} aria-describedby={`${id}-help`} />
        <span id={`${id}-help`} className="zq-help">
          {t.actions.reportHelp}
        </span>
      </div>
      <div className="zq-field">
        <label htmlFor={`${id}-e`}>{t.actions.reportEvidence}</label>
        <input id={`${id}-e`} className="zq-input" maxLength={2000} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
      </div>
      {msg ? (
        <p role={msg.tone === "ok" ? "status" : "alert"} className={msg.tone === "ok" ? "zq-help" : "zq-error"}>
          {msg.text}{" "}
          {msg.tone === "auth" ? <Link href={`/sign-in?returnTo=${encodeURIComponent(`/quran/${surah}#ayah-${ayah}`)}`}>→</Link> : null}
        </p>
      ) : null}
      <div className="qs-actions">
        <button type="submit" className="zq-btn zq-btn-primary zq-btn-sm" disabled={busy}>
          {t.actions.reportSend}
        </button>
        <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={onDone}>
          {t.actions.reportCancel}
        </button>
      </div>
    </form>
  );
}

/* ---------- the panel body ---------- */

/** The panel's content for given data: Arabic on top, the tabs, then the actions. Pure render (unit-tested). */
export function StudyView({ target, data, status, locale, headingId, onClose, headingRef }: {
  target: StudyTarget;
  data: StudyData | null;
  status: "loading" | "ready" | "error";
  locale: string;
  headingId: string;
  onClose: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const t = interpretationT(locale);
  const id = useId();
  const [sel, setSel] = useState(0);
  const [reporting, setReporting] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const ref = `Q ${target.surah}:${target.ayah}`;

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = TAB_KEYS.length;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let next = sel;
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (sel + 1) % n;
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (sel - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    setSel(next);
    tabRefs.current[next]?.focus();
  };

  const key: TabKey = TAB_KEYS[sel] ?? "translations";
  const body = (k: TabKey, d: StudyData): ReactNode => {
    switch (k) {
      case "translations":
        return <TranslationsTab data={d} t={t} />;
      case "words":
        return <WordsTab data={d} t={t} />;
      case "differences":
        return <DifferencesTab data={d} t={t} />;
      case "tafsir":
        return <TafsirTab data={d} t={t} />;
      case "hadith":
        return <HadithTab data={d} t={t} />;
      case "related":
        return <RelatedTab related={target.related} t={t} />;
      case "summary":
        return <SummaryTab data={d} t={t} />;
    }
  };

  return (
    <div className="qs-panel-inner">
      <div className="qs-head">
        <h2 id={headingId} ref={headingRef} tabIndex={-1}>
          {t.studyTitle(ref)}
        </h2>
        <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={onClose}>
          <Icon.close /> {t.close}
        </button>
      </div>

      {/* Arabic first, in normal flow: nothing is ever positioned over it. */}
      <div className="qs-arabic" data-study-arabic="">
        {target.arabic ? (
          <p className="zq-ar-quran" lang="ar" dir="rtl">
            {target.arabic}
          </p>
        ) : (
          <div className="qs-empty">
            <EvidenceLabel kind="unknown">Source not imported</EvidenceLabel>
            <p>{t.arabicNotLoaded}</p>
          </div>
        )}
      </div>

      <div className="zq-tabs qs-tabs" role="tablist" aria-label={t.panelLabel} onKeyDown={onTabKey}>
        {TAB_KEYS.map((k, i) => (
          <button
            key={k}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${k}`}
            aria-controls={`${id}-panel`}
            aria-selected={sel === i}
            tabIndex={sel === i ? 0 : -1}
            className="zq-tab"
            onClick={() => setSel(i)}
          >
            {t.tabs[k]}
          </button>
        ))}
      </div>
      <div className="qs-body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${key}`} tabIndex={0} data-tab={key}>
        {key === "related" ? (
          body(key, data ?? { ...EMPTY, ref: { surah: target.surah, ayah: target.ayah } })
        ) : status === "loading" ? (
          <p className="zq-meta" role="status">
            {t.loading}
          </p>
        ) : status === "error" || !data ? (
          <p className="zq-error" role="alert">
            {t.loadError}
          </p>
        ) : (
          body(key, data)
        )}
      </div>

      <div className="qs-actions qs-foot" role="group" aria-label={t.actions.group}>
        <span className="zq-btn zq-btn-secondary zq-btn-sm qs-disabled" aria-disabled="true" title={t.actions.askMuftiSoon}>
          {t.actions.askMuftiSoon}
        </span>
        <BookmarkButton target={{ type: "quran_verse", id: `${target.surah}:${target.ayah}` }} />
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" aria-expanded={reporting} onClick={() => setReporting((v) => !v)}>
          {t.actions.report}
        </button>
      </div>
      {reporting ? <ReportForm surah={target.surah} ayah={target.ayah} t={t} onDone={() => setReporting(false)} /> : null}
    </div>
  );
}

const EMPTY: StudyData = {
  ref: { surah: 1, ayah: 1 },
  configured: false,
  translations: [],
  earlyTafsir: { edition: null, state: "not_imported", text: null, flags: [], reviewNote: null },
  words: [],
  wordsSource: null,
  differences: [],
  tafsir: [],
  hadith: [],
  explanations: [],
};

/* ---------- the container: bottom sheet below 1024px, docked side panel above ---------- */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

export function useStudyData(target: StudyTarget | null) {
  const [state, setState] = useState<{ key: string; data: StudyData | null; status: "loading" | "ready" | "error" }>({ key: "", data: null, status: "loading" });
  const key = target ? `${target.surah}:${target.ayah}` : "";
  useEffect(() => {
    if (!target) return;
    let live = true;
    setState({ key, data: null, status: "loading" });
    fetch(`/api/quran/${target.surah}/${target.ayah}/study`)
      .then((r) => (r.ok ? (r.json() as Promise<StudyData>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => live && setState({ key, data: d, status: "ready" }))
      .catch(() => live && setState({ key, data: null, status: "error" }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? state : { key, data: null, status: "loading" as const };
}

/**
 * Hosts the reader content and, when a target is set, the Study panel: a modal bottom sheet on phones and tablets,
 * a docked column beside the text on desktop (the grid gives it its own column, so it never covers the Arabic).
 */
export function StudyLayout({ target, locale, onClose, children }: { target: StudyTarget | null; locale: string; onClose: () => void; children: ReactNode }) {
  const desktop = useDesktop();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const { data, status } = useStudyData(target);
  const open = Boolean(target);

  const close = useCallback(() => {
    onClose();
    const o = opener.current;
    opener.current = null;
    setTimeout(() => o?.focus(), 0);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    if (!opener.current && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    heading.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.surah, target?.ayah]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (desktop || e.key !== "Tab" || !sheet.current) return;
      const f = Array.from(sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = f[0];
      const last = f[f.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    let prev = "";
    if (!desktop) {
      prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      if (!desktop) document.body.style.overflow = prev;
    };
  }, [open, desktop, close]);

  const view = target ? <StudyView target={target} data={data} status={status} locale={locale} headingId={headingId} onClose={close} headingRef={heading} /> : null;

  return (
    <div className="qs-layout" data-study-open={open || undefined}>
      <div className="qs-main">{children}</div>
      {target && desktop ? (
        <aside className="qs-side" aria-labelledby={headingId} data-study-panel="side">
          {view}
        </aside>
      ) : null}
      {target && !desktop ? (
        <div className="qs-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
          <div ref={sheet} className="qs-sheet" role="dialog" aria-modal="true" aria-labelledby={headingId} data-study-panel="sheet">
            <div className="qb-grip" aria-hidden="true" />
            {view}
          </div>
        </div>
      ) : null}
    </div>
  );
}
