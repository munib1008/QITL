import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { loadQuran, parseRef, rangeExists } from "@/lib/events/verify";
import { TRACK_IDS } from "@/lib/events/tracks";

const Track = z.enum(TRACK_IDS);
const Category = z.enum(["sacred_history", "prophetic_life", "islamic_history"]);
const Range = z.object({ surah: z.number().int().min(1).max(114), from: z.number().int().min(1), to: z.number().int().min(1) }).refine((r) => r.to >= r.from, "the range ends before it starts");
const Slug = z.string().regex(/^[a-z0-9-]{2,80}$/);

const SourceRef = z.object({ kind: z.enum(["tafsir", "history", "scholar"]), sourceId: z.string().uuid(), locator: z.string().trim().min(1).max(200), note: z.string().max(500).optional() });
const QuranRef = z.object({ kind: z.literal("quran"), surah: z.number().int().min(1).max(114), from: z.number().int().min(1), to: z.number().int().min(1).optional() });
const InlineClaim = z.object({
  statement: z.string().trim().min(5).max(2000),
  evidence: z.enum(["quran", "hadith", "scholar", "estimate", "disputed", "unknown"]),
  references: z.array(z.discriminatedUnion("kind", [QuranRef, SourceRef])).min(1),
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), slug: Slug, title: z.string().trim().min(2).max(200), track: Track, category: Category, nameSource: z.enum(["quran", "later_tradition"]), refs: z.array(Range).min(1).max(40) }),
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    title: z.string().trim().min(2).max(200).optional(),
    titleAr: z.string().trim().max(200).nullable().optional(),
    track: Track.optional(),
    category: Category.optional(),
    nameSource: z.enum(["quran", "later_tradition"]).optional(),
    // How the item is ordered. Years exist only for a historians' dated estimate.
    orderingKind: z.enum(["relative", "disputed", "unassigned", "dated_estimate"]).optional(),
    relativePosition: z.number().int().min(0).optional(),
    startYear: z.number().int().optional(),
    endYear: z.number().int().optional(),
    startAh: z.number().optional(),
    endAh: z.number().optional(),
    datingMethod: z.string().trim().min(3).max(600).optional(),
  }),
  z.object({ action: z.literal("add_verse"), eventId: z.string().uuid(), ref: Range, claimId: z.string().uuid().optional() }),
  z.object({ action: z.literal("remove_verse"), id: z.string().uuid() }),
  z.object({ action: z.literal("attach_claim"), eventId: z.string().uuid(), claimId: z.string().uuid() }),
  z.object({
    action: z.literal("add_identification"),
    eventId: z.string().uuid(),
    kind: z.enum(["identification", "name", "ordering", "dating"]),
    subject: z.string().trim().min(2).max(300),
    view: z.string().trim().min(2).max(600),
    standing: z.enum(["disputed", "widely_held", "minority", "later_tradition"]).default("disputed"),
    claimId: z.string().uuid().optional(),
    claim: InlineClaim.optional(),
  }),
  z.object({
    action: z.literal("add_connection"),
    eventId: z.string().uuid(),
    targetKind: z.enum(["event", "person", "community", "place"]),
    targetId: z.string().uuid(),
    kind: z.enum(["involves", "takes_place_at", "same_community", "related", "lineage"]),
    claimId: z.string().uuid(),
  }),
  z.object({ action: z.literal("merge"), sourceId: z.string().uuid(), targetId: z.string().uuid(), reason: z.string().trim().max(500).optional() }),
]);

