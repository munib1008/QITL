/**
 * Automated story checks (docs/STORY_COVERAGE.md, "Checks"). Pure: no files, no database, no clock. The CLI
 * (scripts/check-stories.ts), the admin coverage page and the tests all call runChecks() with the same inputs:
 *
 *   - `content`: the static files (event inventory, journey, Quran structure), see static-inputs.ts (Node only);
 *   - `db`: the rows returned by the staff-only RPC story_check_inputs() (absent when no database is reachable).
 *
 * A check reports; it never edits, publishes or "fixes" anything. A finding is advice to an editor, with a severity:
 * `error` breaks a rule of the platform (a published chapter without a reference), `warning` needs a human look,
 * `info` is context.
 */

export type Severity = "error" | "warning" | "info";

export const CHECK_IDS = [
  "missing_quran_reference",
  "verse_outside_surah",
  "duplicate_story",
  "non_prophet_labelled_prophet",
  "unsupported_chronology",
  "hadith_grading_gap",
  "unlicensed_source",
  "contradictory_genealogy",
  "unreviewed_translation",
  "broken_internal_link",
  "unapproved_claim",
] as const;
export type CheckId = (typeof CHECK_IDS)[number];

export interface Finding {
  check: CheckId;
  severity: Severity;
  /** What it is about, for a human: "chapter nuh-and-his-people #2", "inventory item hud". */
  subject: string;
  message: string;
}

// ---------- Inputs ----------
export interface InventoryItem {
  slug: string;
  title: string;
  track: string;
  /** "surah:from-to" strings. */
  refs: string[];
}
export interface ContentInputs {
  /** Number of ayat in each surah, index = surah number (index 0 unused). */
  ayahCounts: number[];
  inventory: InventoryItem[];
  /** The journey's stops: prophets and milestones, with their related passages. */
  journey: Array<{ id: string; type: "prophet" | "milestone"; refs: string[] }>;
  /** Slugs the app serves: for the internal-link check. */
  routes: { topLevel: string[]; prophetIds: string[]; eventSlugs: string[]; storySlugs: string[] };
}

export interface DbRef {
  unitKind: "chapter" | "section";
  unitId: string;
  claimId: string;
  claimStatus: string;
  kind: string;
  surah: number | null;
  ayahFrom: number | null;
  ayahTo: number | null;
  hadithId: string | null;
  collection: string | null;
  grade: string | null;
  authentic: boolean;
  rightsStatus: string | null;
}
export interface DbChapter {
  id: string;
  storySlug: string;
  position: number;
  anchor: string;
  title: string;
  status: string;
  eventSlug: string | null;
  bodyMd: string;
  summaryMd: string | null;
  deepMd: string | null;
  kidsMd: string | null;
  lessonsMd: string | null;
  unknownsMd: string | null;
}
export interface DbInputs {
  stories: Array<{ id: string; slug: string; status: string; personSlug: string | null }>;
  chapters: DbChapter[];
  sections: Array<{ id: string; section: string; status: string; subjectSlug: string; subjectKind: "person" | "event"; bodyMd: string }>;
  refs: DbRef[];
  unitsWithoutClaims: Array<{ unitKind: "chapter"; unitId: string }>;
  people: Array<{ slug: string; kind: string; status: string }>;
  events: Array<{ slug: string; track: string | null; status: string; orderingKind: string | null; datePrecision: string; startYear: number | null; endYear: number | null; startAh: number | null; claimId: string | null }>;
  eventRefs: Array<{ eventSlug: string; surah: number; ayahFrom: number; ayahTo: number }>;
  relationships: Array<{ id: string; from: string; to: string; kind: string; status: string; confidence: string; competingGroup: string | null }>;
  translations: Array<{ scriptId: string; language: string; status: string; title: string; linguisticOk: boolean; religiousOk: boolean }>;
}

export interface CheckInput {
  content: ContentInputs;
  db?: DbInputs | null;
}

