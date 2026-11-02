"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import { emptyState, makeQuiz, newCard, parseState, queue, review, STUDY_KEY, type QuizQuestion, type StudyState } from "@/lib/asma/learn";

export interface StudyName {
  slug: string;
  ar: string;
  transliteration: string;
  meaning: string;
}

type Tab = "cards" | "quiz" | "saved" | "notes";

/** Flashcards, a quiz, saved Names and notes. Everything is kept in this browser; there are no points or rewards. */
export function Learn({ names, locale }: { names: StudyName[]; locale: string }) {
  const s = asmaStrings(locale).learn;
  const [state, setState] = useState<StudyState>(emptyState());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("cards");
  const [now, setNow] = useState(0);
  useEffect(() => {
    try {
      setState(parseState(localStorage.getItem(STUDY_KEY)));
    } catch {
      /* storage blocked: study works for this visit only */
    }
    setNow(Date.now());
    setReady(true);
  }, []);
  const save = useCallback((next: StudyState) => {
    setState(next);
    try {
      localStorage.setItem(STUDY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);
  const bySlug = useMemo(() => new Map(names.map((n) => [n.slug, n])), [names]);
  const slugs = useMemo(() => names.map((n) => n.slug), [names]);

  if (!names.length) return <p data-testid="learn-empty">{s.noNames}</p>;
  const tabs: Tab[] = ["cards", "quiz", "saved", "notes"];
  return (
    <div className="as-sections" data-testid="learn">
      <div role="tablist" aria-label={s.title} className="as-tabs">
        {tabs.map((k) => (
          <button key={k} role="tab" id={`as-tab-${k}`} aria-selected={tab === k} aria-controls={`as-panel-${k}`} className="as-tab" aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)} type="button">
            {s.tabs[k]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`as-panel-${tab}`} aria-labelledby={`as-tab-${tab}`}>
        {!ready ? null : tab === "cards" ? (
          <Cards state={state} bySlug={bySlug} slugs={slugs} now={now} save={save} locale={locale} />
        ) : tab === "quiz" ? (
          <Quiz names={names} bySlug={bySlug} locale={locale} />
        ) : tab === "saved" ? (
          <Saved state={state} bySlug={bySlug} save={save} locale={locale} />
        ) : (
          <Notes state={state} names={names} save={save} locale={locale} />
        )}
      </div>
      <p className="as-note">{s.deviceOnly}</p>
      <button
        type="button"
        className="zq-btn zq-btn-quiet"
        onClick={() => {
          save(emptyState());
        }}
      >
        {s.reset}
      </button>
    </div>
  );
}

function Cards({ state, bySlug, slugs, now, save, locale }: { state: StudyState; bySlug: Map<string, StudyName>; slugs: string[]; now: number; save: (s: StudyState) => void; locale: string }) {
  const s = asmaStrings(locale).learn;
  const [shown, setShown] = useState(false);
  const q = queue(state.cards, slugs, now);
  const current = q.due[0] ?? q.fresh[0] ?? null;
  const n = current ? bySlug.get(current) : null;
  const answer = (ok: boolean) => {
    if (!current) return;
    const card = state.cards[current] ?? newCard(current);
    save({ ...state, cards: { ...state.cards, [current]: review(card, ok, Date.now()) } });
    setShown(false);
  };
  return (
    <div className="as-sections">
      <p role="status" data-testid="due-count">
        {s.due(q.due.length)} · {s.newCards}: <span dir="ltr">{q.fresh.length}</span>
      </p>
      {!n ? (
        <p>{s.nothingDue}</p>
      ) : (
        <div className="as-flash" data-testid="flashcard">
          <span className="zq-meta">
            {s.cardFront} · {s.box(state.cards[n.slug]?.box ?? 0)}
          </span>
          <span className="as-ar as-ar-xl" lang="ar" dir="rtl">
            {n.ar}
          </span>
          {shown ? (
            <>
              <span className="as-tr" dir="ltr">
                {n.transliteration}
              </span>
              <span className="as-meaning">{n.meaning}</span>
              <div className="as-actions">
                <button type="button" className="zq-btn zq-btn-secondary" onClick={() => answer(true)}>
                  {s.knew}
                </button>
                <button type="button" className="zq-btn zq-btn-secondary" onClick={() => answer(false)}>
                  {s.missed}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="zq-btn zq-btn-primary" onClick={() => setShown(true)}>
              {s.showAnswer}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Quiz({ names, bySlug, locale }: { names: StudyName[]; bySlug: Map<string, StudyName>; locale: string }) {
  const s = asmaStrings(locale).learn;
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const start = () => {
    setQuestions(makeQuiz(names.map((n) => ({ slug: n.slug, meaning: n.meaning })), Date.now() & 0xffffffff, 8));
    setI(0);
    setPicked(null);
    setRight(0);
  };
  if (!questions)
    return (
      <div className="as-sections">
        <h2 className="zq-eyebrow">{s.quizHeading}</h2>
        <div className="as-actions">
          <button type="button" className="zq-btn zq-btn-primary" onClick={start}>
            {s.quizStart}
          </button>
        </div>
      </div>
    );
  if (i >= questions.length)
    return (
      <div className="as-sections">
        <p role="status" data-testid="quiz-result">
          {s.quizResult(right, questions.length)}
        </p>
        <div className="as-actions">
          <button type="button" className="zq-btn zq-btn-primary" onClick={start}>
            {s.again}
          </button>
        </div>
      </div>
    );
  const q = questions[i]!;
  const target = bySlug.get(q.slug)!;
  const toMeaning = q.kind === "toMeaning";
  const choose = (slug: string) => {
    if (picked) return;
    setPicked(slug);
    if (slug === q.slug) setRight((r) => r + 1);
  };
  return (
    <div className="as-sections" data-testid="quiz">
      <p className="zq-meta">
        {i + 1} / {questions.length}
      </p>
      <h2 className="zq-eyebrow">{toMeaning ? s.quizQuestion.toMeaning : s.quizQuestion.toArabic}</h2>
      {toMeaning ? (
        <p className="as-ar as-ar-xl" lang="ar" dir="rtl">
          {target.ar}
        </p>
      ) : (
        <p className="as-tr">{target.meaning}</p>
      )}
      <ul className="as-options">
        {q.options.map((slug) => {
          const o = bySlug.get(slug)!;
          const state = picked ? (slug === q.slug ? "right" : slug === picked ? "wrong" : undefined) : undefined;
          return (
            <li key={slug}>
              <button type="button" className="as-option" data-state={state} onClick={() => choose(slug)} aria-disabled={picked ? true : undefined}>
                {toMeaning ? o.meaning : <span lang="ar" dir="rtl" className="as-ar">{o.ar}</span>}
                {state === "right" ? " ✓" : state === "wrong" ? " ✗" : ""}
              </button>
            </li>
          );
        })}
      </ul>
      {picked ? (
        <div className="as-actions">
          <button
            type="button"
            className="zq-btn zq-btn-secondary"
            onClick={() => {
              setI(i + 1);
              setPicked(null);
            }}
          >
            {s.next}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Saved({ state, bySlug, save, locale }: { state: StudyState; bySlug: Map<string, StudyName>; save: (s: StudyState) => void; locale: string }) {
  const s = asmaStrings(locale);
  const items = state.saved.map((x) => bySlug.get(x)).filter((x): x is StudyName => !!x);
  return (
    <div className="as-sections">
      <h2 className="zq-eyebrow">{s.learn.savedHeading}</h2>
      {items.length === 0 ? (
        <p>{s.learn.noSaved}</p>
      ) : (
        <ul className="as-list" data-testid="saved-list">
          {items.map((n) => (
            <li key={n.slug}>
              <span className="as-ar" lang="ar" dir="rtl">
                {n.ar}
              </span>
              <span className="as-tr" dir="ltr">
                {n.transliteration}
              </span>
              <button type="button" className="zq-btn zq-btn-quiet" onClick={() => save({ ...state, saved: state.saved.filter((x) => x !== n.slug) })}>
                {s.name.unsave}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Notes({ state, names, save, locale }: { state: StudyState; names: StudyName[]; save: (s: StudyState) => void; locale: string }) {
  const s = asmaStrings(locale).learn;
  const [slug, setSlug] = useState(names[0]!.slug);
  const [text, setText] = useState(state.notes[names[0]!.slug] ?? "");
  const [done, setDone] = useState(false);
  return (
    <div className="as-sections">
      <h2 className="zq-eyebrow">{s.notesHeading}</h2>
      <div className="as-field">
        <label htmlFor="as-note-name">{asmaStrings(locale).name.transliteration}</label>
        <select
          id="as-note-name"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setText(state.notes[e.target.value] ?? "");
            setDone(false);
          }}
        >
          {names.map((n) => (
            <option key={n.slug} value={n.slug}>
              {n.transliteration}
            </option>
          ))}
        </select>
      </div>
      <div className="as-field">
        <label htmlFor="as-note-text">{s.notesHeading}</label>
        <textarea id="as-note-text" className="as-textarea" value={text} maxLength={2000} placeholder={s.notePlaceholder} onChange={(e) => { setText(e.target.value); setDone(false); }} />
      </div>
      <div className="as-actions">
        <button
          type="button"
          className="zq-btn zq-btn-secondary"
          onClick={() => {
            const notes = { ...state.notes };
            if (text.trim()) notes[slug] = text.slice(0, 2000);
            else delete notes[slug];
            save({ ...state, notes });
            setDone(true);
          }}
        >
          {asmaStrings(locale).dua.save}
        </button>
      </div>
      <p className="as-note" role="status">
        {done ? s.noteSaved : ""}
      </p>
    </div>
  );
}
