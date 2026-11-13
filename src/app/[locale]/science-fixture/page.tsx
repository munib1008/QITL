import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { Disclosure, ReviewBadges, TopicCard } from "@/components/science/Parts";
import type { TopicListItem } from "@/lib/science/model";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Science test fixture", robots: { index: false, follow: false } };

const L = (en: string) => ({ en, ar: "عنوان تجريبي", ur: "تجرباتی عنوان" });
const base: TopicListItem = {
  slug: "fixture-draft", title: L("Fixture draft topic"), discipline: "cosmology", topic_kind: "natural", summary: null, scholarly_status: "not_reviewed", scientific_review: "not_reviewed",
  ai_generated: true, published: false, needs_rereview: false, links: [{ surah: 1, ayah: 1, relationship: "unassessed", interpretation_strength: "unassessed", connection_strength: "unassessed" }], evidence_states: [], milestones: [], origin: "database",
};
const ITEMS: TopicListItem[] = [
  base,
  {
    ...base, slug: "fixture-verified", title: L("Fixture verified topic"), scholarly_status: "approved", scientific_review: "approved", published: true, ai_generated: false,
    links: [{ surah: 1, ayah: 1, relationship: "consistent_interpretation", interpretation_strength: "plausible_interpretive_connection", connection_strength: "limited" }],
    evidence_states: ["well_supported"],
    milestones: [{ discovery: "Fixture", kind: "observation", label: "Fixture milestone", year: 1900, verified_source: "https://example.test/source" }],
  },
  { ...base, slug: "fixture-rejected", title: L("Fixture rejected topic"), scientific_review: "rejected", links: [{ surah: 1, ayah: 1, relationship: "unsupported_claim", interpretation_strength: "weak_or_strained", connection_strength: "none_claimed" }], evidence_states: ["unsupported_or_contradicted"] },
  { ...base, slug: "fixture-mixed", title: L("Fixture one-review topic"), scientific_review: "approved", links: [{ surah: 1, ayah: 1, relationship: "interpretation_debated", interpretation_strength: "disputed_interpretation", connection_strength: "tentative" }], evidence_states: ["established"] },
];

/** Test harness for the Quran & Science components with data in them. 404 unless QITL_E2E_FIXTURES=1. Placeholder text only. */
export default async function ScienceFixture({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.QITL_E2E_FIXTURES !== "1") notFound();
  const { locale: raw } = await params;
  const locale = raw === "ar" || raw === "ur" ? raw : "en";
  return (
    <ReadingPage locale={raw} crumbs={[{ label: "Science test fixture" }]} title="Science test fixture">
      <div className="zq-pagebody sc-page">
        <Disclosure locale={locale} />
        <ul className="sc-grid" data-testid="fixture-grid">
          {ITEMS.map((t) => (
            <TopicCard key={t.slug} t={t} locale={locale} />
          ))}
        </ul>
        <section aria-label="detail" data-testid="fixture-detail">
          <ReviewBadges t={ITEMS[1]!} locale={locale} detail />
        </section>
      </div>
    </ReadingPage>
  );
}
