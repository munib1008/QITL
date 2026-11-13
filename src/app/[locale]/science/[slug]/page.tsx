import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { Assessment, Assessments, Disclosure, En, ReviewBadges, Section, Unavailable } from "@/components/science/Parts";
import { ayahArabic } from "@/content/quran";
import { scienceTopic } from "@/lib/data/science";
import { getDict } from "@/lib/i18n";
import { scienceStrings } from "@/lib/i18n/modules/science";
import { pick3, type Assessed, type EvidenceState, type InterpretationDoc, type TopicDoc } from "@/lib/science/model";
import { displayYear, refLabel } from "@/lib/science/status";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const r = await scienceTopic(slug);
  const s = scienceStrings(locale);
  return { title: r ? `${pick3(r.doc.title, locale)} · ${s.title}` : s.title, robots: r && r.doc.published ? undefined : { index: false } };
}

const quranHref = (surah: number, ayah: number) => `/quran/${surah}#ayah-${ayah}`;

function InterpretationItem({ i, locale }: { i: InterpretationDoc; locale: string }) {
  const t = scienceStrings(locale).topic;
  const era = i.era === "classical" ? t.classical : t.contemporary;
  const when = i.proposed_after_discovery === true ? t.proposedAfter : i.proposed_after_discovery === false ? t.proposedBefore : t.proposedUnknown;
  return (
    <li data-testid="interpretation" data-status={i.evidence_status}>
      <span className="sc-tag">{era}</span>
      {i.evidence_status === "sourced" ? (
        <>
          <b>
            <En locale={locale}>{i.scholar}</En>
            {i.work ? <> · <En locale={locale}>{i.work}</En></> : null}
            {i.locator ? <> · <En locale={locale}>{i.locator}</En></> : null}
          </b>
          {i.summary ? <En locale={locale} as="p">{i.summary}</En> : null}
          <span className="sc-note">{when}</span>
        </>
      ) : (
        <Unavailable locale={locale}>{t.tafsirPlaceholder}</Unavailable>
      )}
    </li>
  );
}

