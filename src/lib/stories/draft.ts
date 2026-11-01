/**
 * Story drafts (content/stories/<slug>.draft.json): schema and validator. See content/stories/SCHEMA.md.
 *
 * A draft is NEVER published and never presented as reviewed. The validator is a gate that stops the common ways a
 * draft goes wrong (a verse that does not exist, a sentence with no claim behind it, an invented name, number,
 * dialogue or description, hadith or tradition mixed into Quranic text). It is a heuristic, not a scholar: whatever
 * it passes still needs the review checklist in docs/STORY_DRAFTS.md.
 *
 * Node only (it uses the Quran verification helpers, which read the imported text).
 */
import { z } from "zod";
import { norm, parseRef, rangeHasAnchor, type Quran } from "@/lib/events/verify";

// ---------------------------------------------------------------- schema

const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const VerseRangeSchema = z
  .object({ surah: z.number().int().min(1).max(114), from: z.number().int().min(1), to: z.number().int().min(1) })
  .strict()
  .refine((r) => r.to >= r.from, { message: "to must be >= from" });

export const ClaimSchema = z
  .object({
    id: z.string().regex(/^c\d+$/, "claim id must look like c1"),
    statement_en: z.string().min(5).max(2000),
    verses: z.array(VerseRangeSchema).min(1),
    evidence: z.literal("quran"),
  })
  .strict();

export const ChapterSchema = z
  .object({
    anchor: z.string().regex(kebab, "anchor must be kebab-case"),
    position: z.number().int().min(1),
    title_en: z.string().min(1).max(200),
    event_slug: z.string().regex(kebab).nullable(),
    verses: z.array(VerseRangeSchema).min(1),
    claims: z.array(ClaimSchema).min(1),
    summary_md: z.string().min(1).max(4000),
    body_md: z.string().min(1),
    deep_md: z.string().max(40000).nullable(),
    kids_md: z.string().max(8000).nullable(),
    lessons_md: z.string().max(8000).nullable(),
    unknowns_md: z.string().max(4000),
  })
  .strict();

export const StoryDraftSchema = z
  .object({
    slug: z.string().regex(kebab),
    title_en: z.string().min(1).max(200),
    title_ar: z.string().min(1).max(60).nullable(),
    subject: z.object({ type: z.enum(["prophet", "person", "community", "event", "parable", "seerah"]), event_slug: z.string().regex(kebab) }).strict(),
    status: z.literal("draft"),
    notes: z.string().max(4000).optional(),
    chapters: z.array(ChapterSchema).min(1),
    uncertainties_en: z.array(z.string().min(1).max(1000)),
  })
  .strict();

export type VerseRange = z.infer<typeof VerseRangeSchema>;
export type DraftClaim = z.infer<typeof ClaimSchema>;
export type DraftChapter = z.infer<typeof ChapterSchema>;
export type StoryDraft = z.infer<typeof StoryDraftSchema>;

/** The Event Universe track each subject type belongs to (content/events/inventory.draft.json). */
export const SUBJECT_TRACK = { prophet: "prophets", person: "people", community: "communities", event: "events", parable: "parables", seerah: "seerah" } as const;

export const LESSONS_PREFIX = "Educational interpretation (not scripture):";
export const TRADITION_LABEL = "Named in later tradition, not in the Quranic text";
export const HADITH_LATER_PREFIX = "Hadith to add later:";

/** The text fields of a chapter in which every sentence must rest on a claim. */
export const CLAIM_BOUND_FIELDS = ["summary_md", "body_md", "deep_md", "kids_md", "lessons_md"] as const;
/** The modes that may only restate claims (names and numbers must already be in the claims). */
const RESTATING_FIELDS = ["summary_md", "kids_md", "lessons_md"] as const;
type TextField = (typeof CLAIM_BOUND_FIELDS)[number] | "unknowns_md";

// ---------------------------------------------------------------- fixtures and context

