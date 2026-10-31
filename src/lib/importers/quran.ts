/**
 * Quran text adapter: the King Fahd Glorious Qur'an Printing Complex (Madinah Mushaf, Hafs 'an 'Asim) and Tanzil
 * Uthmani. Text is never edited, normalised, trimmed inside or re-encoded: the bytes the provider published are what
 * is checksummed, and each ayah string is stored exactly as parsed. Verses already in the database are immutable:
 * an import that would change one is refused as a whole, and nothing is written.
 */
import { ImportRefused, recordSourceVersion, sha256, type SourceRecord, type SourceSink } from "./common";

export type QuranFormat = "kfgqpc-hafs" | "tanzil-uthmani";

export interface ParsedVerse {
  surah: number;
  ayah: number;
  text: string;
}

export interface SurahMeta {
  number: number;
  nameAr: string;
  nameTransliterated: string;
  nameEn: string | null;
  ayahCount: number;
}

/**
 * Registry records for the two supported sources. Licence wording summarises the provider's published conditions and
 * must be re-read before an import (the --accept-terms flag records that the owner did). rights_status starts as
 * 'unknown' in the registry; clearing it is an admin decision in /admin/sources.
 */
export const QURAN_SOURCES: Record<QuranFormat, Omit<SourceRecord, "edition"> & { termsUrl: string }> = {
  "kfgqpc-hafs": {
    type: "quran_text",
    work: "Madinah Mushaf (Hafs 'an 'Asim)",
    author: null,
    publisher: "King Fahd Glorious Qur'an Printing Complex",
    source_url: "https://qurancomplex.gov.sa/",
    language: "ar",
    license_text: "King Fahd Glorious Qur'an Printing Complex digital Mushaf: used under the Complex's published terms of use, verbatim and with attribution.",
    license_url: null,
    attribution: "King Fahd Glorious Qur'an Printing Complex, Madinah",
    termsUrl: "https://qurancomplex.gov.sa/",
  },
  "tanzil-uthmani": {
    type: "quran_text",
    work: "Tanzil Quran Text (Uthmani)",
    author: null,
    publisher: "Tanzil Project",
    source_url: "https://tanzil.net/",
    language: "ar",
    license_text:
      "Tanzil Quran Text (Uthmani), Copyright (C) 2007-2026 Tanzil Project. License: Creative Commons Attribution 3.0; verbatim copies only (the text may not be changed); the source (Tanzil Project) is credited and linked to tanzil.net; the copyright notice is reproduced in derived files.",
    license_url: "https://tanzil.net/docs/Text_License",
    attribution: "Tanzil Project, tanzil.net",
    termsUrl: "https://tanzil.net/download/",
  },
};

export const QURAN_AYAH_TOTAL = 6236;

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeXml = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => XML_ENTITIES[e]!).replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)));

/** Tanzil: the "text" download (surah|ayah|text per line, # comments) or the XML download (<sura><aya index text/>). */
export function parseTanzil(raw: string): { verses: ParsedVerse[]; version: string | null } {
  const version = /#\s*Version:\s*([\w.-]+)/.exec(raw)?.[1] ?? /<!--[^>]*?Version:\s*([\w.-]+)/.exec(raw)?.[1] ?? null;
  const verses: ParsedVerse[] = [];
  if (/<quran[\s>]/.test(raw) && /<sura\b/.test(raw)) {
    for (const sura of raw.matchAll(/<sura\b([^>]*)>([\s\S]*?)<\/sura>/g)) {
      const s = Number(/\bindex="(\d+)"/.exec(sura[1]!)?.[1]);
      for (const aya of sura[2]!.matchAll(/<aya\b([^>]*?)\/?>/g)) {
        const a = Number(/\bindex="(\d+)"/.exec(aya[1]!)?.[1]);
        const t = /\btext="([^"]*)"/.exec(aya[1]!)?.[1];
        if (!s || !a || t === undefined) throw new ImportRefused("bad_format", `unreadable <aya> in sura ${s}`);
        verses.push({ surah: s, ayah: a, text: decodeXml(t) });
      }
    }
  } else {
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const [s, a, ...rest] = line.split("|");
      if (!s || !a || !rest.length || !/^\d+$/.test(s) || !/^\d+$/.test(a)) throw new ImportRefused("bad_format", `unreadable line: ${line.slice(0, 40)}`);
      verses.push({ surah: Number(s), ayah: Number(a), text: rest.join("|") });
    }
  }
  return { verses, version };
}

