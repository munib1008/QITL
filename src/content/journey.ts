import { z } from "zod";
import raw from "@content/journey/journey.draft.json";

/**
 * Typed loader for content/journey/journey.draft.json (schema ziq.journey.v1).
 * The content is DRAFT until the scholarly review board approves it; the loader exposes `status`
 * so every page that renders it shows the draft badge. A schema error fails the build.
 */

export const EvidenceKind = z.enum(["quran", "hadith", "scholar", "estimate", "disputed", "unknown"]);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

export const EraCertainty = z.enum(["relative", "estimate", "traditional", "exact", "unknown", "disputed"]);
export type EraCertainty = z.infer<typeof EraCertainty>;

export const PlaceCertainty = z.enum(["point", "region", "hypothesis", "disputed", "unknown"]);
export type PlaceCertainty = z.infer<typeof PlaceCertainty>;

/** An ayah reference such as "12:4" or "2:30–39" (en dash or hyphen). */
export const AyahRange = z.string().regex(/^\d{1,3}:\d{1,3}([–-]\d{1,3})?$/, "expected surah:ayah or surah:from–to");

const Surah = z.object({
  number: z.number().int().min(1).max(114),
  name: z.string().min(1),
  arabic: z.string().min(1),
  passages: z.array(AyahRange).min(1),
  named: z.boolean().optional(),
});

const Ref = z.object({
  kind: z.enum(["quran", "hadith", "scholar"]),
  ref: z.string().min(1),
  label: z.string().min(1),
});

const Milestone = z.object({
  when: z.string(),
  text: z.string(),
  certainty: z.enum(["exact", "estimate", "traditional", "unknown"]),
});

/** A story movement. `summary` may be absent while its wording is drafted (summary_status says so). */
const StoryStep = z.object({
  title: z.string().min(1),
  summary: z.string().min(1).optional(),
  summary_status: z.string().optional(),
  ayat: AyahRange,
});

export const JourneyItem = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    type: z.enum(["prophet", "milestone"]),
    chapter: z.string().regex(/^\d{2}$/),
    dated: z.boolean(),
    name: z.string().min(1),
    arabicName: z.string().min(1),
    honorific: z.string(),
    subtitle: z.string().optional(),
    era: z.object({ label: z.string().min(1), certainty: EraCertainty }),
    ageMarker: z.string().optional(),
    summary: z.string().min(1),
    milestones: z.array(Milestone).optional(),
    surahs: z.array(Surah).optional(),
    refs: z.array(Ref).optional(),
    place: z.object({ name: z.string(), certainty: PlaceCertainty }).optional(),
    evidence: z.array(EvidenceKind).optional(),
    order: z.object({ label: z.string(), disputed: z.boolean().optional() }).optional(),
    note: z.string().optional(),
    points: z.union([z.literal(8), z.literal(10), z.literal(12)]).optional(),
    story: z.array(StoryStep).optional(),
  })
  .superRefine((it, ctx) => {
    if (it.type === "prophet" && !it.surahs?.length)
      ctx.addIssue({ code: "custom", message: `${it.id}: a prophet stop needs related surahs` });
    if (it.type === "milestone" && !it.refs?.length)
      ctx.addIssue({ code: "custom", message: `${it.id}: a milestone stop needs sources (refs)` });
  });
export type JourneyItem = z.infer<typeof JourneyItem>;

export const JourneyEra = z.object({ title: z.string(), note: z.string().optional(), items: z.array(JourneyItem).min(1) });
export type JourneyEra = z.infer<typeof JourneyEra>;

export const Journey = z
  .object({
    schema: z.literal("ziq.journey.v1"),
    status: z.enum(["draft", "in_review", "approved", "published"]),
    review: z.object({ state: z.string(), rule: z.string() }).optional(),
    eras: z.array(JourneyEra).min(1),
  })
  .superRefine((j, ctx) => {
    const ids = j.eras.flatMap((e) => e.items.map((i) => i.id));
    const dup = ids.find((id, i) => ids.indexOf(id) !== i);
    if (dup) ctx.addIssue({ code: "custom", message: `duplicate journey id: ${dup}` });
  });
export type Journey = z.infer<typeof Journey>;

export function parseJourney(data: unknown): Journey {
  const res = Journey.safeParse(data);
  if (!res.success) throw new Error(`journey.draft.json failed ziq.journey.v1 validation:\n${res.error.toString()}`);
  return res.data;
}

let cached: Journey | undefined;
export function getJourney(): Journey {
  cached ??= parseJourney(raw);
  return cached;
}

/** Every stop in journey order. */
export function journeyStops(j: Journey = getJourney()): JourneyItem[] {
  return j.eras.flatMap((e) => e.items);
}

export interface StopPosition {
  item: JourneyItem;
  index: number; // 0-based in the full journey
  total: number;
  era: JourneyEra;
  eraIndex: number; // 0-based
  indexInEra: number; // 0-based
  prev?: JourneyItem;
  next?: JourneyItem;
}

export function findStop(id: string, j: Journey = getJourney()): StopPosition | undefined {
  const all = journeyStops(j);
  const index = all.findIndex((s) => s.id === id);
  if (index < 0) return undefined;
  const eraIndex = j.eras.findIndex((e) => e.items.some((s) => s.id === id));
  const era = j.eras[eraIndex]!;
  return {
    item: all[index]!,
    index,
    total: all.length,
    era,
    eraIndex,
    indexInEra: era.items.findIndex((s) => s.id === id),
    prev: all[index - 1],
    next: all[index + 1],
  };
}

export { ERA_TEXT, PLACE_TEXT } from "./labels";
