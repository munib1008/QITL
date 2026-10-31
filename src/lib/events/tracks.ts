/**
 * The six tracks of the Complete Timeline and the filter logic behind ?tracks=. Pure: used by the server page, the
 * client filter and the tests. Each track has a colour AND a shape (never colour alone).
 */
export const TRACK_IDS = ["prophets", "people", "communities", "events", "parables", "seerah"] as const;
export type TrackId = (typeof TRACK_IDS)[number];

/** Non-figurative marks: no person, no animal. */
export type TrackShape = "star" | "rings" | "triad" | "diamond" | "spiral" | "scroll";
export const TRACK_SHAPE: Record<TrackId, TrackShape> = {
  prophets: "star",
  people: "rings",
  communities: "triad",
  events: "diamond",
  parables: "spiral",
  seerah: "scroll",
};

export function isTrack(v: unknown): v is TrackId {
  return typeof v === "string" && (TRACK_IDS as readonly string[]).includes(v);
}

type Param = string | string[] | undefined;

/**
 * ?tracks=prophets,events (or repeated tracks=…): the selected tracks in canonical order. Absent → every track on.
 * "-" or "none" → no track on (an explicit empty selection). Unknown names are ignored; if nothing valid is left the
 * default (all) applies, so a mangled link never hides the atlas.
 */
export function parseTracks(p: Param): TrackId[] {
  if (p === undefined) return [...TRACK_IDS];
  const raw = (Array.isArray(p) ? p : [p]).flatMap((s) => s.split(",")).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (raw.length === 0) return [...TRACK_IDS];
  if (raw.every((s) => s === "-" || s === "none")) return [];
  const set = new Set(raw.filter(isTrack));
  if (set.size === 0) return [...TRACK_IDS];
  return TRACK_IDS.filter((t) => set.has(t));
}

/** The query value for a selection, or undefined when every track is on (the default stays out of the URL). */
export function serializeTracks(selected: readonly TrackId[]): string | undefined {
  if (selected.length === TRACK_IDS.length) return undefined;
  if (selected.length === 0) return "-";
  return TRACK_IDS.filter((t) => selected.includes(t)).join(",");
}

export function toggleTrack(selected: readonly TrackId[], id: TrackId): TrackId[] {
  return TRACK_IDS.filter((t) => (t === id ? !selected.includes(t) : selected.includes(t)));
}

export function filterByTracks<T extends { track: TrackId }>(items: readonly T[], selected: readonly TrackId[]): T[] {
  return items.filter((i) => selected.includes(i.track));
}

/** /timeline?view=complete&tracks=… for a selection. */
export function completeHref(selected: readonly TrackId[]): string {
  const t = serializeTracks(selected);
  return t ? `/timeline?view=complete&tracks=${t}` : "/timeline?view=complete";
}