/** Tanzil's quran-data.js: QuranData.Sura = [[start, ayas, order, rukus, name, tname, ename, type], ...]. */
export function parseTanzilMetadata(js: string): SurahMeta[] {
  const block = /QuranData\.Sura\s*=\s*\[([\s\S]*?)\];/.exec(js)?.[1];
  if (!block) throw new ImportRefused("bad_format", "could not read surah metadata");
  const rows = [...block.matchAll(/\[\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*'([^']*)',\s*"([^"]*)",\s*'([^']*)',\s*'(Meccan|Medinan)'\s*\]/g)];
  return rows.map((m, i) => ({ number: i + 1, ayahCount: Number(m[2]), nameAr: m[5]!, nameTransliterated: m[6]!, nameEn: m[7]! || null }));
}

/** A position in the text: [surah, ayah]. */
export type AyahPos = [number, number];

/**
 * Reading divisions from the same Tanzil metadata file (quran-data.js), saved as content/quran/structure.json:
 * the first ayah of each juz (30), hizb quarter (240, four per hizb, 60 hizb) and Madinah mushaf page (604).
 * Numbers only, never text.
 */
export interface QuranStructure {
  source: string;
  license: string;
  url: string;
  sha256: string;
  juz: AyahPos[];
  hizbQuarters: AyahPos[];
  pages: AyahPos[];
}

export const STRUCTURE_COUNTS = { juz: 30, hizbQuarters: 240, pages: 604 } as const;

function positions(js: string, name: string, expected: number, surahs: SurahMeta[] | null): AyahPos[] {
  const block = new RegExp(`QuranData\\.${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`).exec(js)?.[1];
  if (!block) throw new ImportRefused("bad_format", `could not read QuranData.${name}`);
  const rows = [...block.matchAll(/\[\s*(\d+),\s*(\d+)\s*\]/g)].map((m) => [Number(m[1]), Number(m[2])] as AyahPos);
  // The list ends with a sentinel [115, 1] (one past the last surah); drop it.
  const last = rows.at(-1);
  if (last && last[0] === 115) rows.pop();
  if (rows.length !== expected) throw new ImportRefused("bad_count", `QuranData.${name}: expected ${expected} entries, found ${rows.length}`);
  for (let i = 0; i < rows.length; i++) {
    const [s, a] = rows[i]!;
    const max = surahs?.[s - 1]?.ayahCount ?? 286;
    if (s < 1 || s > 114 || a < 1 || a > max) throw new ImportRefused("bad_reference", `QuranData.${name}[${i + 1}] = ${s}:${a} is out of range`);
    const prev = rows[i - 1];
    if (prev && (s < prev[0] || (s === prev[0] && a <= prev[1]))) throw new ImportRefused("bad_format", `QuranData.${name} is not in reading order at ${s}:${a}`);
  }
  if (rows[0]![0] !== 1 || rows[0]![1] !== 1) throw new ImportRefused("bad_format", `QuranData.${name} must start at 1:1`);
  return rows;
}

/** The licence line of quran-data.js's header ("// License: ..."), or null when the file has none. */
export function tanzilMetadataLicense(js: string): string | null {
  return /^\s*\/\/\s*License:\s*(.+?)\s*$/m.exec(js)?.[1] ?? null;
}

/**
 * Juz, hizb-quarter and page boundaries from Tanzil's quran-data.js. Refused unless the file's own header states the
 * Creative Commons Attribution licence the text is used under (the same project and terms).
 */
export function parseTanzilStructure(js: string, surahs: SurahMeta[] | null = null): QuranStructure {
  const license = tanzilMetadataLicense(js);
  if (!license || !/Creative Commons Attribution 3\.0/i.test(license)) throw new ImportRefused("licence", `quran-data.js does not state CC BY 3.0 (found ${license ?? "no licence line"}); not imported`);
  const header = js
    .split(/\r?\n/)
    .filter((l) => l.startsWith("//"))
    .slice(0, 3)
    .map((l) => l.replace(/^\/\/\s?/, "").trim())
    .filter(Boolean);
  return {
    source: header.filter((l) => !l.startsWith("License")).join("; "),
    license,
    url: "https://tanzil.net/res/text/metadata/quran-data.js",
    sha256: sha256(Buffer.from(js, "utf8")),
    juz: positions(js, "Juz", STRUCTURE_COUNTS.juz, surahs),
    hizbQuarters: positions(js, "HizbQaurter", STRUCTURE_COUNTS.hizbQuarters, surahs),
    pages: positions(js, "Page", STRUCTURE_COUNTS.pages, surahs),
  };
}

