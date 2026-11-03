/**
 * Study logic for the memorisation studio: a Leitner-box spaced-repetition scheduler, a deterministic quiz maker and the
 * on-device state. Pure and unit-tested. There are no points, streak rewards or "hasanat": a card only has a box and a due
 * time, and the state never leaves the browser unless a signed-in reader chooses to sync it.
 */
export const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16] as const;
export const MAX_BOX = INTERVAL_DAYS.length - 1;
const DAY = 86_400_000;
const RETRY_MS = 10 * 60_000;

export interface Card {
  slug: string;
  box: number;
  due: number | null;
  seen: number;
  recalled: number;
  last: number | null;
}

export const newCard = (slug: string): Card => ({ slug, box: 0, due: null, seen: 0, recalled: 0, last: null });

export function review(card: Card, correct: boolean, now: number): Card {
  const box = correct ? Math.min(MAX_BOX, card.box + 1) : 0;
  return { ...card, box, seen: card.seen + 1, recalled: card.recalled + (correct ? 1 : 0), last: now, due: correct ? now + INTERVAL_DAYS[box]! * DAY : now + RETRY_MS };
}

export const isDue = (c: Card, now: number): boolean => c.due !== null && c.due <= now;

export function queue(cards: Record<string, Card>, slugs: string[], now: number): { due: string[]; fresh: string[] } {
  const due = slugs.filter((s) => cards[s] && isDue(cards[s]!, now)).sort((a, b) => (cards[a]!.due ?? 0) - (cards[b]!.due ?? 0));
  const fresh = slugs.filter((s) => !cards[s]);
  return { due, fresh };
}

/** Small deterministic generator (mulberry32) so a quiz can be reproduced from its seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: readonly T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export interface QuizItem {
  slug: string;
  meaning: string;
}
export interface QuizQuestion {
  kind: "toMeaning" | "toArabic";
  /** the Name asked about */
  slug: string;
  /** four slugs (fewer if there are fewer Names), one of them the answer, in display order */
  options: string[];
}

export function makeQuiz(items: QuizItem[], seed: number, count: number): QuizQuestion[] {
  const rand = rng(seed);
  const usable = items.filter((i) => i.meaning.trim().length > 0);
  if (usable.length === 0) return [];
  const picked = shuffle(usable, rand).slice(0, Math.min(count, usable.length));
  return picked.map((it, i) => {
    const distractors = shuffle(usable.filter((o) => o.slug !== it.slug && o.meaning !== it.meaning), rand).slice(0, 3);
    return { kind: i % 2 === 0 ? "toMeaning" : "toArabic", slug: it.slug, options: shuffle([it, ...distractors], rand).map((o) => o.slug) };
  });
}

export interface StudyState {
  v: 1;
  cards: Record<string, Card>;
  saved: string[];
  notes: Record<string, string>;
}
export const emptyState = (): StudyState => ({ v: 1, cards: {}, saved: [], notes: {} });
export const STUDY_KEY = "qitl.asma.study.v1";

/** Reads whatever was stored, tolerating damage: anything that does not fit is dropped. */
export function parseState(raw: string | null): StudyState {
  if (!raw) return emptyState();
  try {
    const j = JSON.parse(raw) as Partial<StudyState>;
    const s = emptyState();
    if (j && typeof j === "object") {
      for (const [slug, c] of Object.entries(j.cards ?? {})) {
        const k = c as Partial<Card>;
        if (/^[a-z][a-z0-9-]{1,60}$/.test(slug) && typeof k.box === "number" && k.box >= 0 && k.box <= MAX_BOX)
          s.cards[slug] = { slug, box: k.box, due: typeof k.due === "number" ? k.due : null, seen: Math.max(0, Number(k.seen) || 0), recalled: Math.max(0, Math.min(Number(k.recalled) || 0, Number(k.seen) || 0)), last: typeof k.last === "number" ? k.last : null };
      }
      s.saved = Array.isArray(j.saved) ? j.saved.filter((x): x is string => typeof x === "string" && /^[a-z][a-z0-9-]{1,60}$/.test(x)) : [];
      for (const [slug, n] of Object.entries(j.notes ?? {})) if (typeof n === "string" && /^[a-z][a-z0-9-]{1,60}$/.test(slug)) s.notes[slug] = n.slice(0, 2000);
    }
    return s;
  } catch {
    return emptyState();
  }
}
