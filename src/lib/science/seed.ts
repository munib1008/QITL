import { assertTopic, checkScienceText } from "./validator";
import { DISCIPLINES, EVIDENCE_STATES, OUTSIDE, TESTABILITY, MILESTONE_KINDS, RELATIONSHIPS, type Discipline, type EvidenceState, type L3, type MilestoneKind, type Relationship, type Testability, type TopicDoc, type TopicListItem } from "./model";

/**
 * The DRAFT inventory of candidate topics (content/science/topics.draft.json). Nothing in it is reviewed, no rating is assigned,
 * section texts are null placeholders, and a discovery year appears only where it carries the URL and the note of the check.
 * `loadSeed` refuses the file when a Quran reference is not in the loaded corpus, when an Arabic term does not appear in the
 * verse text, or when the validator (src/lib/science/validator.ts) rejects anything.
 */
export const SEED_VERSION = "science-seed-v1";
export const SEED_MODEL = "qitl-draft-inventory";

/** The general, true "does not establish" sentences. The Arabic and Urdu are drafts for a translator. */
export const GENERAL_DNE: L3 = {
  en: "A scientific finding about a phenomenon does not by itself show that a passage predicted or described it. Understanding the wording of a passage is a question of interpretation, and this page records no scholarly position until a source is attached. Nothing here is a scientific proof of the Quran, and nothing here is a score.",
  ar: "إن وجود دعم علمي لظاهرة ما لا يدلّ بذاته على أن النصّ قد تنبّأ بها أو وصفها. وفهم ألفاظ النصّ مسألة تفسير، ولا تسجّل هذه الصفحة موقفًا علميًا لأحد حتى يُرفق به مصدر. ليس في هذه الصفحة إثباتٌ علميّ للقرآن ولا درجةٌ تقييمية.",
  ur: "کسی مظہر کے بارے میں سائنسی دریافت بذاتِ خود یہ ثابت نہیں کرتی کہ کسی عبارت نے اس کی پیش گوئی کی یا اسے بیان کیا۔ عبارت کے الفاظ کا مفہوم تفسیر کا مسئلہ ہے، اور جب تک ماخذ منسلک نہ ہو یہ صفحہ کسی عالم کا موقف درج نہیں کرتا۔ یہاں کوئی چیز قرآن کا سائنسی ثبوت نہیں اور نہ کوئی نمبر یا سکور ہے۔",
};

interface RawMilestone { kind: MilestoneKind; label: string; year: number | null; verified_source?: string; verified_note?: string; publication?: number }
interface RawTopic {
  slug: string;
  kind: "natural" | "unseen";
  discipline: Discipline;
  title: L3;
  summary: string | null;
  does_not_establish_en: string;
  dne_ar?: string;
  dne_ur?: string;
  links: Array<{ surah: number; ayah: number; terms: string[]; relationship?: Relationship }>;
  claims: Array<{ claim: string; kind: string; evidence_state?: EvidenceState }>;
  discoveries: Array<{ title: string; milestones: RawMilestone[] }>;
  publications: Array<{ title: string; authors: string[]; doi: string | null; year: number | null; url: string | null; verified_source: string; verified_note: string }>;
  questions: Array<{ question: string; known: string | null; uncertain: string | null; competing: string | null; testability: Testability; why_connection: string | null }>;
}
export interface RawSeed {
  version: string;
  topics: RawTopic[];
}

export interface DraftTopic extends Omit<RawTopic, "dne_ar" | "dne_ur" | "does_not_establish_en"> {
  does_not_establish: L3;
}

export type VerseLookup = (surah: number, ayah: number) => string | null;

