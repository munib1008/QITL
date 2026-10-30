import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COLLECTIONS, AUTHENTIC_GRADES, presentedAsSahih } from "@/lib/data/hadith";
import { earlyTafsirSlot, tafsirSlots, translationSlots, type TafsirRow } from "./state";
import type { DifferenceItem, EditionInfo, ExplanationItem, HadithRef, Licence, StudyData, TafsirFlag, WordItem } from "./types";

/* Raw row shapes as PostgREST returns them (embedded to-one relations come back as objects). */
interface SourceRow {
  work: string | null;
  rights_status: Licence["rightsStatus"];
  license_text: string | null;
  license_url: string | null;
  attribution: string | null;
}
interface EditionRow {
  id: string;
  kind: EditionInfo["kind"];
  language: string;
  title: string;
  title_ar: string | null;
  publication_year: number | null;
  edition: string | null;
  origin: string;
  registry_status: EditionInfo["registryStatus"];
  reliability_note: string | null;
  historical_period: string | null;
  position: number | null;
  translator_profiles: { name: string; name_ar: string | null; died: string | null } | null;
  sources: SourceRow | null;
}

export const EDITION_SELECT =
  "id, kind, language, title, title_ar, publication_year, edition, origin, registry_status, reliability_note, historical_period, position, translator_profiles(name, name_ar, died), sources(work, rights_status, license_text, license_url, attribution)";

export function toLicence(s: SourceRow | null | undefined): Licence | null {
  if (!s) return null;
  return { work: s.work, rightsStatus: s.rights_status, text: s.license_text, url: s.license_url, attribution: s.attribution };
}

export function toEdition(r: EditionRow): EditionInfo {
  return {
    id: r.id,
    kind: r.kind,
    language: r.language,
    title: r.title,
    titleAr: r.title_ar,
    translator: r.translator_profiles ? { name: r.translator_profiles.name, nameAr: r.translator_profiles.name_ar, died: r.translator_profiles.died } : null,
    year: r.publication_year,
    edition: r.edition,
    origin: r.origin,
    registryStatus: r.registry_status,
    reliabilityNote: r.reliability_note,
    historicalPeriod: r.historical_period,
    position: r.position,
    licence: toLicence(r.sources),
  };
}

export function emptyStudy(surah: number, ayah: number, configured: boolean): StudyData {
  return {
    ref: { surah, ayah },
    configured,
    translations: [],
    earlyTafsir: { edition: null, state: "not_imported", text: null, flags: [], reviewNote: null },
    words: [],
    wordsSource: null,
    differences: [],
    tafsir: [],
    hadith: [],
    explanations: [],
  };
}

/**
 * Everything the Study panel shows for one ayah, read with the public (anonymous) client so RLS limits it to what any
 * reader may see: verified editions with cleared licences, published senses, explanations and narrations.
 */
