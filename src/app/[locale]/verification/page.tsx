import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { VerificationBadge } from "@/components/verification/VerificationBadge";
import { publicAiDraftGate } from "@/lib/stories/ai-draft-gate";
import { getPublicSupabase } from "@/lib/supabase/server";
import { VERIFICATION_STATES } from "@/lib/verification/model";
import { verificationStrings } from "@/lib/i18n/modules/verification";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = verificationStrings((await params).locale).page;
  return { title: t.title, description: t.lead };
}

/**
 * What the labels mean and where the platform stands, computed from the records. Anonymous readers can see only published
 * rows, so "verified stories" is the count of published stories (publishing needs a recorded qualified approval); reviewer
 * identities and contact details are never shown here.
 */
export default async function VerificationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = verificationStrings(locale);
  const p = t.page;
  const gate = await publicAiDraftGate();
  const sb = getPublicSupabase();
  let verified: number | null = null;
  if (sb) {
    const { count, error } = await sb.from("stories").select("id", { count: "exact", head: true }).eq("status", "published");
    verified = error ? null : (count ?? 0);
  }
  return (
    <ReadingPage locale={locale} crumbs={[{ label: p.title }]} title={p.title} lead={p.lead}>
      <div className="zq-pagebody vf-page">
        <section aria-labelledby="vf-meaning">
          <h2 id="vf-meaning">{p.meaning}</h2>
          <p>{p.verifiedMeans}</p>
          <p>{p.pendingMeans}</p>
          <dl className="vf-states">
            {VERIFICATION_STATES.map((s) => (
              <div key={s}>
                <dt>
                  <VerificationBadge state={s} locale={locale} notice={false} />
                </dt>
                <dd>{t.states[s].what}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="vf-check" data-testid="verification-check">
          <h2 id="vf-check">{p.check.title}</h2>
          <ol>
            {p.check.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="vf-sources">
          <h2 id="vf-sources">{p.howSources}</h2>
          <p>{p.howSourcesBody}</p>
        </section>
        <section aria-labelledby="vf-reviewers">
          <h2 id="vf-reviewers">{p.reviewers}</h2>
          <p>{p.reviewersBody}</p>
        </section>
        <section aria-labelledby="vf-corrections">
          <h2 id="vf-corrections">{p.corrections}</h2>
          <p>{p.correctionsBody}</p>
        </section>
        <section aria-labelledby="vf-licences">
          <h2 id="vf-licences">{p.licences}</h2>
          <p>{p.licencesBody}</p>
        </section>
        <section aria-labelledby="vf-counts">
          <h2 id="vf-counts">{p.counts}</h2>
          <p className="zq-meta">{p.countsNote}</p>
          {gate === null && verified === null ? (
            <p className="zq-meta" data-testid="verification-offline">
              {p.offline}
            </p>
          ) : (
            <ul className="vf-counts" data-testid="verification-counts">
              <li>
                <span>{p.stories}</span>
                <b dir="ltr">{gate ? gate.size : "—"}</b>
              </li>
              <li>
                <span>{p.verifiedStories}</span>
                <b dir="ltr">{verified ?? "—"}</b>
              </li>
            </ul>
          )}
        </section>
      </div>
    </ReadingPage>
  );
}