// ---------- Helpers ----------
const PUBLIC_STATES = new Set(["published"]);
const REVIEWED_STATES = new Set(["in_review", "approved", "published", "correction"]);
const sev = (status: string, whenLive: Severity = "error"): Severity => (REVIEWED_STATES.has(status) ? whenLive : "warning");

export interface Range {
  surah: number;
  from: number;
  to: number;
}
export function parseRange(s: string): Range | null {
  const m = /^(\d{1,3}):(\d{1,3})(?:[-–](\d{1,3}))?$/.exec(s.trim().replace(/^Q\s*/i, ""));
  if (!m) return null;
  return { surah: Number(m[1]), from: Number(m[2]), to: m[3] ? Number(m[3]) : Number(m[2]) };
}
const fmt = (r: Range) => (r.from === r.to ? `${r.surah}:${r.from}` : `${r.surah}:${r.from}-${r.to}`);

/** null when the range lies inside the surah, otherwise why not. */
export function rangeProblem(r: Range, ayahCounts: number[]): string | null {
  if (!Number.isInteger(r.surah) || r.surah < 1 || r.surah > 114) return `surah ${r.surah} does not exist`;
  const n = ayahCounts[r.surah] ?? 0;
  if (r.from < 1) return `ayah ${r.from} is not a verse number`;
  if (r.to < r.from) return `the range ends before it starts`;
  if (n && r.to > n) return `ayah ${r.to} is past the end of surah ${r.surah} (${n} ayat)`;
  return null;
}

const keys = (rs: Range[]) => {
  const s = new Set<string>();
  for (const r of rs) for (let a = r.from; a <= r.to; a++) s.add(`${r.surah}:${a}`);
  return s;
};

// ---------- 1. Missing Quran references ----------
export function checkMissingReferences(c: CheckInput): Finding[] {
  const out: Finding[] = [];
  for (const i of c.content.inventory)
    if (!i.refs.length) out.push({ check: "missing_quran_reference", severity: "error", subject: `inventory item ${i.slug}`, message: "has no Quran reference" });
  const db = c.db;
  if (!db) return out;
  const refsByUnit = new Map<string, DbRef[]>();
  for (const r of db.refs) refsByUnit.set(`${r.unitKind}:${r.unitId}`, [...(refsByUnit.get(`${r.unitKind}:${r.unitId}`) ?? []), r]);
  const noClaims = new Set(db.unitsWithoutClaims.map((u) => `${u.unitKind}:${u.unitId}`));
  for (const ch of db.chapters) {
    if (ch.status === "archived") continue;
    const rs = refsByUnit.get(`chapter:${ch.id}`) ?? [];
    const has = rs.some((r) => r.kind === "quran" || r.kind === "hadith");
    const subject = `chapter ${ch.storySlug}#${ch.anchor}`;
    if (noClaims.has(`chapter:${ch.id}`)) out.push({ check: "missing_quran_reference", severity: sev(ch.status), subject, message: "has no claims at all, so nothing in it is sourced" });
    else if (!has) out.push({ check: "missing_quran_reference", severity: sev(ch.status), subject, message: "its claims carry no Quran or authentic hadith reference" });
  }
  for (const s of db.sections) {
    if (s.status === "archived") continue;
    const rs = refsByUnit.get(`section:${s.id}`) ?? [];
    if (!rs.some((r) => r.kind === "quran" || r.kind === "hadith"))
      out.push({ check: "missing_quran_reference", severity: sev(s.status), subject: `section ${s.subjectSlug}/${s.section}`, message: "its claim carries no Quran or authentic hadith reference" });
  }
  const refd = new Set(db.eventRefs.map((r) => r.eventSlug));
  for (const e of db.events)
    if (e.track && e.status === "published" && !refd.has(e.slug)) out.push({ check: "missing_quran_reference", severity: "error", subject: `event ${e.slug}`, message: "is published without a verse reference" });
  return out;
}

