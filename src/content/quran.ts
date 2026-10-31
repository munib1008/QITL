import "server-only";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/**
 * Quran Arabic comes ONLY from a verified canonical source, pinned by version and checksum
 * (content/quran/source.json + the text file it names, written by scripts/import-quran.ts).
 * Nothing here retypes, transliterates or "fixes" the text. If the import has not been run, or the checksum
 * does not match, every lookup returns null and the UI shows the designed "not loaded" state.
 */

const Manifest = z.object({
  source: z.string(), // e.g. "Tanzil Quran Text (Uthmani, v1.1)"
  url: z.string().url(),
  version: z.string(),
  license: z.string(),
  file: z.string().regex(/^[\w.-]+$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  importedAt: z.string(),
});
export type QuranManifest = z.infer<typeof Manifest>;

interface Loaded {
  manifest: QuranManifest;
  verses: Map<string, string>; // "s:a" → Arabic
}

const dir = join(process.cwd(), "content", "quran");
let cache: Loaded | null | undefined;

function load(): Loaded | null {
  if (cache !== undefined) return cache;
  cache = null;
  const mpath = join(dir, "source.json");
  if (!existsSync(mpath)) return cache;
  const manifest = Manifest.parse(JSON.parse(readFileSync(mpath, "utf8")));
  const buf = readFileSync(join(dir, manifest.file));
  const sum = createHash("sha256").update(buf).digest("hex");
  if (sum !== manifest.sha256) {
    console.error(`[quran] checksum mismatch for ${manifest.file}: refusing to serve unverified text`);
    return cache;
  }
  // Tanzil "text" format: one ayah per line, "surah|ayah|text"; comment lines start with #.
  const verses = new Map<string, string>();
  for (const line of buf.toString("utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [s, a, ...rest] = line.split("|");
    if (s && a && rest.length) verses.set(`${Number(s)}:${Number(a)}`, rest.join("|"));
  }
  cache = { manifest, verses };
  return cache;
}

export function quranSource(): QuranManifest | null {
  return load()?.manifest ?? null;
}

export function ayahArabic(surah: number, ayah: number): string | null {
  return load()?.verses.get(`${surah}:${ayah}`) ?? null;
}

/** The Basmala as it opens Al-Fatihah (1:1) in the verified text. */
export function basmala(): string | null {
  return ayahArabic(1, 1);
}

export function surahArabic(surah: number): Array<{ ayah: number; text: string }> | null {
  const l = load();
  if (!l) return null;
  const out: Array<{ ayah: number; text: string }> = [];
  for (let a = 1; ; a++) {
    const t = l.verses.get(`${surah}:${a}`);
    if (!t) break;
    out.push({ ayah: a, text: t });
  }
  return out.length ? out : null;
}

export interface SurahMeta {
  number: number;
  name: string; // transliterated, as given by the source's metadata
  arabic: string;
  english?: string;
  ayahs: number;
  revelation?: "Meccan" | "Medinan";
}

const SurahMetaSchema = z.array(
  z.object({
    number: z.number().int().min(1).max(114),
    name: z.string(),
    arabic: z.string(),
    english: z.string().optional(),
    ayahs: z.number().int().min(3).max(286),
    revelation: z.enum(["Meccan", "Medinan"]).optional(),
  }),
);

let metaCache: SurahMeta[] | null | undefined;
/** Surah metadata from the same pinned source import (content/quran/surahs.json). Null until imported. */
export function surahList(): SurahMeta[] | null {
  if (metaCache !== undefined) return metaCache;
  metaCache = null;
  if (!load()) return metaCache;
  const p = join(dir, "surahs.json");
  if (!existsSync(p)) return metaCache;
  const list = SurahMetaSchema.parse(JSON.parse(readFileSync(p, "utf8")));
  metaCache = list.length === 114 ? list : null;
  return metaCache;
}

const Pos = z.tuple([z.number().int().min(1).max(114), z.number().int().min(1).max(286)]);
const StructureSchema = z.object({
  source: z.string(),
  license: z.string().regex(/Creative Commons Attribution 3\.0/),
  url: z.string().url(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  juz: z.array(Pos).length(30),
  hizbQuarters: z.array(Pos).length(240),
  pages: z.array(Pos).length(604),
});
export type QuranStructure = z.infer<typeof StructureSchema>;

let structureCache: QuranStructure | null | undefined;
/**
 * Juz, hizb-quarter and mushaf-page boundaries (content/quran/structure.json, from Tanzil's quran-data.js under CC BY
 * 3.0, written by scripts/import-quran.ts). Null when absent or malformed: the reader then shows no markers.
 */
export function quranStructure(): QuranStructure | null {
  if (structureCache !== undefined) return structureCache;
  structureCache = null;
  const p = join(dir, "structure.json");
  if (!existsSync(p) || !load()) return structureCache;
  const r = StructureSchema.safeParse(JSON.parse(readFileSync(p, "utf8")));
  structureCache = r.success ? r.data : null;
  if (!r.success) console.error("[quran] structure.json is malformed; reading divisions hidden");
  return structureCache;
}
