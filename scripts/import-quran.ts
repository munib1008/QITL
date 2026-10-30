/**
 * Imports the verified Quran text from Tanzil (https://tanzil.net), pinned by version and checksum.
 *
 *   pnpm tsx scripts/import-quran.ts --expect-sha256 <hex>     # verify against a known checksum
 *   pnpm tsx scripts/import-quran.ts --pin                      # first import: record the checksum seen now
 *
 * Writes content/quran/quran-uthmani.txt (verbatim, never edited), content/quran/surahs.json (metadata) and
 * content/quran/source.json (source, version, licence, sha256). The app refuses to serve text whose checksum
 * does not match source.json.
 *
 * Licence: the Tanzil Quran Text is distributed under Creative Commons Attribution 3.0 with the condition that
 * the text is copied verbatim, with attribution and a link to tanzil.net. Read the current terms at
 * https://tanzil.net/download/ before running this; the person running it accepts them.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "content", "quran");
const TEXT_URL = "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true";
const META_URL = "https://tanzil.net/res/text/metadata/quran-data.js";

const args = process.argv.slice(2);
const expect = args[args.indexOf("--expect-sha256") + 1];
const pin = args.includes("--pin");
if (!pin && !(args.includes("--expect-sha256") && /^[0-9a-f]{64}$/.test(expect ?? ""))) {
  console.error("Pass --expect-sha256 <hex> to verify a known version, or --pin for the first import.");
  process.exit(2);
}

async function get(url: string): Promise<Buffer> {
  const r = await fetch(url, { headers: { "User-Agent": "ZIQ source importer (one-off, verbatim)" } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const text = await get(TEXT_URL);
const sha = createHash("sha256").update(text).digest("hex");
if (!pin && sha !== expect) {
  console.error(`Checksum mismatch: got ${sha}, expected ${expect}. Nothing written.`);
  process.exit(1);
}

// Sanity checks only; the text itself is never modified.
const lines = text
  .toString("utf8")
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith("#"));
if (lines.length !== 6236) throw new Error(`expected 6236 ayat, found ${lines.length}; refusing to import`);
const version = /#\s*Version:\s*([\w.]+)/.exec(text.toString("utf8"))?.[1] ?? "unknown";

// Metadata: Tanzil's quran-data.js has QuranData.Sura = [[start, ayas, order, rukus, name, tname, ename, type], ...]
const metaJs = (await get(META_URL)).toString("utf8");
const block = /QuranData\.Sura\s*=\s*\[([\s\S]*?)\];/.exec(metaJs)?.[1];
if (!block) throw new Error("could not read surah metadata");
const rows = [...block.matchAll(/\[\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*'([^']*)',\s*"([^"]*)",\s*'([^']*)',\s*'(Meccan|Medinan)'\s*\]/g)];
if (rows.length !== 114) throw new Error(`expected 114 surahs in metadata, found ${rows.length}`);
const surahs = rows.map((m, i) => ({ number: i + 1, ayahs: Number(m[2]), arabic: m[5]!, name: m[6]!, english: m[7]!, revelation: m[8] as "Meccan" | "Medinan" }));
const total = surahs.reduce((a, s) => a + s.ayahs, 0);
if (total !== lines.length) throw new Error(`metadata ayah total ${total} does not match the text (${lines.length})`);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "quran-uthmani.txt"), text);
writeFileSync(join(out, "surahs.json"), JSON.stringify(surahs, null, 2) + "\n");
writeFileSync(
  join(out, "source.json"),
  JSON.stringify(
    {
      source: `Tanzil Quran Text (Uthmani)`,
      url: "https://tanzil.net/",
      version,
      license: "Tanzil Quran Text, Creative Commons Attribution 3.0; verbatim copying only. Source: tanzil.net",
      file: "quran-uthmani.txt",
      sha256: sha,
      importedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);
console.log(`Imported ${lines.length} ayat, version ${version}, sha256 ${sha}`);
