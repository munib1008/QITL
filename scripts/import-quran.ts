/**
 * Imports the verified Quran text, pinned by version and checksum, from ONE of two sources the owner chooses:
 *
 *   King Fahd Glorious Qur'an Printing Complex (Madinah Mushaf, Hafs), from its developer data file (JSON):
 *     pnpm tsx scripts/import-quran.ts --format kfgqpc-hafs --file <hafs.json> --version <label> \
 *       --retrieved-from <https URL it was downloaded from> --accept-terms (--pin | --expect-sha256 <hex>) [--db]
 *
 *   Tanzil Uthmani ("text" download, surah|ayah|text, or the XML download):
 *     pnpm tsx scripts/import-quran.ts --format tanzil-uthmani [--file <quran-uthmani.txt|.xml> --retrieved-from <url>] \
 *       --accept-terms (--pin | --expect-sha256 <hex>) [--version <label>] [--db]
 *
 * --accept-terms is required: it records that the owner read and accepts the provider's terms (Tanzil: CC BY 3.0,
 * verbatim only, https://tanzil.net/download/; King Fahd Complex: its published terms of use). Without it nothing is
 * fetched or written.
 *
 * Writes content/quran/quran.txt (surah|ayah|text, each ayah string exactly as the provider published it),
 * content/quran/surahs.json and content/quran/source.json (source, version, licence, checksums, retrieved date). With
 * --db it also records the source, the pinned source version (version, sha256, retrieved date and URL) and the verses
 * into Supabase (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 *
 * Immutability: verses already stored are never modified. If any stored verse (in the database, or the existing local
 * import) differs from the new file, the whole import is refused and nothing is written.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { ImportRefused, parseFlags, requireEnv, requireHttps, sha256 } from "../src/lib/importers/common";
import { QURAN_SOURCES, diffVerses, importQuran, parseQuran, parseTanzilMetadata, toPipeText, validateVerses, type QuranFormat, type SurahMeta } from "../src/lib/importers/quran";
import { supabaseSink } from "../src/lib/importers/supabase-sink";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "content", "quran");
const TANZIL_TEXT_URL = "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true";
const TANZIL_META_URL = "https://tanzil.net/res/text/metadata/quran-data.js";

async function get(url: string): Promise<Buffer> {
  const r = await fetch(url, { headers: { "User-Agent": "QITL source importer (one-off, verbatim)" } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function main() {
  const f = parseFlags(process.argv.slice(2));
  const format = f.get("format") as QuranFormat | undefined;
  if (format !== "kfgqpc-hafs" && format !== "tanzil-uthmani") throw new ImportRefused("usage", "Pass --format kfgqpc-hafs or --format tanzil-uthmani (see the header of this script).");
  if (!f.has("accept-terms")) throw new ImportRefused("terms_not_accepted", `Read ${QURAN_SOURCES[format].termsUrl}, then pass --accept-terms. Nothing fetched or written.`);
  const expect = f.get("expect-sha256");
  if (!f.has("pin") && !(expect && /^[0-9a-f]{64}$/.test(expect))) throw new ImportRefused("usage", "Pass --expect-sha256 <hex> to verify a known version, or --pin for the first import.");

  const file = f.get("file");
  if (format === "kfgqpc-hafs" && !file) throw new ImportRefused("usage", "The King Fahd Complex data file must be downloaded by the owner after accepting its terms: pass --file <path>.");
  const raw = file ? readFileSync(resolve(file)) : await get(TANZIL_TEXT_URL);
  const retrievedFrom = requireHttps(file ? (f.get("retrieved-from") ?? "") : TANZIL_TEXT_URL);
  const checksum = sha256(raw);
  if (expect && checksum !== expect) throw new ImportRefused("checksum", `Checksum mismatch: got ${checksum}, expected ${expect}. Nothing written.`);

  const metadata: SurahMeta[] | undefined = format === "tanzil-uthmani" ? parseTanzilMetadata((await get(TANZIL_META_URL)).toString("utf8")) : undefined;
  const parsed = parseQuran({ format, raw, metadata, version: f.get("version") });
  if (!parsed.version) throw new ImportRefused("no_version", "Pass --version <label>: the source's version is required to pin the import.");
  validateVerses(parsed.verses, parsed.surahs);
  const surahs = parsed.surahs!;

  // Local immutability: an existing import may only be repeated byte-for-byte, never changed.
  if (existsSync(join(out, "source.json"))) {
    const prev = JSON.parse(readFileSync(join(out, "source.json"), "utf8")) as { file: string; sourceSha256?: string; sha256: string };
    const prevText = readFileSync(join(out, prev.file), "utf8");
    const prevVerses = new Map<string, string>();
    for (const line of prevText.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const [s, a, ...rest] = line.split("|");
      prevVerses.set(`${Number(s)}:${Number(a)}`, rest.join("|"));
    }
    const d = diffVerses(prevVerses, parsed.verses);
    if (d.conflicts.length) throw new ImportRefused("immutable", `${d.conflicts.length} verse(s) differ from the existing local import (first ${d.conflicts[0]}). Nothing written.`);
  }

  const retrievedAt = new Date();
  if (f.has("db")) {
    const sb = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
    const r = await importQuran(supabaseSink(sb), { format, raw, metadata, version: parsed.version, retrievedFrom, retrievedAt, acceptTerms: true });
    console.log(`Database: source ${r.sourceId}, version ${r.version} (${r.versionId}); ${r.inserted} ayat inserted, ${r.unchanged} unchanged.`);
  }

  const def = QURAN_SOURCES[format];
  const text = toPipeText(parsed.verses, [`${def.work}`, `Version: ${parsed.version}`, `Source sha256: ${checksum}`, `Retrieved from: ${retrievedFrom}`]);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "quran.txt"), text);
  writeFileSync(
    join(out, "surahs.json"),
    JSON.stringify(
      surahs.map((s) => ({ number: s.number, ayahs: s.ayahCount, arabic: s.nameAr, name: s.nameTransliterated, ...(s.nameEn ? { english: s.nameEn } : {}) })),
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    join(out, "source.json"),
    JSON.stringify(
      {
        source: def.work,
        publisher: def.publisher,
        format,
        url: def.source_url,
        version: parsed.version,
        license: def.license_text,
        termsAcceptedAt: retrievedAt.toISOString(),
        retrievedFrom,
        file: "quran.txt",
        sha256: sha256(text),
        sourceSha256: checksum,
        importedAt: retrievedAt.toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Imported ${parsed.verses.length} ayat from ${def.work}, version ${parsed.version}, source sha256 ${checksum}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof ImportRefused ? `Refused (${e.code}): ${e.message}` : e);
  process.exit(e instanceof ImportRefused ? 2 : 1);
});
