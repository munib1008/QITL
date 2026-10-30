import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";

const QuranRef = z.object({ kind: z.literal("quran"), surah: z.number().int().min(1).max(114), from: z.number().int().min(1), to: z.number().int().min(1).optional() });
const HadithRef = z.object({ kind: z.literal("hadith"), hadithId: z.string().uuid(), gradingId: z.string().uuid().optional() });
const SourceRef = z.object({ kind: z.enum(["tafsir", "history", "scholar"]), sourceId: z.string().uuid(), locator: z.string().trim().min(1).max(200), note: z.string().max(500).optional() });

/** Ring of [lng, lat] pairs; the database checks validity and minimum area for an approximate region. */
const Polygon = z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(4);

const NewEvent = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
    title: z.string().trim().min(3).max(160),
    titleAr: z.string().trim().max(160).optional(),
    summary: z.string().trim().max(2000).optional(),
    category: z.enum(["sacred_history", "prophetic_life", "islamic_history", "last_hour_minor", "last_hour_major"]),
    datePrecision: z.enum(["exact", "range", "estimated", "relative", "unknown"]),
    relativeOrder: z.number().int().optional(),
    startYear: z.number().int().optional(),
    endYear: z.number().int().optional(),
    claim: z.object({
      statement: z.string().trim().min(5).max(2000),
      evidence: z.enum(["quran", "hadith", "scholar", "estimate", "disputed", "unknown"]),
      references: z.array(z.discriminatedUnion("kind", [QuranRef, HadithRef, SourceRef])).min(1),
    }),
    place: z
      .object({
        locationId: z.string().uuid(),
        precision: z.enum(["region", "hypothesis", "unknown"]),
        polygon: Polygon.optional(),
        sourceId: z.string().uuid().optional(),
      })
      .optional(),
  })
  .refine((e) => !e.place || e.place.precision === "unknown" || (e.place.polygon && e.place.sourceId), {
    message: "an approximate region needs a polygon and a source; otherwise mark the place unknown",
    path: ["place"],
  });

/**
 * Flow D: an editor creates an event (often with an unknown date), its claim and citations, and an approximate
 * polygon, all as drafts. A reviewer then approves the claim and the event, and the editor publishes through
 * /api/admin/status. The same rows then feed the map, the timeline, the story and the graph.
 * Steps run in order; a failure part-way leaves only drafts, which the editor can fix or delete.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const e = await parseBody(req, NewEvent);
  if (isResponse(e)) return e;

  const { data: claim, error: ce } = await a.sb
    .from("evidence_claims")
    .insert({ statement: e.claim.statement, evidence: e.claim.evidence, created_by: a.user.id })
    .select("id")
    .single();
  if (ce) return dbError(ce);

  const refs = e.claim.references.map((r) =>
    r.kind === "quran"
      ? { claim_id: claim.id, kind: "quran", quran_surah: r.surah, quran_ayah_from: r.from, quran_ayah_to: r.to ?? null }
      : r.kind === "hadith"
        ? { claim_id: claim.id, kind: "hadith", hadith_id: r.hadithId, hadith_grading_id: r.gradingId ?? null }
        : { claim_id: claim.id, kind: r.kind, source_id: r.sourceId, locator: r.locator, note: r.note ?? null },
  );
  const { error: re } = await a.sb.from("claim_references").insert(refs);
  if (re) return dbError(re);

  const { data: ev, error: ee } = await a.sb
    .from("historical_events")
    .insert({
      slug: e.slug,
      title: e.title,
      title_ar: e.titleAr ?? null,
      summary: e.summary ?? null,
      category: e.category,
      date_precision: e.datePrecision,
      relative_order: e.relativeOrder ?? null,
      start_year: e.startYear ?? null,
      end_year: e.endYear ?? null,
      claim_id: claim.id,
      created_by: a.user.id,
    })
    .select("id, slug")
    .single();
  if (ee) return dbError(ee);

  if (e.place) {
    const { error: pe } = await a.sb.from("event_places").insert({ event_id: ev.id, location_id: e.place.locationId });
    if (pe) return dbError(pe);
    const ring = e.place.polygon ? `SRID=4326;POLYGON((${e.place.polygon.map(([x, y]) => `${x} ${y}`).join(", ")}))` : null;
    const { error: ge } = await a.sb.from("place_geometries").insert({
      location_id: e.place.locationId,
      geom: ring,
      precision: e.place.precision,
      confidence: e.place.precision === "unknown" ? "unknown" : e.claim.evidence === "quran" ? "estimate" : e.claim.evidence,
      claim_id: e.place.precision === "unknown" ? null : claim.id,
      source_id: e.place.sourceId ?? null,
      created_by: a.user.id,
    });
    if (ge) return dbError(ge);
  }
  return json({ event: ev, claimId: claim.id, status: "draft", next: "Ask a scholarly reviewer to approve the claim and the event, then publish." }, 201);
}