export default async function TopicPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const { locale } = getDict(raw);
  const s = scienceStrings(locale);
  const t = s.topic;
  const r = await scienceTopic(slug);
  if (!r) notFound();
  const d: TopicDoc = r.doc;
  const title = pick3(d.title, locale);
  const claimsStates = d.claims.map((c) => c.evidence_state) as Array<Assessed<EvidenceState>>;
  const sections: Array<[string, number, string]> = [
    ["summary", 1, t.s1], ["passage", 2, t.s2], ["translation", 3, t.s3], ["terms", 4, t.s4], ["tafsir", 5, t.s5], ["phenomenon", 6, t.s6], ["claims", 7, t.s7],
    ["timeline", 8, t.s8], ["evidence", 9, t.s9], ["interpretation", 10, t.s10], ["limitations", 11, t.s11], ["alternatives", 12, t.s12], ["dne", 13, t.s13],
    ["questions", 14, t.s14], ["conclusion", 15, t.s15], ["references", 16, t.s16], ["review", 17, t.s17],
  ];
  const text = (v: string | null, id: string) => (v ? <En locale={locale} as="p">{v}</En> : <Unavailable locale={locale} key={id} />);
  const firstRef = refLabel(d.links);

  return (
    <ReadingPage locale={raw} crumbs={[{ href: "/science", label: s.nav }, { label: title }]} kicker={`${s.kicker} · ${s.disciplines[d.discipline]}`} title={title}>
      <div className="zq-pagebody sc-page" data-testid="science-topic" data-origin={d.origin ?? "database"}>
        <Disclosure locale={locale} />
        {d.origin === "draft_file" ? <p className="sc-note" data-testid="draft-file-note">{t.fromDraftFile}</p> : null}
        <nav aria-label={t.sectionsHeading}>
          <ul className="sc-toc">
            {sections.map(([id, n, label]) => (
              <li key={id}>
                <a href={`#${id}`}>
                  <bdi dir="ltr">{n}.</bdi>&nbsp;{label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Section id="summary" n={1} title={t.s1}>
          {d.summary ? <En locale={locale} as="p">{d.summary}</En> : <Unavailable locale={locale} />}
          <p className="sc-meta">
            <span>
              {s.card.quran} <bdi dir="ltr">{firstRef}</bdi>
            </span>
            <span>{s.disciplines[d.discipline]}</span>
          </p>
          <Assessments item={{ links: d.links, evidence_states: claimsStates }} locale={locale} />
        </Section>

        <Section id="passage" n={2} title={t.s2}>
          <p className="sc-note">{t.passageNote}</p>
          {d.links.map((l) => {
            const ar = ayahArabic(l.surah, l.ayah);
            return (
              <div key={`${l.surah}:${l.ayah}`} data-testid="passage">
                {ar ? (
                  <p className="sc-ayah" lang="ar" dir="rtl">
                    {ar}
                  </p>
                ) : (
                  <Unavailable locale={locale}>{t.corpusMissing}</Unavailable>
                )}
                <Link className="sc-ref" href={quranHref(l.surah, l.ayah)}>
                  Q <bdi dir="ltr">{l.surah}:{l.ayah}</bdi>
                </Link>
              </div>
            );
          })}
        </Section>

        <Section id="translation" n={3} title={t.s3}>
          <Unavailable locale={locale}>{t.translationUnavailable}</Unavailable>
        </Section>

        <Section id="terms" n={4} title={t.s4}>
          <p className="sc-note">{t.termsNote}</p>
          {d.links.some((l) => l.terms?.length) ? (
            d.links.map((l) =>
              l.terms?.length ? (
                <div key={`${l.surah}:${l.ayah}`}>
                  <h3>
                    Q <bdi dir="ltr">{l.surah}:{l.ayah}</bdi>
                  </h3>
                  <ul className="sc-terms" lang="ar" dir="rtl" data-testid="terms">
                    {l.terms.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )
          ) : (
            <p>{t.noTerms}</p>
          )}
        </Section>

        <Section id="tafsir" n={5} title={t.s5}>
          <p className="sc-note">{t.tafsirNote}</p>
          {d.links.map((l) =>
            l.interpretations?.length ? (
              <div key={`${l.surah}:${l.ayah}`}>
                <h3>
                  Q <bdi dir="ltr">{l.surah}:{l.ayah}</bdi>
                </h3>
                <ul className="sc-list">
                  {l.interpretations.map((i, k) => (
                    <InterpretationItem key={k} i={i} locale={locale} />
                  ))}
                </ul>
              </div>
            ) : null,
          )}
          {d.links.every((l) => !l.interpretations?.length) ? <Unavailable locale={locale} /> : null}
        </Section>

        <Section id="phenomenon" n={6} title={t.s6}>
          {text(d.phenomenon, "phenomenon")}
        </Section>

        <Section id="claims" n={7} title={t.s7}>
          {d.claims.length ? (
            <ul className="sc-list" data-testid="claims">
              {d.claims.map((c, k) => (
                <li key={k}>
                  <En locale={locale} as="p">{c.claim}</En>
                  <dl className="sc-assessments">
                    <Assessment kind="evidence" values={[c.evidence_state]} locale={locale} />
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t.claimsNone}</p>
          )}
        </Section>

        <Section id="timeline" n={8} title={t.s8}>
          <div className="sc-layers" data-both="true">
            <div className="sc-layer" data-layer="a">
              <h3>{t.layerA}</h3>
              <ol>
                {d.links.map((l) => (
                  <li key={`${l.surah}:${l.ayah}`}>
                    Q <bdi dir="ltr">{l.surah}:{l.ayah}</bdi>
                    {l.interpretations?.filter((i) => i.evidence_status === "sourced").map((i, k) => (
                      <span key={k} className="sc-note">
                        {" · "}
                        {i.era === "classical" ? t.classical : t.contemporary}
                      </span>
                    ))}
                  </li>
                ))}
              </ol>
            </div>
            <div className="sc-layer" data-layer="b">
              <h3>{t.layerB}</h3>
              {d.milestones.length ? (
                <ol data-testid="milestones">
                  {d.milestones.map((m, k) => {
                    const y = displayYear(m);
                    return (
                      <li key={k} data-dated={y.year != null ? "true" : "false"}>
                        <b dir="ltr">{y.year != null ? y.year : t.notYetVerified}</b> · <En locale={locale}>{m.label}</En>
                        {y.sourceUrl ? (
                          <>
                            {" "}
                            <a href={y.sourceUrl} rel="noopener noreferrer" target="_blank">
                              {t.sourceChecked}
                            </a>
                          </>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <Unavailable locale={locale} />
              )}
            </div>
          </div>
          <p className="sc-link-note" data-testid="interpretive-link">
            {t.link}
          </p>
        </Section>

        <Section id="evidence" n={9} title={t.s9}>
          {d.evidence.length ? (
            <ul className="sc-list">
              {d.evidence.map((e, k) => (
                <li key={k}>
                  <En locale={locale} as="p">{e.summary}</En>
                  <span className="sc-note">{e.evidence_status === "sourced" && e.cited ? t.citedVerified : t.evidenceNeedsSource}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t.evidenceNone}</p>
          )}
        </Section>

        <Section id="interpretation" n={10} title={t.s10}>
          <p className="sc-note">{s.assessments.unassessedNote}</p>
          {d.links.map((l) => (
            <div key={`${l.surah}:${l.ayah}`}>
              <h3>
                Q <bdi dir="ltr">{l.surah}:{l.ayah}</bdi>
              </h3>
              <dl className="sc-assessments">
                <Assessment kind="interpretation" values={[l.interpretation_strength]} locale={locale} />
                <Assessment kind="connection" values={[l.connection_strength]} locale={locale} />
                <Assessment kind="relationship" values={[l.relationship]} locale={locale} />
              </dl>
              {l.note ? <En locale={locale} as="p">{l.note}</En> : null}
            </div>
          ))}
        </Section>

        <Section id="limitations" n={11} title={t.s11}>
          {text(d.limitations, "limitations")}
        </Section>

        <Section id="alternatives" n={12} title={t.s12}>
          {text(d.alternatives, "alternatives")}
        </Section>

        <section className="sc-section sc-dne" aria-labelledby="dne-h" id="dne" data-testid="does-not-establish">
          <h2 id="dne-h">
            <span className="sc-num" aria-hidden="true">
              13
            </span>
            {t.s13}
          </h2>
          <p>{pick3(d.does_not_establish, locale)}</p>
        </section>

        <Section id="questions" n={14} title={t.s14}>
          {d.open_questions.length ? (
            <ul className="sc-list">
              {d.open_questions.map((q, k) => (
                <li key={k}>
                  <b>
                    <En locale={locale}>{q.question}</En>
                  </b>
                  <span className="sc-note">{s.testability[q.testability]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t.openQuestionsNone}</p>
          )}
          <Link href="/science/questions">{s.explore.questions}</Link>
        </Section>

        <Section id="conclusion" n={15} title={t.s15}>
          {d.conclusion ? <En locale={locale} as="p">{d.conclusion}</En> : <Unavailable locale={locale}>{t.conclusionNote}</Unavailable>}
        </Section>

        <Section id="references" n={16} title={t.s16}>
          {d.publications.length ? (
            <ul className="sc-list" data-testid="publications">
              {d.publications.map((p, k) => (
                <li key={k}>
                  <En locale={locale}>
                    {p.authors.join(", ")}
                    {p.authors.length ? ". " : ""}
                    {p.title}
                    {p.year != null ? ` (${p.year})` : ""}
                  </En>
                  {p.doi ? (
                    <a href={`https://doi.org/${p.doi}`} rel="noopener noreferrer" target="_blank" dir="ltr">
                      {t.doi} {p.doi}
                    </a>
                  ) : p.url ? (
                    <a href={p.url} rel="noopener noreferrer" target="_blank" dir="ltr">
                      {p.url}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p data-testid="no-publications">{t.publicationsNone}</p>
              <p className="sc-note">{t.publicationsPending}</p>
            </>
          )}
        </Section>

        <Section id="review" n={17} title={t.s17}>
          <p>{t.reviewIntro}</p>
          <ReviewBadges t={d} locale={locale} detail />
          {d.version ? (
            <p className="sc-note">
              {t.version}: <bdi dir="ltr">{d.version}</bdi>
            </p>
          ) : null}
        </Section>
      </div>
    </ReadingPage>
  );
}
