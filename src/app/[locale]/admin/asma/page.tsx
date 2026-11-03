import { AsmaAdmin, type AsmaAdminRow, type AsmaMethodology, type AsmaVerification } from "@/components/admin/AsmaAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";
import { adminStrings } from "@/lib/i18n/modules/admin";
import { adminAsmaStrings } from "@/lib/i18n/modules/adminAsma";
import { buildIndex, countName, queryHash, type CorpusIndex } from "@/lib/asma/count";
import { loadQuranCorpusFromDisk } from "@/lib/asma/corpus-node";
import { storedQuery, type InclusionRow } from "@/lib/asma/seed";

export const dynamic = "force-dynamic";

function loadIndex(): CorpusIndex | null {
  try {
    return buildIndex(loadQuranCorpusFromDisk());
  } catch {
    return null;
  }
}

export default async function AsmaAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = adminAsmaStrings(locale);
  const title = adminStrings(locale).nav["/admin/asma"];
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");

  let rows: AsmaAdminRow[] = [];
  let verification: AsmaVerification[] | null = [];
  let methodology: AsmaMethodology | null = null;
  let inclusions: Array<{ slug: string; measure: string; form: string; root: string | null }> = [];
  if (sb) {
    const names = await sb.from("divine_names").select("id, slug, name_ar, transliteration, status, visibility, integrity_status, scholarly_status, version, classification_version, needs_rereview, rereview_reason, surface_forms").order("created_at").limit(500);
    const list = (names.data ?? []) as Array<AsmaAdminRow & { name_ar: string; surface_forms: string[] }>;
    rows = list.map((r) => ({ ...r, ar: r.name_ar }));
    const m = await sb.from("divine_name_occurrence_methodologies").select("id, version, edition_source, edition_version, edition_sha256, normalisation_policy, tokenisation_policy, query_version").eq("is_current", true).maybeSingle();
    methodology = (m.data as (AsmaMethodology & { id: string }) | null) ?? null;
    const incl = await sb.from("divine_name_inclusions").select("id, name_id, measure, form, root, basis").eq("status", "published");
    const inclRows = (incl.data ?? []) as Array<InclusionRow & { name_id: string }>;
    inclusions = inclRows.map((i) => ({ slug: list.find((n) => n.id === i.name_id)?.slug ?? "?", measure: i.measure, form: i.form, root: i.root }));
    const idx = loadIndex();
    if (!idx) verification = null;
    else if (methodology) {
      const sums = await sb.from("divine_name_count_summaries").select("name_id, measure, occurrence_count, query_hash").eq("methodology_id", (m.data as { id: string }).id);
      const stored = new Map<string, { count: number; hash: string }>();
      for (const s of (sums.data ?? []) as Array<{ name_id: string; measure: "A" | "B" | "C"; occurrence_count: number; query_hash: string }>) stored.set(`${s.name_id}:${s.measure}`, { count: s.occurrence_count, hash: s.query_hash });
      verification = [];
      for (const n of list) {
        const q = storedQuery(n.slug, n.surface_forms, inclRows.filter((i) => i.name_id === n.id));
        const counts = countName(idx, q);
        const hashNow = queryHash(q);
        for (const k of ["A", "B", "C"] as const) {
          const st = stored.get(`${n.id}:${k}`) ?? null;
          const recomputed = counts[k].count;
          verification.push({ id: n.id, slug: n.slug, measure: k, stored: st?.count ?? null, recomputed, hashStored: st?.hash ?? null, hashNow, result: !st ? "none" : st.count !== recomputed ? "mismatch" : st.hash !== hashNow ? "hash" : "match" });
        }
      }
    }
  }
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{title}</h1>
      <p className="zq-meta">{t.pageLead}</p>
      {!sb ? (
        <p>{t.notConnected}</p>
      ) : (
        <AsmaAdmin rows={rows} verification={verification} methodology={methodology} inclusions={inclusions} canEdit={admin || roles.includes("editor")} canReview={admin || roles.includes("scholarly_reviewer")} isAdmin={admin} />
      )}
    </div>
  );
}