/**
 * Editorial actions for the Complete Timeline's events: add a draft shell, correct fields, manage verse references,
 * cited identification/ordering/dating claims and connections, and merge two events. Publishing and review go
 * through /api/admin/status and /api/admin/review; the database refuses to publish without evidence and review.
 * References are checked against the imported Quran text when it is available on the server (the database checks
 * the surah bounds again wherever the text is imported).
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const b = await parseBody(req, Body);
  if (isResponse(b)) return b;

  switch (b.action) {
    case "create": {
      try {
        const q = loadQuran();
        const bad = b.refs.filter((r) => !rangeExists(q, r));
        if (bad.length) return fail(422, "rule", `Not in the Quran text: ${bad.map((r) => `${r.surah}:${r.from}-${r.to}`).join(", ")}.`);
      } catch {
        // The text file is not on this server; the database check still applies where verses are imported.
      }
      const { data: ev, error } = await a.sb
        .from("historical_events")
        .insert({ slug: b.slug, title: b.title, category: b.category, track: b.track, name_source: b.nameSource, date_precision: "unknown", ordering_kind: "unassigned", created_by: a.user.id })
        .select("id, slug")
        .single();
      if (error) return dbError(error);
      const { error: re } = await a.sb.from("event_verse_refs").insert(b.refs.map((r, i) => ({ event_id: ev.id, surah: r.surah, ayah_from: r.from, ayah_to: r.to, position: i })));
      if (re) {
        await a.sb.from("historical_events").delete().eq("id", ev.id);
        return dbError(re);
      }
      return json({ event: ev, status: "draft" }, 201);
    }
    case "update": {
      const patch: Record<string, unknown> = {};
      if (b.title !== undefined) patch.title = b.title;
      if (b.titleAr !== undefined) patch.title_ar = b.titleAr;
      if (b.track !== undefined) patch.track = b.track;
      if (b.category !== undefined) patch.category = b.category;
      if (b.nameSource !== undefined) patch.name_source = b.nameSource;
      if (b.orderingKind !== undefined) {
        // The date columns follow the ordering kind, so no year survives a change to anything but a dated estimate.
        patch.ordering_kind = b.orderingKind;
        patch.relative_position = b.orderingKind === "relative" ? (b.relativePosition ?? null) : null;
        patch.date_precision = b.orderingKind === "relative" ? "relative" : b.orderingKind === "dated_estimate" ? "estimated" : "unknown";
        patch.relative_order = b.orderingKind === "relative" ? (b.relativePosition ?? null) : null;
        const dated = b.orderingKind === "dated_estimate";
        patch.start_year = dated ? (b.startYear ?? null) : null;
        patch.end_year = dated ? (b.endYear ?? b.startYear ?? null) : null;
        patch.start_ah = dated ? (b.startAh ?? null) : null;
        patch.end_ah = dated ? (b.endAh ?? null) : null;
        patch.dating_method = dated ? (b.datingMethod ?? null) : null;
      }
      if (!Object.keys(patch).length) return fail(422, "invalid", "Nothing to change.");
      const { data, error } = await a.sb.from("historical_events").update(patch).eq("id", b.id).select("id, status").maybeSingle();
      if (error) return dbError(error);
      if (!data) return fail(404, "not_found", "Not found, or you cannot change it.");
      return json({ event: data });
    }
    case "add_verse": {
      try {
        if (!rangeExists(loadQuran(), b.ref)) return fail(422, "rule", `${b.ref.surah}:${b.ref.from}-${b.ref.to} is not in the Quran text.`);
      } catch {
        // see above
      }
      const { data, error } = await a.sb.from("event_verse_refs").insert({ event_id: b.eventId, surah: b.ref.surah, ayah_from: b.ref.from, ayah_to: b.ref.to, claim_id: b.claimId ?? null }).select("id").single();
      if (error) return dbError(error);
      return json({ ref: data }, 201);
    }
    case "remove_verse": {
      const { error } = await a.sb.from("event_verse_refs").delete().eq("id", b.id);
      if (error) return dbError(error);
      return json({ ok: true });
    }
    case "attach_claim": {
      // The claim becomes the evidence of every verse reference that has none yet, and one of the event's own claims.
      const { error: e1 } = await a.sb.from("event_verse_refs").update({ claim_id: b.claimId }).eq("event_id", b.eventId).is("claim_id", null);
      if (e1) return dbError(e1);
      const { error: e2 } = await a.sb.from("event_claims").upsert({ event_id: b.eventId, claim_id: b.claimId }, { onConflict: "event_id,claim_id", ignoreDuplicates: true });
      if (e2) return dbError(e2);
      return json({ ok: true });
    }
    case "add_identification": {
      let claimId = b.claimId;
      if (!claimId && b.claim) {
        const { data: claim, error: ce } = await a.sb.from("evidence_claims").insert({ statement: b.claim.statement, evidence: b.claim.evidence, created_by: a.user.id }).select("id").single();
        if (ce) return dbError(ce);
        claimId = claim.id as string;
        const refs = b.claim.references.map((r) =>
          r.kind === "quran" ? { claim_id: claimId, kind: "quran", quran_surah: r.surah, quran_ayah_from: r.from, quran_ayah_to: r.to ?? null } : { claim_id: claimId, kind: r.kind, source_id: r.sourceId, locator: r.locator, note: r.note ?? null },
        );
        const { error: re } = await a.sb.from("claim_references").insert(refs);
        if (re) return dbError(re);
      }
      if (!claimId) return fail(422, "invalid", "An identification, name, order or dating is a cited claim: give a claim id or a new claim.");
      const { data, error } = await a.sb
        .from("event_identifications")
        .insert({ event_id: b.eventId, kind: b.kind, subject: b.subject, view: b.view, standing: b.standing, claim_id: claimId, created_by: a.user.id })
        .select("id")
        .single();
      if (error) return dbError(error);
      return json({ identification: data, claimId }, 201);
    }
    case "add_connection": {
      const row: Record<string, unknown> = { event_id: b.eventId, target_kind: b.targetKind, kind: b.kind, claim_id: b.claimId, created_by: a.user.id };
      if (b.targetKind === "person") row.person_id = b.targetId;
      else if (b.targetKind === "place") row.location_id = b.targetId;
      else row.target_event_id = b.targetId;
      const { data, error } = await a.sb.from("event_connections").insert(row).select("id").single();
      if (error) return dbError(error);
      return json({ connection: data }, 201);
    }
    case "merge": {
      const { data, error } = await a.sb.rpc("merge_events", { source: b.sourceId, target: b.targetId, reason: b.reason ?? null });
      if (error) return dbError(error);
      return json({ mergedInto: data });
    }
  }
}

/** A reference string such as "5:27-31" checked against the Quran text, for the admin form. */
export async function GET(req: NextRequest) {
  const a = await requireRole(req, "editor", { mutation: false });
  if (isResponse(a)) return a;
  const ref = req.nextUrl.searchParams.get("check") ?? "";
  const r = parseRef(ref);
  if (!r) return fail(422, "invalid", "Use a reference such as 5:27-31.");
  try {
    return json({ ref, exists: rangeExists(loadQuran(), r) });
  } catch {
    return json({ ref, exists: null });
  }
}
