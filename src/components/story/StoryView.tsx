"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { Markdown } from "@/components/ui/Markdown";
import { ChapterNav } from "./ChapterNav";
import { AnimationPlayer } from "./AnimationPlayer";
import { QuizBlock } from "./QuizBlock";
import { LanguageNote } from "@/components/i18n/LanguageNote";
import type { Audience, Ref, Section, Story } from "@/lib/data/story-types";
import { AUDIENCES, FACT_KEYS, STEP_ROLES, refLabel } from "@/lib/data/story-types";
import { englishContent } from "@/lib/i18n/locales";
import { storyStrings } from "@/lib/i18n/modules/story";
import { useLocale } from "@/lib/i18n/useLocale";

function Refs({ refs, evidence }: { refs: Ref[]; evidence?: Section["evidence"] }) {
  return (
    <span className="qs-refs">
      {evidence ? <EvidenceLabel kind={evidence} /> : null}
      {refs.map((r, i) => {
        const l = refLabel(r);
        return (
          <CitationChip key={i} href={l.href} kind={r.kind === "hadith" && r.hadith?.grade ? r.hadith.grade : undefined}>
            {l.text}
          </CitationChip>
        );
      })}
    </span>
  );
}

/**
 * One story, in three reading levels. Every level rests on the same reviewed claims: a kids or young text is an
 * adaptation of a full section on the same claim. Where no adaptation exists yet, the full text is shown and says so.
 */