/**
 * King Fahd Complex "Hafs" data file (JSON array, one object per ayah), as distributed in the Complex's developer
 * resources: { sura_no, aya_no, aya_text, sura_name_ar, sura_name_en, ... }. aya_text is kept exactly as given,
 * including its end-of-ayah marker; nothing is stripped.
 */
export function parseKfgqpcHafs(raw: string): { verses: ParsedVerse[]; surahs: SurahMeta[] } {
  let rows: unknown;
  try {
    rows = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  } catch {
    throw new ImportRefused("bad_format", "the King Fahd Complex file is not valid JSON");
  }
  if (!Array.isArray(rows)) throw new ImportRefused("bad_format", "expected a JSON array of ayat");
  const verses: ParsedVerse[] = [];
  const surahs = new Map<number, SurahMeta>();
  for (const r of rows as Array<Record<string, unknown>>) {
    const s = Number(r.sura_no);
    const a = Number(r.aya_no);
    const t = r.aya_text;
    if (!Number.isInteger(s) || !Number.isInteger(a) || typeof t !== "string" || !t) throw new ImportRefused("bad_format", `unreadable row ${JSON.stringify(r).slice(0, 60)}`);
    verses.push({ surah: s, ayah: a, text: t });
    const m = surahs.get(s) ?? { number: s, nameAr: String(r.sura_name_ar ?? ""), nameTransliterated: String(r.sura_name_en ?? ""), nameEn: null, ayahCount: 0 };
    m.ayahCount = Math.max(m.ayahCount, a);
    surahs.set(s, m);
  }
  return { verses, surahs: [...surahs.values()].sort((x, y) => x.number - y.number) };
}

/** Structural checks only (the text itself is never inspected or changed). */
export function validateVerses(verses: ParsedVerse[], surahs: SurahMeta[] | null, expectedTotal = QURAN_AYAH_TOTAL) {
  if (verses.length !== expectedTotal) throw new ImportRefused("bad_count", `expected ${expectedTotal} ayat, found ${verses.length}; refusing to import`);
  const seen = new Set<string>();
  for (const v of verses) {
    if (v.surah < 1 || v.surah > 114 || v.ayah < 1 || v.ayah > 286) throw new ImportRefused("bad_reference", `out-of-range reference ${v.surah}:${v.ayah}`);
    const k = `${v.surah}:${v.ayah}`;
    if (seen.has(k)) throw new ImportRefused("duplicate", `duplicate ayah ${k}`);
    if (!v.text.length) throw new ImportRefused("empty", `empty text at ${k}`);
    seen.add(k);
  }
  if (surahs) {
    const total = surahs.reduce((n, s) => n + s.ayahCount, 0);
    if (total !== verses.length) throw new ImportRefused("bad_metadata", `metadata ayah total ${total} does not match the text (${verses.length})`);
    for (const s of surahs) for (let a = 1; a <= s.ayahCount; a++) if (!seen.has(`${s.number}:${a}`)) throw new ImportRefused("gap", `missing ayah ${s.number}:${a}`);
  }
}

/** Compare against what is stored. Any changed verse is a conflict; identical verses are skipped. */
export function diffVerses(existing: Map<string, string>, incoming: ParsedVerse[]) {
  const added: ParsedVerse[] = [];
  const conflicts: string[] = [];
  let unchanged = 0;
  for (const v of incoming) {
    const old = existing.get(`${v.surah}:${v.ayah}`);
    if (old === undefined) added.push(v);
    else if (old === v.text) unchanged++;
    else conflicts.push(`${v.surah}:${v.ayah}`);
  }
  return { added, unchanged, conflicts };
}