// ---------- 2. Verse ids outside the surah ----------
export function checkVerseRanges(c: CheckInput): Finding[] {
  const out: Finding[] = [];
  const counts = c.content.ayahCounts;
  const test = (subject: string, r: Range | null, raw: string) => {
    if (!r) return void out.push({ check: "verse_outside_surah", severity: "error", subject, message: `"${raw}" is not a verse reference` });
    const p = rangeProblem(r, counts);
    if (p) out.push({ check: "verse_outside_surah", severity: "error", subject, message: `${fmt(r)}: ${p}` });
  };
  for (const i of c.content.inventory) for (const raw of i.refs) test(`inventory item ${i.slug}`, parseRange(raw), raw);
  for (const j of c.content.journey) for (const raw of j.refs) test(`journey stop ${j.id}`, parseRange(raw), raw);
  const db = c.db;
  if (db) {
    for (const r of db.refs)
      if (r.kind === "quran") test(`${r.unitKind} ${r.unitId.slice(0, 8)}`, r.surah && r.ayahFrom ? { surah: r.surah, from: r.ayahFrom, to: r.ayahTo ?? r.ayahFrom } : null, `${r.surah}:${r.ayahFrom}`);
    for (const r of db.eventRefs) test(`event ${r.eventSlug}`, { surah: r.surah, from: r.ayahFrom, to: r.ayahTo }, `${r.surah}:${r.ayahFrom}-${r.ayahTo}`);
  }
  return out;
}

// ---------- 3. Duplicate stories ----------
/**
 * Identical verse sets are flagged for dedupe. Near-identical sets (Jaccard >= 0.9, >= 8 ayat) are context. A set that
 * merely contains another (a prophet and one episode of his story) is by design and not reported.
 */
export function checkDuplicates(c: CheckInput): Finding[] {
  const out: Finding[] = [];
  type Item = { name: string; ranges: Range[] };
  const compare = (what: string, items: Item[]) => {
    const withRefs = items.filter((i) => i.ranges.length).map((i) => ({ ...i, set: keys(i.ranges) }));
    for (let a = 0; a < withRefs.length; a++)
      for (let b = a + 1; b < withRefs.length; b++) {
        const x = withRefs[a]!;
        const y = withRefs[b]!;
        let shared = 0;
        for (const k of x.set) if (y.set.has(k)) shared++;
        const union = x.set.size + y.set.size - shared;
        if (shared === x.set.size && shared === y.set.size)
          out.push({ check: "duplicate_story", severity: "warning", subject: `${what} ${x.name} and ${y.name}`, message: "cover exactly the same verses: merge them, or state what distinguishes them" });
        else if (union >= 8 && shared / union >= 0.9)
          out.push({ check: "duplicate_story", severity: "info", subject: `${what} ${x.name} and ${y.name}`, message: `share ${shared} of ${union} ayat: check they are not the same story` });
      }
  };
  compare(
    "inventory items",
    c.content.inventory.map((i) => ({ name: i.slug, ranges: i.refs.map(parseRange).filter((r): r is Range => !!r) })),
  );
  const db = c.db;
  if (db) {
    const slugOf = new Map(db.chapters.map((ch) => [ch.id, ch.storySlug]));
    const byStory = new Map<string, Range[]>();
    for (const r of db.refs)
      if (r.unitKind === "chapter" && r.kind === "quran" && r.surah && r.ayahFrom) {
        const slug = slugOf.get(r.unitId);
        if (slug) byStory.set(slug, [...(byStory.get(slug) ?? []), { surah: r.surah, from: r.ayahFrom, to: r.ayahTo ?? r.ayahFrom }]);
      }
    compare("stories", [...byStory].map(([name, ranges]) => ({ name, ranges })));
    const byEvent = new Map<string, Range[]>();
    for (const r of db.eventRefs) byEvent.set(r.eventSlug, [...(byEvent.get(r.eventSlug) ?? []), { surah: r.surah, from: r.ayahFrom, to: r.ayahTo }]);
    compare("events", [...byEvent].map(([name, ranges]) => ({ name, ranges })));
  }
  return out;
}

