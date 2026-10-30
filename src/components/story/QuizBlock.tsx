"use client";

import { useId, useState } from "react";
import { CitationChip } from "@/components/ui/evidence";
import { refLabel, type Quiz } from "@/lib/data/story-types";

/**
 * A quiz on verified story facts. Each answer shows whether it is right and the source it comes from.
 * No points, streaks or rewards: the aim is understanding, not a score.
 */
export function QuizBlock({ quiz }: { quiz: Quiz }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const uid = useId();
  return (
    <div className="qq">
      <p className="zq-eyebrow">{quiz.title}</p>
      <ol className="qq-list">
        {quiz.questions.map((q) => {
          const chosen = answers[q.id];
          const done = checked[q.id];
          const right = done && chosen === q.correct;
          return (
            <li key={q.id} className="qq-q">
              <fieldset>
                <legend>{q.prompt}</legend>
                {q.options.map((o, i) => (
                  <label key={i} className="qq-opt" data-state={done ? (i === q.correct ? "correct" : i === chosen ? "wrong" : undefined) : undefined}>
                    <input type="radio" name={`${uid}-${q.id}`} checked={chosen === i} disabled={done} onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))} /> {o}
                  </label>
                ))}
              </fieldset>
              {!done ? (
                <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={chosen === undefined} onClick={() => setChecked((c) => ({ ...c, [q.id]: true }))}>
                  Check
                </button>
              ) : (
                <div className="qq-feedback" role="status">
                  <b>{right ? "That's right." : `Not quite: the answer is “${q.options[q.correct]}”.`}</b>
                  {q.explanation ? <p>{q.explanation}</p> : null}
                  <span className="qs-refs">
                    {q.refs.map((r, i) => {
                      const l = refLabel(r);
                      return (
                        <CitationChip key={i} href={l.href}>
                          {l.text}
                        </CitationChip>
                      );
                    })}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