export interface QuranSink extends SourceSink {
  existingVerses(): Promise<Map<string, string>>;
  existingSurahs(): Promise<Set<number>>;
  insertSurahs(rows: Array<{ id: number; name_ar: string; name_transliterated: string; name_en: string | null; ayah_count: number; source_version_id: string }>): Promise<void>;
  insertVerses(rows: Array<{ surah_id: number; ayah_no: number; text_ar: string; source_version_id: string }>): Promise<void>;
}

export interface QuranImportInput {
  format: QuranFormat;
  raw: Buffer;
  /** Tanzil metadata (quran-data.js) when the format carries no surah names. */
  metadata?: SurahMeta[];
  version?: string;
  retrievedFrom: string;
  retrievedAt: Date;
  acceptTerms: boolean;
  expectedTotal?: number;
}

export interface QuranImportResult {
  format: QuranFormat;
  version: string;
  checksum: string;
  sourceId: string;
  versionId: string;
  inserted: number;
  unchanged: number;
  verses: ParsedVerse[];
  surahs: SurahMeta[];
}

export function parseQuran(input: Pick<QuranImportInput, "format" | "raw" | "metadata" | "version">) {
  const text = input.raw.toString("utf8");
  if (input.format === "tanzil-uthmani") {
    const p = parseTanzil(text);
    return { verses: p.verses, surahs: input.metadata ?? null, version: input.version ?? p.version };
  }
  const p = parseKfgqpcHafs(text);
  return { verses: p.verses, surahs: p.surahs, version: input.version ?? null };
}

export async function importQuran(sink: QuranSink, input: QuranImportInput): Promise<QuranImportResult> {
  if (!input.acceptTerms)
    throw new ImportRefused("terms_not_accepted", `Read ${QURAN_SOURCES[input.format].termsUrl} and pass --accept-terms to confirm the owner accepts them. Nothing written.`);
  const checksum = sha256(input.raw);
  const { verses, surahs, version } = parseQuran(input);
  if (!version) throw new ImportRefused("no_version", "pass --version: the source's version label is required to pin the import");
  validateVerses(verses, surahs, input.expectedTotal);
  if (!surahs) throw new ImportRefused("no_metadata", "surah metadata is required (Tanzil: quran-data.js)");

  // Immutability first: refuse before anything is recorded.
  const diff = diffVerses(await sink.existingVerses(), verses);
  if (diff.conflicts.length)
    throw new ImportRefused("immutable", `${diff.conflicts.length} stored verse(s) differ from this file (first: ${diff.conflicts.slice(0, 5).join(", ")}). Stored verses are never modified. Nothing written.`);

  const def = QURAN_SOURCES[input.format];
  const rec: Omit<SourceRecord, "edition"> = { type: def.type, work: def.work, author: def.author, publisher: def.publisher, source_url: def.source_url, language: def.language, license_text: def.license_text, license_url: def.license_url, attribution: def.attribution };
  const rv = await recordSourceVersion(sink, { ...rec, edition: input.format === "kfgqpc-hafs" ? "Hafs 'an 'Asim" : "Uthmani" }, { version, checksum, retrievedAt: input.retrievedAt, retrievedFrom: input.retrievedFrom });

  const have = await sink.existingSurahs();
  const newSurahs = surahs.filter((s) => !have.has(s.number));
  if (newSurahs.length)
    await sink.insertSurahs(newSurahs.map((s) => ({ id: s.number, name_ar: s.nameAr, name_transliterated: s.nameTransliterated, name_en: s.nameEn, ayah_count: s.ayahCount, source_version_id: rv.versionId })));
  if (diff.added.length) await sink.insertVerses(diff.added.map((v) => ({ surah_id: v.surah, ayah_no: v.ayah, text_ar: v.text, source_version_id: rv.versionId })));
  return { format: input.format, version, checksum, sourceId: rv.sourceId, versionId: rv.versionId, inserted: diff.added.length, unchanged: diff.unchanged, verses, surahs };
}

/** The app's local text file (content/quran): "surah|ayah|text" lines, the format src/content/quran.ts reads. */
export function toPipeText(verses: ParsedVerse[], header: string[]): string {
  return [...header.map((h) => `# ${h}`), ...verses.map((v) => `${v.surah}|${v.ayah}|${v.text}`)].join("\n") + "\n";
}