// ---------- 4. A non-prophet labelled a prophet ----------
/** The journey spells two slugs differently from the event inventory. */
export const SLUG_ALIASES: Record<string, string> = { dhulkifl: "dhul-kifl", zakariya: "zakariyya" };
export const canonicalSlug = (s: string) => SLUG_ALIASES[s] ?? s;

export function checkProphetLabels(c: CheckInput): Finding[] {
  const out: Finding[] = [];
  // The data: the Quran-named prophets are the inventory's `prophets` track.
  const prophets = new Set(c.content.inventory.filter((i) => i.track === "prophets").map((i) => i.slug));
  if (!prophets.size) return out;
  for (const j of c.content.journey)
    if (j.type === "prophet" && !prophets.has(canonicalSlug(j.id)))
      out.push({ check: "non_prophet_labelled_prophet", severity: "error", subject: `journey stop ${j.id}`, message: "is labelled a prophet but is not among the prophets of the event inventory" });
  const notProphet = c.content.inventory.filter((i) => i.track !== "prophets" && prophets.has(i.slug));
  for (const i of notProphet) out.push({ check: "non_prophet_labelled_prophet", severity: "warning", subject: `inventory item ${i.slug}`, message: `is filed under "${i.track}" but is a prophet` });
  const db = c.db;
  if (!db) return out;
  for (const p of db.people)
    if (p.kind === "prophet" && !prophets.has(canonicalSlug(p.slug)))
      out.push({ check: "non_prophet_labelled_prophet", severity: "error", subject: `person ${p.slug}`, message: "is recorded as a prophet but is not among the 25 prophets named in the Quran" });
  for (const e of db.events)
    if (e.track === "prophets" && !prophets.has(e.slug)) out.push({ check: "non_prophet_labelled_prophet", severity: "error", subject: `event ${e.slug}`, message: "is on the prophets track but is not among the 25 prophets" });
  const kindOf = new Map(db.people.map((p) => [p.slug, p.kind]));
  for (const s of db.stories)
    if (s.personSlug && kindOf.get(s.personSlug) !== "prophet") out.push({ check: "non_prophet_labelled_prophet", severity: "info", subject: `story ${s.slug}`, message: `is told about ${s.personSlug}, who is not recorded as a prophet` });
  // Text that calls a known non-prophet "prophet".
  const names = c.content.inventory.filter((i) => i.track === "people" || i.track === "communities").map((i) => i.slug.replace(/-/g, "[- ]"));
  if (names.length) {
    const re = new RegExp(`\\b(prophet|nabi|messenger)\\s+(${names.join("|")})\\b`, "i");
    for (const t of texts(db)) {
      const m = re.exec(t.text);
      if (m) out.push({ check: "non_prophet_labelled_prophet", severity: "warning", subject: t.subject, message: `calls "${m[2]}" a ${m[1]!.toLowerCase()}; check whether scholars treat them as one` });
    }
  }
  return out;
}

// ---------- 5. Unsupported chronology ----------
const DATE_IN_TEXT = /\b(\d{1,4}\s?(?:BC|BCE|CE|AD|AH)\b|(?:circa|around|about|in the year)\s+\d{3,4}\b|\d[\d,]*\s+years\s+ago\b)/i;
export function checkChronology(c: CheckInput): Finding[] {
  const out: Finding[] = [];
  const db = c.db;
  if (!db) return out;
  for (const e of db.events) {
    const hasYears = e.startYear !== null || e.endYear !== null || e.startAh !== null;
    if (hasYears && e.orderingKind !== null && e.orderingKind !== "dated_estimate")
      out.push({ check: "unsupported_chronology", severity: "error", subject: `event ${e.slug}`, message: `carries a year although its ordering is "${e.orderingKind}" (only a sourced historians' estimate may)` });
    if (["exact", "range", "estimated"].includes(e.datePrecision) && !e.claimId)
      out.push({ check: "unsupported_chronology", severity: sev(e.status), subject: `event ${e.slug}`, message: "has a date but no claim that cites where it comes from" });
  }
  for (const t of texts(db)) {
    const m = DATE_IN_TEXT.exec(t.text);
    if (m) out.push({ check: "unsupported_chronology", severity: "warning", subject: t.subject, message: `states a date ("${m[0]}"): dates appear only from a sourced, labelled estimate` });
  }
  return out;
}