export interface AnchorFixtures {
  /** Persons, places and titles that may be named, with the Arabic anchor word that must occur in the cited ayat ("a/b" lists variants). */
  names: Record<string, string>;
  /** Number words that may be written, with the Arabic anchor that must occur in the cited ayat. */
  numbers: Record<string, string>;
  /** Body-part and similar words that are depiction-sensitive: allowed only when the cited ayat use the Arabic word. */
  guarded: Record<string, string>;
  /** Capitalised words that are not names (God, Quran ...). */
  common_capitalised: string[];
  /** Ordinary words that may begin a sentence. */
  opening_words: string[];
  /** Names from later tradition: allowed only in a sentence that carries TRADITION_LABEL (unknowns / uncertainties). */
  tradition_names: string[];
  /** The well-known Arabic name of a subject, for title_ar. */
  titles_ar: Record<string, string>;
}

export interface InventoryItem {
  slug: string;
  title?: string;
  track: string;
  refs: string[];
}

export interface DraftContext {
  quran: Quran;
  ayahCounts: number[];
  inventory: InventoryItem[];
  anchors: AnchorFixtures;
}

export type Severity = "error" | "warning" | "info";
export interface Issue {
  severity: Severity;
  code: string;
  where: string;
  message: string;
}

// ---------------------------------------------------------------- verse helpers

export const ayatOfRanges = (rs: VerseRange[]): Set<string> => {
  const s = new Set<string>();
  for (const r of rs) for (let a = r.from; a <= r.to; a++) s.add(`${r.surah}:${a}`);
  return s;
};

export function refsToRanges(refs: string[]): VerseRange[] {
  const out: VerseRange[] = [];
  for (const x of refs) {
    const r = parseRef(x);
    if (r) out.push({ surah: r.surah, from: r.from, to: r.to });
  }
  return out;
}

export const formatRange = (r: VerseRange): string => (r.from === r.to ? `${r.surah}:${r.from}` : `${r.surah}:${r.from}-${r.to}`);

