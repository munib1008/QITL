import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BASE, LtaShell, NoRecords } from "@/components/lifestyle/Shell";
import { CategoryBadge, ReconstructionContainer, RecordMeta } from "@/components/lifestyle/Evidence";
import { DraftFields } from "@/components/lifestyle/DraftFields";
import { NuhNote } from "@/components/lifestyle/NuhNote";
import { lifestyleDraft } from "@/lib/lifestyle/draft-data";
import { draftSlugFor } from "@/lib/stories/draft-outline";
import { Markdown } from "@/components/ui/Markdown";
import { findStop, journeyStops } from "@/content/journey";
import { LOCALES } from "@/lib/i18n";
import { lifestyleStrings, type LifestyleStrings } from "@/lib/i18n/modules/lifestyle";
import { getProfiles, type ProfileField } from "@/lib/lifestyle/data";
import { FIELD_KEYS, profileSlugsFor, splitLessons, splitReconstructions, type FieldKey } from "@/lib/lifestyle/model";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => journeyStops().filter((s) => s.type === "prophet").map((s) => ({ locale, id: s.id })));
}
export const dynamicParams = false;
/** Published profiles come from the database; refresh every 5 minutes. */
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const pos = findStop(id);
  if (!pos) return {};
  return { title: `${pos.item.name}: ${lifestyleStrings((await params).locale).prophet.tab}`, alternates: { canonical: `${BASE}/prophets/${id}` } };
}

export default async function ProphetLifePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const pos = findStop(id);
  if (!pos || pos.item.type !== "prophet") notFound();
  const p = pos.item;
  const t = lifestyleStrings(locale);
  const slugs = profileSlugsFor(id);
  const res = await getProfiles(slugs);
  const profiles = res.state === "ok" ? res.data : [];
  return (
    <LtaShell
      locale={locale}
      section="prophets"
      title={`${p.name} — ${t.sections.prophets}`}
      lead={t.sections.prophetsNote}
      crumbs={[{ href: BASE, label: t.title }, { href: `/prophets/${id}`, label: p.name }, { label: t.sections.prophets }]}
    >
      <nav className="lta-tabs" aria-label={p.name}>
        <Link href={`/prophets/${id}`}>{t.prophet.back}</Link>
        <Link href={`${BASE}/prophets/${id}`} aria-current="page">
          {t.prophet.tab}
        </Link>
      </nav>
      <p className="lta-notice">{t.prophet.noDates}</p>
      {id === "nuh" ? <NuhNote t={t} /> : null}
      {slugs.map((slug) => {
        const prof = profiles.find((x) => x.person_slug === slug);
        const draft = lifestyleDraft(slug) ?? lifestyleDraft(draftSlugFor(slug));
        return (
          <section key={slug} className="lta-section" aria-labelledby={`lta-how-${slug}`} data-testid="lifestyle-profile">
            <h2 id={`lta-how-${slug}`}>
              {t.prophet.howTheyLived}
              {slugs.length > 1 ? ` · ${slug.charAt(0).toUpperCase()}${slug.slice(1)}` : ""}
            </h2>
            {!prof && draft ? (
              <DraftFields draft={draft} t={t} locale={locale} />
            ) : !prof ? (
              <>
                <NoRecords t={t} result={res} title={t.prophet.profileDraft} />
                <FieldGrid t={t} fields={[]} />
              </>
            ) : (
              <FieldGrid t={t} fields={prof.fields} />
            )}
          </section>
        );
      })}
    </LtaShell>
  );
}

function FieldGrid({ t, fields }: { t: LifestyleStrings; fields: ProfileField[] }) {
  return (
    <ul className="lta-fields">
      {FIELD_KEYS.map((k) => (
        <FieldCell key={k} k={k} t={t} rows={fields.filter((f) => f.field_key === k && f.known)} />
      ))}
    </ul>
  );
}

function FieldCell({ k, t, rows }: { k: FieldKey; t: LifestyleStrings; rows: ProfileField[] }) {
  if (!rows.length)
    return (
      <li className="lta-field" data-field={k} data-known="false">
        <h3>{t.fields[k]}</h3>
        <CategoryBadge category={null} t={t} />
        <p className="zq-meta" style={{ margin: 0 }}>
          {t.notEstablishedHelp}
        </p>
      </li>
    );
  if (k === "lessons") {
    const { religious, modern, reconstructions } = splitLessons(rows);
    return (
      <li className="lta-field" data-field={k} data-known="true" style={{ gridColumn: "1 / -1" }}>
        <h3>{t.sections.lessons}</h3>
        <div className="lta-lessons">
          <section data-lesson="religious">
            <h3>{t.lessons.religious}</h3>
            <p className="zq-meta">{t.lessons.religiousNote}</p>
            {religious.map((r) => <Row key={r.id} r={r} t={t} />)}
          </section>
          <section data-lesson="modern">
            <h3>{t.lessons.modern}</h3>
            <p className="zq-meta">{t.lessons.modernNote}</p>
            {modern.map((r) => <Row key={r.id} r={r} t={t} />)}
          </section>
        </div>
        {reconstructions.map((r) => <Row key={r.id} r={r} t={t} />)}
      </li>
    );
  }
  const { established, reconstructions } = splitReconstructions(rows);
  return (
    <li className="lta-field" data-field={k} data-known="true">
      <h3>{t.fields[k]}</h3>
      {established.map((r) => <Row key={r.id} r={r} t={t} />)}
      {reconstructions.map((r) => <Row key={r.id} r={r} t={t} />)}
    </li>
  );
}

function Row({ r, t }: { r: ProfileField; t: LifestyleStrings }) {
  const body = (
    <>
      <Markdown source={r.body_md} />
      <RecordMeta r={r} t={t} />
    </>
  );
  return r.evidence_category === "D" ? <ReconstructionContainer t={t}>{body}</ReconstructionContainer> : <div>{body}</div>;
}
