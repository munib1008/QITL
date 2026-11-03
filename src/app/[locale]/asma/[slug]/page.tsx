import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { AiDraftBadge, AiDraftBanner, isAiDraft, MeasureCards, Provenance, Section, Unavailable } from "@/components/asma/Parts";
import { SaveName } from "@/components/asma/SaveName";
import { asmaName } from "@/lib/data/asma";
import { getDict } from "@/lib/i18n";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import { pick, quranHref, titleOf, type Lang } from "@/lib/asma/model";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const n = await asmaName(slug);
  const s = asmaStrings(locale);
  return { title: n ? `${n.transliteration} · ${s.title}` : s.title, robots: n ? undefined : { index: false } };
}

const LANGS: Lang[] = ["en", "ar", "ur"];

export default async function NamePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const { locale } = getDict(raw);
  const s = asmaStrings(locale);
  const n = await asmaName(slug);
  if (n === undefined) notFound();
  if (n === null)
    return (
      <ReadingPage locale={raw} crumbs={[{ href: "/asma", label: s.nav }, { label: slug }]} kicker={s.kicker} title={s.title} lead={s.lead}>
        <div className="zq-pagebody as-page">
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.notConnected.title}</EvidenceLabel>} title={s.notConnected.title}>
            <p>{s.notConnected.body}</p>
          </EmptyState>
        </div>
      </ReadingPage>
    );
  const t = s.name;
  const draft = isAiDraft(n);
  const a = n.summary?.measures.A;
  return (
    <ReadingPage
      locale={raw}
      crumbs={[{ href: "/asma", label: s.nav }, { label: n.transliteration }]}
      kicker={s.kicker}
      title={
        <>
          <span dir="ltr">{n.transliteration}</span>{" "}
          <small lang="ar" dir="rtl" style={{ font: "400 32px/1 var(--font-naskh)", color: "var(--ink-muted)" }}>
            {n.vowelled}
          </small>
        </>
      }
      lead={pick(n.rendering, locale) ?? undefined}
      meta={<AiDraftBadge locale={locale} reviewed={!draft} />}
    >
      <div className="zq-pagebody as-page">
        {draft ? <AiDraftBanner locale={locale} status={n.scholarly_status} /> : null}
        {n.needs_rereview ? <p className="as-note" role="status">{t.review.rereview}</p> : null}
        <nav aria-label={t.sections.A} className="as-actions">
          <Link className="zq-btn zq-btn-quiet zq-btn-link" href="/asma">
            {t.backToAll}
          </Link>
          <SaveName slug={n.slug} locale={locale} />
        </nav>

        <div className="as-sections">
          <Section id="as-a" letter="A" title={t.sections.A}>
            <p data-testid="recognition-status">{s.recognition[n.recognition_status]}</p>
            <p className="as-note">
              {s.recognition.basis}: {n.recognition_basis}
            </p>
            <p className="as-note">{s.recognition.note}</p>
            <MeasureCards locale={locale} summary={n.summary} />
          </Section>

          <Section id="as-b" letter="B" title={t.sections.B}>
            <p className="as-ar as-ar-xl" lang="ar" dir="rtl" data-testid="name-arabic">
              {n.vowelled}
            </p>
            <dl className="as-prov">
              <dt>{t.arabic}</dt>
              <dd lang="ar" dir="rtl">
                {n.ar}
              </dd>
              <dt>{t.transliteration}</dt>
              <dd dir="ltr">{n.transliteration}</dd>
            </dl>
            {n.aliases.length ? (
              <ul className="as-list">
                {n.aliases.map((x) => (
                  <li key={`${x.alias}-${x.language}`}>
                    <span lang={x.language} dir={x.language === "ar" ? "rtl" : undefined}>
                      {x.alias}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section id="as-c" letter="C" title={t.sections.C}>
            <p className="as-note">{t.renderingNote}</p>
            <ul className="as-list" data-testid="renderings">
              {LANGS.map((l) =>
                n.rendering[l] ? (
                  <li key={l}>
                    <span className="zq-meta">{t.languages[l]}</span>
                    <span lang={l} dir={l === "en" ? "ltr" : "rtl"}>
                      {n.rendering[l]}
                    </span>
                  </li>
                ) : null,
              )}
            </ul>
            {n.translations.map((x, i) => (
              <blockquote key={i} className="as-quote" lang={x.language}>
                {x.body}
              </blockquote>
            ))}
          </Section>

          <Section id="as-d" letter="D" title={t.sections.D}>
            <dl className="as-prov">
              <dt>{t.root}</dt>
              <dd lang="ar" dir="rtl">
                {n.root ?? t.rootNone}
              </dd>
            </dl>
            {n.linguistics.length ? (
              <ul className="as-list">
                {n.linguistics.map((x, i) => (
                  <li key={i}>
                    <span className="zq-meta">{x.aspect}</span>
                    <span lang={x.language}>{x.body}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Unavailable locale={locale}>{t.nothingSourced}</Unavailable>
            )}
          </Section>

          <Section id="as-e" letter="E" title={t.sections.E}>
            <EvidenceLabel kind="quran" lang={locale} />
            <p>{t.quranSummary}</p>
            <MeasureCards locale={locale} summary={n.summary} />
            <Provenance locale={locale} summary={n.summary} />
            {a ? (
              <div className="as-actions">
                <Link className="zq-btn zq-btn-secondary zq-btn-link" href={`/asma/${n.slug}/occurrences`} data-testid="open-explorer">
                  {t.explore}
                </Link>
              </div>
            ) : (
              <Unavailable locale={locale}>{s.measures.notComputed}</Unavailable>
            )}
          </Section>

          <Section id="as-f" letter="F" title={t.sections.F}>
            <EvidenceLabel kind="hadith" lang={locale} />
            <p className="as-note">{t.hadith.note}</p>
            {n.hadith_evidence.length ? (
              <ul className="as-list" data-testid="hadith-evidence">
                {n.hadith_evidence.map((h, i) => (
                  <li key={i} data-status={h.evidence_status}>
                    {h.evidence_status === "sourced" ? (
                      <span>
                        {t.hadith.collection}: <span dir="ltr">{h.collection}</span> · {t.hadith.number}: <span dir="ltr">{h.number}</span>
                        {h.grading ? (
                          <>
                            {" "}
                            · {t.hadith.grading}: {h.grading.grade} ({h.grading.grader})
                          </>
                        ) : null}
                      </span>
                    ) : (
                      <Unavailable locale={locale}>{h.reference_label ?? t.hadith.placeholder}</Unavailable>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Unavailable locale={locale} />
            )}
          </Section>

          <Section id="as-g" letter="G" title={t.sections.G}>
            <EvidenceLabel kind="scholar" lang={locale} />
            <p className="as-note">{t.tafsir.note}</p>
            {n.tafsir_links.some((x) => x.evidence_status === "sourced") ? (
              <ul className="as-list">
                {n.tafsir_links
                  .filter((x) => x.evidence_status === "sourced")
                  .map((x, i) => (
                    <li key={i}>
                      <span>{x.work}</span>
                      <span className="zq-meta">
                        {t.tafsir.locator}: {x.locator}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <Unavailable locale={locale} />
            )}
          </Section>

          <Section id="as-h" letter="H" title={t.sections.H}>
            <EvidenceLabel kind="scholar" lang={locale} />
            <p className="as-note">{t.positions.note}</p>
            {n.positions.some((p) => p.evidence_status === "sourced") ? (
              <ul className="as-list" data-testid="positions">
                {n.positions
                  .filter((p) => p.evidence_status === "sourced")
                  .map((p, i) => (
                    <li key={i}>
                      <b>{t.positions.topics[p.topic as keyof typeof t.positions.topics] ?? p.topic}</b>
                      <span>
                        {t.positions.scholar}: {p.scholar} · {t.positions.work}: {p.work} · {p.locator}
                      </span>
                      <span>{p.summary}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <Unavailable locale={locale}>{t.awaitingReview}</Unavailable>
            )}
          </Section>

          <Section id="as-i" letter="I" title={t.sections.I}>
            {n.relationships.length ? (
              <ul className="as-list">
                {n.relationships.map((r) => (
                  <li key={`${r.other}-${r.kind}`}>
                    <Link href={`/asma/${r.other}`}>
                      <span lang="ar" dir="rtl">
                        {r.other_ar}
                      </span>{" "}
                      <span dir="ltr">{r.other_transliteration}</span>
                    </Link>
                    <span className="zq-meta">{t.related[r.kind as keyof typeof t.related] ?? r.kind}</span>
                    {r.surah && r.ayah ? <Link href={quranHref(r.surah, r.ayah)} dir="ltr">{`Q ${r.surah}:${r.ayah}`}</Link> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Unavailable locale={locale}>{t.nothingSourced}</Unavailable>
            )}
          </Section>

          <Section id="as-j" letter="J" title={t.sections.J}>
            {n.duas.length ? (
              <ul className="as-list">
                {n.duas.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/asma/dua/${d.slug}`}>{titleOf(d, locale) || d.slug}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Unavailable locale={locale}>{t.noDuas}</Unavailable>
            )}
          </Section>

          <Section id="as-k" letter="K" title={t.sections.K}>
            <p className="as-note">{t.topicsNote}</p>
            {n.topics.length ? (
              <ul className="as-list" data-testid="name-topics">
                {n.topics.map((x) => (
                  <li key={x.slug}>
                    <b>{titleOf(x, locale)}</b>
                    {x.surah && x.ayah ? <Link href={quranHref(x.surah, x.ayah)} dir="ltr">{`Q ${x.surah}:${x.ayah}`}</Link> : <span className="zq-meta">{s.pathways.needsSource}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <Unavailable locale={locale}>{t.nothingSourced}</Unavailable>
            )}
          </Section>

          <Section id="as-l" letter="L" title={t.sections.L}>
            {n.misconceptions.length ? (
              <ul className="as-list">
                {n.misconceptions.map((m) => (
                  <li key={m.slug}>
                    <span className="zq-meta">{t.misconception.claim}</span>
                    <span>{m.claim}</span>
                    <span className="zq-meta">{t.misconception.correction}</span>
                    {m.correction ? <span>{m.correction}</span> : <Unavailable locale={locale}>{t.misconception.correctionPending}</Unavailable>}
                  </li>
                ))}
              </ul>
            ) : (
              <Unavailable locale={locale}>{t.nothingSourced}</Unavailable>
            )}
          </Section>

          <Section id="as-m" letter="M" title={t.sections.M}>
            <dl className="as-prov">
              <dt>{t.review.status}</dt>
              <dd data-testid="scholarly-status">{t.review.statuses[n.scholarly_status]}</dd>
              <dt>{t.review.version}</dt>
              <dd dir="ltr">{n.version}</dd>
              <dt>{t.review.classification}</dt>
              <dd dir="ltr">{n.classification_version}</dd>
              <dt>{t.review.lastResearch}</dt>
              <dd dir="ltr">{n.last_research_review ?? t.review.none}</dd>
            </dl>
            <Provenance locale={locale} summary={n.summary} />
          </Section>
        </div>
      </div>
    </ReadingPage>
  );
}
