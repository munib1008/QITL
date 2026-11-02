import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireAnyRole, requireRole } from "@/lib/admin";
import { buildIndex, countName, queryHash } from "@/lib/asma/count";
import { loadQuranCorpusFromDisk } from "@/lib/asma/corpus-node";
import { occurrenceRows, storedQuery, type InclusionRow } from "@/lib/asma/seed";

const TYPES = ["divine_name", "authentic_dua", "dua_life_topic"] as const;
const TABLE = { divine_name: "divine_names", authentic_dua: "authentic_duas", dua_life_topic: "dua_life_topics" } as const;

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("integrity"), type: z.enum(TYPES), id: z.string().uuid() }),
  z.object({ action: z.literal("publish_ai"), type: z.enum(TYPES), id: z.string().uuid() }),
  z.object({ action: z.literal("withdraw_ai"), type: z.enum(TYPES), id: z.string().uuid() }),
  z.object({ action: z.literal("status"), type: z.enum(TYPES), id: z.string().uuid(), status: z.enum(["in_review", "published", "correction"]) }),
  z.object({ action: z.literal("clear_flag"), type: z.enum(TYPES), id: z.string().uuid() }),
  z.object({ action: z.literal("review"), type: z.enum(TYPES), id: z.string().uuid(), decision: z.enum(["approved", "changes_requested", "rejected"]), comment: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal("recount"), id: z.string().uuid() }),
]);

/**
 * Research-console actions. Every one is authorised again by the database: the integrity check, AI-draft publication and
 * status changes need an editor; reviews need a scholarly reviewer (never the author); a recount needs an administrator
 * and is computed here from the pinned corpus with the Name's STORED query, then written only through the database
 * function asma_replace_occurrences (which derives the summaries itself). Nothing here accepts a count from the client.
 */
export async function POST(req: NextRequest) {
  const raw = (await req.clone().json().catch(() => ({}))) as { action?: string };
  const a = raw.action === "review" ? await requireRole(req, "scholarly_reviewer") : raw.action === "recount" ? await requireRole(req, "admin") : await requireAnyRole(req, ["editor", "admin"]);
  if (isResponse(a)) return a;
  const b = await parseBody(req, Body);
  if (isResponse(b)) return b;

  switch (b.action) {
    case "integrity": {
      const { data, error } = await a.sb.rpc("run_asma_integrity", { p_type: b.type, p_id: b.id });
      return error ? dbError(error) : json({ result: data });
    }
    case "publish_ai": {
      const { error } = await a.sb.rpc("publish_asma_ai_draft", { p_type: b.type, p_id: b.id });
      return error ? dbError(error) : json({ ok: true });
    }
    case "withdraw_ai": {
      const { error } = await a.sb.rpc("withdraw_asma_ai_draft", { p_type: b.type, p_id: b.id });
      return error ? dbError(error) : json({ ok: true });
    }
    case "status": {
      const { error } = await a.sb.from(TABLE[b.type]).update({ status: b.status }).eq("id", b.id);
      return error ? dbError(error) : json({ ok: true });
    }
    case "clear_flag": {
      const { error } = await a.sb.from(TABLE[b.type]).update({ needs_rereview: false, rereview_reason: null }).eq("id", b.id);
      return error ? dbError(error) : json({ ok: true });
    }
    case "review": {
      const { data, error } = await a.sb.from("divine_name_reviews").insert({ entity_type: b.type, entity_id: b.id, reviewer_id: a.user.id, decision: b.decision, comment: b.comment ?? null }).select("id, entity_version").single();
      return error ? dbError(error) : json({ review: data }, 201);
    }
    case "recount": {
      let corpus;
      try {
        corpus = loadQuranCorpusFromDisk();
      } catch (e) {
        return fail(503, "corpus_unavailable", e instanceof Error ? e.message : "The Quran corpus could not be read.");
      }
      const m = await a.sb.from("divine_name_occurrence_methodologies").select("id, edition_sha256, edition_content_sha256, normalisation_policy, tokenisation_policy, query_version").eq("is_current", true).maybeSingle();
      if (m.error) return dbError(m.error);
      if (!m.data) return fail(409, "no_methodology", "No current counting methodology is recorded.");
      const cur = m.data as { id: string; edition_sha256: string; edition_content_sha256: string; normalisation_policy: string; tokenisation_policy: string; query_version: string };
      const idx = buildIndex(corpus);
      if (cur.edition_sha256 !== corpus.edition.sha256 || cur.edition_content_sha256 !== corpus.edition.contentSha256)
        return fail(409, "methodology_mismatch", "The Quran text on this server differs from the current methodology's edition. A changed edition needs a new methodology (and sends every Name back for re-review).");
      const n = await a.sb.from("divine_names").select("slug, surface_forms").eq("id", b.id).maybeSingle();
      if (n.error) return dbError(n.error);
      if (!n.data) return fail(404, "not_found", "No such Name.");
      const inc = await a.sb.from("divine_name_inclusions").select("id, measure, form, root, basis").eq("name_id", b.id).eq("status", "published");
      if (inc.error) return dbError(inc.error);
      const name = n.data as { slug: string; surface_forms: string[] };
      const q = storedQuery(name.slug, name.surface_forms, (inc.data ?? []) as InclusionRow[]);
      const counts = countName(idx, q);
      const { data, error } = await a.sb.rpc("asma_replace_occurrences", { p_name: b.id, p_methodology: cur.id, p_query_hash: queryHash(q), p_rows: occurrenceRows(counts) });
      return error ? dbError(error) : json({ counts: data });
    }
  }
}
