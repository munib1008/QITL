import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import type { Variant } from "./model";

/**
 * Published Qira'at records, read with the anonymous client: RLS returns only published rows, variants only while
 * every reading's edition still allows display, and recordings only while their permission allows it. Nothing is
 * invented when a read fails or the database is not configured: the pages render their designed empty states.
 */
export type Loaded<T> = { state: "not_configured" } | { state: "error" } | { state: "ok"; data: T };

async function run<T>(fn: (sb: NonNullable<ReturnType<typeof getPublicSupabase>>) => Promise<T | null>): Promise<Loaded<T>> {
  const sb = getPublicSupabase();
  if (!sb) return { state: "not_configured" };
  try {
    const data = await fn(sb);
    return data === null ? { state: "error" } : { state: "ok", data };
  } catch {
    return { state: "error" };
  }
}

export interface PublishedReader {
  id: string;
  position: number;
  name_ar: string;
  name_translit: string;
  riwayat: Array<{ id: string; position: number; name_ar: string; name_translit: string }>;
}

export function getReaders(): Promise<Loaded<PublishedReader[]>> {
  return run(async (sb) => {
    const { data, error } = await sb.from("qiraat").select("id, position, name_ar, name_translit, riwayat(id, position, name_ar, name_translit)").eq("status", "published").order("position");
    if (error) return null;
    return ((data ?? []) as PublishedReader[]).map((r) => ({ ...r, riwayat: [...(r.riwayat ?? [])].sort((a, b) => a.position - b.position) }));
  });
}

export function getApprovedVariants(): Promise<Loaded<Variant[]>> {
  return run(async (sb) => {
    const { data, error } = await sb
      .from("qiraat_variants")
      .select("id, surah, ayah, word_position, kind, qiraat_variant_readings(riwayah_id, reading_text, edition_id, quran_text_editions(title, content_permissions(attribution_text))), qiraat_variant_claims(position, evidence_claims(id, statement, evidence))")
      .eq("status", "published")
      .order("surah")
      .order("ayah")
      .order("word_position")
      .limit(200);
    if (error) return null;
    type Row = Omit<Variant, "readings" | "claims"> & {
      qiraat_variant_readings: Array<{ riwayah_id: string; reading_text: string; edition_id: string; quran_text_editions: { title: string; content_permissions: { attribution_text: string | null } | null } | null }> | null;
      qiraat_variant_claims: Array<{ position: number; evidence_claims: Variant["claims"][number] | null }> | null;
    };
    return ((data ?? []) as unknown as Row[])
      .map(({ qiraat_variant_readings, qiraat_variant_claims, ...v }) => ({
        ...v,
        readings: (qiraat_variant_readings ?? []).map((r) => ({
          riwayah_id: r.riwayah_id,
          reading_text: r.reading_text,
          edition_id: r.edition_id,
          edition_title: r.quran_text_editions?.title ?? null,
          attribution: r.quran_text_editions?.content_permissions?.attribution_text ?? null,
        })),
        claims: [...(qiraat_variant_claims ?? [])]
          .sort((a, b) => a.position - b.position)
          .flatMap((c) => (c.evidence_claims ? [c.evidence_claims] : [])),
      }))
      .filter((v) => v.readings.length >= 2 && v.claims.length > 0 && v.readings.every((r) => r.attribution));
  });
}

export interface PublicRecording {
  id: string;
  riwayah_id: string;
  surah: number | null;
  url: string;
  url_kind: "file" | "stream";
  reciter: string;
  attribution: string | null;
}

/** Recordings of this riwayah (and surah, or whole-Quran streams). Comparisons are never offered as the reader's audio. */
export function getRecordings(riwayah: string, surah: number): Promise<Loaded<PublicRecording[]>> {
  return run(async (sb) => {
    const { data, error } = await sb
      .from("audio_recordings")
      .select("id, riwayah_id, surah, url, url_kind, is_comparison, reciters(name_translit), content_permissions(attribution_text)")
      .eq("riwayah_id", riwayah)
      .eq("is_comparison", false)
      .or(`surah.eq.${surah},surah.is.null`)
      .limit(20);
    if (error) return null;
    type Row = { id: string; riwayah_id: string; surah: number | null; url: string; url_kind: "file" | "stream"; reciters: { name_translit: string } | null; content_permissions: { attribution_text: string | null } | null };
    return ((data ?? []) as unknown as Row[])
      .filter((r) => r.riwayah_id === riwayah && r.reciters)
      .map((r) => ({ id: r.id, riwayah_id: r.riwayah_id, surah: r.surah, url: r.url, url_kind: r.url_kind, reciter: r.reciters!.name_translit, attribution: r.content_permissions?.attribution_text ?? null }));
  });
}

export interface ClaimRef {
  kind: string;
  quran_surah: number | null;
  quran_ayah_from: number | null;
  quran_ayah_to: number | null;
  locator: string | null;
}

export interface Misconception {
  id: string;
  question: string;
  claim: { id: string; statement: string; evidence: string; refs: ClaimRef[] };
}

/** Published misconceptions, each answered only by its approved evidence claim and that claim's references. */
export function getMisconceptions(): Promise<Loaded<Misconception[]>> {
  return run(async (sb) => {
    const { data, error } = await sb
      .from("qiraat_misconceptions")
      .select("id, question, position, evidence_claims(id, statement, evidence, status, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, locator))")
      .eq("status", "published")
      .order("position");
    if (error) return null;
    type Row = { id: string; question: string; evidence_claims: { id: string; statement: string; evidence: string; status: string; claim_references: ClaimRef[] | null } | null };
    return ((data ?? []) as unknown as Row[]).flatMap((r) =>
      r.evidence_claims && (r.evidence_claims.status === "approved" || r.evidence_claims.status === "published")
        ? [{ id: r.id, question: r.question, claim: { id: r.evidence_claims.id, statement: r.evidence_claims.statement, evidence: r.evidence_claims.evidence, refs: r.evidence_claims.claim_references ?? [] } }]
        : [],
    );
  });
}

/** "Q 2:255", "Q 2:1–5" or "history: p. 12". */
export function refLabel(r: ClaimRef): string {
  if (r.kind === "quran") return `Q ${r.quran_surah}:${r.quran_ayah_from}${r.quran_ayah_to && r.quran_ayah_to !== r.quran_ayah_from ? `–${r.quran_ayah_to}` : ""}`;
  return `${r.kind}: ${r.locator ?? ""}`;
}
