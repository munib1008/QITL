/**
 * Quran translation adapters: QuranEnc (quranenc.com) and the Quran Foundation Content API. Each imports ONE edition
 * that is registered, verified and licence-cleared (./editions.ts), records the fetched payloads' checksum as a
 * source version, and stores each ayah's translation text unmodified. Arabic returned by a translation API is never
 * used: the Arabic comes only from the pinned Quran text import. Stored rows are immutable here too.
 */
import { ImportRefused, recordVersion, requireEnv, sha256, type SourceSink } from "./common";
import { assertEditionImportable, type EditionGateRow } from "./editions";

export type TranslationProvider = "quranenc" | "quran_foundation";
export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface TranslationRow {
  surah: number;
  ayah: number;
  text: string;
}

/** QuranEnc /api/v1/translation/sura/{key}/{sura}: { result: [{ sura, aya, translation, footnotes, arabic_text }] }. */
export function parseQuranEncSura(raw: string, expectSurah: number): TranslationRow[] {
  const j = JSON.parse(raw) as { result?: Array<{ sura: string | number; aya: string | number; translation: unknown }> };
  if (!Array.isArray(j.result)) throw new ImportRefused("bad_format", "QuranEnc response has no result array");
  return j.result.map((r) => {
    const s = Number(r.sura);
    const a = Number(r.aya);
    if (s !== expectSurah || !Number.isInteger(a) || a < 1 || typeof r.translation !== "string") throw new ImportRefused("bad_format", `unexpected QuranEnc row ${s}:${a}`);
    return { surah: s, ayah: a, text: r.translation };
  });
}

/** Quran Foundation /content/api/v4/quran/translations/{id}?chapter_number=N&fields=verse_key: { translations: [{ verse_key, text }] }. */
export function parseQuranFoundationChapter(raw: string, expectSurah: number): TranslationRow[] {
  const j = JSON.parse(raw) as { translations?: Array<{ verse_key?: string; text?: unknown }> };
  if (!Array.isArray(j.translations)) throw new ImportRefused("bad_format", "Quran Foundation response has no translations array");
  return j.translations.map((r) => {
    const m = /^(\d+):(\d+)$/.exec(r.verse_key ?? "");
    if (!m || Number(m[1]) !== expectSurah || typeof r.text !== "string") throw new ImportRefused("bad_format", `unexpected Quran Foundation row ${r.verse_key}`);
    return { surah: Number(m[1]), ayah: Number(m[2]), text: r.text };
  });
}

export interface ProviderClient {
  provider: TranslationProvider;
  /** The URL each surah's payload comes from (recorded as retrieved_from). */
  url(surah: number): string;
  fetchSurah(surah: number): Promise<string>;
}

/** QuranEnc client. QURANENC_API_KEY: the access key issued under the owner's agreement with QuranEnc. */
export function quranEncClient(ref: string, fetchFn: FetchLike, env: Record<string, string | undefined> = process.env): ProviderClient {
  const key = requireEnv("QURANENC_API_KEY", env);
  if (!/^[a-z0-9_]+$/.test(ref)) throw new ImportRefused("bad_ref", `bad QuranEnc translation key ${ref}`);
  const url = (s: number) => `https://quranenc.com/api/v1/translation/sura/${ref}/${s}`;
  return {
    provider: "quranenc",
    url,
    async fetchSurah(s) {
      const r = await fetchFn(url(s), { headers: { Authorization: `Bearer ${key}`, "User-Agent": "QITL source importer" } });
      if (!r.ok) throw new ImportRefused("http", `QuranEnc surah ${s}: HTTP ${r.status}`);
      return r.text();
    },
  };
}

