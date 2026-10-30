/**
 * sunnah.com hadith adapter (API v1, key in SUNNAH_API_KEY). Imports only the four catalogued collections, and only
 * for a registered, verified, licence-cleared sunnah.com edition (./editions.ts). Every narration lands as a DRAFT:
 * publishing needs the editorial review like everything else. Gradings are recorded exactly as the source gives them,
 * each with its named grader; a grade without a named grader is not recorded, and no grade is ever inferred from the
 * collection's name.
 */
import { COLLECTION_IDS, type CollectionId } from "@/lib/data/hadith";
import { ImportRefused, recordVersion, requireEnv, sha256, type SourceSink } from "./common";
import { assertEditionImportable, type EditionGateRow } from "./editions";
import type { FetchLike } from "./translations";

/** sunnah.com's collection slugs for the four collections QITL catalogues. */
export const SUNNAH_COLLECTIONS: Record<CollectionId, string> = { bukhari: "bukhari", muslim: "muslim", tirmidhi: "tirmidhi", ibnmajah: "ibnmajah" };
export const SUNNAH_NUMBERING = "sunnah.com";

export type GradeEnum = "sahih" | "hasan" | "hasan sahih" | "sahih li-ghayrihi" | "hasan li-ghayrihi" | "daif" | "daif jiddan" | "mawdu" | "munkar" | "shadhdh" | "other";

/** Maps a source's grade wording onto the database enum; anything unrecognised is "other" with its label kept verbatim. */
export function mapGrade(label: string): GradeEnum {
  const g = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "")
    .toLowerCase()
    .replace(/['`‘’ʿʾ]/g, "")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const table: Array<[RegExp, GradeEnum]> = [
    [/^hasan sahih$/, "hasan sahih"],
    [/^sahih li ?gh?ayrihi$|^sahih li ?ghairihi$/, "sahih li-ghayrihi"],
    [/^hasan li ?gh?ayrihi$|^hasan li ?ghairihi$/, "hasan li-ghayrihi"],
    [/^sahih$/, "sahih"],
    [/^hasan$/, "hasan"],
    [/^da?if jiddan$/, "daif jiddan"],
    [/^da?if$/, "daif"],
    [/^maw?du?$|^maudu$/, "mawdu"],
    [/^munkar$/, "munkar"],
    [/^shadh?dh?$/, "shadhdh"],
  ];
  return table.find(([re]) => re.test(g))?.[1] ?? "other";
}

export interface SunnahHadith {
  collection: string;
  hadithNumber: string;
  arabic: string | null;
  english: string | null;
  grades: Array<{ grader: string; label: string }>;
}

/** /v1/collections/{name}/hadiths?page=N: { data: [{ collection, hadithNumber, hadith: [{ lang, body, grades: [{ graded_by, grade }] }] }], next }. */
export function parseSunnahPage(raw: string): { items: SunnahHadith[]; next: number | null } {
  const j = JSON.parse(raw) as {
    data?: Array<{ collection?: string; hadithNumber?: string; hadith?: Array<{ lang?: string; body?: string; grades?: Array<{ graded_by?: string | null; grade?: string }> }> }>;
    next?: number | null;
  };
  if (!Array.isArray(j.data)) throw new ImportRefused("bad_format", "sunnah.com response has no data array");
  const items = j.data.map((d) => {
    const ar = d.hadith?.find((h) => h.lang === "ar");
    const en = d.hadith?.find((h) => h.lang === "en");
    const grades = [...(en?.grades ?? []), ...(ar?.grades ?? [])]
      .filter((g) => typeof g.grade === "string" && g.grade.trim() && typeof g.graded_by === "string" && g.graded_by.trim().length > 1)
      .map((g) => ({ grader: g.graded_by!.trim(), label: g.grade!.trim() }));
    // The same grader can appear in both language blocks: keep one.
    const uniq = [...new Map(grades.map((g) => [g.grader, g])).values()];
    return { collection: String(d.collection ?? ""), hadithNumber: String(d.hadithNumber ?? "").trim(), arabic: ar?.body ?? null, english: en?.body ?? null, grades: uniq };
  });
  return { items, next: typeof j.next === "number" ? j.next : null };
}

export function sunnahClient(fetchFn: FetchLike, env: Record<string, string | undefined> = process.env) {
  const key = requireEnv("SUNNAH_API_KEY", env);
  const base = env.SUNNAH_API_BASE ?? "https://api.sunnah.com/v1";
  const url = (collection: string, page: number) => `${base}/collections/${collection}/hadiths?limit=50&page=${page}`;
  return {
    url,
    async page(collection: string, page: number) {
      const r = await fetchFn(url(collection, page), { headers: { "X-API-Key": key, "User-Agent": "QITL source importer" } });
      if (!r.ok) throw new ImportRefused("http", `sunnah.com ${collection} page ${page}: HTTP ${r.status}`);
      return r.text();
    },
  };
}

