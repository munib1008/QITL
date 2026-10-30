/**
 * Imports narrations of ONE collection from the sunnah.com API as DRAFTS (hadith_entries, hadith_translations,
 * hadith_gradings).
 *
 *   pnpm tsx scripts/import-hadith.ts --collection bukhari|muslim|tirmidhi|ibnmajah --version <label> \
 *     [--max-pages 10] --accept-terms
 *
 * Refuses unless: --accept-terms is passed; the collection is one of the four in QITL's catalogue; a
 * translation_editions row (origin sunnah_com, origin_ref = the collection, kind hadith_translation) is VERIFIED, names
 * its translator, and its source licence is CLEARED. Every grading is stored as the source gives it, with its named
 * grader; nothing is graded from the collection's name. Stored narrations are never modified.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUNNAH_API_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { ImportRefused, parseFlags, requireEnv } from "../src/lib/importers/common";
import { importHadith, sunnahClient } from "../src/lib/importers/hadith";
import { supabaseSink } from "../src/lib/importers/supabase-sink";

async function main() {
  const f = parseFlags(process.argv.slice(2));
  if (!f.has("accept-terms")) throw new ImportRefused("terms_not_accepted", "Read the sunnah.com API terms and pass --accept-terms. Nothing fetched or written.");
  const sb = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const r = await importHadith(supabaseSink(sb), sunnahClient(fetch), {
    collection: f.get("collection") ?? "",
    version: f.get("version") ?? "",
    maxPages: Number(f.get("max-pages") ?? 10),
    acceptTerms: true,
    retrievedAt: new Date(),
  });
  console.log(`${r.collection}: ${r.inserted} drafts inserted, ${r.unchanged} unchanged, ${r.skipped.length} skipped, ${r.gradings} gradings; sha256 ${r.checksum}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof ImportRefused ? `Refused (${e.code}): ${e.message}` : e);
  process.exit(e instanceof ImportRefused ? 2 : 1);
});