/** Validate the file and return the topics. Throws a readable message on the first problem. */
export function loadSeed(raw: RawSeed, verse: VerseLookup): DraftTopic[] {
  if (raw.version !== SEED_VERSION) throw new Error(`seed version ${raw.version}, expected ${SEED_VERSION}`);
  const slugs = new Set<string>();
  return raw.topics.map((t) => {
    if (slugs.has(t.slug)) throw new Error(`duplicate slug ${t.slug}`);
    slugs.add(t.slug);
    if (!DISCIPLINES.includes(t.discipline)) throw new Error(`${t.slug}: unknown discipline ${t.discipline}`);
    if (!t.links.length) throw new Error(`${t.slug}: no Quran link`);
    const seen = new Set<string>();
    for (const l of t.links) {
      const text = verse(l.surah, l.ayah);
      if (!text) throw new Error(`${t.slug}: ${l.surah}:${l.ayah} is not in the loaded Quran corpus`);
      if (seen.has(`${l.surah}:${l.ayah}`)) throw new Error(`${t.slug}: duplicate link ${l.surah}:${l.ayah}`);
      seen.add(`${l.surah}:${l.ayah}`);
      for (const term of l.terms) if (!text.includes(term)) throw new Error(`${t.slug}: Arabic term "${term}" does not appear in the corpus text of ${l.surah}:${l.ayah}`);
      if (l.relationship && !RELATIONSHIPS.includes(l.relationship)) throw new Error(`${t.slug}: unknown relationship ${l.relationship}`);
    }
    for (const c of t.claims) {
      if (c.evidence_state && !EVIDENCE_STATES.includes(c.evidence_state)) throw new Error(`${t.slug}: unknown evidence state`);
      // Only the categorical "outside empirical science" is ever pre-set; every other rating waits for a science reviewer.
      if (c.evidence_state && c.evidence_state !== OUTSIDE) throw new Error(`${t.slug}: a seed may not assign the evidence state ${c.evidence_state}`);
      if (t.kind === "unseen" && c.evidence_state !== OUTSIDE) throw new Error(`${t.slug}: a metaphysical topic must be classified outside empirical science`);
    }
    if (t.kind === "unseen" && t.links.some((l) => l.relationship !== "not_scientifically_testable")) throw new Error(`${t.slug}: a metaphysical topic must be not scientifically testable`);
    for (const q of t.questions) if (!TESTABILITY.includes(q.testability)) throw new Error(`${t.slug}: unknown testability`);
    for (const g of t.discoveries) for (const m of g.milestones) {
      if (!MILESTONE_KINDS.includes(m.kind)) throw new Error(`${t.slug}: unknown milestone kind`);
      if (m.publication != null && !t.publications[m.publication]) throw new Error(`${t.slug}: milestone points at a missing publication`);
    }
    const dne: L3 = {
      en: `${t.does_not_establish_en} ${GENERAL_DNE.en}`,
      ar: t.dne_ar ? `${t.dne_ar} ${GENERAL_DNE.ar}` : GENERAL_DNE.ar,
      ur: t.dne_ur ? `${t.dne_ur} ${GENERAL_DNE.ur}` : GENERAL_DNE.ur,
    };
    const texts: Record<string, string | null> = { title_en: t.title.en, summary: t.summary, dne_en: dne.en, dne_ar: dne.ar, dne_ur: dne.ur };
    t.claims.forEach((c, i) => (texts[`claim${i}`] = c.claim));
    t.questions.forEach((q, i) => (Object.assign(texts, { [`q${i}`]: q.question, [`q${i}k`]: q.known, [`q${i}u`]: q.uncertain, [`q${i}w`]: q.why_connection })));
    const milestones = t.discoveries.flatMap((g) => g.milestones.map((m) => ({ kind: m.kind, label: m.label, year: m.year, verifiedSource: m.verified_source ?? null })));
    for (const m of milestones) texts[`milestone:${m.label.slice(0, 20)}`] = m.label;
    assertTopic({
      kind: t.kind,
      texts,
      doesNotEstablish: dne,
      milestones,
      publications: t.publications.map((p) => ({ title: p.title, doi: p.doi, url: p.url, year: p.year, verifiedSource: p.verified_source })),
    });
    for (const [k, v] of Object.entries(texts)) if (v && checkScienceText(v).length) throw new Error(`${t.slug}: ${k} breaks the text guard`);
    const { dne_ar: _a, dne_ur: _u, does_not_establish_en: _e, ...rest } = t;
    void _a; void _u; void _e;
    return { ...rest, does_not_establish: dne };
  });
}

