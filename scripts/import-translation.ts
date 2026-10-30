/**
 * Imports ONE Quran translation edition from QuranEnc or the Quran Foundation Content API into quran_translations.
 *
 *   pnpm tsx scripts/import-translation.ts --provider quranenc --ref <translation_key> --version <label> \
 *     --surahs 1-114 --accept-terms
 *   pnpm tsx scripts/import-translation.ts --provider quran_foundation --ref <translation id> --version <label> \
 *     --surahs 1,12 --accept-terms
 *
 * Refuses unless: --accept-terms is passed; the edition is registered in translation_editions with this origin and
 * origin_ref, VERIFIED by an editor, linked to a source whose licence is CLEARED, and names its translator; the Quran
 * text is already imported. Stored translation rows are never modified. Nothing is published by this script: text
 * appears only while the edition stays verified and cleared (RLS).
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and QURANENC_API_KEY (QuranEnc) or QF_CLIENT_ID +
 * QF_CLIENT_SECRET (Quran Foundation; optional QF_AUTH_URL / QF_API_BASE for their pre-production environment).
 */
import { createClient } from "@supabase/supabase-js";
import { ImportRefused, parseFlags, parseSurahList, requireEnv } from "../src/lib/importers/common";
import { supabaseSink } from "../src/lib/importers/supabase-sink";
import { importTranslation, quranEncClient, quranFoundationClient, type TranslationProvider } from "../src/lib/importers/translations";

async function main() {
  const f = parseFlags(process.argv.slice(2));
  const provider = f.get("provider") as TranslationProvider | undefined;
  if (provider !== "quranenc" && provider !== "quran_foundation") throw new ImportRefused("usage", "Pass --provider quranenc or --provider quran_foundation.");
  const ref = f.get("ref");
  if (!ref) throw new ImportRefused("usage", "Pass --ref <the provider's edition reference>.");
  if (!f.has("accept-terms")) throw new ImportRefused("terms_not_accepted", `Read the ${provider} terms and pass --accept-terms. Nothing fetched or written.`);
  const sb = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const client = provider === "quranenc" ? quranEncClient(ref, fetch) : quranFoundationClient(ref, fetch);
  const r = await importTranslation(supabaseSink(sb), client, {
    provider,
    ref,
    version: f.get("version") ?? "",
    surahs: parseSurahList(f.get("surahs") ?? "1-114"),
    acceptTerms: true,
    retrievedAt: new Date(),
  });
  console.log(`${r.edition}: ${r.inserted} ayat inserted, ${r.unchanged} unchanged; payload sha256 ${r.checksum}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof ImportRefused ? `Refused (${e.code}): ${e.message}` : e);
  process.exit(e instanceof ImportRefused ? 2 : 1);
});
