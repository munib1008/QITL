"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { Skeleton } from "@/components/ui/misc";
import { apiCall } from "./api";
import { Pill } from "./ui";

interface Row {
  id: string;
  title: string;
  status: string;
  visibility: string;
  created_at: string;
}

/** "My questions" for the account page: the reader's own questions in any state. */
export function MyQuestions({ locale }: { locale: string }) {
  const t = muftiT(locale);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    apiCall<{ questions: Row[] }>("/api/mufti/questions", "GET")
      .then((d) => setRows(d.questions))
      .catch(() => setError(true));
  }, []);
  return (
    <section className="qa qa-sec" aria-labelledby="my-questions-h">
      <h2 id="my-questions-h">{t.mine.title}</h2>
      {error ? (
        <p className="zq-error" role="alert">
          {t.mine.error}
        </p>
      ) : !rows ? (
        <Skeleton height={18} />
      ) : !rows.length ? (
        <p className="zq-meta">{t.mine.empty}</p>
      ) : (
        <ul className="qa-list">
          {rows.map((q) => (
            <li key={q.id} className="qa-card">
              <Link className="title" href={`/community/questions/${q.id}`}>
                {q.title}
              </Link>
              <div className="qa-meta">
                <Pill>{t.status[q.status] ?? q.status}</Pill>
                <Pill>{t.visibility[q.visibility] ?? q.visibility}</Pill>
                <span>{new Date(q.created_at).toLocaleDateString(locale)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link className="zq-btn zq-btn-secondary" href="/community/questions/ask">
          {t.mine.ask}
        </Link>
      </p>
    </section>
  );
}