// ---------- 6. Hadith grading gaps ----------
const COLLECTIONS = new Set(["bukhari", "muslim", "tirmidhi", "ibnmajah"]);
export function checkHadith(c: CheckInput): Finding[] {
  const out: Finding[] = [];
  for (const r of c.db?.refs ?? []) {
    if (r.kind !== "hadith") continue;
    const subject = `${r.unitKind} ${r.unitId.slice(0, 8)}`;
    if (!r.collection || !COLLECTIONS.has(r.collection))
      out.push({ check: "hadith_grading_gap", severity: "error", subject, message: `cites a hadith from "${r.collection ?? "an unknown collection"}": only Bukhari, Muslim, and individually graded Tirmidhi and Ibn Majah are used` });
    else if (!r.grade) out.push({ check: "hadith_grading_gap", severity: "error", subject, message: `cites a ${r.collection} hadith without the grading it relies on (grade, named scholar, source)` });
    else if (!r.authentic) out.push({ check: "hadith_grading_gap", severity: "error", subject, message: `cites a ${r.collection} hadith graded "${r.grade}", which is not sahih or hasan` });
  }
  return out;
}

// ---------- 7. Unlicensed source content ----------
export function checkLicences(c: CheckInput): Finding[] {
  const out: Finding[] = [];
  const status = new Map<string, string>();
  for (const ch of c.db?.chapters ?? []) status.set(`chapter:${ch.id}`, ch.status);
  for (const s of c.db?.sections ?? []) status.set(`section:${s.id}`, s.status);
  const seen = new Set<string>();
  for (const r of c.db?.refs ?? []) {
    if (!r.rightsStatus || ["cleared", "public_domain"].includes(r.rightsStatus)) continue;
    const key = `${r.unitKind}:${r.unitId}:${r.rightsStatus}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      check: "unlicensed_source",
      severity: PUBLIC_STATES.has(status.get(`${r.unitKind}:${r.unitId}`) ?? "") ? "error" : "warning",
      subject: `${r.unitKind} ${r.unitId.slice(0, 8)}`,
      message: `cites a source whose rights are "${r.rightsStatus}": nothing from it may be published until it is cleared (docs/LICENSING.md)`,
    });
  }
  return out;
}

// ---------- 8. Contradictory genealogy ----------
export function checkGenealogy(c: CheckInput): Finding[] {
  const out: Finding[] = [];
  const edges = (c.db?.relationships ?? []).filter((e) => e.status !== "archived" && e.status !== "rejected");
  // Competing (disputed) alternatives are meant to disagree with each other; the rest must be consistent.
  const firm = edges.filter((e) => !e.competingGroup);
  const parent = new Map<string, Set<string>>(); // parent -> children
  const add = (p: string, ch: string) => parent.set(p, (parent.get(p) ?? new Set()).add(ch));
  for (const e of firm) {
    if (e.kind === "parent_of") add(e.from, e.to);
    if (e.kind === "descendant_of") add(e.to, e.from);
  }
  // A person who is their own ancestor.
  const reported = new Set<string>();
  for (const start of parent.keys()) {
    const stack: Array<[string, string[]]> = [[start, [start]]];
    const visited = new Set<string>();
    while (stack.length) {
      const [node, path] = stack.pop()!;
      for (const next of parent.get(node) ?? []) {
        if (next === start) {
          const key = [...path].sort().join(">");
          if (!reported.has(key)) {
            reported.add(key);
            out.push({ check: "contradictory_genealogy", severity: "error", subject: `${path.join(" > ")} > ${start}`, message: "a person is their own ancestor" });
          }
        } else if (!visited.has(next)) {
          visited.add(next);
          stack.push([next, [...path, next]]);
        }
      }
    }
  }
  // The same pair joined by kinds that cannot both be true.
  const pair = (a: string, b: string) => [a, b].sort().join("|");
  const kinds = new Map<string, Set<string>>();
  for (const e of firm) {
    const k = e.kind === "descendant_of" ? "parent_of" : e.kind;
    kinds.set(pair(e.from, e.to), (kinds.get(pair(e.from, e.to)) ?? new Set()).add(k));
  }
  for (const [p, ks] of kinds)
    if (ks.has("parent_of") && (ks.has("sibling_of") || ks.has("spouse_of")))
      out.push({ check: "contradictory_genealogy", severity: "error", subject: p.replace("|", " and "), message: `are recorded as parent and child and also as ${ks.has("sibling_of") ? "siblings" : "spouses"}` });
  return out;
}

// ---------- 9. Unreviewed translations ----------
export function checkTranslations(c: CheckInput): Finding[] {
  const out: Finding[] = [];
  for (const t of c.db?.translations ?? []) {
    if (t.linguisticOk && t.religiousOk) continue;
    const missing = [!t.linguisticOk ? "linguistic" : "", !t.religiousOk ? "religious" : ""].filter(Boolean).join(" and ");
    out.push({
      check: "unreviewed_translation",
      severity: ["published", "approved"].includes(t.status) ? "error" : "info",
      subject: `${t.language.toUpperCase()} translation "${t.title}"`,
      message: `is ${t.status} without an approved ${missing} review of this version`,
    });
  }
  return out;
}

// ---------- 10. Broken internal links ----------
const LINK = /\]\(([^)\s]+)\)/g;
const LOCALE_PREFIX = /^\/(ar|ur)(?=\/|$)/;

export function linkProblem(href: string, r: ContentInputs["routes"], ayahCounts: number[]): string | null {
  if (href.startsWith("#") || href.startsWith("mailto:")) return null;
  if (/^https:\/\//.test(href)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//") || href.includes("\\")) return "is not a same-site path or an https link";
  if (!href.startsWith("/")) return "is a relative link; use a full /path";
  const [pathAndQuery = "", hash = ""] = href.replace(LOCALE_PREFIX, "").split("#") as [string, string?];
  const path = pathAndQuery.split("?")[0] || "/";
  const segs = path.split("/").filter(Boolean);
  if (!segs.length) return null;
  const [top, second] = segs;
  if (!r.topLevel.includes(top!)) return `points to /${top}, which is not a page of the site`;
  if (top === "quran" && second) {
    const s = Number(second);
    if (!Number.isInteger(s) || s < 1 || s > 114) return `points to surah ${second}, which does not exist`;
    const m = /^ayah-(\d+)(?:-(\d+))?$/.exec(hash ?? "");
    if (hash && !m) return `anchor #${hash} is not an ayah anchor`;
    if (m) {
      const p = rangeProblem({ surah: s, from: Number(m[1]), to: Number(m[2] ?? m[1]) }, ayahCounts);
      if (p) return `anchor #${hash}: ${p}`;
    }
  }
  if (top === "prophets" && second && !r.prophetIds.includes(second)) return `points to prophet "${second}", who has no page`;
  if (top === "events" && second && !r.eventSlugs.includes(second)) return `points to event "${second}", which does not exist`;
  if (top === "stories" && second && !r.storySlugs.includes(second)) return `points to story "${second}", which does not exist`;
  return null;
}

