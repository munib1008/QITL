/**
 * Importing story drafts (content/stories/*.draft.json) as DRAFT rows: stories, chapters, evidence_claims,
 * claim_references and chapter_claims. See docs/STORY_DRAFTS.md.
 *
 * Rules that cannot be relaxed from here:
 *  - everything is written with status 'draft'; this module never writes 'in_review', 'approved' or 'published';
 *  - it never writes editorial_reviews (no review, no publish stays true);
 *  - a story, chapter or claim that is no longer a draft is left alone and reported (a published or reviewed row is
 *    never overwritten by a re-import);
 *  - idempotent: a claim is identified by (chapter, claim id), kept in chapter_claims.anchor ("c1", "c2" ...), a chapter
 *    by (story, anchor); a row is written only when it differs, so a second run changes nothing (and does not bump
 *    the chapter version, which the database does on every change).
 *
 * The database is reached through the small ImportStore interface so the same code runs against Supabase (the CLI,
 * with the service-role key from the environment) and against PGlite (the tests).
 */
import type { DraftChapter, StoryDraft, VerseRange } from "./draft";
import { stripMarkers } from "./draft";

export type Row = Record<string, unknown>;
export type Filter = Record<string, string | number | null>;

export const IMPORT_TABLES = ["stories", "chapters", "evidence_claims", "claim_references", "chapter_claims", "event_stories", "historical_events", "people"] as const;
export type ImportTable = (typeof IMPORT_TABLES)[number];

export interface ImportStore {
  select(table: ImportTable, filter: Filter): Promise<Row[]>;
  insert(table: ImportTable, row: Row): Promise<Row>;
  update(table: ImportTable, id: string, patch: Row): Promise<void>;
  remove(table: ImportTable, filter: Filter): Promise<void>;
}

/** Reads nothing, writes nothing: the default dry run (no database). */
export class NullStore implements ImportStore {
  async select(): Promise<Row[]> {
    return [];
  }
  async insert(): Promise<Row> {
    throw new Error("NullStore cannot write");
  }
  async update(): Promise<void> {
    throw new Error("NullStore cannot write");
  }
  async remove(): Promise<void> {
    throw new Error("NullStore cannot write");
  }
}

export interface Action {
  level: "create" | "update" | "delete" | "skip" | "warn";
  what: string;
  detail?: string;
}
export interface ImportReport {
  slug: string;
  actions: Action[];
  counts: { created: number; updated: number; deleted: number; skipped: number; warnings: number };
}

const DRAFT = "draft" as const;

function storySummary(d: StoryDraft): string {
  return `DRAFT, pending scholarly review. Chapters: ${d.chapters.map((c) => c.title_en).join("; ")}.`.slice(0, 1000);
}

const refKey = (r: { surah: number; from: number; to: number }) => `${r.surah}:${r.from}-${r.to}`;

export function chapterRow(c: DraftChapter, eventId: string | null): Row {
  return {
    position: c.position,
    title: c.title_en,
    body_md: stripMarkers(c.body_md),
    summary_md: stripMarkers(c.summary_md),
    deep_md: c.deep_md === null ? null : stripMarkers(c.deep_md),
    kids_md: c.kids_md === null ? null : stripMarkers(c.kids_md),
    lessons_md: c.lessons_md === null ? null : stripMarkers(c.lessons_md),
    unknowns_md: c.unknowns_md,
    event_id: eventId,
  };
}

const differs = (current: Row, wanted: Row): string[] => Object.keys(wanted).filter((k) => (current[k] ?? null) !== (wanted[k] ?? null));

