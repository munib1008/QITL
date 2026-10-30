import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { COLLECTIONS, collectionById } from "@/lib/data/hadith";
import { getServerSupabase } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ collection: string }> }): Promise<Metadata> {
  const c = collectionById((await params).collection);
  return c ? { title: c.name } : {};
}
export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ collection: c.id }));
}

export default async function CollectionPage({ params, searchParams }: { params: Promise<{ locale: string; collection: string }>; searchParams: Promise<{ n?: string }> }) {
  const { locale, collection } = await params;
  const { n } = await searchParams;
  const c = collectionById(collection);
  if (!c) notFound();
  const sb = await getServerSupabase();
  const entries = sb
    ? (await sb.from("hadith_entries").select("canonical_number, numbering_system").eq("collection_id", c.id).eq("status", "published").order("canonical_number").limit(200)).data
    : null;

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ href: "/hadith", label: "Hadith" }, { label: c.name }]}
      title={
        <>
          {c.name}{" "}
          <small lang="ar" dir="rtl" style={{ font: "400 26px/1 var(--font-naskh)", color: "var(--ink-muted)" }}>
            {c.arabic}
          </small>
        </>
      }
      lead={c.note}
    >
      <div className="zq-pagebody">
        <form action={`/hadith/${c.id}`} method="get" className="zq-form" role="search" aria-label={`Go to a narration in ${c.name}`}>
          <div className="zq-field">
            <label htmlFor="hn">Go to a narration by number</label>
            <input id="hn" name="n" className="zq-input" inputMode="numeric" pattern="[0-9]+[a-z]?" defaultValue={n} dir="ltr" />
            <span className="zq-help">Numbers differ between printed editions; each page states its numbering system.</span>
          </div>
        </form>
        {n && /^[0-9]+[a-z]?$/.test(n) ? (
          <p>
            <Link href={`/hadith/${c.id}/${n}`}>
              Open {c.name} {n} →
            </Link>
          </p>
        ) : null}
        {entries?.length ? (
          <ul className="zq-surahs">
            {entries.map((e: { canonical_number: string; numbering_system: string }) => (
              <li key={`${e.numbering_system}-${e.canonical_number}`}>
                <Link href={`/hadith/${c.id}/${e.canonical_number}`}>
                  <span className="zq-order">{e.canonical_number}</span>
                  <span>{e.numbering_system}</span>
                  <span />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState label={<EvidenceLabel kind="unknown">Not yet published</EvidenceLabel>} title={`No narrations from ${c.name} are published yet.`}>
            <p>Narrations are added only from a licensed edition, pinned by version, and appear once each grading is recorded with its scholar and source.</p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