export function hasAnchor(q: Quran, ayat: Set<string>, anchor: string): boolean {
  for (const k of ayat) {
    const [s, a] = k.split(":").map(Number) as [number, number];
    if (rangeHasAnchor(q, { surah: s, from: a, to: a }, anchor)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- text helpers

const MARKER = /\[c\d+(?:\s*,\s*c\d+)*\]/g;
const VERSE_REF = /\b\d{1,3}:\d{1,3}(?:-\d{1,3})?\b/g;

export const markerIds = (s: string): string[] => [...s.matchAll(MARKER)].flatMap((m) => m[0].match(/c\d+/g) ?? []);
export const stripMarkers = (s: string): string => s.replace(/\s*\[c\d+(?:\s*,\s*c\d+)*\]/g, "");

/** Sentence-level units of a Markdown text: bullets are units, headings are skipped. */
export function splitUnits(md: string): string[] {
  const out: string[] = [];
  for (const block of md.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    for (const line of block.split("\n")) {
      const t = line.trim().replace(/^(?:-|\d+\.)\s+/, "");
      if (!t || t.startsWith("#")) continue;
      out.push(...t.split(/(?<=[.!?])\s+(?=["“A-Z])/).map((x) => x.trim()).filter(Boolean));
    }
  }
  return out;
}

const SPEECH_VERB = /\b(said|says|say|called|calls|cried|asked|asks|replied|answered|prayed|prays|spoke|told|tells|declared|exclaimed|whispered|urged|proclaimed|warned|added|advised|promised|swore|vowed|responded|commanded|ordered|announced|pleaded|appealed|complained|reminded|reassured)\b/i;
const NUMBER_WORDS = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|hundreds|thousand|thousands|million|several|dozen|dozens|twice|thrice|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/gi;
const HADITH = /\b(hadith|hadiths|bukhari|tirmidhi|abu dawud|nasa'?i|ibn majah|sunan|musnad|isnad|narrated by|narrator|sahih muslim|sahih al-)\b|the prophet\s*(?:muhammad\s*)?(?:ﷺ\s*)?said|the messenger of god said/i;
const TRADITION_PHRASES = /\b(it is said|it was said|is said to|are said to|was said to|were said to|according to (?:tradition|some|many|later|classical|the tradition|commentat\w+|reports?)|traditionally|tradition holds|reportedly|allegedly|legend\w*|folklore|isra'?iliyy\w*|midrash\w*|biblical|the bible|talmud\w*|some say|many say|others say|is believed|are believed|is reported|is narrated|is related that|stories say|accounts say|later reports?)\b/i;
const DEPICTION = /\b(handsome|beautiful|beauty|good-looking|tall|short-statured|appearance|looked like|radiant|glowing|beard|robe|robes|cloak|turban|height|complexion|hair|features|skin|physique|dressed in|wore|wearing|lovely|attractive|striking|charming|stature|figure of)\b/i;
const LEGAL_MEDICAL = /\b(haram|halal|fatwa|fatawa|obligatory|permissible|impermissible|ruling|rulings|legal verdict|diagnos\w+|cure|cures|therapy|medicine|medical|treatment|prescrib\w+|dosage)\b/i;
const WORLDLY_PROMISE = /\b(guarantee\w*|will always|always (?:leads?|brings?|rewards?)|never fails?|ensures? (?:success|wealth|victory|happiness)|you will (?:succeed|prosper|be rich|be rewarded|win)|is sure to bring|bring you (?:success|wealth|riches))\b/i;
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

interface Scope {
  where: string;
  /** Ayat the text may rely on. */
  ayat: Set<string>;
  /** unknowns / uncertainties: no claim markers needed, tradition may be named under its label. */
  loose: boolean;
  /** a title: its first word is capitalised by convention, so it is not judged as a possible name unless it is a listed one. */
  title?: boolean;
  /** the story's own subject: its name is tested against the whole subject's inventory ayat, not chapter by chapter. */
  subject?: { slug: string; ayat: Set<string> };
}

/** Capitalised words of a unit with whether they open a sentence/clause. */
function capitalised(unit: string): Array<{ word: string; initial: boolean }> {
  const out: Array<{ word: string; initial: boolean }> = [];
  const t = unit.replace(MARKER, " ").replace(VERSE_REF, " ");
  for (const m of t.matchAll(/[A-Za-z][A-Za-z'’-]*/g)) {
    const word = m[0].replace(/['’]s$/, "").replace(/['’-]+$/, "");
    if (!/^[A-Z]/.test(word)) continue;
    const before = t.slice(0, m.index).trimEnd();
    const prev = before.slice(-1);
    const initial = before === "" || /[.!?:("“]/.test(prev);
    out.push({ word, initial });
  }
  return out;
}

const KEY_OF = (w: string) => w.toLowerCase();

function checkText(text: string, scope: Scope, ctx: DraftContext, issues: Issue[], opts: { claimIds?: Set<string>; claimStatements?: string }): void {
  const fx = ctx.anchors;
  const where = scope.where;
  const err = (code: string, message: string) => issues.push({ severity: "error", code, where, message });

  if (ARABIC_SCRIPT.test(text)) err("arabic-in-text", "Arabic script in a draft text; verse references are enough (Arabic anchors live only in the fixtures).");

  const cleaned = text.replace(MARKER, " ");
  if (HADITH.test(cleaned) && !text.trimStart().startsWith(HADITH_LATER_PREFIX)) err("hadith", "Hadith wording: these drafts are Quran only; list hadith under uncertainties_en as 'Hadith to add later'.");
  if (DEPICTION.test(cleaned)) err("depiction", "Depiction wording (physical description or dress); prophets, angels and jinn are never described.");
  if (LEGAL_MEDICAL.test(cleaned)) err("legal-medical", "Legal or medical wording; no rulings or advice in story texts.");
  if (WORLDLY_PROMISE.test(cleaned)) err("worldly-promise", "Promises a worldly outcome; not allowed.");
  if (!scope.loose && TRADITION_PHRASES.test(cleaned)) err("tradition-phrase", "'it is said / according to tradition' wording; later tradition belongs only in unknowns_md or uncertainties_en.");

  // verse references written in the text must exist
  for (const m of text.matchAll(VERSE_REF)) {
    const r = parseRef(m[0]);
    const count = r ? ctx.ayahCounts[r.surah] ?? 0 : 0;
    if (!r || r.to > count || r.from > count) err("verse-ref", `reference ${m[0]} does not exist in the Quran text`);
    else {
      for (let a = r.from; a <= r.to; a++) {
        if (!scope.loose && !scope.ayat.has(`${r.surah}:${a}`)) {
          err("verse-ref-outside", `reference ${m[0]} is outside the verses this text may rely on`);
          break;
        }
      }
    }
  }

  const noRefs = cleaned.replace(VERSE_REF, " ");

  // digits
  for (const m of noRefs.matchAll(/\d+/g)) err("number-digit", `numeral "${m[0]}": numbers, ages, years and durations are written only when the cited ayah states them, and then as words listed in the anchors fixture`);

  // number words
  for (const m of noRefs.matchAll(NUMBER_WORDS)) {
    const w = KEY_OF(m[0]);
    const anchor = fx.numbers[w];
    if (!anchor) err("number-word", `number word "${m[0]}" has no anchor in the fixture; a number not in the cited ayat is invented`);
    else if (!hasAnchor(ctx.quran, scope.ayat, anchor)) err("number-anchor", `number word "${m[0]}" (anchor ${anchor}) does not occur in the cited ayat`);
  }

  // depiction-sensitive words
  for (const [word, anchor] of Object.entries(fx.guarded)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(noRefs) && !hasAnchor(ctx.quran, scope.ayat, anchor)) {
      err("guarded-word", `"${word}" (anchor ${anchor}) is not in the cited ayat; descriptive words about people need the ayah to use them`);
    }
  }

  // tradition names
  for (const unit of splitUnits(text)) {
    const labelled = unit.includes(TRADITION_LABEL);
    for (const n of fx.tradition_names) {
      if (new RegExp(`\\b${n}\\b`, "i").test(unit) && !(scope.loose && labelled)) {
        err("tradition-name", `"${n}" is a name from later tradition; it may appear only in unknowns_md / uncertainties_en, in a sentence that says "${TRADITION_LABEL}"`);
      }
    }
    // named persons / places: anchor-word test
    if (!(scope.loose && labelled)) {
      const common = new Set(fx.common_capitalised.map(KEY_OF));
      const opening = new Set(fx.opening_words.map(KEY_OF));
      let n = 0;
      for (const { word, initial } of capitalised(unit)) {
        const first = n++ === 0;
        const k = KEY_OF(word);
        if (common.has(k)) continue;
        const anchor = Object.entries(fx.names).find(([n]) => KEY_OF(n) === k)?.[1];
        if (anchor) {
          const isSubject = scope.subject !== undefined && k === scope.subject.slug;
          if (!hasAnchor(ctx.quran, isSubject ? scope.subject!.ayat : scope.ayat, anchor)) err("name-anchor", `"${word}" (anchor ${anchor}) does not occur in the ${isSubject ? "inventory ayat of the subject" : "cited ayat"}`);
          continue;
        }
        if (initial && (opening.has(k) || (scope.title && first))) continue;
        err("name-unknown", `capitalised word "${word}" is not a listed name (anchors fixture) or opening word; a name not in the cited ayat is invented`);
      }
    }
  }

  // quotation marks: only speech that the cited claim itself records
  for (const unit of splitUnits(text)) {
    const quotes = [...unit.matchAll(/"([^"]+)"|“([^”]+)”/g)];
    if (quotes.length === 0) continue;
    const ids = markerIds(unit);
    const statements = ids.map((id) => opts.claimStatements ? claimText(opts.claimStatements, id) : "").join(" ");
    for (const q of quotes) {
      const inner = (q[1] ?? q[2] ?? "").trim();
      if (opts.claimIds === undefined) {
        // inside a claim statement itself: it must be a speech statement
        if (!SPEECH_VERB.test(unit.replace(q[0], ""))) err("quote", `quotation marks around "${inner}" but the statement does not say someone spoke; direct quotation is only for speech the ayah records`);
      } else if (ids.length === 0 || !SPEECH_VERB.test(statements) || !statements.toLowerCase().includes(inner.toLowerCase())) {
        err("quote", `quotation marks around "${inner}": allowed only for speech recorded in a cited ayah, and the words must appear in the cited claim's statement (a claim saying someone spoke)`);
      }
    }
  }
}

/** The statements of all claims, as one searchable string keyed by id: "<id>\u0001<statement>\u0002". */
function packClaims(claims: DraftClaim[]): string {
  return claims.map((c) => `${c.id}\u0001${c.statement_en}\u0002`).join("");
}
function claimText(packed: string, id: string): string {
  const m = new RegExp(`${id}\\u0001([^\\u0002]*)\\u0002`).exec(packed);
  return m?.[1] ?? "";
}

// ---------------------------------------------------------------- the validator

export interface ValidateOptions {
  /** The file name without extension, to compare with the slug. */
  fileSlug?: string;
}

export function validateStoryDraft(raw: unknown, ctx: DraftContext, opts: ValidateOptions = {}): Issue[] {
  const issues: Issue[] = [];
  const parsed = StoryDraftSchema.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) issues.push({ severity: "error", code: "schema", where: i.path.join(".") || "(file)", message: i.message });
    return issues;
  }
  const d = parsed.data;
  const err = (code: string, where: string, message: string) => issues.push({ severity: "error", code, where, message });
  const warn = (code: string, where: string, message: string) => issues.push({ severity: "warning", code, where, message });
  const info = (code: string, where: string, message: string) => issues.push({ severity: "info", code, where, message });

  if (opts.fileSlug !== undefined && opts.fileSlug !== d.slug) err("slug-file", "slug", `slug "${d.slug}" does not match the file name "${opts.fileSlug}.draft.json"`);

  // subject and the inventory
  const inv = ctx.inventory.find((i) => i.slug === d.subject.event_slug);
  if (!inv) err("subject", "subject.event_slug", `"${d.subject.event_slug}" is not in content/events/inventory.draft.json`);
  else if (inv.track !== SUBJECT_TRACK[d.subject.type]) err("subject", "subject.event_slug", `"${inv.slug}" is on the "${inv.track}" track, not "${SUBJECT_TRACK[d.subject.type]}" (subject.type "${d.subject.type}")`);
  const subjectAyat = ayatOfRanges(refsToRanges(inv?.refs ?? []));

  if (d.title_ar !== null) {
    const want = ctx.anchors.titles_ar[d.slug];
    if (!want || norm(want) !== norm(d.title_ar)) err("title-ar", "title_ar", `title_ar must be the well-known Arabic name of the subject (fixture titles_ar); otherwise null`);
  }
  if (ARABIC_SCRIPT.test(d.title_en)) err("arabic-in-text", "title_en", "title_en must not contain Arabic script");

  const subject = { slug: d.slug, ayat: subjectAyat };
  const covered = new Set<string>();
  const anchorsSeen = new Set<string>();

  d.chapters.forEach((c, idx) => {
    const w = `chapters[${idx}] (${c.anchor})`;
    if (c.position !== idx + 1) err("position", w, `position must be ${idx + 1} (positions run 1..n in order)`);
    if (anchorsSeen.has(c.anchor)) err("anchor-dup", w, `anchor "${c.anchor}" is used twice`);
    anchorsSeen.add(c.anchor);

    // verse ranges exist
    const rangesOk = (rs: VerseRange[], where: string): boolean => {
      let ok = true;
      for (const r of rs) {
        const n = ctx.ayahCounts[r.surah] ?? 0;
        if (r.from > n || r.to > n) {
          err("verse-bounds", where, `${formatRange(r)} is outside surah ${r.surah} (${n} ayat)`);
          ok = false;
        }
      }
      return ok;
    };
    const chapterOk = rangesOk(c.verses, `${w}.verses`);
    const chAyat = ayatOfRanges(c.verses);
    if (chapterOk) {
      for (const k of chAyat) covered.add(k);
      // consistent with the inventory
      const outside = [...chAyat].filter((k) => !subjectAyat.has(k));
      if (inv && outside.length) err("inventory", `${w}.verses`, `verses outside the inventory refs of "${inv.slug}" (${inv.refs.join(", ")}): ${compact(outside)}`);
    }

    // event link
    if (c.event_slug !== null) {
      const ev = ctx.inventory.find((i) => i.slug === c.event_slug);
      if (!ev) err("event", `${w}.event_slug`, `"${c.event_slug}" is not in the event inventory`);
      else {
        const evAyat = ayatOfRanges(refsToRanges(ev.refs));
        const out = [...chAyat].filter((k) => !evAyat.has(k));
        if (out.length) err("event", `${w}.event_slug`, `chapter verses outside the event "${ev.slug}" (${ev.refs.join(", ")}): ${compact(out)}; set event_slug to null or narrow the chapter`);
      }
    }

    // claims
    const ids = new Set<string>();
    const cited = new Set<string>();
    for (const cl of c.claims) {
      const cw = `${w}.claims.${cl.id}`;
      if (ids.has(cl.id)) err("claim-dup", cw, "duplicate claim id");
      ids.add(cl.id);
      const ok = rangesOk(cl.verses, `${cw}.verses`);
      if (ok) {
        const cAyat = ayatOfRanges(cl.verses);
        const out = [...cAyat].filter((k) => !chAyat.has(k));
        if (out.length) err("claim-outside", cw, `claim verses outside the chapter's verses: ${compact(out)}`);
        // names are judged against the whole chapter: a claim may refer to a speaker by pronoun and the name stands in the verse before
        checkText(cl.statement_en, { where: `${cw}.statement_en`, ayat: chAyat, loose: false, subject }, ctx, issues, {});
      }
    }
    const packed = packClaims(c.claims);
    const claimsText = c.claims.map((x) => x.statement_en).join(" ");

    // every verse the chapter lists should be cited by at least one claim
    const claimed = ayatOfRanges(c.claims.flatMap((x) => x.verses));
    const unclaimed = [...chAyat].filter((k) => !claimed.has(k));
    if (unclaimed.length) warn("verse-unclaimed", `${w}.verses`, `verses listed for the chapter but cited by no claim: ${compact(unclaimed)}`);

    // title is text too
    checkText(c.title_en, { where: `${w}.title_en`, ayat: chAyat, loose: false, title: true, subject }, ctx, issues, { claimIds: ids, claimStatements: packed });

    // texts
    const fields: Array<[TextField, string | null]> = [
      ["summary_md", c.summary_md],
      ["body_md", c.body_md],
      ["deep_md", c.deep_md],
      ["kids_md", c.kids_md],
      ["lessons_md", c.lessons_md],
      ["unknowns_md", c.unknowns_md],
    ];
    for (const [field, text] of fields) {
      if (text === null || text.trim() === "") {
        if (field === "unknowns_md") warn("unknowns-empty", `${w}.${field}`, "unknowns_md is empty; say what the verses do not establish");
        else if (field !== "body_md" && field !== "summary_md") warn("mode-empty", `${w}.${field}`, `${field} is empty (renders as "Not established yet")`);
        continue;
      }
      const loose = field === "unknowns_md";
      const fw = `${w}.${field}`;
      checkText(text, { where: fw, ayat: chAyat, loose, subject }, ctx, issues, { claimIds: ids, claimStatements: packed });
      if (!loose) {
        for (const unit of splitUnits(text)) {
          const m = markerIds(unit);
          if (m.length === 0) err("no-claim", fw, `sentence with no claim marker: "${trim(unit)}"`);
          for (const id of m) {
            if (!ids.has(id)) err("claim-unknown", fw, `marker ${id} is not a claim of this chapter`);
            else cited.add(id);
          }
        }
      }
      if (field === "lessons_md" && !text.trimStart().startsWith(LESSONS_PREFIX)) err("lessons-label", fw, `lessons_md must start with "${LESSONS_PREFIX}"`);
      if (field === "unknowns_md" && markerIds(text).length) warn("unknowns-marker", fw, "claim markers in unknowns_md are ignored (it states what is NOT established)");
      if ((RESTATING_FIELDS as readonly string[]).includes(field)) {
        // restating modes: every name and number already appears in the chapter's claims
        const stripped = text.replace(MARKER, " ").replace(VERSE_REF, " ");
        const claimsLower = claimsText.toLowerCase();
        const toks = new Set<string>();
        for (const unit of splitUnits(stripped)) for (const { word } of capitalised(unit)) if (Object.keys(ctx.anchors.names).some((n) => KEY_OF(n) === KEY_OF(word))) toks.add(KEY_OF(word));
        for (const m of stripped.matchAll(NUMBER_WORDS)) toks.add(KEY_OF(m[0]));
        for (const t of toks) {
          if (!new RegExp(`\\b${t}`, "i").test(claimsLower)) err("adds-fact", fw, `"${t}" is not in any claim of this chapter; summary, kids and lessons may only restate claims`);
        }
      }
    }
    for (const id of ids) {
      if (!cited.has(id)) warn("claim-unused", `${w}.claims.${id}`, "claim is not cited by any text of the chapter");
    }
  });

  // file-level uncertainties
  d.uncertainties_en.forEach((u, i) => {
    const labelled = u.startsWith(HADITH_LATER_PREFIX);
    checkText(labelled ? u.slice(HADITH_LATER_PREFIX.length) : u, { where: `uncertainties_en[${i}]`, ayat: subjectAyat, loose: true, subject }, ctx, issues, {});
  });
  if (!d.uncertainties_en.some((u) => u.startsWith(HADITH_LATER_PREFIX))) warn("hadith-later", "uncertainties_en", `no "${HADITH_LATER_PREFIX}" entry; list the hadith that still have to be added (or say none are expected)`);

  // coverage of the inventory (information for the reviewer, not an error)
  if (inv) {
    const missing = [...subjectAyat].filter((k) => !covered.has(k));
    if (missing.length) info("coverage", "chapters", `inventory ayat of "${inv.slug}" not covered by any chapter: ${compact(missing)}`);
  }

  return issues;
}

const trim = (s: string) => (s.length > 80 ? `${s.slice(0, 77)}...` : s);

/** "2:30,2:31,2:32,7:1" -> "2:30-32, 7:1" */
export function compact(keys: string[]): string {
  const by = new Map<number, number[]>();
  for (const k of keys) {
    const [s, a] = k.split(":").map(Number) as [number, number];
    (by.get(s) ?? by.set(s, []).get(s)!).push(a);
  }
  const parts: string[] = [];
  for (const [s, as] of [...by].sort((x, y) => x[0] - y[0])) {
    as.sort((x, y) => x - y);
    let start = as[0]!;
    let prev = start;
    const flush = () => parts.push(start === prev ? `${s}:${start}` : `${s}:${start}-${prev}`);
    for (const a of as.slice(1)) {
      if (a === prev + 1) prev = a;
      else {
        flush();
        start = prev = a;
      }
    }
    flush();
  }
  return parts.join(", ");
}

export const hasErrors = (issues: Issue[]): boolean => issues.some((i) => i.severity === "error");