export interface HadithSink extends SourceSink {
  findEdition(origin: string, originRef: string): Promise<EditionGateRow | null>;
  existingHadith(collection: CollectionId, numbering: string): Promise<Map<string, { id: string; arabic: string }>>;
  insertHadith(row: { collection_id: CollectionId; numbering_system: string; canonical_number: string; source_version_id: string; arabic: string; source_url: string; status: "draft" }): Promise<{ id: string }>;
  insertTranslation(row: { hadith_id: string; source_id: string; source_version_id: string; translator: string; language: string; text: string }): Promise<void>;
  insertGrading(row: { hadith_id: string; grader: string; grade: GradeEnum; grade_label: string; source_id: string; citation: string }): Promise<void>;
}

export interface HadithImportInput {
  collection: string;
  version: string;
  maxPages: number;
  acceptTerms: boolean;
  retrievedAt: Date;
}

export async function importHadith(sink: HadithSink, client: ReturnType<typeof sunnahClient>, input: HadithImportInput) {
  if (!input.acceptTerms) throw new ImportRefused("terms_not_accepted", "Read the sunnah.com API terms and pass --accept-terms. Nothing fetched or written.");
  if (!(COLLECTION_IDS as string[]).includes(input.collection))
    throw new ImportRefused("collection_not_catalogued", `Only ${COLLECTION_IDS.join(", ")} are imported (QITL's public catalogue).`);
  if (!input.version) throw new ImportRefused("no_version", "pass --version to pin the import");
  const collection = input.collection as CollectionId;
  const edition = assertEditionImportable(await sink.findEdition("sunnah_com", collection), { origin: "sunnah_com", kind: "hadith_translation", originRef: collection });

  const pages: string[] = [];
  const items: SunnahHadith[] = [];
  let page: number | null = 1;
  while (page && pages.length < input.maxPages) {
    const raw = await client.page(SUNNAH_COLLECTIONS[collection], page);
    pages.push(raw);
    const p = parseSunnahPage(raw);
    items.push(...p.items);
    page = p.next;
  }
  const existing = await sink.existingHadith(collection, SUNNAH_NUMBERING);
  const skipped: string[] = [];
  const conflicts: string[] = [];
  const fresh: SunnahHadith[] = [];
  for (const h of items) {
    if (h.collection !== SUNNAH_COLLECTIONS[collection] || !/^[0-9]+[a-z]?$/.test(h.hadithNumber) || !h.arabic) {
      skipped.push(h.hadithNumber || "(no number)");
      continue;
    }
    const old = existing.get(h.hadithNumber);
    if (!old) fresh.push(h);
    else if (old.arabic !== h.arabic) conflicts.push(h.hadithNumber);
  }
  if (conflicts.length) throw new ImportRefused("immutable", `${conflicts.length} stored narration(s) differ (first ${conflicts[0]}). Stored text is never modified. Nothing written.`);

  const checksum = sha256(pages.join("\n"));
  const rv = await recordVersion(sink, edition.source.id, edition.source.work, { version: input.version, checksum, retrievedAt: input.retrievedAt, retrievedFrom: client.url(SUNNAH_COLLECTIONS[collection], 1) });
  let gradings = 0;
  for (const h of fresh) {
    const { id } = await sink.insertHadith({
      collection_id: collection,
      numbering_system: SUNNAH_NUMBERING,
      canonical_number: h.hadithNumber,
      source_version_id: rv.versionId,
      arabic: h.arabic!,
      source_url: `https://sunnah.com/${SUNNAH_COLLECTIONS[collection]}:${h.hadithNumber}`,
      status: "draft",
    });
    if (h.english) await sink.insertTranslation({ hadith_id: id, source_id: edition.source.id, source_version_id: rv.versionId, translator: edition.translator, language: edition.language, text: h.english });
    for (const g of h.grades) {
      await sink.insertGrading({ hadith_id: id, grader: g.grader, grade: mapGrade(g.label), grade_label: g.label, source_id: edition.source.id, citation: `sunnah.com, ${SUNNAH_COLLECTIONS[collection]}:${h.hadithNumber}` });
      gradings++;
    }
  }
  return { collection, checksum, versionId: rv.versionId, inserted: fresh.length, unchanged: items.length - fresh.length - skipped.length, skipped, gradings };
}