export async function importDraft(store: ImportStore, d: StoryDraft, opts: { apply: boolean; offline?: boolean }): Promise<ImportReport> {
  const actions: Action[] = [];
  const act = (level: Action["level"], what: string, detail?: string) => actions.push({ level, what, detail });
  const write = opts.apply;

  // ---- story
  const eventRow = (await store.select("historical_events", { slug: d.subject.event_slug }))[0];
  const personRow = (await store.select("people", { slug: d.slug }))[0];
  let storyId: string | null = null;
  const wantedStory: Row = { title: d.title_en, title_ar: d.title_ar, summary: storySummary(d) };
  const existing = (await store.select("stories", { slug: d.slug }))[0];
  if (!existing) {
    act("create", `story ${d.slug}`, "status draft");
    if (write) storyId = String((await store.insert("stories", { slug: d.slug, ...wantedStory, person_id: personRow ? personRow.id : null, status: DRAFT })).id);
  } else {
    storyId = String(existing.id);
    if (existing.status !== DRAFT) {
      act("skip", `story ${d.slug}`, `status is ${String(existing.status)}, not draft: left untouched, and so are its chapters`);
      return finish(d.slug, actions);
    }
    const ch = differs(existing, wantedStory);
    if (ch.length) {
      act("update", `story ${d.slug}`, ch.join(", "));
      if (write) await store.update("stories", storyId, wantedStory);
    }
  }
  if (!eventRow && opts.offline) act("create", `event link ${d.subject.event_slug}`, "if the event exists");
  else if (!eventRow) act("warn", `event ${d.subject.event_slug}`, "no such row in historical_events; the story is not linked to an event");
  else if (storyId) {
    const link = await store.select("event_stories", { event_id: String(eventRow.id), story_id: storyId });
    if (link.length === 0) {
      act("create", `event link ${d.subject.event_slug}`);
      if (write) await store.insert("event_stories", { event_id: eventRow.id, story_id: storyId });
    }
  } else act("create", `event link ${d.subject.event_slug}`);

  // ---- chapters
  for (const c of d.chapters) {
    let eventId: string | null = null;
    if (c.event_slug) {
      const ev = (await store.select("historical_events", { slug: c.event_slug }))[0];
      if (ev) eventId = String(ev.id);
      else if (!opts.offline) act("warn", `chapter ${c.anchor}`, `event ${c.event_slug} not in historical_events; chapter event link left empty`);
    }
    const wanted = chapterRow(c, eventId);
    const cur = storyId ? (await store.select("chapters", { story_id: storyId, anchor: c.anchor }))[0] : undefined;
    let chapterId: string | null = null;
    if (!cur) {
      act("create", `chapter ${c.anchor}`, `position ${c.position}, status draft`);
      if (write) chapterId = String((await store.insert("chapters", { story_id: storyId, anchor: c.anchor, ...wanted, status: DRAFT })).id);
    } else {
      chapterId = String(cur.id);
      if (cur.status !== DRAFT) {
        act("skip", `chapter ${c.anchor}`, `status is ${String(cur.status)}, not draft: text and claims left untouched`);
        continue;
      }
      const ch = differs(cur, wanted);
      if (ch.length) {
        act("update", `chapter ${c.anchor}`, ch.join(", "));
        if (write) await store.update("chapters", chapterId, wanted);
      }
    }

    // ---- claims
    const links = chapterId ? await store.select("chapter_claims", { chapter_id: chapterId }) : [];
    const byAnchor = new Map(links.map((l) => [String(l.anchor), l]));
    for (const cl of c.claims) {
      const link = byAnchor.get(cl.id);
      const refs = cl.verses.map((v) => ({ surah: v.surah, from: v.from, to: v.to }));
      if (!link) {
        act("create", `claim ${c.anchor}/${cl.id}`, `${refs.length} Quran reference(s), status draft`);
        if (write && chapterId) {
          const claim = await store.insert("evidence_claims", { statement: cl.statement_en, evidence: "quran", status: DRAFT });
          for (const r of refs) await store.insert("claim_references", { claim_id: claim.id, kind: "quran", quran_surah: r.surah, quran_ayah_from: r.from, quran_ayah_to: r.to });
          await store.insert("chapter_claims", { chapter_id: chapterId, claim_id: claim.id, anchor: cl.id });
        }
        continue;
      }
      const claimId = String(link.claim_id);
      const claim = (await store.select("evidence_claims", { id: claimId }))[0];
      if (!claim) {
        act("warn", `claim ${c.anchor}/${cl.id}`, "linked claim row not found");
        continue;
      }
      if (claim.status !== DRAFT) {
        act("skip", `claim ${c.anchor}/${cl.id}`, `status is ${String(claim.status)}, not draft: left untouched${claim.statement === cl.statement_en ? "" : " (the draft text differs)"}`);
        continue;
      }
      if (claim.statement !== cl.statement_en) {
        act("update", `claim ${c.anchor}/${cl.id}`, "statement");
        if (write) await store.update("evidence_claims", claimId, { statement: cl.statement_en });
      }
      const have = (await store.select("claim_references", { claim_id: claimId, kind: "quran" }))
        .map((r) => refKey({ surah: Number(r.quran_surah), from: Number(r.quran_ayah_from), to: Number(r.quran_ayah_to ?? r.quran_ayah_from) }))
        .sort();
      const want = refs.map(refKey).sort();
      if (have.join("|") !== want.join("|")) {
        act("update", `claim ${c.anchor}/${cl.id}`, "references");
        if (write) {
          await store.remove("claim_references", { claim_id: claimId, kind: "quran" });
          for (const r of refs) await store.insert("claim_references", { claim_id: claimId, kind: "quran", quran_surah: r.surah, quran_ayah_from: r.from, quran_ayah_to: r.to });
        }
      }
    }
    // claims that left the draft (only ones this importer made: anchor c<number>, still draft)
    const keep = new Set(c.claims.map((x) => x.id));
    for (const l of links) {
      const a = String(l.anchor);
      if (!/^c\d+$/.test(a) || keep.has(a)) continue;
      const claim = (await store.select("evidence_claims", { id: String(l.claim_id) }))[0];
      if (claim && claim.status === DRAFT) {
        act("delete", `claim ${c.anchor}/${a}`, "no longer in the draft file");
        if (write && chapterId) {
          await store.remove("chapter_claims", { chapter_id: chapterId, claim_id: String(l.claim_id) });
          await store.remove("evidence_claims", { id: String(l.claim_id) });
        }
      } else act("warn", `claim ${c.anchor}/${a}`, "no longer in the draft file but not a draft: left in place");
    }
  }
  return finish(d.slug, actions);
}

function finish(slug: string, actions: Action[]): ImportReport {
  const n = (l: Action["level"]) => actions.filter((a) => a.level === l).length;
  return { slug, actions, counts: { created: n("create"), updated: n("update"), deleted: n("delete"), skipped: n("skip"), warnings: n("warn") } };
}

export type { VerseRange };