export function checkLinks(c: CheckInput): Finding[] {
  const out: Finding[] = [];
  const db = c.db;
  if (!db) return out;
  for (const t of texts(db)) {
    for (const m of t.text.matchAll(LINK)) {
      const p = linkProblem(m[1]!, c.content.routes, c.content.ayahCounts);
      if (p) out.push({ check: "broken_internal_link", severity: "warning", subject: t.subject, message: `link ${m[1]} ${p}` });
    }
  }
  return out;
}

// ---------- extra: published on an unapproved claim ----------
export function checkClaims(c: CheckInput): Finding[] {
  const out: Finding[] = [];
  const status = new Map<string, string>();
  for (const ch of c.db?.chapters ?? []) status.set(`chapter:${ch.id}`, ch.status);
  for (const s of c.db?.sections ?? []) status.set(`section:${s.id}`, s.status);
  const seen = new Set<string>();
  for (const r of c.db?.refs ?? []) {
    if (["approved", "published"].includes(r.claimStatus)) continue;
    const st = status.get(`${r.unitKind}:${r.unitId}`) ?? "";
    const key = `${r.unitKind}:${r.unitId}:${r.claimId}`;
    if (seen.has(key) || !REVIEWED_STATES.has(st)) continue;
    seen.add(key);
    out.push({ check: "unapproved_claim", severity: st === "published" ? "error" : "warning", subject: `${r.unitKind} ${r.unitId.slice(0, 8)}`, message: `is ${st} but rests on a claim that is ${r.claimStatus}` });
  }
  return out;
}

