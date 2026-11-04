import { ScienceAdmin, type ScienceAdminRow, type ScienceClaimRow, type ScienceHistoryRow, type ScienceMilestoneRow, type SciencePublicationRow } from "@/components/admin/ScienceAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";
import { adminStrings } from "@/lib/i18n/modules/admin";
import { adminScienceStrings } from "@/lib/i18n/modules/adminScience";

export const dynamic = "force-dynamic";

export default async function ScienceAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = adminScienceStrings(locale);
  const title = adminStrings(locale).nav["/admin/science"];
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");

  let rows: ScienceAdminRow[] = [];
  let publications: SciencePublicationRow[] = [];
  let milestones: ScienceMilestoneRow[] = [];
  let claims: ScienceClaimRow[] = [];
  let history: ScienceHistoryRow[] = [];
  if (sb) {
    const topics = await sb
      .from("science_topics")
      .select("id, slug, title_en, title_ar, status, visibility, integrity_status, scholarly_status, scientific_review, version, classification_version, needs_rereview, rereview_reason")
      .order("created_at")
      .limit(500);
    rows = (topics.data ?? []) as ScienceAdminRow[];
    const slug = new Map(rows.map((r) => [r.id, r.slug]));
    const pubs = await sb.from("science_publications").select("id, topic_id, title, doi, year, verified, verified_source").order("created_at").limit(500);
    publications = ((pubs.data ?? []) as Array<SciencePublicationRow & { topic_id: string }>).map((p) => ({ ...p, topic: slug.get(p.topic_id) ?? "?" }));
    const ds = await sb.from("science_discoveries").select("id, topic_id, title_en").limit(500);
    const disc = new Map(((ds.data ?? []) as Array<{ id: string; topic_id: string; title_en: string }>).map((d) => [d.id, d]));
    const ms = await sb.from("science_discovery_milestones").select("id, discovery_id, label_en, year, verified_source").order("year", { nullsFirst: false }).limit(1000);
    milestones = ((ms.data ?? []) as Array<{ id: string; discovery_id: string; label_en: string; year: number | null; verified_source: string | null }>).map((m) => ({
      id: m.id,
      topic: slug.get(disc.get(m.discovery_id)?.topic_id ?? "") ?? "?",
      discovery: disc.get(m.discovery_id)?.title_en ?? "?",
      label: m.label_en,
      year: m.year,
      verified_source: m.verified_source,
    }));
    const cl = await sb.from("science_claims").select("id, topic_id, claim_en, evidence_state").limit(1000);
    claims = ((cl.data ?? []) as Array<{ id: string; topic_id: string; claim_en: string; evidence_state: string }>).map((c) => ({ id: c.id, topic: slug.get(c.topic_id) ?? "?", claim: c.claim_en, evidence_state: c.evidence_state }));
    const h = await sb.from("science_revision_history").select("id, topic_id, topic_version, action, created_at").order("created_at", { ascending: false }).limit(100);
    history = ((h.data ?? []) as Array<{ id: string; topic_id: string; topic_version: number; action: string; created_at: string }>).map((x) => ({ ...x, topic: slug.get(x.topic_id) ?? "?" }));
  }
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{title}</h1>
      <p className="zq-meta">{t.pageLead}</p>
      {!sb ? (
        <p>{t.notConnected}</p>
      ) : (
        <ScienceAdmin
          rows={rows}
          publications={publications}
          milestones={milestones}
          claims={claims}
          history={history}
          canEdit={admin || roles.includes("editor")}
          canScience={roles.includes("science_reviewer")}
          canScholarly={roles.includes("scholarly_reviewer")}
        />
      )}
    </div>
  );
}
