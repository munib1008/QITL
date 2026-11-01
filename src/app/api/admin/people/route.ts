import type { NextRequest } from "next/server";
import { fail, isResponse, json, parseBody, parseQuery } from "@/lib/api";
import { requireAnyRole, requireRole } from "@/lib/admin";
import { ClassificationSchema, ListQuerySchema, kindIssue, kindIssueText, likeTerm } from "@/lib/people-admin/form";
import { refusal } from "@/lib/people-admin/server";

const PERSON_LIST =
  "id, slug, name_en, name_ar, kind, encyclopedia_kind, status, subject_event_id, subject:historical_events!people_subject_event_id_fkey(slug, title, track), claims:person_claims(count)";
const COMMUNITY_LIST =
  "id, slug, name_en, name_ar, status, evidence_category, claim_id, subject_event_id, subject:historical_events!historical_communities_subject_event_id_fkey(slug, title, track)";
const REFS = "claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to)";

/**
 * Staff reads for the People and Communities screens, all under the caller's own session (row-level security decides what
 * they see; nothing here uses a service key):
 *   view=list    people or communities with status, kind, Event Universe item and claim count
 *   view=detail  one person's aliases, claims (with Quran references) and latest scholarly review
 *   view=events  Event Universe items of one track, for the subject picker (editors)
 *   view=claims  existing evidence claims by statement or id, with their Quran references (editors)
 */
export async function GET(req: NextRequest) {
  const q = parseQuery(req, ListQuerySchema);
  if (isResponse(q)) return q;
  const picker = q.view === "events" || q.view === "claims";
  const a = picker ? await requireRole(req, "editor", { mutation: false }) : await requireAnyRole(req, ["editor", "scholarly_reviewer"], { mutation: false });
  if (isResponse(a)) return a;
  const term = likeTerm(q.q);

  if (q.view === "list") {
    const table = q.scope === "person" ? "people" : "historical_communities";
    let b = a.sb.from(table).select(q.scope === "person" ? PERSON_LIST : COMMUNITY_LIST).order("name_en").limit(300);
    if (q.status) b = b.eq("status", q.status);
    if (term) b = b.ilike("name_en", `%${term}%`);
    const { data, error } = await b;
    if (error) return refusal(error);
    return json({ items: data ?? [] });
  }

  if (q.view === "detail") {
    if (q.scope !== "person" || !q.id) return fail(422, "invalid", "Detail is available for one person at a time.");
    const [aliases, claims, review] = await Promise.all([
      a.sb.from("person_aliases").select("alias, language").eq("person_id", q.id).order("alias"),
      a.sb.from("person_claims").select(`id, position, claim_id, claim:evidence_claims(id, statement, status, evidence, ${REFS})`).eq("person_id", q.id).order("position"),
      a.sb.from("editorial_reviews").select("decision, created_at").eq("entity_type", "person").eq("entity_id", q.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const err = aliases.error ?? claims.error ?? review.error;
    if (err) return refusal(err);
    return json({ aliases: aliases.data ?? [], claims: claims.data ?? [], review: review.data ?? null });
  }

  if (q.view === "events") {
    if (!q.track) return fail(422, "invalid", "Choose a track.");
    let b = a.sb.from("historical_events").select("id, slug, title, title_ar, track, status").eq("track", q.track).order("title").limit(25);
    if (term) b = b.ilike("title", `%${term}%`);
    const { data, error } = await b;
    if (error) return refusal(error);
    return json({ items: data ?? [] });
  }

  // view = claims. A uuid finds that claim; anything else searches the statement.
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q.q ?? "");
  let b = a.sb.from("evidence_claims").select(`id, statement, status, evidence, ${REFS}`).in("status", ["draft", "in_review", "approved", "published"]).order("created_at", { ascending: false }).limit(25);
  if (isId) b = b.eq("id", q.q as string);
  else if (term) b = b.ilike("statement", `%${term}%`);
  const { data, error } = await b;
  if (error) return refusal(error);
  return json({ items: data ?? [] });
}

/**
 * Set the encyclopedia kind (people) and/or the Event Universe item (people and communities). Editors only. A published
 * record is read-only here (the database refuses it too); the kind rules and the track rule are checked by the database
 * triggers and constraints, whose refusal is returned in plain words.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const c = await parseBody(req, ClassificationSchema);
  if (isResponse(c)) return c;

  const table = c.scope === "person" ? "people" : "historical_communities";
  const { data: row, error: e0 } = await a.sb.from(table).select(c.scope === "person" ? "id, status, kind" : "id, status").eq("id", c.id).maybeSingle();
  if (e0) return refusal(e0);
  if (!row) return fail(404, "not_found", "Not found, or you cannot see it.");
  const cur = row as unknown as { status: string; kind?: string };
  if (cur.status === "published") return fail(409, "published", "A published record is read-only. Move it to correction first.");

  const patch: Record<string, unknown> = {};
  if (c.encyclopediaKind !== undefined) {
    const issue = kindIssue(cur.kind ?? "", c.encyclopediaKind);
    if (issue) return fail(422, issue, kindIssueText(issue));
    patch.encyclopedia_kind = c.encyclopediaKind;
  }
  if (c.subjectEventId !== undefined) patch.subject_event_id = c.subjectEventId;

  const { data, error } = await a.sb.from(table).update(patch).eq("id", c.id).select("id").maybeSingle();
  if (error) return refusal(error);
  if (!data) return fail(404, "not_found", "Not found, or you cannot change it.");
  return json({ record: data });
}