/** What the draft file shows when no database is connected: never reviewed, never rated, publications unverified so not listed. */
export function draftToDoc(t: DraftTopic): TopicDoc {
  return {
    slug: t.slug,
    title: t.title,
    discipline: t.discipline,
    topic_kind: t.kind,
    summary: t.summary,
    scholarly_status: "not_reviewed",
    scientific_review: "not_reviewed",
    ai_generated: true,
    published: false,
    needs_rereview: false,
    origin: "draft_file",
    phenomenon: null,
    limitations: null,
    alternatives: null,
    conclusion: null,
    does_not_establish: t.does_not_establish,
    claims: t.claims.map((c) => ({ claim: c.claim, kind: c.kind, evidence_state: c.evidence_state ?? "unassessed" })),
    links: t.links.map((l, i) => ({
      surah: l.surah,
      ayah: l.ayah,
      terms: l.terms,
      relationship: l.relationship ?? "unassessed",
      interpretation_strength: "unassessed",
      connection_strength: "unassessed",
      note: null,
      // tafsir reference placeholders: no wording until a source is attached
      interpretations: i === 0 ? (["classical", "contemporary"] as const).map((era) => ({ era, evidence_status: "needs_source" as const, scholar: null, work: null, locator: null, summary: null, proposed_after_discovery: null })) : [],
    })),
    milestones: t.discoveries.flatMap((g) =>
      g.milestones.map((m) => ({ discovery: g.title, kind: m.kind, label: m.label, year: m.year, verified_source: m.year != null ? m.verified_source ?? null : null, verified_note: m.verified_note ?? null })),
    ),
    publications: [],
    evidence: [],
    open_questions: t.questions.map((q) => ({ question: q.question, known: q.known, uncertain: q.uncertain, competing: q.competing, testability: q.testability, why_connection: q.why_connection })),
    visuals: [],
    localizations: [],
    reviews: { scientific: null, scholarly: null },
  };
}

export function docToListItem(d: TopicDoc): TopicListItem {
  return {
    slug: d.slug,
    title: d.title,
    discipline: d.discipline,
    topic_kind: d.topic_kind,
    summary: d.summary,
    scholarly_status: d.scholarly_status,
    scientific_review: d.scientific_review,
    ai_generated: d.ai_generated,
    published: d.published,
    needs_rereview: d.needs_rereview,
    origin: d.origin,
    links: d.links.map((l) => ({ surah: l.surah, ayah: l.ayah, relationship: l.relationship, interpretation_strength: l.interpretation_strength, connection_strength: l.connection_strength })),
    evidence_states: [...new Set(d.claims.map((c) => c.evidence_state))],
    milestones: d.milestones,
  };
}

export interface SeedSink {
  insert(table: string, row: Record<string, unknown>): Promise<string>;
}

/** Write the draft inventory as private AI drafts through a sink (the script's Supabase client, or the test database). */
export async function writeSeed(topics: DraftTopic[], sink: SeedSink): Promise<void> {
  for (const t of topics) {
    const topicId = await sink.insert("science_topics", {
      slug: t.slug, title_en: t.title.en, title_ar: t.title.ar, title_ur: t.title.ur, discipline: t.discipline, topic_kind: t.kind, summary_en: t.summary,
      does_not_establish_en: t.does_not_establish.en, does_not_establish_ar: t.does_not_establish.ar, does_not_establish_ur: t.does_not_establish.ur,
      ai_generated: true, ai_model: SEED_MODEL, prompt_version: SEED_VERSION,
    });
    for (const [i, c] of t.claims.entries()) await sink.insert("science_claims", { topic_id: topicId, claim_en: c.claim, claim_kind: c.kind, evidence_state: c.evidence_state ?? "unassessed", position: i });
    for (const [i, l] of t.links.entries()) {
      const linkId = await sink.insert("quran_science_links", { topic_id: topicId, surah_id: l.surah, ayah_no: l.ayah, arabic_terms: l.terms, relationship: l.relationship ?? "unassessed", position: i });
      if (i === 0) for (const era of ["classical", "contemporary"]) await sink.insert("quran_science_interpretations", { link_id: linkId, era });
    }
    const pubIds: string[] = [];
    for (const p of t.publications)
      pubIds.push(await sink.insert("science_publications", { topic_id: topicId, title: p.title, authors: p.authors, doi: p.doi, year: p.year, url: p.url, verified_source: p.verified_source, verified_note: p.verified_note }));
    for (const [gi, g] of t.discoveries.entries()) {
      const did = await sink.insert("science_discoveries", { topic_id: topicId, title_en: g.title, position: gi });
      for (const [mi, m] of g.milestones.entries())
        await sink.insert("science_discovery_milestones", {
          discovery_id: did, kind: m.kind, label_en: m.label, year: m.year, position: mi,
          publication_id: m.publication != null ? pubIds[m.publication] : null,
          verified_source: m.year != null ? m.verified_source ?? null : null, verified_note: m.year != null ? m.verified_note ?? null : null,
        });
    }
    for (const [i, q] of t.questions.entries())
      await sink.insert("science_open_questions", { topic_id: topicId, question_en: q.question, known_en: q.known, uncertain_en: q.uncertain, competing_en: q.competing, testability: q.testability, why_connection_en: q.why_connection, position: i });
  }
}
