import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, notConfigured, publicJson } from "@/lib/api";
import { getServerSupabase } from "@/lib/supabase/server";

/** A published story with its published chapters, each chapter's claims and their references. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!z.string().regex(/^[a-z0-9-]{1,120}$/).safeParse(slug).success) return fail(404, "not_found", "Not found.");
  const sb = await getServerSupabase();
  if (!sb) return notConfigured();
  const { data, error } = await sb
    .from("stories")
    .select(
      "id, slug, title, title_ar, summary, published_at, chapters(id, position, title, body_md, status, chapter_claims(anchor, evidence_claims(id, statement, evidence, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, hadith_id, locator, sources(work, edition)))))",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .eq("chapters.status", "published")
    .order("position", { referencedTable: "chapters" })
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "No published story with that address.");
  return publicJson({ story: data });
}
