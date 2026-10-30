/**
 * Shared pieces of the source import adapters (Quran text, translations, hadith). Pure or sink-driven: no adapter
 * talks to the database or the network directly, so every rule is testable with fixtures (tests/unit/importers.test.ts).
 * The scripts in scripts/ wire them to Supabase (service role) and fetch.
 *
 * Nothing here ships or bundles any religious text. Importing is an owner decision: each adapter refuses to run
 * without an explicit acceptance of the provider's terms and, for translations and hadith, a verified edition whose
 * source licence is cleared.
 */
import { createHash } from "node:crypto";

export const sha256 = (buf: Buffer | string) => createHash("sha256").update(buf).digest("hex");

export class ImportRefused extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ImportRefused";
  }
}

export type SourceType = "quran_text" | "quran_translation" | "tafsir" | "hadith_collection" | "hadith_translation" | "hadith_grading";
export type RightsStatus = "unknown" | "requested" | "cleared" | "denied" | "public_domain";

export interface SourceRecord {
  type: SourceType;
  work: string;
  edition: string | null;
  author: string | null;
  publisher: string | null;
  source_url: string;
  language: string;
  license_text: string;
  license_url: string | null;
  attribution: string;
}

export interface SourceVersionRecord {
  source_id: string;
  version: string;
  checksum_sha256: string;
  retrieved_at: string;
  retrieved_from: string;
  is_current: boolean;
}

/** The registry half of every sink: sources and their pinned versions. */
export interface SourceSink {
  findSource(type: SourceType, work: string, edition: string | null): Promise<{ id: string; rights_status: RightsStatus } | null>;
  createSource(rec: SourceRecord): Promise<{ id: string }>;
  findVersion(sourceId: string, version: string): Promise<{ id: string; checksum_sha256: string } | null>;
  hasCurrentVersion(sourceId: string): Promise<boolean>;
  createVersion(rec: SourceVersionRecord): Promise<{ id: string }>;
}

export const CLEARED: ReadonlySet<RightsStatus> = new Set(["cleared", "public_domain"]);

export function requireHttps(url: string): string {
  if (!/^https:\/\//.test(url)) throw new ImportRefused("bad_url", `retrieved_from must be an https URL, got ${url}`);
  return url;
}

type VersionInput = { version: string; checksum: string; retrievedAt: Date; retrievedFrom: string };

/**
 * Records one pinned version of an existing source. A version label that already exists with a different checksum is
 * refused: the same label can never point at different bytes. The first version of a source becomes current.
 */
export async function recordVersion(sink: SourceSink, sourceId: string, label: string, v: VersionInput): Promise<{ versionId: string; reused: boolean }> {
  requireHttps(v.retrievedFrom);
  if (!/^[0-9a-f]{64}$/.test(v.checksum)) throw new ImportRefused("bad_checksum", "checksum must be a sha256 hex digest");
  const existing = await sink.findVersion(sourceId, v.version);
  if (existing) {
    if (existing.checksum_sha256 !== v.checksum)
      throw new ImportRefused("version_checksum_mismatch", `version ${v.version} of "${label}" is already recorded with checksum ${existing.checksum_sha256}; got ${v.checksum}. Nothing written.`);
    return { versionId: existing.id, reused: true };
  }
  const isCurrent = !(await sink.hasCurrentVersion(sourceId));
  const created = await sink.createVersion({ source_id: sourceId, version: v.version, checksum_sha256: v.checksum, retrieved_at: v.retrievedAt.toISOString(), retrieved_from: v.retrievedFrom, is_current: isCurrent });
  return { versionId: created.id, reused: false };
}

/** Records the source (once, with its licence text) and this pinned version. */
export async function recordSourceVersion(sink: SourceSink, source: SourceRecord, v: VersionInput): Promise<{ sourceId: string; versionId: string; rightsStatus: RightsStatus; reused: boolean }> {
  requireHttps(v.retrievedFrom);
  const found = await sink.findSource(source.type, source.work, source.edition);
  const sourceId = found?.id ?? (await sink.createSource(source)).id;
  const r = await recordVersion(sink, sourceId, source.work, v);
  return { sourceId, versionId: r.versionId, rightsStatus: found?.rights_status ?? "unknown", reused: r.reused };
}

/** Minimal flag parser for the import scripts: --name value and --flag. */
export function parseFlags(argv: string[]): { get(name: string): string | undefined; has(name: string): boolean } {
  return {
    get: (name) => {
      const i = argv.indexOf(`--${name}`);
      const v = i >= 0 ? argv[i + 1] : undefined;
      return v && !v.startsWith("--") ? v : undefined;
    },
    has: (name) => argv.includes(`--${name}`),
  };
}

export function requireEnv(name: string, env: Record<string, string | undefined> = process.env): string {
  const v = env[name];
  if (!v) throw new ImportRefused("missing_env", `${name} is not set. Put it in the environment (never in a file that is committed).`);
  return v;
}

/** "1-114", "1,12,18-20" → sorted unique surah numbers, each 1..114. */
export function parseSurahList(spec: string): number[] {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!m) throw new ImportRefused("usage", `bad --surahs part "${part}"`);
    const a = Number(m[1]);
    const b = Number(m[2] ?? m[1]);
    if (a < 1 || b > 114 || b < a) throw new ImportRefused("usage", `bad --surahs range "${part}"`);
    for (let s = a; s <= b; s++) out.add(s);
  }
  return [...out].sort((x, y) => x - y);
}