/** Quran Foundation client: OAuth2 client credentials (QF_CLIENT_ID, QF_CLIENT_SECRET), then the Content API. */
export function quranFoundationClient(ref: string, fetchFn: FetchLike, env: Record<string, string | undefined> = process.env): ProviderClient {
  const id = requireEnv("QF_CLIENT_ID", env);
  const secret = requireEnv("QF_CLIENT_SECRET", env);
  if (!/^\d+$/.test(ref)) throw new ImportRefused("bad_ref", `bad Quran Foundation translation id ${ref}`);
  const authUrl = env.QF_AUTH_URL ?? "https://oauth2.quran.foundation/oauth2/token";
  const apiBase = env.QF_API_BASE ?? "https://apis.quran.foundation/content/api/v4";
  const url = (s: number) => `${apiBase}/quran/translations/${ref}?chapter_number=${s}&fields=verse_key`;
  let token: string | null = null;
  return {
    provider: "quran_foundation",
    url,
    async fetchSurah(s) {
      if (!token) {
        const r = await fetchFn(authUrl, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` },
          body: "grant_type=client_credentials&scope=content",
        });
        if (!r.ok) throw new ImportRefused("auth", `Quran Foundation token: HTTP ${r.status}`);
        token = (JSON.parse(await r.text()) as { access_token?: string }).access_token ?? null;
        if (!token) throw new ImportRefused("auth", "Quran Foundation token response had no access_token");
      }
      const r = await fetchFn(url(s), { headers: { "x-auth-token": token, "x-client-id": id } });
      if (!r.ok) throw new ImportRefused("http", `Quran Foundation surah ${s}: HTTP ${r.status}`);
      return r.text();
    },
  };
}

export interface TranslationSink extends SourceSink {
  findEdition(origin: string, originRef: string): Promise<EditionGateRow | null>;
  existingVerseKeys(): Promise<Set<string>>;
  existingTranslations(sourceId: string): Promise<Map<string, string>>;
  insertTranslations(rows: Array<{ surah_id: number; ayah_no: number; source_id: string; source_version_id: string; translator: string; edition: string; language: string; text: string; edition_id: string }>): Promise<void>;
}

export interface TranslationImportInput {
  provider: TranslationProvider;
  ref: string;
  version: string;
  surahs: number[];
  acceptTerms: boolean;
  retrievedAt: Date;
}

export async function importTranslation(sink: TranslationSink, client: ProviderClient, input: TranslationImportInput) {
  if (!input.acceptTerms) throw new ImportRefused("terms_not_accepted", `Read the ${input.provider} terms and pass --accept-terms. Nothing fetched or written.`);
  if (!input.version) throw new ImportRefused("no_version", "pass --version (the provider's edition version) to pin the import");
  // The gate runs before any network request.
  const edition = assertEditionImportable(await sink.findEdition(input.provider, input.ref), { origin: input.provider, kind: "quran_translation", originRef: input.ref });

  const payloads: string[] = [];
  const rows: TranslationRow[] = [];
  for (const s of input.surahs) {
    if (!Number.isInteger(s) || s < 1 || s > 114) throw new ImportRefused("bad_reference", `bad surah ${s}`);
    const raw = await client.fetchSurah(s);
    payloads.push(raw);
    rows.push(...(input.provider === "quranenc" ? parseQuranEncSura(raw, s) : parseQuranFoundationChapter(raw, s)));
  }
  const verses = await sink.existingVerseKeys();
  const missing = rows.filter((r) => !verses.has(`${r.surah}:${r.ayah}`));
  if (missing.length) throw new ImportRefused("verses_missing", `${missing.length} ayat are not in quran_verses (first ${missing[0]!.surah}:${missing[0]!.ayah}). Import the Quran text first. Nothing written.`);
  const existing = await sink.existingTranslations(edition.source.id);
  const conflicts = rows.filter((r) => existing.has(`${r.surah}:${r.ayah}`) && existing.get(`${r.surah}:${r.ayah}`) !== r.text);
  if (conflicts.length) throw new ImportRefused("immutable", `${conflicts.length} stored translation(s) differ (first ${conflicts[0]!.surah}:${conflicts[0]!.ayah}). Stored text is never modified; register a new edition for a new version. Nothing written.`);

  const checksum = sha256(payloads.join("\n"));
  const rv = await recordVersion(sink, edition.source.id, edition.source.work, { version: input.version, checksum, retrievedAt: input.retrievedAt, retrievedFrom: client.url(input.surahs[0] ?? 1) });
  const fresh = rows.filter((r) => !existing.has(`${r.surah}:${r.ayah}`));
  if (fresh.length)
    await sink.insertTranslations(
      fresh.map((r) => ({ surah_id: r.surah, ayah_no: r.ayah, source_id: edition.source.id, source_version_id: rv.versionId, translator: edition.translator, edition: edition.title, language: edition.language, text: r.text, edition_id: edition.id })),
    );
  return { edition: edition.title, checksum, versionId: rv.versionId, inserted: fresh.length, unchanged: rows.length - fresh.length };
}