export function StoryView({ story, name, intro, chapterKey }: { story: Story; name: string; intro?: ReactNode; /** shows sticky chapter progress (pages without their own) */ chapterKey?: string }) {
  const locale = useLocale();
  const t = storyStrings(locale);
  const en = englishContent(locale);
  const [level, setLevel] = useState<Audience>("full");
  useEffect(() => {
    try {
      const v = localStorage.getItem("qitl-level");
      if (v === "kids" || v === "young" || v === "full") setLevel(v);
    } catch {
      // storage unavailable
    }
  }, []);
  const choose = (a: Audience) => {
    setLevel(a);
    try {
      localStorage.setItem("qitl-level", a);
    } catch {
      // ignore
    }
  };

  const full = story.sections.filter((s) => s.audience === "full");
  const pick = useMemo(
    () => (s: Section) => {
      if (level === "full") return { s, adapted: true };
      const v = story.sections.find((x) => x.baseId === s.id && x.audience === level);
      return v ? { s: v, adapted: true } : { s, adapted: false };
    },
    [level, story.sections],
  );
  const of = (kind: string) => full.filter((s) => s.section === kind).sort((a, b) => a.position - b.position);

  const Prose = ({ list, empty }: { list: Section[]; empty?: string }) =>
    list.length ? (
      <>
        {list.map((base) => {
          const { s, adapted } = pick(base);
          return (
            <div key={base.id} className="qs-block">
              {s.title ? <h4 {...en}>{s.title}</h4> : null}
              {!adapted ? <p className="qs-level-note">{t.notAdapted}</p> : null}
              <div className="zq-prose" {...en}>
                <Markdown source={s.bodyMd} />
              </div>
              <Refs refs={base.refs} evidence={base.evidence} />
            </div>
          );
        })}
      </>
    ) : empty ? (
      <p className="zq-meta">{empty}</p>
    ) : null;

  const facts = full.filter((s) => s.section === "fact");
  const steps = of("step");
  const groups = [...new Set(steps.map((s) => s.stepGroup!))].sort((a, b) => a - b);
  const allRefs = new Map<string, Ref>();
  for (const s of story.sections) for (const r of s.refs) allRefs.set(refLabel(r).text, r);
  for (const q of story.quizzes) for (const x of q.questions) for (const r of x.refs) allRefs.set(refLabel(r).text, r);
  const hadithRefs = [...allRefs.values()].filter((r) => r.kind === "hadith");
  const quizzes = story.quizzes.filter((q) => level === "full" || q.audience === level || q.audience === "full");

  return (
    <div className="qs" data-level={level}>
      <div className="qs-levels" role="radiogroup" aria-label={t.levels}>
        {AUDIENCES.map(([a]) => (
          <button key={a} type="button" role="radio" aria-checked={level === a} className="zq-pill" onClick={() => choose(a)} title={t.audiences[a][1]}>
            {t.audiences[a][0]}
          </button>
        ))}
        <span className="zq-meta qs-levels-note">{t.levelsNote}</span>
      </div>
      <LanguageNote kind="narration" />
      {chapterKey ? (
        <ChapterNav
          storageKey={chapterKey}
          chapters={[
            { id: "qs-quick", label: t.chapters.quick },
            { id: "qs-a", label: t.chapters.a },
            { id: "qs-b", label: t.chapters.b },
            { id: "qs-c", label: t.chapters.c },
            { id: "qs-d", label: t.chapters.d },
            { id: "qs-e", label: t.chapters.e },
            { id: "qs-f", label: t.chapters.f },
            { id: "qs-reflect", label: t.chapters.reflect },
            { id: "qs-quiz", label: t.chapters.quiz },
            { id: "qs-g", label: t.chapters.g },
          ]}
        />
      ) : null}

      {story.media.length ? (
        <div className="qs-media">
          {story.media.map((m) =>
            m.animationKey ? (
              <AnimationPlayer key={m.id} animation={m.animationKey} caption={m.caption} alt={m.alt} gentle={level === "kids"} />
            ) : m.imageUrl ? (
              <figure key={m.id} className="qs-figure">
                {/* eslint-disable-next-line @next/next/no-img-element -- approved asset from storage */}
                <img src={m.imageUrl} alt={m.alt} loading="lazy" />
                <figcaption>{m.caption}</figcaption>
              </figure>
            ) : null,
          )}
        </div>
      ) : null}

      <section className="qs-sec" aria-labelledby="qs-quick">
        <h3 id="qs-quick">{t.quick}</h3>
        <Prose list={of("summary")} empty={t.quickEmpty} />
      </section>

      <section className="qs-sec" aria-labelledby="qs-a">
        <h3 id="qs-a">
          <span className="qs-letter">A</span> {t.introduction}
        </h3>
        <div className="qp-facts" role="list" aria-label={t.factsAbout(name)}>
          {FACT_KEYS.map((k) => {
            const f = facts.find((x) => x.factKey === k);
            return (
              <div role="listitem" key={k}>
                <div className="qp-fact" data-fact={k}>
                  <span className="qp-fact-label">{t.facts[k]}</span>
                  {f ? (
                    <>
                      {f.known ? (
                        <b className="qp-fact-value" {...en}>
                          {f.valueText}
                        </b>
                      ) : (
                        <b className="qp-fact-value">{t.notEstablishedShort}</b>
                      )}
                      {f.known || f.valueNote ? (
                        <span className="qp-fact-note" {...en}>
                          {f.valueNote}
                        </span>
                      ) : (
                        <span className="qp-fact-note">{t.notEstablished}</span>
                      )}
                      <Refs refs={f.refs} evidence={f.evidence} />
                    </>
                  ) : (
                    <span className="qp-fact-pending">{t.notWritten}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {intro}
        {hadithRefs.length ? (
          <p className="qs-hadith-refs">
            <span className="qp-fact-label">{t.hadithCited}</span> <Refs refs={hadithRefs} />
          </p>
        ) : null}
      </section>

      <section className="qs-sec" aria-labelledby="qs-b">
        <h3 id="qs-b">
          <span className="qs-letter">B</span> {t.before}
        </h3>
        <Prose list={of("before_mission")} empty={t.beforeEmpty} />
      </section>

      <section className="qs-sec" aria-labelledby="qs-c">
        <h3 id="qs-c">
          <span className="qs-letter">C</span> {t.calling}
        </h3>
        <Prose list={of("calling")} empty={t.notWrittenDot} />
      </section>

      <section className="qs-sec" aria-labelledby="qs-d">
        <h3 id="qs-d">
          <span className="qs-letter">D</span> {t.challenges}
        </h3>
        {groups.length ? (
          groups.map((g) => (
            <ol key={g} className="qs-chain" aria-label={t.challenge(g)}>
              {STEP_ROLES.map((role) => {
                const base = steps.find((s) => s.stepGroup === g && s.stepRole === role);
                if (!base) return null;
                const { s, adapted } = pick(base);
                return (
                  <li key={role} className="qs-step" data-role={role}>
                    <span className="qs-step-role">{t.steps[role]}</span>
                    {!adapted ? <p className="qs-level-note">{t.fullShown}</p> : null}
                    <div className="zq-prose" {...en}>
                      <Markdown source={s.bodyMd} />
                    </div>
                    <Refs refs={base.refs} evidence={base.evidence} />
                  </li>
                );
              })}
            </ol>
          ))
        ) : (
          <p className="zq-meta">{t.challengesEmpty}</p>
        )}
      </section>

      <section className="qs-sec" aria-labelledby="qs-e">
        <h3 id="qs-e">
          <span className="qs-letter">E</span> {t.outcome}
        </h3>
        <Prose list={of("outcome")} empty={t.outcomeEmpty} />
      </section>

      <section className="qs-sec" aria-labelledby="qs-f">
        <h3 id="qs-f">
          <span className="qs-letter">F</span> {t.takeaways}
        </h3>
        {of("takeaway").length ? (
          <ul className="qs-takeaways">
            {of("takeaway").map((base) => {
              const { s } = pick(base);
              return (
                <li key={base.id} className="qs-takeaway">
                  <p className="qs-tk-lesson">
                    <span className="qp-fact-label">{t.lesson}</span> <span {...en}>{s.title}</span>
                  </p>
                  <div className="qs-tk-meaning">
                    <span className="qp-fact-label">{t.meaning}</span>
                    <div {...en}>
                      <Markdown source={s.bodyMd} />
                    </div>
                  </div>
                  <p className="qs-tk-example">
                    <span className="qp-fact-label">{t.example}</span> <span {...en}>{s.everydayExample}</span>{" "}
                    <span className="zq-meta">{t.exampleNote}</span>
                  </p>
                  <Refs refs={base.refs} evidence={base.evidence} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="zq-meta">{t.notWrittenDot}</p>
        )}
      </section>

      {of("reflection").length ? (
        <section className="qs-sec" aria-labelledby="qs-reflect">
          <h3 id="qs-reflect">{t.reflect}</h3>
          <ol className="qs-reflect" {...en}>
            {of("reflection").map((base) => (
              <li key={base.id}>
                <Markdown source={pick(base).s.bodyMd} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {quizzes.length ? (
        <section className="qs-sec" aria-labelledby="qs-quiz">
          <h3 id="qs-quiz">{t.quiz}</h3>
          {quizzes.map((q) => (
            <QuizBlock key={q.id} quiz={q} />
          ))}
        </section>
      ) : null}

      {level === "full" && of("scholarly_note").length ? (
        <section className="qs-sec" aria-labelledby="qs-notes">
          <h3 id="qs-notes">{t.scholarlyNotes}</h3>
          <Prose list={of("scholarly_note")} />
        </section>
      ) : null}

      <section className="qs-sec" aria-labelledby="qs-vocab">
        <h3 id="qs-vocab">{t.vocabulary}</h3>
        <EmptyState tone="soon" label={<span className="zq-soon">{t.soon}</span>} title={t.vocabTitle}>
          <p>{t.vocabBody}</p>
        </EmptyState>
      </section>

      <section className="qs-sec" aria-labelledby="qs-g">
        <h3 id="qs-g">
          <span className="qs-letter">G</span> {t.sources}
        </h3>
        {allRefs.size ? (
          <ul className="qs-sources">
            {[...allRefs.values()].map((r) => {
              const l = refLabel(r);
              return (
                <li key={l.text}>
                  <CitationChip href={l.href}>{l.text}</CitationChip>
                  {r.kind === "hadith" && r.hadith ? (
                    <span className="zq-meta">
                      {r.hadith.grade ?? t.grade} — {t.gradedBy} {r.hadith.grader ?? t.aScholar}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="zq-meta">{t.sourcesEmpty}</p>
        )}
      </section>
    </div>
  );
}
