/**
 * The static inputs of the story checks: the event inventory, the journey and the imported Quran text, read from
 * content/ (Node only: reads files; used by the CLI, the admin coverage page and the tests).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ContentInputs, DbInputs } from "./checks";
import { ayahCounts, loadQuran } from "@/lib/events/verify";

/** Top-level pages of the site, for the internal-link check (merged with the app directory when it can be read). */
export const KNOWN_TOP_LEVEL_ROUTES = [
  "about", "accessibility", "account", "admin", "asma", "atlas", "community", "compare", "contact", "corrections", "creation", "dreams", "events",
  "genealogy", "guidance", "hadith", "last-hour", "learn", "life-through-ages", "methodology", "mufti", "privacy", "prophets", "qiraat",
  "quran", "review-board", "search", "shifa", "sign-in", "stories", "terms", "timeline",
];

function appRoutes(root: string): string[] {
  const dir = join(root, "src", "app", "[locale]");
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !/^[[(]/.test(d.name))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

interface JourneyFile {
  eras: Array<{ items: Array<{ id: string; type: "prophet" | "milestone"; surahs?: Array<{ passages: string[] }>; refs?: Array<{ kind: string; ref: string }> }> }>;
}
interface InventoryFile {
  items: Array<{ slug: string; title: string; track: string; refs: string[] }>;
}

export function loadContentInputs(root = process.cwd(), db?: DbInputs | null): ContentInputs {
  const inv = JSON.parse(readFileSync(join(root, "content", "events", "inventory.draft.json"), "utf8")) as InventoryFile;
  const journey = JSON.parse(readFileSync(join(root, "content", "journey", "journey.draft.json"), "utf8")) as JourneyFile;
  const stops = journey.eras.flatMap((e) => e.items);
  const refsOf = (s: (typeof stops)[number]) => [
    ...(s.surahs ?? []).flatMap((x) => x.passages),
    ...(s.refs ?? []).filter((r) => r.kind === "quran").map((r) => r.ref.replace(/^Q\s*/, "")),
  ];
  const counts = existsSync(join(root, "content", "quran", "quran.txt")) ? ayahCounts(loadQuran(root)) : [];
  return {
    ayahCounts: counts,
    inventory: inv.items.map((i) => ({ slug: i.slug, title: i.title, track: i.track, refs: i.refs })),
    journey: stops.map((s) => ({ id: s.id, type: s.type, refs: refsOf(s) })),
    routes: {
      topLevel: [...new Set([...KNOWN_TOP_LEVEL_ROUTES, ...appRoutes(root)])],
      prophetIds: stops.map((s) => s.id),
      eventSlugs: [...new Set([...inv.items.map((i) => i.slug), ...(db?.events.map((e) => e.slug) ?? [])])],
      storySlugs: db?.stories.map((s) => s.slug) ?? [],
    },
  };
}
