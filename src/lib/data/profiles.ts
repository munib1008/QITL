import "server-only";
import type { EvidenceKind } from "@/content/labels";
import { getPublicSupabase } from "@/lib/supabase/server";

export const FACT_KINDS = ["time_among_people", "lifespan", "people_addressed", "outcome"] as const;
export type FactKind = (typeof FACT_KINDS)[number];
export const NARRATIVE_KINDS = ["situation", "challenge", "what_happened", "lessons"] as const;

export const SECTION_TITLE: Record<string, string> = {
  overview: "In thirty seconds",
  time_among_people: "Time among his people",
  lifespan: "Total lifespan",
  people_addressed: "People addressed",
  outcome: "Outcome",
  situation: "The situation",
  challenge: "The challenge",
  what_happened: "What happened",
  lessons: "What can we learn?",
  study: "Study",
};

export interface SectionRef {
  kind: string;
  surah: number | null;
  from: number | null;
  to: number | null;
  locator: string | null;
  work: string | null;
}

export interface ProfileSection {
  id: string;
  kind: string;
  depth: "overview" | "narrative" | "study";
  position: number;
  valueText: string | null;
  valueNote: string | null;
  known: boolean;
  bodyMd: string;
  evidence: EvidenceKind;
  refs: SectionRef[];
}

export interface Profile {
  facts: Partial<Record<FactKind, ProfileSection>>;
  overview: ProfileSection[];
  narrative: ProfileSection[];
  study: ProfileSection[];
}

export type ProfileResult = { state: "not_configured" } | { state: "error" } | { state: "ok"; profile: Profile | null };

interface Row {
  id: string;
  kind: string;
  depth: ProfileSection["depth"];
  position: number;
  value_text: string | null;
  value_note: string | null;
  known: boolean;
  body_md: string;
  evidence_claims: {
    evidence: EvidenceKind;
    claim_references: Array<{ kind: string; quran_surah: number | null; quran_ayah_from: number | null; quran_ayah_to: number | null; locator: string | null; sources: { work: string } | null }>;
  } | null;
}

/** Published profile of a person (by slug, which matches the journey stop id). Only reviewed, published sections. */
export async function getPersonProfile(slug: string): Promise<ProfileResult> {
  const sb = getPublicSupabase();
  if (!sb) return { state: "not_configured" };
  const { data, error } = await sb
    .from("profile_sections")
    .select(
      "id, kind, depth, position, value_text, value_note, known, body_md, people!inner(slug), evidence_claims(evidence, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, locator, sources(work)))",
    )
    .eq("people.slug", slug)
    .eq("status", "published")
    .order("position");
  if (error) return { state: "error" };
  const rows = (data ?? []) as unknown as Row[];
  if (!rows.length) return { state: "ok", profile: null };
  const sections: ProfileSection[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    depth: r.depth,
    position: r.position,
    valueText: r.value_text,
    valueNote: r.value_note,
    known: r.known,
    bodyMd: r.body_md,
    evidence: r.evidence_claims?.evidence ?? "unknown",
    refs: (r.evidence_claims?.claim_references ?? []).map((c) => ({
      kind: c.kind,
      surah: c.quran_surah,
      from: c.quran_ayah_from,
      to: c.quran_ayah_to,
      locator: c.locator,
      work: c.sources?.work ?? null,
    })),
  }));
  const facts: Profile["facts"] = {};
  for (const s of sections) if ((FACT_KINDS as readonly string[]).includes(s.kind)) facts[s.kind as FactKind] = s;
  const order = (k: string) => (NARRATIVE_KINDS as readonly string[]).indexOf(k);
  return {
    state: "ok",
    profile: {
      facts,
      overview: sections.filter((s) => s.kind === "overview"),
      narrative: sections.filter((s) => s.depth === "narrative").sort((a, b) => order(a.kind) - order(b.kind) || a.position - b.position),
      study: sections.filter((s) => s.depth === "study"),
    },
  };
}

export function refLabel(r: SectionRef): { text: string; href?: string } {
  if (r.kind === "quran" && r.surah && r.from)
    return { text: `Q ${r.surah}:${r.from}${r.to && r.to !== r.from ? `–${r.to}` : ""}`, href: `/quran/${r.surah}#ayah-${r.from}` };
  return { text: [r.work, r.locator].filter(Boolean).join(", ") || r.kind };
}