export async function loadStudy(sb: SupabaseClient | null, surah: number, ayah: number): Promise<StudyData> {
  if (!sb) return emptyStudy(surah, ayah, false);
  const out = emptyStudy(surah, ayah, true);

  const [editionsRes, translationsRes, tafsirRes, wordsRes, sensesRes, explRes, claimRefsRes] = await Promise.all([
    sb.from("translation_editions").select(EDITION_SELECT).in("kind", ["quran_translation", "tafsir", "early_tafsir"]).neq("registry_status", "rejected").limit(200),
    sb.from("quran_translations").select("edition_id, text").eq("surah_id", surah).eq("ayah_no", ayah).not("edition_id", "is", null),
    sb.from("tafsir_entries").select("edition_id, text, flags, review_note, ayah_from, ayah_to").eq("surah_id", surah).lte("ayah_from", ayah).gte("ayah_to", ayah).not("edition_id", "is", null),
    sb
      .from("quran_word_morphology")
      .select("word_no, text_ar, transliteration, root, lemma, pos, features, literal_gloss, source_versions(version, sources(work, rights_status, license_text, license_url, attribution))")
      .eq("surah_id", surah)
      .eq("ayah_no", ayah)
      .order("word_no"),
    sb.from("quran_word_senses").select("word_no, root_meaning, contextual_meaning, explanation_md").eq("surah_id", surah).eq("ayah_no", ayah).eq("status", "published"),
    sb
      .from("interpretation_explanations")
      .select("id, title, body_md, origin, model, prompt_version, version, language, interpretation_differences(id, kind, term_ar, surah_id, ayah_no, word_no, summary, recognised_disagreement, position, edition_ids)")
      .eq("status", "published")
      .eq("surah_id", surah)
      .lte("ayah_from", ayah)
      .gte("ayah_to", ayah),
    sb.from("claim_references").select("claim_id, quran_ayah_from, quran_ayah_to").eq("kind", "quran").eq("quran_surah", surah).lte("quran_ayah_from", ayah).limit(200),
  ]);

  const editions = ((editionsRes.data ?? []) as unknown as EditionRow[]).map(toEdition);
  const titleOf = new Map(editions.map((e) => [e.id, e.title]));
  const texts = new Map<string, string>();
  for (const t of (translationsRes.data ?? []) as Array<{ edition_id: string; text: string }>) texts.set(t.edition_id, t.text);
  const tafsirRows: TafsirRow[] = ((tafsirRes.data ?? []) as Array<{ edition_id: string; text: string; flags: TafsirFlag[]; review_note: string | null; ayah_from: number; ayah_to: number }>).map((r) => ({
    editionId: r.edition_id,
    text: r.text,
    flags: r.flags ?? [],
    reviewNote: r.review_note,
    from: r.ayah_from,
    to: r.ayah_to,
  }));
  out.translations = translationSlots(editions, texts);
  out.earlyTafsir = earlyTafsirSlot(editions, tafsirRows);
  out.tafsir = tafsirSlots(editions, tafsirRows);

  // Word by word, with the reviewed contextual meaning kept apart from the literal gloss.
  type WordRow = { word_no: number; text_ar: string; transliteration: string | null; root: string | null; lemma: string | null; pos: string; features: Record<string, unknown> | null; literal_gloss: string | null; source_versions: { version: string; sources: SourceRow | null } | null };
  const wordRows = (wordsRes.data ?? []) as unknown as WordRow[];
  const senses = new Map(((sensesRes.data ?? []) as Array<{ word_no: number; root_meaning: string | null; contextual_meaning: string; explanation_md: string | null }>).map((s) => [s.word_no, s]));
  const lemmas = [...new Set(wordRows.map((w) => w.lemma).filter((l): l is string => Boolean(l)))];
  const occ = new Map<string, WordItem["occurrences"]>();
  if (lemmas.length) {
    const { data } = await sb.from("quran_word_occurrences").select("lemma, surah_id, ayah_no, word_no").in("lemma", lemmas).limit(2000);
    for (const o of (data ?? []) as Array<{ lemma: string; surah_id: number; ayah_no: number; word_no: number }>) {
      if (o.surah_id === surah && o.ayah_no === ayah) continue;
      const list = occ.get(o.lemma) ?? [];
      list.push({ surah: o.surah_id, ayah: o.ayah_no, word: o.word_no });
      occ.set(o.lemma, list);
    }
  }
  out.words = wordRows.map((w) => {
    const s = senses.get(w.word_no);
    return {
      wordNo: w.word_no,
      textAr: w.text_ar,
      transliteration: w.transliteration,
      root: w.root,
      lemma: w.lemma,
      pos: w.pos,
      features: Object.fromEntries(Object.entries(w.features ?? {}).map(([k, v]) => [k, String(v)])),
      literalGloss: w.literal_gloss,
      sense: s ? { rootMeaning: s.root_meaning, contextualMeaning: s.contextual_meaning, explanation: s.explanation_md } : null,
      occurrences: w.lemma ? (occ.get(w.lemma) ?? []) : [],
    };
  });
  out.wordsSource = toLicence(wordRows[0]?.source_versions?.sources);

  type ExplRow = {
    id: string;
    title: string;
    body_md: string;
    origin: ExplanationItem["origin"];
    model: string | null;
    prompt_version: string | null;
    version: number;
    language: string;
    interpretation_differences: Array<{ id: string; kind: DifferenceItem["kind"]; term_ar: string | null; surah_id: number | null; ayah_no: number | null; word_no: number | null; summary: string; recognised_disagreement: boolean; position: number; edition_ids: string[] }>;
  };
  const expl = (explRes.data ?? []) as ExplRow[];
  out.explanations = expl.map((e) => ({ id: e.id, title: e.title, bodyMd: e.body_md, origin: e.origin, model: e.model, promptVersion: e.prompt_version, version: e.version, language: e.language }));
  out.differences = expl
    .flatMap((e) => e.interpretation_differences ?? [])
    .filter((d) => d.ayah_no == null || (d.surah_id === surah && d.ayah_no === ayah))
    .sort((a, b) => a.position - b.position)
    .map((d) => ({ id: d.id, kind: d.kind, termAr: d.term_ar, wordNo: d.word_no, summary: d.summary, recognised: d.recognised_disagreement, editions: d.edition_ids.map((id) => titleOf.get(id)).filter((t): t is string => Boolean(t)) }));

  // Hadith cross-references: narrations cited by the same published claims that cite this ayah.
  const claimIds = [
    ...new Set(
      ((claimRefsRes.data ?? []) as Array<{ claim_id: string; quran_ayah_from: number; quran_ayah_to: number | null }>)
        .filter((r) => (r.quran_ayah_to ?? r.quran_ayah_from) >= ayah)
        .map((r) => r.claim_id),
    ),
  ];
  if (claimIds.length) {
    const { data } = await sb
      .from("claim_references")
      .select("hadith_entries(collection_id, canonical_number, numbering_system, hadith_gradings(grader, grade, grade_label, citation)), evidence_claims!inner(status)")
      .eq("kind", "hadith")
      .eq("evidence_claims.status", "published")
      .in("claim_id", claimIds)
      .limit(50);
    type HRow = { hadith_entries: { collection_id: string; canonical_number: string; numbering_system: string; hadith_gradings: Array<{ grader: string; grade: string; grade_label: string; citation: string }> } | null };
    const seen = new Set<string>();
    const refs: HadithRef[] = [];
    for (const r of (data ?? []) as unknown as HRow[]) {
      const h = r.hadith_entries;
      const c = h && COLLECTIONS.find((x) => x.id === h.collection_id);
      if (!h || !c) continue; // the public catalogue is the four collections only
      const key = `${h.collection_id}:${h.numbering_system}:${h.canonical_number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({
        collectionId: c.id,
        collectionName: c.name,
        number: h.canonical_number,
        numbering: h.numbering_system,
        gradings: h.hadith_gradings.map((g) => ({ grader: g.grader, grade: g.grade, label: g.grade_label, citation: g.citation, authentic: AUTHENTIC_GRADES.has(g.grade) })),
        presentedAsSahih: presentedAsSahih(c.id, h.hadith_gradings),
      });
    }
    out.hadith = refs;
  }
  return out;
}
