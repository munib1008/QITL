/**
 * The Supabase implementation of the import sinks, for the scripts in scripts/ (service role: imports are the only
 * writer of source text). Not used by the web app. Reads page through PostgREST's row limit.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CollectionId } from "@/lib/data/hadith";
import { ImportRefused, type SourceSink } from "./common";
import type { EditionGateRow } from "./editions";
import type { HadithSink } from "./hadith";
import type { QuranSink } from "./quran";
import type { TranslationSink } from "./translations";

function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new ImportRefused("db", `${what}: ${r.error.message}`);
  return r.data as T;
}

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, what: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await q(from, from + 999), what) ?? [];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

async function chunked<T>(rows: T[], size: number, fn: (part: T[]) => PromiseLike<{ error: { message: string } | null }>, what: string) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await fn(rows.slice(i, i + size));
    if (error) throw new ImportRefused("db", `${what}: ${error.message}`);
  }
}

export function supabaseSink(sb: SupabaseClient): QuranSink & TranslationSink & HadithSink {
  const sources: SourceSink = {
    async findSource(type, work, edition) {
      let q = sb.from("sources").select("id, rights_status").eq("type", type).eq("work", work);
      q = edition === null ? q.is("edition", null) : q.eq("edition", edition);
      const rows = must(await q.limit(1), "find source") as Array<{ id: string; rights_status: "unknown" }>;
      return rows[0] ?? null;
    },
    async createSource(rec) {
      return must(await sb.from("sources").insert({ ...rec, rights_status: "unknown" }).select("id").single(), "create source") as { id: string };
    },
    async findVersion(sourceId, version) {
      const rows = must(await sb.from("source_versions").select("id, checksum_sha256").eq("source_id", sourceId).eq("version", version).limit(1), "find version") as Array<{ id: string; checksum_sha256: string }>;
      return rows[0] ?? null;
    },
    async hasCurrentVersion(sourceId) {
      const rows = must(await sb.from("source_versions").select("id").eq("source_id", sourceId).eq("is_current", true).limit(1), "current version") as unknown[];
      return rows.length > 0;
    },
    async createVersion(rec) {
      return must(await sb.from("source_versions").insert(rec).select("id").single(), "create version") as { id: string };
    },
  };

  async function findEdition(origin: string, originRef: string): Promise<EditionGateRow | null> {
    const rows = must(
      await sb
        .from("translation_editions")
        .select("id, kind, language, title, edition, origin, origin_ref, registry_status, translator_profiles(name), sources(id, type, rights_status, work)")
        .eq("origin", origin)
        .eq("origin_ref", originRef)
        .limit(1),
      "find edition",
    ) as unknown as Array<Omit<EditionGateRow, "translator" | "source"> & { translator_profiles: { name: string } | null; sources: EditionGateRow["source"] }>;
    const r = rows[0];
    if (!r) return null;
    const { translator_profiles, sources: src, ...rest } = r;
    return { ...rest, translator: translator_profiles?.name ?? null, source: src };
  }

  return {
    ...sources,
    findEdition,
    async existingVerses() {
      const rows = await all<{ surah_id: number; ayah_no: number; text_ar: string }>((a, b) => sb.from("quran_verses").select("surah_id, ayah_no, text_ar").order("surah_id").order("ayah_no").range(a, b), "read verses");
      return new Map(rows.map((r) => [`${r.surah_id}:${r.ayah_no}`, r.text_ar]));
    },
    async existingVerseKeys() {
      const rows = await all<{ surah_id: number; ayah_no: number }>((a, b) => sb.from("quran_verses").select("surah_id, ayah_no").order("surah_id").order("ayah_no").range(a, b), "read verse keys");
      return new Set(rows.map((r) => `${r.surah_id}:${r.ayah_no}`));
    },
    async existingSurahs() {
      const rows = must(await sb.from("quran_surahs").select("id"), "read surahs") as Array<{ id: number }>;
      return new Set(rows.map((r) => r.id));
    },
    async insertSurahs(rows) {
      await chunked(rows, 200, (p) => sb.from("quran_surahs").insert(p), "insert surahs");
    },
    async insertVerses(rows) {
      // Insert only: never upsert, so an existing verse can never be overwritten by this path.
      await chunked(rows, 500, (p) => sb.from("quran_verses").insert(p), "insert verses");
    },
    async existingTranslations(sourceId) {
      const rows = await all<{ surah_id: number; ayah_no: number; text: string }>((a, b) => sb.from("quran_translations").select("surah_id, ayah_no, text").eq("source_id", sourceId).range(a, b), "read translations");
      return new Map(rows.map((r) => [`${r.surah_id}:${r.ayah_no}`, r.text]));
    },
    async insertTranslations(rows) {
      await chunked(rows, 500, (p) => sb.from("quran_translations").insert(p), "insert translations");
    },
    async existingHadith(collection: CollectionId, numbering: string) {
      const rows = await all<{ id: string; canonical_number: string; arabic: string }>(
        (a, b) => sb.from("hadith_entries").select("id, canonical_number, arabic").eq("collection_id", collection).eq("numbering_system", numbering).range(a, b),
        "read hadith",
      );
      return new Map(rows.map((r) => [r.canonical_number, { id: r.id, arabic: r.arabic }]));
    },
    async insertHadith(row) {
      return must(await sb.from("hadith_entries").insert(row).select("id").single(), "insert hadith") as { id: string };
    },
    async insertTranslation(row) {
      must(await sb.from("hadith_translations").insert(row), "insert hadith translation");
    },
    async insertGrading(row) {
      must(await sb.from("hadith_gradings").insert(row), "insert grading");
    },
  };
}