/** Every text a reader may see, with a label: for the date and link checks. */
function texts(db: DbInputs): Array<{ subject: string; text: string }> {
  const out: Array<{ subject: string; text: string }> = [];
  for (const ch of db.chapters) {
    const subject = `chapter ${ch.storySlug}#${ch.anchor}`;
    for (const t of [ch.bodyMd, ch.summaryMd, ch.deepMd, ch.kidsMd, ch.lessonsMd, ch.unknownsMd]) if (t) out.push({ subject, text: t });
  }
  for (const s of db.sections) if (s.bodyMd) out.push({ subject: `section ${s.subjectSlug}/${s.section}`, text: s.bodyMd });
  return out;
}

export const CHECKS: Array<{ id: CheckId; title: string; run: (c: CheckInput) => Finding[] }> = [
  { id: "missing_quran_reference", title: "Missing Quran references", run: checkMissingReferences },
  { id: "verse_outside_surah", title: "Verse ids outside the surah", run: checkVerseRanges },
  { id: "duplicate_story", title: "Duplicate stories (same verse ranges)", run: checkDuplicates },
  { id: "non_prophet_labelled_prophet", title: "Non-prophets labelled prophets", run: checkProphetLabels },
  { id: "unsupported_chronology", title: "Unsupported chronology or dates", run: checkChronology },
  { id: "hadith_grading_gap", title: "Hadith grading gaps", run: checkHadith },
  { id: "unlicensed_source", title: "Unlicensed source content", run: checkLicences },
  { id: "contradictory_genealogy", title: "Contradictory genealogy edges", run: checkGenealogy },
  { id: "unreviewed_translation", title: "Unreviewed translations", run: checkTranslations },
  { id: "broken_internal_link", title: "Broken internal source links", run: checkLinks },
  { id: "unapproved_claim", title: "Reviewed or published on an unapproved claim", run: checkClaims },
];

const ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function runChecks(input: CheckInput): Finding[] {
  return CHECKS.flatMap((c) => c.run(input)).sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.check.localeCompare(b.check) || a.subject.localeCompare(b.subject));
}

export function summarise(findings: readonly Finding[]) {
  const by = Object.fromEntries(CHECK_IDS.map((id) => [id, { error: 0, warning: 0, info: 0 }])) as Record<CheckId, Record<Severity, number>>;
  for (const f of findings) by[f.check][f.severity]++;
  return { total: findings.length, errors: findings.filter((f) => f.severity === "error").length, warnings: findings.filter((f) => f.severity === "warning").length, by };
}
